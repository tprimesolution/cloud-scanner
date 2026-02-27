import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";
import { CloudSploitScanService } from "../scanner-engine/cloudsploit/services/cloudsploit-scan.service";

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudsploitScanService: CloudSploitScanService
  ) {}

  async getMetrics() {
    const latestJob = await this.prisma.scanJob.findFirst({
      where: { status: "completed" },
      orderBy: { completedAt: "desc" },
      select: { id: true },
    });
    const assetCount = latestJob
      ? await this.prisma.collectedResource.count({ where: { scanJobId: latestJob.id } })
      : 0;

    const [findingCount, criticalCount, totalRules] = await Promise.all([
      this.prisma.finding.count({ where: { status: "open" } }),
      this.prisma.finding.count({ where: { status: "open", severity: "critical" } }),
      this.prisma.complianceRule.count({ where: { enabled: true } }),
    ]);

    const frameworks = ["CIS", "SOC2", "HIPAA", "ISO27001", "PCIDSS"].length;
    const frameworkCoverage = totalRules > 0 ? Math.min(100, Math.round((totalRules / (frameworks * 5)) * 100)) : 0;

    const latestCoverage = await this.getLatestCoverageSummary();

    return {
      totalAssets: assetCount,
      activeViolations: findingCount,
      criticalRisks: criticalCount,
      frameworkCoverage: `${frameworkCoverage}%`,
      complianceCoverage: latestCoverage
        ? {
            compliancePercent: latestCoverage.compliancePercent,
            coveragePercent: latestCoverage.coveragePercent,
            passed: latestCoverage.passed,
            failed: latestCoverage.failed,
            notEvaluated: latestCoverage.notEvaluated,
            notApplicable: latestCoverage.notApplicable,
          }
        : null,
      cloudsploitExecution: this.cloudsploitScanService.getExecutionMetrics(),
    };
  }

  async getComplianceScore() {
    const [, totalResources] = await Promise.all([
      this.prisma.finding.count({ where: { status: "open" } }),
      this.prisma.collectedResource.count(),
    ]);

    const lastJob = await this.prisma.scanJob.findFirst({
      where: { status: "completed" },
      orderBy: { completedAt: "desc" },
      select: { resourceCount: true, findingCount: true, completedAt: true },
    });

    const latestCoverage = await this.getLatestCoverageSummary();
    if (latestCoverage) {
      return {
        score: latestCoverage.compliancePercent,
        coveragePercent: latestCoverage.coveragePercent,
        passed: latestCoverage.passed,
        failed: latestCoverage.failed,
        notEvaluated: latestCoverage.notEvaluated,
        notApplicable: latestCoverage.notApplicable,
        lastEvaluated: latestCoverage.lastEvaluated,
        resourceCount: totalResources,
      };
    }

    if (!lastJob || lastJob.resourceCount === 0) {
      return { score: 100, coveragePercent: 0, lastEvaluated: null, resourceCount: 0 };
    }

    const passed = lastJob.resourceCount - lastJob.findingCount;
    const score = Math.round((passed / lastJob.resourceCount) * 100);

    return {
      score: Math.max(0, Math.min(100, score)),
      coveragePercent: 0,
      lastEvaluated: lastJob.completedAt,
      resourceCount: lastJob.resourceCount,
    };
  }

  async getFindingsBySeverity() {
    const counts = await this.prisma.finding.groupBy({
      by: ["severity"],
      where: { status: "open" },
      _count: { id: true },
    });

    const map: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      informational: 0,
    };

    for (const c of counts) {
      map[c.severity] = c._count.id;
    }

    return [
      { name: "Critical", value: map.critical, color: "#f97373" },
      { name: "High", value: map.high, color: "#fb923c" },
      { name: "Medium", value: map.medium, color: "#eab308" },
      { name: "Low", value: map.low, color: "#22c55e" },
    ];
  }

  async getFrameworkScores() {
    const latestScan = await this.prisma.frameworkStatus.findFirst({
      orderBy: { createdAt: "desc" },
      select: { scanId: true },
    });
    if (!latestScan) {
      return [
        { name: "CIS", score: 0, coveragePercent: 0, passed: 0, failed: 0, notEvaluated: 0, notApplicable: 0 },
      ];
    }

    const rows = await this.prisma.frameworkStatus.findMany({
      where: { scanId: latestScan.scanId },
      include: { framework: { select: { name: true } } },
    });
    return rows.map((row) => ({
      name: row.framework.name,
      score: row.readinessPercent,
      coveragePercent:
        row.inScopeCriteria + row.outOfScopeCriteria > 0
          ? Math.round(
              (row.inScopeCriteria / (row.inScopeCriteria + row.outOfScopeCriteria)) * 100
            )
          : 0,
      passed: row.readyCriteria,
      failed: Math.max(0, row.totalCriteria - row.readyCriteria),
      notEvaluated: 0,
      notApplicable: row.outOfScopeCriteria,
    }));
  }

  async getRiskTrend() {
    const jobs = await this.prisma.scanJob.findMany({
      where: { status: "completed" },
      orderBy: { completedAt: "desc" },
      take: 10,
      select: { resourceCount: true, findingCount: true, completedAt: true },
    });

    return jobs.reverse().map((j: { resourceCount: number; findingCount: number; completedAt: Date | null }, i: number) => {
      const passed = j.resourceCount - j.findingCount;
      const score = j.resourceCount > 0 ? Math.round((passed / j.resourceCount) * 100) : 100;
      return {
        week: `Scan ${i + 1}`,
        score: Math.max(0, Math.min(100, score)),
        date: j.completedAt,
      };
    });
  }

  private async getLatestCoverageSummary(): Promise<{
    compliancePercent: number;
    coveragePercent: number;
    passed: number;
    failed: number;
    notEvaluated: number;
    notApplicable: number;
    lastEvaluated: Date;
  } | null> {
    const latest = await this.prisma.frameworkStatus.findFirst({
      orderBy: { createdAt: "desc" },
      select: { scanId: true, createdAt: true },
    });
    if (!latest) return null;

    const [rows, controls] = await Promise.all([
      this.prisma.frameworkStatus.findMany({
        where: { scanId: latest.scanId },
        select: { readyCriteria: true, totalCriteria: true, outOfScopeCriteria: true },
      }),
      this.prisma.controlStatus.findMany({
        where: { scanId: latest.scanId },
        select: { readinessPercent: true },
      }),
    ]);
    const notApplicable = rows.reduce((sum, row) => sum + row.outOfScopeCriteria, 0);
    const passed = controls.filter((c) => c.readinessPercent === 100).length;
    const failed = controls.filter((c) => c.readinessPercent === 0).length;
    const notEvaluated = controls.length - passed - failed;
    const applicable = passed + failed;
    const coverageDenominator = controls.length + notApplicable;
    return {
      compliancePercent: applicable > 0 ? Math.round((passed / applicable) * 100) : 0,
      coveragePercent:
        coverageDenominator > 0
          ? Math.round((applicable / coverageDenominator) * 100)
          : 0,
      passed,
      failed,
      notEvaluated,
      notApplicable,
      lastEvaluated: latest.createdAt,
    };
  }
}
