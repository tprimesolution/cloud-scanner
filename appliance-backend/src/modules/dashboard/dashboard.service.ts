import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";
import { CloudSploitScanService } from "../scanner-engine/cloudsploit/services/cloudsploit-scan.service";

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudsploitScanService: CloudSploitScanService
  ) {}

  /**
   * High-level risk-centric overview used by the redesigned dashboard.
   *
   * This does not change scanning logic; it only aggregates existing findings
   * and scan metadata into risk-focused metrics.
   */
  async getOverview() {
    const latestJob = await this.prisma.scanJob.findFirst({
      where: { status: "completed" },
      orderBy: { completedAt: "desc" },
      select: { id: true, resourceCount: true, findingCount: true, completedAt: true },
    });

    const scanJobId = latestJob?.id;

    // Total assets for the latest completed scan.
    const totalAssets = scanJobId
      ? await this.prisma.collectedResource.count({ where: { scanJobId } })
      : 0;

    // Open findings for the latest scan (fallback to all open if no scan is available).
    const findingWhere = scanJobId
      ? { status: "open" as const, scanJobId }
      : { status: "open" as const };

    const [criticalCount, identityRiskCount, exposureCounts] = await Promise.all([
      this.prisma.finding.count({
        where: { ...findingWhere, severity: "critical" },
      }),
      // Identity risks: IAM-related resource types or IAM-prefixed rule codes.
      this.prisma.finding.count({
        where: {
          ...findingWhere,
          OR: [
            { resourceType: { in: ["iam_user", "iam_role", "iam_policy", "iam_root"] } },
            { ruleCode: { startsWith: "IAM_" } },
          ],
        },
      }),
      this.aggregateExposureCounts(findingWhere),
    ]);

    const exposedAssets =
      exposureCounts.publicEc2 + exposureCounts.publicDatabases + exposureCounts.openSecurityGroups + exposureCounts.exposedKubernetes;

    const riskSummary = {
      total_assets: totalAssets,
      exposed_assets: exposedAssets,
      critical_risks: criticalCount,
      identity_risk_count: identityRiskCount,
      security_posture_score: this.computeSecurityPostureScore(
        criticalCount,
        exposureCounts,
        latestJob?.resourceCount ?? 0
      ),
    };

    const severity_distribution = await this.getFindingsBySeverity();
    const rule_coverage_stats = await this.getBaselineCoverage();

    return {
      risk_summary: riskSummary,
      attack_surface: exposureCounts,
      severity_distribution,
      rule_coverage_stats,
      compliance_scores: {
        baseline: rule_coverage_stats,
      },
    };
  }

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
      guardExecution: this.cloudsploitScanService.getExecutionMetrics(),
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

  /**
   * Aggregate attack surface counts for the given predicate.
   */
  private async aggregateExposureCounts(
    where: { status: "open"; scanJobId?: string }
  ): Promise<{
    publicEc2: number;
    publicDatabases: number;
    openSecurityGroups: number;
    exposedKubernetes: number;
  }> {
    const [publicEc2, publicDatabases, openSecurityGroups, exposedKubernetes] = await Promise.all([
      this.prisma.finding.count({
        where: {
          ...where,
          resourceType: "ec2_instance",
          severity: { in: ["critical", "high"] },
        },
      }),
      this.prisma.finding.count({
        where: {
          ...where,
          resourceType: { in: ["rds_instance", "database", "aurora_cluster"] },
          severity: { in: ["critical", "high"] },
        },
      }),
      this.prisma.finding.count({
        where: {
          ...where,
          resourceType: "security_group",
          severity: { in: ["critical", "high"] },
        },
      }),
      this.prisma.finding.count({
        where: {
          ...where,
          resourceType: { in: ["eks_cluster", "kubernetes_cluster"] },
          severity: { in: ["critical", "high"] },
        },
      }),
    ]);

    return {
      publicEc2,
      publicDatabases,
      openSecurityGroups,
      exposedKubernetes,
    };
  }

  private computeSecurityPostureScore(
    criticalFindings: number,
    exposure: { publicEc2: number; publicDatabases: number; openSecurityGroups: number; exposedKubernetes: number },
    assetCount: number
  ): number {
    // Simple, explainable risk scoring:
    // - Critical findings and exposed assets are heavily weighted.
    const exposureScore =
      exposure.publicEc2 * 5 +
      exposure.publicDatabases * 7 +
      exposure.openSecurityGroups * 3 +
      exposure.exposedKubernetes * 6;

    const rawPenalty = criticalFindings * 4 + exposureScore;
    // Normalize by asset count to avoid penalizing larger environments too harshly.
    const normalization = Math.max(1, assetCount / 50);
    const penalty = Math.min(100, Math.round(rawPenalty / normalization));
    return Math.max(0, 100 - penalty);
  }

  /**
   * Security Baseline Coverage limited to automated frameworks:
   * - CIS
   * - NIST technical control families
   */
  private async getBaselineCoverage() {
    const latest = await this.prisma.complianceControlStatus.findFirst({
      orderBy: { createdAt: "desc" },
      select: { scanId: true },
    });
    if (!latest) {
      return [];
    }

    const frameworks = ["CIS", "NIST-800-53"];

    const results: {
      framework: string;
      total_controls: number;
      automatable_controls: number;
      passed_controls: number;
      compliance_percentage: number;
      coverage_percentage: number;
    }[] = [];

    for (const fw of frameworks) {
      const rows = await this.prisma.complianceControlStatus.findMany({
        where: { scanId: latest.scanId, framework: fw },
      });
      if (rows.length === 0) continue;

      const totalControls = new Set(rows.map((r) => r.controlId)).size;
      const passed = rows.filter((r) => r.status === "PASSED").length;
      const failed = rows.filter((r) => r.status === "FAILED").length;
      const notEvaluated = rows.filter((r) => r.status === "NOT_EVALUATED").length;
      const notApplicable = rows.filter((r) => r.isNotApplicable).length;

      const applicable = passed + failed;
      const coverageDenominator = applicable + notEvaluated + notApplicable;
      const compliancePercent = applicable > 0 ? Math.round((passed / applicable) * 100) : 0;
      const coveragePercent =
        coverageDenominator > 0 ? Math.round((applicable / coverageDenominator) * 100) : 0;

      results.push({
        framework: fw,
        total_controls: totalControls,
        automatable_controls: totalControls,
        passed_controls: passed,
        compliance_percentage: compliancePercent,
        coverage_percentage: coveragePercent,
      });
    }

    return results;
  }
}
