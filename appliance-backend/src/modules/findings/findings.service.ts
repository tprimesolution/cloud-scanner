import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";
import type { Violation } from "../rule-engine/rule-evaluator.service";
import { PluginLoaderService } from "../rule-engine/plugin-loader.service";
import type { ExternalFinding } from "../external-scanner/interfaces/external-finding.interface";

@Injectable()
export class FindingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pluginLoader: PluginLoaderService,
  ) {}

  async upsertFromViolation(violation: Violation, scanJobId?: string): Promise<void> {
    const plugin = this.pluginLoader.getPlugins().find((p) => p.code === violation.ruleCode);
    if (!plugin) return;

    const rule = await this.ensureRule(plugin);
    if (!rule) return;

    await this.prisma.finding.upsert({
      where: {
        resourceId_ruleId: {
          resourceId: violation.resourceId,
          ruleId: rule.id,
        },
      },
      create: {
        resourceId: violation.resourceId,
        resourceType: violation.resourceType,
        ruleId: rule.id,
        ruleCode: violation.ruleCode,
        severity: violation.severity,
        message: violation.message,
        controlIds: violation.controlIds,
        rawResource: violation.rawResource as object,
        scanJobId,
      },
      update: {
        lastSeenAt: new Date(),
        rawResource: violation.rawResource as object,
        scanJobId,
      },
    });
  }

  private async ensureRule(plugin: { code: string; name: string; description?: string; resourceType: string; severity: string; controlIds: string[] }): Promise<{ id: string } | null> {
    const existing = await this.prisma.complianceRule.findUnique({
      where: { code: plugin.code },
    });
    if (existing) return existing;

    const created = await this.prisma.complianceRule.create({
      data: {
        code: plugin.code,
        name: plugin.name,
        description: plugin.description,
        resourceType: plugin.resourceType,
        severity: plugin.severity,
        conditions: [],
        controlIds: plugin.controlIds,
        enabled: true,
      },
    });
    return created;
  }

  async findMany(filter: { status?: string; severity?: string; limit?: number; offset?: number } = {}) {
    const where: { status?: string; severity?: string } = {};
    if (filter.status) where.status = filter.status;
    if (filter.severity) where.severity = filter.severity;

    const [items, total] = await Promise.all([
      this.prisma.finding.findMany({
        where,
        take: filter.limit ?? 50,
        skip: filter.offset ?? 0,
        orderBy: { lastSeenAt: "desc" },
        include: { rule: true },
      }),
      this.prisma.finding.count({ where }),
    ]);

    const enriched = items.map((f) => {
      const exposureType = deriveExposureType(f.resourceType, f.ruleCode, f.message);
      const exploitabilityScore = deriveExploitabilityScore(f.severity, exposureType);
      const attackPathIndicator = deriveAttackPathIndicator(f.ruleCode, exposureType);

      return {
        ...f,
        accountId: (f.rawResource as { accountId?: string } | null)?.accountId ?? undefined,
        region: (f.rawResource as { region?: string } | null)?.region ?? undefined,
        riskCategory: exposureType,
        firstDetected: f.firstSeenAt,
        lastDetected: f.lastSeenAt,
        exposure_type: exposureType,
        exploitability_score: exploitabilityScore,
        attack_path_indicator: attackPathIndicator,
      };
    });

    return { items: enriched, total };
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.prisma.finding.update({
      where: { id },
      data: { status },
    });
  }

  /** Upsert finding from Shield or Guard. Creates ComplianceRule on first sight. */
  async upsertFromExternalFinding(f: ExternalFinding, scanJobId?: string): Promise<void> {
    const rule = await this.ensureExternalRule({
      code: f.ruleCode,
      name: f.ruleName,
      resourceType: f.resourceType,
      severity: f.severity,
      controlIds: f.controlIds,
    });
    if (!rule) return;

    await this.prisma.finding.upsert({
      where: {
        resourceId_ruleId: {
          resourceId: f.resourceId,
          ruleId: rule.id,
        },
      },
      create: {
        resourceId: f.resourceId,
        resourceType: f.resourceType,
        ruleId: rule.id,
        ruleCode: f.ruleCode,
        severity: f.severity,
        message: f.message,
        controlIds: f.controlIds,
        rawResource: f.rawResource as object,
        scanJobId,
      },
      update: {
        lastSeenAt: new Date(),
        rawResource: f.rawResource as object,
        scanJobId,
      },
    });
  }

  private async ensureExternalRule(rule: {
    code: string;
    name: string;
    resourceType: string;
    severity: string;
    controlIds: string[];
  }): Promise<{ id: string } | null> {
    const existing = await this.prisma.complianceRule.findUnique({
      where: { code: rule.code },
    });
    if (existing) return existing;

    return this.prisma.complianceRule.create({
      data: {
        code: rule.code,
        name: rule.name,
        description: null,
        resourceType: rule.resourceType,
        severity: rule.severity,
        conditions: [],
        controlIds: rule.controlIds,
        enabled: true,
      },
    });
  }
}

function deriveExposureType(
  resourceType: string,
  ruleCode: string,
  message: string
): string {
  const code = ruleCode.toLowerCase();
  const msg = message.toLowerCase();

  if (resourceType === "ec2_instance" && (code.includes("public") || msg.includes("public"))) {
    return "PUBLIC_COMPUTE";
  }
  if (["rds_instance", "database"].includes(resourceType) && (code.includes("public") || msg.includes("public"))) {
    return "PUBLIC_DATABASE";
  }
  if (resourceType === "security_group" && (code.includes("sg_open") || msg.includes("0.0.0.0/0"))) {
    return "OPEN_SECURITY_GROUP";
  }
  if (["eks_cluster", "kubernetes_cluster"].includes(resourceType) && (code.includes("eks_public") || msg.includes("public endpoint"))) {
    return "EXPOSED_KUBERNETES";
  }
  if (ruleCode.startsWith("IAM_") || resourceType.startsWith("iam_")) {
    return "IDENTITY_PRIVILEGE";
  }
  return "CONFIG_HARDENING";
}

function deriveExploitabilityScore(severity: string, exposureType: string): number {
  const sev = severity.toLowerCase();
  let base = 20;
  if (sev === "critical") base = 90;
  else if (sev === "high") base = 70;
  else if (sev === "medium") base = 50;
  else base = 30;

  if (exposureType === "PUBLIC_COMPUTE" || exposureType === "PUBLIC_DATABASE") base += 5;
  if (exposureType === "OPEN_SECURITY_GROUP" || exposureType === "EXPOSED_KUBERNETES") base += 3;

  return Math.max(0, Math.min(100, base));
}

function deriveAttackPathIndicator(ruleCode: string, exposureType: string): boolean {
  const lower = ruleCode.toLowerCase();
  if (lower.includes("priv_esc") || lower.includes("iam_priv") || lower.includes("lateral")) {
    return true;
  }
  if (["PUBLIC_COMPUTE", "PUBLIC_DATABASE", "EXPOSED_KUBERNETES"].includes(exposureType)) {
    return true;
  }
  return false;
}

