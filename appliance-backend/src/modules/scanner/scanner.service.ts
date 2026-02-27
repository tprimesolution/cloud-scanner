import { Injectable } from "@nestjs/common";
import { ScanOrchestratorService } from "../scan-orchestrator/scan-orchestrator.service";
import { FindingsService } from "../findings/findings.service";
import { ScanQueueService } from "../scan-orchestrator/scan-queue.service";
import { PrismaService } from "../../shared/prisma.service";

@Injectable()
export class ScannerService {
  constructor(
    private readonly orchestrator: ScanOrchestratorService,
    private readonly findings: FindingsService,
    private readonly queue: ScanQueueService,
    private readonly prisma: PrismaService,
  ) {}

  async getStatus(): Promise<{
    ready: boolean;
    scanInProgress: boolean;
    queueLength: number;
    lastJob?: { status: string; errorMessage?: string | null };
  }> {
    const lastJob = await this.prisma.scanJob.findFirst({
      orderBy: { createdAt: "desc" },
      select: { status: true, errorMessage: true },
    });
    return {
      ready: true,
      scanInProgress: this.queue.isProcessing(),
      queueLength: this.queue.getQueueLength(),
      lastJob: lastJob ? { status: lastJob.status, errorMessage: lastJob.errorMessage } : undefined,
    };
  }

  async triggerScan(): Promise<{ triggered: boolean; jobId?: string; message: string }> {
    if (this.queue.isProcessing()) {
      return { triggered: false, message: "Scan already in progress" };
    }
    try {
      const result = await this.orchestrator.triggerScan("on_demand");
      const jobId = "jobId" in result ? result.jobId : undefined;
      return {
        triggered: true,
        jobId,
        message: "Scan started. Check /scanner/status for progress.",
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { triggered: false, message: `Failed to start scan: ${msg}` };
    }
  }

  async getFindings(filter?: { status?: string; severity?: string; limit?: number; offset?: number }) {
    return this.findings.findMany(filter);
  }

  async updateFindingStatus(id: string, status: string): Promise<void> {
    return this.findings.updateStatus(id, status);
  }

  async getJob(id: string) {
    const job = await this.prisma.scanJob.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        status: true,
        resourceCount: true,
        findingCount: true,
        startedAt: true,
        completedAt: true,
        errorMessage: true,
      },
    });
    if (!job) return null;
    return job;
  }

  async getJobs(limit = 20) {
    const jobs = await this.prisma.scanJob.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        type: true,
        status: true,
        resourceCount: true,
        findingCount: true,
        startedAt: true,
        completedAt: true,
        errorMessage: true,
        createdAt: true,
      },
    });
    return jobs;
  }
}
