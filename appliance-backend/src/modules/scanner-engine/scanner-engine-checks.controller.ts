import { Controller, Get, Query } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";

@Controller("scanner-engine")
export class ScannerEngineChecksController {
  constructor(private readonly prisma: PrismaService) {}

  /** List checks with optional filters. */
  @Get("checks")
  async listChecks(
    @Query("provider") provider?: string,
    @Query("service") service?: string,
    @Query("severity") severity?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const where: { provider?: string; service?: string; severity?: string } = {};
    if (provider) where.provider = provider;
    if (service) where.service = service;
    if (severity) where.severity = severity;

    const take = Math.min(parseInt(limit || "100", 10) || 100, 500);
    const skip = parseInt(offset || "0", 10) || 0;

    const [items, total] = await Promise.all([
      this.prisma.prowlerCheck.findMany({
        where,
        take,
        skip,
        orderBy: [{ provider: "asc" }, { service: "asc" }, { checkName: "asc" }],
      }),
      this.prisma.prowlerCheck.count({ where }),
    ]);

    return { items, total };
  }

  /** List compliance frameworks. */
  @Get("frameworks")
  async listFrameworks(
    @Query("provider") provider?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const where: { provider?: string } = {};
    if (provider) where.provider = provider;

    const take = Math.min(parseInt(limit || "100", 10) || 100, 500);
    const skip = parseInt(offset || "0", 10) || 0;

    const [items, total] = await Promise.all([
      this.prisma.complianceFramework.findMany({
        where,
        take,
        skip,
        orderBy: [{ provider: "asc" }, { name: "asc" }],
        include: {
          _count: { select: { complianceMappings: true } },
        },
      }),
      this.prisma.complianceFramework.count({ where }),
    ]);

    return { items, total };
  }

  /** List compliance mappings for a check. */
  @Get("mappings")
  async listMappings(
    @Query("checkName") checkName?: string,
    @Query("frameworkId") frameworkId?: string,
    @Query("compliance") compliance?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const where: { checkName?: string; frameworkId?: string; framework?: { framework?: string } } = {};
    if (checkName) where.checkName = checkName;
    if (frameworkId) where.frameworkId = frameworkId;
    if (compliance) where.framework = { framework: compliance };

    const take = Math.min(parseInt(limit || "100", 10) || 100, 500);
    const skip = parseInt(offset || "0", 10) || 0;

    const [items, total] = await Promise.all([
      this.prisma.complianceMapping.findMany({
        where,
        take,
        skip,
        include: { framework: true },
        orderBy: [{ checkName: "asc" }],
      }),
      this.prisma.complianceMapping.count({ where }),
    ]);

    return { items, total };
  }
}
