import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics() {
    const [assetCount, findingCount, criticalCount, totalRules] = await Promise.all([
      this.prisma.asset.count({ where: { deletedAt: null } }),
      this.prisma.finding.count({ where: { status: "open" } }),
      this.prisma.finding.count({ where: { status: "open", severity: "critical" } }),
      this.prisma.complianceRule.count({ where: { enabled: true } }),
    ]);

    const frameworks = ["CIS", "SOC2", "HIPAA", "ISO27001", "PCIDSS"].length;
    const frameworkCoverage = totalRules > 0 ? Math.min(100, Math.round((totalRules / (frameworks * 5)) * 100)) : 0;

    return {
      totalAssets: assetCount,
      activeViolations: findingCount,
      criticalRisks: criticalCount,
      frameworkCoverage: `${frameworkCoverage}%`,
    };
  }

  async getComplianceScore() {
    const [totalFindings, totalResources] = await Promise.all([
      this.prisma.finding.count({ where: { status: "open" } }),
      this.prisma.collectedResource.count(),
    ]);

    const lastJob = await this.prisma.scanJob.findFirst({
      where: { status: "completed" },
      orderBy: { completedAt: "desc" },
      select: { resourceCount: true, findingCount: true, completedAt: true },
    });

    if (!lastJob || lastJob.resourceCount === 0) {
      return { score: 100, lastEvaluated: null, resourceCount: 0 };
    }

    const passed = lastJob.resourceCount - lastJob.findingCount;
    const score = Math.round((passed / lastJob.resourceCount) * 100);

    return {
      score: Math.max(0, Math.min(100, score)),
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
    const findings = await this.prisma.finding.findMany({
      where: { status: "open" },
      select: { controlIds: true },
    });

    const failed: Record<string, number> = { CIS: 0, SOC2: 0, ISO27001: 0 };

    for (const f of findings) {
      for (const cid of f.controlIds) {
        const framework = cid.split("-")[0];
        if (failed[framework] !== undefined) failed[framework]++;
      }
    }

    const base = 100;
    const penalty = 4;
    return [
      { name: "CIS AWS", score: Math.max(0, base - failed.CIS * penalty) },
      { name: "ISO 27001", score: Math.max(0, base - failed.ISO27001 * penalty) },
      { name: "SOC 2", score: Math.max(0, base - failed.SOC2 * penalty) },
    ];
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
}
