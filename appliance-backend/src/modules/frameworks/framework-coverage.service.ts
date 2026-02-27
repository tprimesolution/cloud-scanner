import { Injectable } from "@nestjs/common";
import { ControlReadinessStatus, CriteriaScopeStatus } from "@prisma/client";
import { PrismaService } from "../../shared/prisma.service";

type CheckState = "PASS" | "FAIL" | "INFO";

@Injectable()
export class FrameworkCoverageService {
  constructor(private readonly prisma: PrismaService) {}

  async listFrameworks() {
    const frameworks = await this.prisma.frameworkCatalog.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, version: true, category: true, region: true },
    });

    const latestStatuses = await this.getLatestFrameworkStatuses(frameworks.map((f) => f.id));
    return frameworks.map((f) => {
      const status = latestStatuses.get(f.id);
      return {
        id: f.id,
        name: f.name,
        version: f.version,
        category: f.category,
        region: f.region,
        framework_readiness_percent: status?.readinessPercent ?? 0,
        criteria_in_scope: status?.inScopeCriteria ?? 0,
        criteria_out_of_scope: status?.outOfScopeCriteria ?? 0,
        controls_setup_count: status?.totalControls ?? 0,
        automated_checks_count: status?.totalAutomatedChecks ?? 0,
      };
    });
  }

  async getFrameworkSummary(frameworkId: string) {
    const framework = await this.prisma.frameworkCatalog.findUnique({
      where: { id: frameworkId },
      select: { id: true, name: true },
    });
    if (!framework) return null;

    const latest = await this.prisma.frameworkStatus.findFirst({
      where: { frameworkId },
      orderBy: { createdAt: "desc" },
      select: {
        scanId: true,
        readinessPercent: true,
        totalCriteria: true,
        totalControls: true,
        totalAutomatedChecks: true,
      },
    });

    const areas = await this.prisma.frameworkArea.count({ where: { frameworkId } });
    return {
      framework_id: framework.id,
      framework_name: framework.name,
      areas,
      criteria: latest?.totalCriteria ?? 0,
      controls: latest?.totalControls ?? 0,
      automated_checks: latest?.totalAutomatedChecks ?? 0,
      framework_readiness_percent: latest?.readinessPercent ?? 0,
      scan_id: latest?.scanId ?? null,
    };
  }

  async getFrameworkCriteria(frameworkId: string) {
    const latest = await this.prisma.frameworkStatus.findFirst({
      where: { frameworkId },
      orderBy: { createdAt: "desc" },
      select: { scanId: true },
    });
    const scanId = latest?.scanId;

    const criteria = await this.prisma.frameworkCriteria.findMany({
      where: { area: { frameworkId } },
      include: {
        controlMappings: { select: { controlId: true } },
        criteriaStatus: scanId
          ? {
              where: { scanId },
              select: { readinessPercent: true, readyControls: true, totalControls: true },
              take: 1,
            }
          : false,
      },
      orderBy: [{ area: { name: "asc" } }, { code: "asc" }],
    });

    const checksByControl = await this.getCheckCountByControl();
    return criteria.map((c) => {
      const status = scanId ? c.criteriaStatus?.[0] : undefined;
      const automatedChecks = c.controlMappings.reduce(
        (sum, m) => sum + (checksByControl.get(m.controlId) ?? 0),
        0
      );
      return {
        criteria_id: c.id,
        criteria_code: c.code,
        description: c.description,
        scope: c.scopeStatus,
        mapped_controls: c.controlMappings.length,
        automated_checks: automatedChecks,
        readiness_percent: status?.readinessPercent ?? 0,
        ready_controls: status?.readyControls ?? 0,
        total_controls: status?.totalControls ?? c.controlMappings.length,
      };
    });
  }

  async setCriteriaScope(criteriaId: string, scope: CriteriaScopeStatus) {
    return this.prisma.frameworkCriteria.update({
      where: { id: criteriaId },
      data: { scopeStatus: scope },
      select: { id: true, code: true, scopeStatus: true },
    });
  }

  async getCriteriaControls(criteriaId: string) {
    const latestScan = await this.prisma.criteriaStatus.findFirst({
      where: { criteriaId },
      orderBy: { createdAt: "desc" },
      select: { scanId: true },
    });

    const mappings = await this.prisma.criteriaControlMapping.findMany({
      where: { criteriaId },
      include: {
        control: {
          include: {
            controlStatus: latestScan?.scanId
              ? { where: { scanId: latestScan.scanId }, take: 1 }
              : false,
          },
        },
      },
    });

    const checksByControl = await this.getCheckCountByControl();
    return mappings.map((m) => ({
      control_id: m.control.id,
      name: m.control.name,
      domain: m.control.domain,
      owner: m.control.owner,
      automated_checks: checksByControl.get(m.control.id) ?? 0,
      readiness_percent: m.control.controlStatus?.[0]?.readinessPercent ?? 0,
      status: m.control.controlStatus?.[0]?.status ?? ControlReadinessStatus.NOT_READY,
    }));
  }

  async getControlChecks(controlId: string) {
    const latestStatus = await this.prisma.controlStatus.findFirst({
      where: { controlId },
      orderBy: { createdAt: "desc" },
      select: { scanId: true },
    });
    const scanId = latestStatus?.scanId;
    const execution = scanId ? await this.getCheckExecutionState(scanId) : new Map<string, CheckState>();

    const mappings = await this.prisma.controlCheckMapping.findMany({
      where: { controlId },
      orderBy: { checkId: "asc" },
      select: { checkId: true },
    });
    return {
      control_id: controlId,
      scan_id: scanId ?? null,
      checks: mappings.map((m) => ({
        check_id: m.checkId,
        status: execution.get(m.checkId) ?? "NOT_EVALUATED",
      })),
    };
  }

  async aggregateScan(scanId: string): Promise<void> {
    await this.syncControlCheckMappings();

    const frameworks = await this.prisma.frameworkCatalog.findMany({
      include: {
        areas: {
          include: {
            criteria: {
              include: {
                controlMappings: {
                  include: {
                    control: {
                      include: {
                        checkMappings: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (frameworks.length === 0) return;

    const execution = await this.getCheckExecutionState(scanId);

    for (const framework of frameworks) {
      let readyCriteria = 0;
      let inScopeCriteria = 0;
      let outOfScopeCriteria = 0;
      let totalControls = 0;
      let totalChecks = 0;

      for (const area of framework.areas) {
        for (const criteria of area.criteria) {
          const controls = criteria.controlMappings.map((m) => m.control);
          totalControls += controls.length;
          totalChecks += controls.reduce((sum, c) => sum + c.checkMappings.length, 0);

          let readyControls = 0;
          for (const control of controls) {
            const checks = control.checkMappings.map((m) => m.checkId);
            const passed = checks.filter((c) => execution.get(c) === "PASS").length;
            const total = checks.length;
            const readinessPercent = total > 0 ? Math.round((passed / total) * 100) : 0;
            const status =
              readinessPercent === 100 && total > 0
                ? ControlReadinessStatus.READY
                : readinessPercent > 0
                ? ControlReadinessStatus.PARTIAL
                : ControlReadinessStatus.NOT_READY;

            if (status === ControlReadinessStatus.READY) readyControls += 1;

            await this.prisma.controlStatus.upsert({
              where: { controlId_scanId: { controlId: control.id, scanId } },
              create: { controlId: control.id, scanId, readinessPercent, status },
              update: { readinessPercent, status },
            });
          }

          const controlCount = controls.length;
          const criteriaReadiness = controlCount > 0 ? Math.round((readyControls / controlCount) * 100) : 0;
          await this.prisma.criteriaStatus.upsert({
            where: { criteriaId_scanId: { criteriaId: criteria.id, scanId } },
            create: {
              criteriaId: criteria.id,
              scanId,
              readinessPercent: criteriaReadiness,
              readyControls,
              totalControls: controlCount,
            },
            update: {
              readinessPercent: criteriaReadiness,
              readyControls,
              totalControls: controlCount,
            },
          });

          if (criteria.scopeStatus === CriteriaScopeStatus.IN_SCOPE) {
            inScopeCriteria += 1;
            if (criteriaReadiness === 100) readyCriteria += 1;
          } else {
            outOfScopeCriteria += 1;
          }
        }
      }

      const frameworkReadiness = inScopeCriteria > 0 ? Math.round((readyCriteria / inScopeCriteria) * 100) : 0;
      await this.prisma.frameworkStatus.upsert({
        where: { frameworkId_scanId: { frameworkId: framework.id, scanId } },
        create: {
          frameworkId: framework.id,
          scanId,
          readinessPercent: frameworkReadiness,
          readyCriteria,
          totalCriteria: inScopeCriteria,
          totalControls,
          totalAutomatedChecks: totalChecks,
          inScopeCriteria,
          outOfScopeCriteria,
        },
        update: {
          readinessPercent: frameworkReadiness,
          readyCriteria,
          totalCriteria: inScopeCriteria,
          totalControls,
          totalAutomatedChecks: totalChecks,
          inScopeCriteria,
          outOfScopeCriteria,
        },
      });
    }
  }

  async getPendingScanIds(limit = 20): Promise<string[]> {
    const [jobs, cloudScans] = await Promise.all([
      this.prisma.scanJob.findMany({
        where: { status: "completed" },
        select: { id: true },
        orderBy: { completedAt: "desc" },
        take: limit,
      }),
      this.prisma.cloudSploitScan.findMany({
        where: { status: "completed" },
        select: { id: true },
        orderBy: { completedAt: "desc" },
        take: limit,
      }),
    ]);

    const existing = await this.prisma.frameworkStatus.findMany({
      select: { scanId: true },
      distinct: ["scanId"],
    });
    const seen = new Set(existing.map((s) => s.scanId));
    const all = [...jobs.map((j) => j.id), ...cloudScans.map((s) => s.id)];
    return all.filter((id, idx) => !seen.has(id) && all.indexOf(id) === idx);
  }

  private async getCheckExecutionState(scanId: string): Promise<Map<string, CheckState>> {
    const map = new Map<string, CheckState>();
    const cloudResults = await this.prisma.cloudSploitScanResult.findMany({
      where: { scanId },
      select: { ruleName: true, status: true },
    });
    for (const row of cloudResults) {
      const incoming = this.normalizeStatus(row.status);
      const current = map.get(row.ruleName);
      map.set(row.ruleName, this.pickWorst(current, incoming));
    }

    const findings = await this.prisma.finding.findMany({
      where: { scanJobId: scanId },
      select: { ruleCode: true },
    });
    for (const row of findings) {
      const current = map.get(row.ruleCode);
      map.set(row.ruleCode, this.pickWorst(current, "FAIL"));
    }
    return map;
  }

  private async syncControlCheckMappings(): Promise<void> {
    const controls = await this.prisma.grcControl.findMany({
      select: { id: true, name: true },
    });
    const byName = new Map(controls.map((c) => [c.name.toLowerCase(), c.id]));

    const mappings = await this.prisma.complianceMapping.findMany({
      include: { framework: { select: { framework: true } } },
    });
    for (const m of mappings) {
      const candidates = [
        m.controlId.toLowerCase(),
        `${m.framework.framework}-${m.controlId}`.toLowerCase(),
      ];
      for (const key of candidates) {
        const controlId = byName.get(key);
        if (!controlId) continue;
        await this.prisma.controlCheckMapping.upsert({
          where: { controlId_checkId: { controlId, checkId: m.checkName } },
          create: { controlId, checkId: m.checkName },
          update: {},
        });
      }
    }

    const cloudRules = await this.prisma.cloudSploitRule.findMany({
      select: { ruleName: true, compliance: true },
    });
    for (const rule of cloudRules) {
      const text = JSON.stringify(rule.compliance || {}).toLowerCase();
      for (const control of controls) {
        if (!text.includes(control.name.toLowerCase())) continue;
        await this.prisma.controlCheckMapping.upsert({
          where: { controlId_checkId: { controlId: control.id, checkId: rule.ruleName } },
          create: { controlId: control.id, checkId: rule.ruleName },
          update: {},
        });
      }
    }
  }

  private async getCheckCountByControl(): Promise<Map<string, number>> {
    const all = await this.prisma.controlCheckMapping.findMany({
      select: { controlId: true },
    });
    const out = new Map<string, number>();
    for (const row of all) out.set(row.controlId, (out.get(row.controlId) ?? 0) + 1);
    return out;
  }

  private normalizeStatus(status: string): CheckState {
    const s = (status || "").toUpperCase();
    if (s === "PASS") return "PASS";
    if (s === "FAIL") return "FAIL";
    return "INFO";
  }

  private pickWorst(current: CheckState | undefined, incoming: CheckState): CheckState {
    if (!current) return incoming;
    const priority: Record<CheckState, number> = { FAIL: 3, INFO: 2, PASS: 1 };
    return priority[incoming] > priority[current] ? incoming : current;
  }

  private async getLatestFrameworkStatuses(frameworkIds: string[]) {
    const statuses = await this.prisma.frameworkStatus.findMany({
      where: { frameworkId: { in: frameworkIds } },
      orderBy: { createdAt: "desc" },
    });
    const map = new Map<string, (typeof statuses)[number]>();
    for (const s of statuses) {
      if (!map.has(s.frameworkId)) map.set(s.frameworkId, s);
    }
    return map;
  }
}
