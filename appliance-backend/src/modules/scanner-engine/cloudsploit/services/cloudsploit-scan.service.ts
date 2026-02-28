import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../../shared/prisma.service";
import { CloudSploitRuleLoaderService } from "../loaders/rule-loader.service";
import { CloudSploitExecutorService } from "../executor/cloudsploit-executor.service";
import { CloudSploitConfigGeneratorService } from "../config/config-generator.service";
import { CloudSploitResultNormalizerService } from "../normalizers/result-normalizer.service";
import type { CloudSploitScanInput } from "../interfaces/cloudsploit-scan.interface";
import { CloudSploitQueueService } from "../executor/cloudsploit-queue.service";
import { CloudSploitMetricsService } from "../executor/cloudsploit-metrics.service";
import { ComplianceCoverageService } from "../../../compliance/compliance-coverage.service";

@Injectable()
export class CloudSploitScanService {
  private readonly logger = new Logger(CloudSploitScanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ruleLoader: CloudSploitRuleLoaderService,
    private readonly executor: CloudSploitExecutorService,
    private readonly configGenerator: CloudSploitConfigGeneratorService,
    private readonly normalizer: CloudSploitResultNormalizerService,
    private readonly queue: CloudSploitQueueService,
    private readonly metrics: CloudSploitMetricsService,
    private readonly complianceCoverage: ComplianceCoverageService,
  ) {}

  /** Start a scan (async, returns scan ID immediately). */
  async startScan(input: CloudSploitScanInput): Promise<{ scanId: string }> {
    const scan = await this.prisma.cloudSploitScan.create({
      data: {
        provider: input.provider,
        status: "pending",
      },
    });

    this.queue.enqueue(async () => {
      await this.runScanAsync(scan.id, input);
    });
    return { scanId: scan.id };
  }

  /** Get scan status. */
  async getScanStatus(scanId: string) {
    const scan = await this.prisma.cloudSploitScan.findUnique({
      where: { id: scanId },
      include: { _count: { select: { results: true } } },
    });
    if (!scan) return null;
    return {
      id: scan.id,
      engineType: "guard",
      provider: scan.provider,
      status: scan.status,
      startedAt: scan.startedAt,
      completedAt: scan.completedAt,
      errorMessage: scan.errorMessage,
      resultCount: scan.resultCount,
    };
  }

  /** Get scan results. */
  async getScanResults(scanId: string) {
    const scan = await this.prisma.cloudSploitScan.findUnique({
      where: { id: scanId },
      include: {
        results: {
          include: { rule: true },
          orderBy: { timestamp: "desc" },
        },
      },
    });
    if (!scan) return null;

      const normalized = scan.results.map((r) => ({
        provider: scan.provider,
        service: r.rule?.service ?? "Unknown",
        rule_id: r.ruleName,
        status: r.status,
        severity: r.rule?.severity ?? "medium",
        description: r.rule?.description ?? "",
        recommendation: "",
        resource: r.resourceId ?? "",
        region: r.region ?? "",
        message: r.message ?? undefined,
      }));

    return {
      scanId: scan.id,
      engineType: "guard",
      status: scan.status,
      resultCount: scan.results.length,
      results: normalized,
    };
  }

  getExecutionMetrics() {
    return {
      ...this.metrics.snapshot(),
      queue: this.queue.getQueueStats(),
    };
  }

  private async runScanAsync(scanId: string, input: CloudSploitScanInput): Promise<void> {
    const started = Date.now();
    this.metrics.scanStarted();
    await this.prisma.cloudSploitScan.update({
      where: { id: scanId },
      data: { status: "running", startedAt: new Date() },
    });
    this.logger.log(
      JSON.stringify({
        event: "guard_run_scan_start",
        engineType: "guard",
        scanId,
        provider: input.provider,
        startedAt: new Date(started).toISOString(),
      })
    );

    let configPath: string | null = null;
    try {
      if (input.credentials && Object.keys(input.credentials).length > 0) {
        configPath = this.configGenerator.generateConfig(input.provider, input.credentials);
      }

      const execution = await this.executor.execute({
        provider: input.provider,
        configPath: configPath || undefined,
        compliance: input.compliance,
        plugin: input.plugins?.[0],
        region: input.region,
        scanId,
      });
      const raw = execution.results;

      const normalized = this.normalizer
        .normalize(raw, input.provider)
        .filter((r) => this.isValidNormalizedResult(r))
        .map((r) => ({
          ...r,
          compliance: Array.isArray(r.compliance) ? r.compliance : [],
        }));

      await this.syncRules(input.provider);

      for (const nr of normalized) {
        const rule = await this.ensureRule(input.provider, nr);
        if (!rule) continue;

        await this.prisma.cloudSploitScanResult.create({
          data: {
            scanId,
            ruleId: rule.id,
            ruleName: nr.rule_id,
            status: nr.status,
            resourceId: nr.resource,
            region: nr.region,
            message: nr.message,
            raw: nr as unknown as object,
          },
        });
      }

      const count = await this.prisma.cloudSploitScanResult.count({ where: { scanId } });
      await this.prisma.cloudSploitScan.update({
        where: { id: scanId },
        data: { status: "completed", completedAt: new Date(), resultCount: count },
      });
      // Async post-processing: compute compliance control coverage without blocking scan completion.
      void this.complianceCoverage
        .calculateAndPersistCoverage(scanId, { provider: input.provider })
        .catch((error) => {
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.error(
            JSON.stringify({
              event: "compliance_coverage_calculation_failed",
              scanId,
              provider: input.provider,
              error: msg,
            })
          );
        });
      this.logger.log(
        JSON.stringify({
          event: "guard_run_scan_complete",
          engineType: "guard",
          scanId,
          provider: input.provider,
          durationMs: Date.now() - started,
          attempts: execution.metadata.attempts,
          timedOut: execution.metadata.timedOut,
          memoryLimitExceeded: execution.metadata.memoryLimitExceeded,
          exitCode: execution.metadata.exitCode,
          resultCount: count,
        })
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(
        JSON.stringify({
          event: "guard_run_scan_failed",
          engineType: "guard",
          scanId,
          provider: input.provider,
          durationMs: Date.now() - started,
          error: msg,
          stack,
        })
      );
      await this.prisma.cloudSploitScan.update({
        where: { id: scanId },
        data: { status: "failed", completedAt: new Date(), errorMessage: msg },
      });
    } finally {
      if (configPath) {
        try {
          const fs = await import("fs");
          const path = await import("path");
          fs.rmSync(path.dirname(configPath), { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
      const failedStatus = await this.prisma.cloudSploitScan.findUnique({
        where: { id: scanId },
        select: { status: true },
      });
      this.metrics.scanCompleted(Date.now() - started, failedStatus?.status === "failed");
    }
  }

  private isValidNormalizedResult(r: {
    rule_id: string;
    status: "PASS" | "FAIL" | "INFO";
    severity: "critical" | "high" | "medium" | "low";
  }): boolean {
    return (
      typeof r.rule_id === "string" &&
      ["PASS", "FAIL", "INFO"].includes(r.status) &&
      ["critical", "high", "medium", "low"].includes(r.severity)
    );
  }

  private async syncRules(provider: string): Promise<void> {
    const rules = this.ruleLoader.loadRulesForProvider(provider);
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
    }
  }

  private async ensureRule(
    provider: string,
    nr: { rule_id: string; service: string; severity: string; description: string }
  ): Promise<{ id: string } | null> {
    const existing = await this.prisma.cloudSploitRule.findUnique({
      where: { ruleName: nr.rule_id },
    });
    if (existing) return existing;

    const created = await this.prisma.cloudSploitRule.create({
      data: {
        provider,
        service: nr.service,
        ruleName: nr.rule_id,
        severity: nr.severity,
        description: nr.description,
      },
    });
    return created;
  }
}
