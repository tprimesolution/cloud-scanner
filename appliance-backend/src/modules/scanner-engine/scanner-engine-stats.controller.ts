import { Controller, Get, Query } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";
import { ScannerStatsService } from "./services/scanner-stats.service";

@Controller("scanner-engine")
export class ScannerEngineStatsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statsService: ScannerStatsService,
  ) {}

  /**
   * High-level statistics for rule coverage and scan activity.
   *
   * GET /api/scanner-engine/stats
   */
  @Get("stats")
  async getStats() {
    return this.statsService.getStats();
  }

  /**
   * Paginated raw rule listing with basic filters.
   *
   * GET /api/scanner-engine/rules
   *
   * Query params:
   * - provider: aws | azure | gcp | kubernetes | oci | ...
   * - severity: critical | high | medium | low
   * - mapped: "true" | "false" – whether rule has at least one compliance mapping
   * - limit, offset: pagination
   */
  @Get("rules")
  async listRules(
    @Query("provider") provider?: string,
    @Query("severity") severity?: string,
    @Query("mapped") mapped?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const take = Math.min(parseInt(limit || "100", 10) || 100, 500);
    const skip = parseInt(offset || "0", 10) || 0;

    const where: { provider?: string; severity?: string; checkName?: { in?: string[]; notIn?: string[] } } = {};
    if (provider) where.provider = provider;
    if (severity) where.severity = severity;

    // Optional compliance mapping filter – derive mapped checkName set once, reuse for total + items.
    let mappedCheckNames: string[] | null = null;
    if (mapped === "true" || mapped === "false") {
      const mappings = await this.prisma.complianceMapping.groupBy({
        by: ["checkName"],
        _count: { _all: true },
      });
      mappedCheckNames = mappings.map((m) => m.checkName);
      if (mapped === "true") {
        where.checkName = { in: mappedCheckNames };
      } else if (mapped === "false") {
        if (mappedCheckNames.length > 0) {
          where.checkName = { notIn: mappedCheckNames };
        }
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.prowlerCheck.findMany({
        where,
        take,
        skip,
        orderBy: [{ provider: "asc" }, { service: "asc" }, { checkName: "asc" }],
      }),
      this.prisma.prowlerCheck.count({ where }),
    ]);

    // Attach mapping metadata for current page.
    const checkNames = items.map((i) => i.checkName);
    const mappingsForPage =
      checkNames.length === 0
        ? []
        : await this.prisma.complianceMapping.findMany({
            where: { checkName: { in: checkNames } },
            include: { framework: true },
          });

    const mappingByCheck = new Map<
      string,
      { frameworkId: string; frameworkName: string; controlId: string }[]
    >();
    for (const m of mappingsForPage) {
      const list = mappingByCheck.get(m.checkName) ?? [];
      list.push({
        frameworkId: m.frameworkId,
        frameworkName: m.framework.name,
        controlId: m.controlId,
      });
      mappingByCheck.set(m.checkName, list);
    }

    const enriched = items.map((i) => {
      const frameworks = mappingByCheck.get(i.checkName) ?? [];
      return {
        ...i,
        hasComplianceMapping: frameworks.length > 0,
        frameworks,
      };
    });

    return {
      items: enriched,
      total,
      limit: take,
      offset: skip,
    };
  }
}

