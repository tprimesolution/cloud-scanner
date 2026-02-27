import { Injectable } from "@nestjs/common";

export interface CloudSploitExecutionMetricsSnapshot {
  runningScans: number;
  queuedScans: number;
  maxConcurrentScans: number;
  totalScans: number;
  failedScans: number;
  averageScanDurationMs: number;
  failureRate: number;
  lastSubprocessMemoryKb: number;
  peakSubprocessMemoryKb: number;
}

@Injectable()
export class CloudSploitMetricsService {
  private runningScans = 0;
  private queuedScans = 0;
  private maxConcurrentScans = 1;
  private totalScans = 0;
  private failedScans = 0;
  private totalDurationMs = 0;
  private lastSubprocessMemoryKb = 0;
  private peakSubprocessMemoryKb = 0;

  setConcurrency(maxConcurrentScans: number) {
    this.maxConcurrentScans = Math.max(1, maxConcurrentScans);
  }

  setQueuedScans(queuedScans: number) {
    this.queuedScans = Math.max(0, queuedScans);
  }

  scanStarted() {
    this.runningScans += 1;
  }

  scanCompleted(durationMs: number, failed: boolean) {
    this.runningScans = Math.max(0, this.runningScans - 1);
    this.totalScans += 1;
    this.totalDurationMs += Math.max(0, durationMs);
    if (failed) this.failedScans += 1;
  }

  updateSubprocessMemory(rssKb: number) {
    this.lastSubprocessMemoryKb = Math.max(0, rssKb);
    this.peakSubprocessMemoryKb = Math.max(this.peakSubprocessMemoryKb, rssKb);
  }

  snapshot(): CloudSploitExecutionMetricsSnapshot {
    const averageScanDurationMs =
      this.totalScans > 0 ? Math.round(this.totalDurationMs / this.totalScans) : 0;
    const failureRate =
      this.totalScans > 0 ? Number((this.failedScans / this.totalScans).toFixed(4)) : 0;
    return {
      runningScans: this.runningScans,
      queuedScans: this.queuedScans,
      maxConcurrentScans: this.maxConcurrentScans,
      totalScans: this.totalScans,
      failedScans: this.failedScans,
      averageScanDurationMs,
      failureRate,
      lastSubprocessMemoryKb: this.lastSubprocessMemoryKb,
      peakSubprocessMemoryKb: this.peakSubprocessMemoryKb,
    };
  }
}
