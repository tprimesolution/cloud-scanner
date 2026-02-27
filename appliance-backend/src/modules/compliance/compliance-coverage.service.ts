import { Injectable } from "@nestjs/common";
import { ComplianceControlState } from "@prisma/client";
import { PrismaService } from "../../shared/prisma.service";

type CheckExecutionState = "PASS" | "FAIL" | "INFO";

export interface ComplianceCoverageRow {
  framework: string;
  total_controls: number;
  passed: number;
  failed: number;
  not_evaluated: number;
  not_applicable: number;
  coverage_percent: number;
  compliance_percent: number;
}

@Injectable()
export class ComplianceCoverageService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateAndPersistCoverage(
    scanId: string,
    opts?: { notApplicableCheckIds?: string[]; provider?: string }
  ): Promise<ComplianceCoverageRow[]> {
    const executedByCheck = await this.getExecutedCheckStatus(scanId);
    const notApplicable = new Set(opts?.notApplicableCheckIds || []);
    const provider = opts?.provider || (await this.inferProvider(scanId));

    const frameworks = await this.prisma.complianceFramework.findMany({
      where: provider ? { provider } : undefined,
      select: { id: true, framework: true, provider: true },
    });
    if (frameworks.length === 0) return [];

    const frameworkIdToName = new Map(frameworks.map((f) => [f.id, f.framework]));
    const mappings = await this.prisma.complianceMapping.findMany({
      where: { frameworkId: { in: frameworks.map((f) => f.id) } },
      select: { frameworkId: true, controlId: true, checkName: true },
    });

    await this.prisma.complianceControlStatus.deleteMany({ where: { scanId } });

    const rows = mappings.map((m) => {
      const framework = frameworkIdToName.get(m.frameworkId) || "UNKNOWN";
      const executed = executedByCheck.get(m.checkName);
      const isNotApplicable = notApplicable.has(m.checkName);
      const status = this.classify(executed, isNotApplicable);

      return {
        scanId,
        framework,
        controlId: m.controlId,
        checkId: m.checkName,
        status,
        isNotApplicable,
      };
    });

    if (rows.length > 0) {
      await this.prisma.complianceControlStatus.createMany({
        data: rows,
      });
    }

    return this.toCoverageRows(rows);
  }

  async getCoverage(scanId: string): Promise<ComplianceCoverageRow[]> {
    const existing = await this.prisma.complianceControlStatus.findMany({
      where: { scanId },
      select: {
        framework: true,
        status: true,
      },
    });

    if (existing.length === 0) {
      return this.calculateAndPersistCoverage(scanId);
    }

    const reconstructed = existing.map((r) => ({
      framework: r.framework,
      status: r.status,
    }));
    return this.toCoverageRows(reconstructed);
  }

  private classify(
    executed: CheckExecutionState | undefined,
    isNotApplicable: boolean
  ): ComplianceControlState {
    if (isNotApplicable) return ComplianceControlState.NOT_APPLICABLE;
    if (executed === "PASS") return ComplianceControlState.PASSED;
    if (executed === "FAIL") return ComplianceControlState.FAILED;
    return ComplianceControlState.NOT_EVALUATED;
  }

  private toCoverageRows(
    rows: Array<{ framework: string; status: ComplianceControlState }>
  ): ComplianceCoverageRow[] {
    const grouped: Record<string, ComplianceCoverageRow> = {};
    for (const row of rows) {
      const framework = row.framework;
      grouped[framework] ??= {
        framework,
        total_controls: 0,
        passed: 0,
        failed: 0,
        not_evaluated: 0,
        not_applicable: 0,
        coverage_percent: 0,
        compliance_percent: 0,
      };
      const current = grouped[framework];
      current.total_controls += 1;
      if (row.status === ComplianceControlState.PASSED) current.passed += 1;
      else if (row.status === ComplianceControlState.FAILED) current.failed += 1;
      else if (row.status === ComplianceControlState.NOT_APPLICABLE) current.not_applicable += 1;
      else current.not_evaluated += 1;
    }

    return Object.values(grouped).map((r) => {
      const applicable = r.passed + r.failed;
      const covered = applicable;
      r.coverage_percent = r.total_controls > 0 ? Math.round((covered / r.total_controls) * 100) : 0;
      r.compliance_percent = applicable > 0 ? Math.round((r.passed / applicable) * 100) : 0;
      return r;
    });
  }

  private async inferProvider(scanId: string): Promise<string | undefined> {
    const cloudSploitScan = await this.prisma.cloudSploitScan.findUnique({
      where: { id: scanId },
      select: { provider: true },
    });
    if (cloudSploitScan?.provider) return cloudSploitScan.provider;
    return undefined;
  }

  private async getExecutedCheckStatus(scanId: string): Promise<Map<string, CheckExecutionState>> {
    const result = new Map<string, CheckExecutionState>();

    const cloudSploitScan = await this.prisma.cloudSploitScan.findUnique({
      where: { id: scanId },
      select: { id: true },
    });
    if (cloudSploitScan) {
      const scanResults = await this.prisma.cloudSploitScanResult.findMany({
        where: { scanId },
        select: { ruleName: true, status: true },
      });
      for (const row of scanResults) {
        const normalized = this.normalizeExecutionState(row.status);
        const current = result.get(row.ruleName);
        result.set(row.ruleName, this.pickWorstState(current, normalized));
      }
    }

    const findings = await this.prisma.finding.findMany({
      where: { scanJobId: scanId },
      select: { ruleCode: true },
    });
    for (const finding of findings) {
      const current = result.get(finding.ruleCode);
      result.set(finding.ruleCode, this.pickWorstState(current, "FAIL"));
    }

    return result;
  }

  private normalizeExecutionState(status: string): CheckExecutionState {
    const s = (status || "").toUpperCase();
    if (s === "FAIL") return "FAIL";
    if (s === "PASS") return "PASS";
    return "INFO";
  }

  private pickWorstState(
    current: CheckExecutionState | undefined,
    incoming: CheckExecutionState
  ): CheckExecutionState {
    if (!current) return incoming;
    const order: Record<CheckExecutionState, number> = { FAIL: 3, INFO: 2, PASS: 1 };
    return order[incoming] > order[current] ? incoming : current;
  }
}
