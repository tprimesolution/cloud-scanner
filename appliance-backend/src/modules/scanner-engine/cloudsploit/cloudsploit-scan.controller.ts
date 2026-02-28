import { Controller, Get, Post, Body, Param } from "@nestjs/common";
import { CloudSploitScanService } from "./services/cloudsploit-scan.service";
import { CloudSploitRuleLoaderService } from "./loaders/rule-loader.service";
import { PrismaService } from "../../../shared/prisma.service";
import type { CloudSploitScanInput } from "./interfaces/cloudsploit-scan.interface";

@Controller("guard")
export class CloudSploitScanController {
  constructor(
    private readonly scanService: CloudSploitScanService,
    private readonly ruleLoader: CloudSploitRuleLoaderService,
    private readonly prisma: PrismaService,
  ) {}

  /** Start a scan. Returns scanId immediately; scan runs async. */
  @Post("scan/start")
  async startScan(@Body() body: CloudSploitScanInput) {
    return this.scanService.startScan(body);
  }

  /** Get scan status. */
  @Get("scan/status/:scanId")
  async getStatus(@Param("scanId") scanId: string) {
    const status = await this.scanService.getScanStatus(scanId);
    if (!status) return { error: "Scan not found" };
    return status;
  }

  /** Get scan results. */
  @Get("scan/results/:scanId")
  async getResults(@Param("scanId") scanId: string) {
    const results = await this.scanService.getScanResults(scanId);
    if (!results) return { error: "Scan not found" };
    return results;
  }

  /** Sync rules from Guard to database. */
  @Post("rules/sync")
  async syncRules() {
    const rules = this.ruleLoader.loadAllRules();
    let created = 0;
    for (const r of rules) {
      await this.prisma.cloudSploitRule.upsert({
        where: { ruleName: r.ruleName },
        create: {
          provider: r.provider,
          service: r.service,
          ruleName: r.ruleName,
          severity: r.severity,
          description: r.description,
          compliance: r.compliance as object,
        },
        update: {
          severity: r.severity,
          description: r.description,
          compliance: r.compliance as object,
        },
      });
      created++;
    }
    return { synced: created };
  }

  /** List rules. */
  @Get("rules")
  async listRules() {
    const rules = this.ruleLoader.loadAllRules();
    return { rules, count: rules.length };
  }

  /** Runtime execution metrics (queue, durations, failure rate, resource usage). */
  @Get("metrics")
  async getExecutionMetrics() {
    return this.scanService.getExecutionMetrics();
  }
}
