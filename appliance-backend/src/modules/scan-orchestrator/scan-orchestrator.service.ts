import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";
import { ResourceCollectionService } from "../resource-collection/resource-collection.service";
import { RuleEngineService } from "../rule-engine/rule-engine.service";
import { FindingsService } from "../findings/findings.service";
import { ExternalScannerService } from "../external-scanner/external-scanner.service";
import { ScanQueueService } from "./scan-queue.service";
import type { ScanJobResult, ScanJobType } from "./interfaces/scan-job.interface";
import type { ScanConfig } from "./interfaces/scan-config.interface";
import type { NormalizedResource } from "../resource-collection/interfaces/fetcher.interface";

const BATCH_EVAL_SIZE = 20;

@Injectable()
export class ScanOrchestratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resourceCollection: ResourceCollectionService,
    private readonly ruleEngine: RuleEngineService,
    private readonly findings: FindingsService,
    private readonly externalScanner: ExternalScannerService,
    private readonly queue: ScanQueueService,
  ) {}

  async runScan(type: ScanJobType = "full", config?: ScanConfig): Promise<ScanJobResult> {
    if (this.queue.isProcessing()) {
      const job = await this.queue.enqueue(type, config);
      return job as Promise<ScanJobResult>;
    }

    this.queue.setProcessing(true);
    const scanJob = await this.prisma.scanJob.create({
      data: { type, status: "running", startedAt: new Date() },
    });

    try {
      await this.runScanInternal(scanJob.id, type, config);
      const updated = await this.prisma.scanJob.findUniqueOrThrow({ where: { id: scanJob.id } });
      const result: ScanJobResult = {
        jobId: scanJob.id,
        status: "completed",
        resourceCount: updated.resourceCount,
        findingCount: updated.findingCount,
        startedAt: scanJob.startedAt ?? undefined,
        completedAt: updated.completedAt ?? undefined,
      };
      this.queue.setProcessing(false);
      const next = this.queue.dequeue();
      if (next) {
        this.runScan(next.type as ScanJobType, next.config as ScanConfig).then(next.resolve).catch(next.reject);
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await this.prisma.scanJob.update({
        where: { id: scanJob.id },
        data: { status: "failed", completedAt: new Date(), errorMessage },
      });
      this.queue.setProcessing(false);
      const next = this.queue.dequeue();
      if (next) {
        this.runScan(next.type as ScanJobType, next.config as ScanConfig).then(next.resolve).catch(next.reject);
      }
      throw err;
    }
  }

  async triggerScan(type: ScanJobType = "on_demand", config?: ScanConfig): Promise<{ jobId: string } | ScanJobResult> {
    if (this.queue.isProcessing()) {
      const job = await this.queue.enqueue(type, config);
      return job as Promise<ScanJobResult>;
    }

    this.queue.setProcessing(true);
    const scanJob = await this.prisma.scanJob.create({
      data: { type, status: "running", startedAt: new Date() },
    });

    this.runScanInternal(scanJob.id, type, config)
      .then(() => {
        this.queue.setProcessing(false);
        const next = this.queue.dequeue();
        if (next) {
          this.triggerScan(next.type as ScanJobType, next.config as ScanConfig).then(next.resolve).catch(next.reject);
        }
      })
      .catch(async (err) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        await this.prisma.scanJob.update({
          where: { id: scanJob.id },
          data: { status: "failed", completedAt: new Date(), errorMessage },
        });
        this.queue.setProcessing(false);
        const next = this.queue.dequeue();
        if (next) next.reject(err);
      });

    return { jobId: scanJob.id };
  }

  private async runScanInternal(scanJobId: string, _type: ScanJobType, config?: ScanConfig): Promise<void> {
    const resourceCount = await this.resourceCollection.collectResources(scanJobId, {
      regions: config?.regions,
      accountId: config?.accountId,
    });

    const resources = await this.prisma.collectedResource.findMany({
      where: { scanJobId },
      select: {
        resourceId: true,
        resourceType: true,
        region: true,
        accountId: true,
        metadata: true,
      },
    });

    let findingCount = 0;
    const normalized: NormalizedResource[] = resources.map((r: { resourceId: string; resourceType: string; region: string | null; accountId: string | null; metadata: unknown }) => ({
      id: r.resourceId,
      type: r.resourceType,
      region: r.region ?? "",
      accountId: r.accountId ?? undefined,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      fetchedAt: new Date(),
    }));

    for (let i = 0; i < normalized.length; i += BATCH_EVAL_SIZE) {
      const batch = normalized.slice(i, i + BATCH_EVAL_SIZE);
      const violations = this.ruleEngine.evaluateResources(batch);
      for (const v of violations) {
        await this.findings.upsertFromViolation(v, scanJobId);
        findingCount++;
      }
    }

    // Run Prowler (572+ checks) and CloudSploit (600+ plugins) for full coverage
    const enableProwler = process.env.ENABLE_PROWLER !== "false";
    const enableCloudSploit = process.env.ENABLE_CLOUDSPLOIT !== "false";
    if (enableProwler || enableCloudSploit) {
      const externalCount = await this.externalScanner.runExternalScans(scanJobId, {
        enableProwler,
        enableCloudSploit,
        prowlerCompliance: process.env.PROWLER_COMPLIANCE,
        cloudsploitCompliance: process.env.CLOUDSPLOIT_COMPLIANCE,
      });
      findingCount += externalCount;
    }

    await this.prisma.scanJob.update({
      where: { id: scanJobId },
      data: {
        status: "completed",
        completedAt: new Date(),
        resourceCount,
        findingCount,
      },
    });
  }
}
