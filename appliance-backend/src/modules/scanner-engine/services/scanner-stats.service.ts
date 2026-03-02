import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../shared/prisma.service";

export interface ScannerEngineStats {
  totalRawRules: number;
  rulesByProvider: {
    provider: string;
    prowlerChecks: number;
    cloudSploitRules: number;
  }[];
  mappedComplianceRules: number;
  enabledComplianceRules: number;
  lastScan: {
    id: string | null;
    type: string | null;
    status: string | null;
    resourceCount: number | null;
    findingCount: number | null;
    completedAt: Date | null;
  };
}

@Injectable()
export class ScannerStatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * High-level statistics for scanner engine coverage and recent activity.
   * Designed for read-only dashboard consumption – keep queries aggregate-only.
   */
  async getStats(): Promise<ScannerEngineStats> {
    const [
      prowlerTotal,
      cloudSploitTotal,
      prowlerByProvider,
      cloudSploitByProvider,
      mappedDistinctChecks,
      enabledComplianceRules,
      lastScanJob,
    ] = await Promise.all([
      this.prisma.prowlerCheck.count(),
      this.prisma.cloudSploitRule.count(),
      this.prisma.prowlerCheck.groupBy({
        by: ["provider"],
        _count: { _all: true },
      }),
      this.prisma.cloudSploitRule.groupBy({
        by: ["provider"],
        _count: { _all: true },
      }),
      this.prisma.complianceMapping.groupBy({
        by: ["checkName"],
        _count: { _all: true },
      }),
      this.prisma.complianceRule.count({
        where: { enabled: true },
      }),
      this.prisma.scanJob.findFirst({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          status: true,
          resourceCount: true,
          findingCount: true,
          completedAt: true,
        },
      }),
    ]);

    const byProviderMap = new Map<
      string,
      { provider: string; prowlerChecks: number; cloudSploitRules: number }
    >();

    for (const row of prowlerByProvider) {
      byProviderMap.set(row.provider, {
        provider: row.provider,
        prowlerChecks: row._count._all,
        cloudSploitRules: 0,
      });
    }

    for (const row of cloudSploitByProvider) {
      const existing = byProviderMap.get(row.provider);
      if (existing) {
        existing.cloudSploitRules = row._count._all;
      } else {
        byProviderMap.set(row.provider, {
          provider: row.provider,
          prowlerChecks: 0,
          cloudSploitRules: row._count._all,
        });
      }
    }

    return {
      totalRawRules: prowlerTotal + cloudSploitTotal,
      rulesByProvider: Array.from(byProviderMap.values()).sort((a, b) =>
        a.provider.localeCompare(b.provider),
      ),
      mappedComplianceRules: mappedDistinctChecks.length,
      enabledComplianceRules,
      lastScan: {
        id: lastScanJob?.id ?? null,
        type: lastScanJob?.type ?? null,
        status: lastScanJob?.status ?? null,
        resourceCount: lastScanJob?.resourceCount ?? null,
        findingCount: lastScanJob?.findingCount ?? null,
        completedAt: lastScanJob?.completedAt ?? null,
      },
    };
  }
}

