import { Injectable } from "@nestjs/common";
import { CloudSploitMetricsService } from "./cloudsploit-metrics.service";

type QueueTask = () => Promise<void>;

@Injectable()
export class CloudSploitQueueService {
  private readonly maxConcurrentScans: number;
  private running = 0;
  private readonly queue: QueueTask[] = [];

  constructor(private readonly metrics: CloudSploitMetricsService) {
    const parsed = Number(process.env.CLOUDSPLOIT_MAX_CONCURRENT_SCANS || 2);
    this.maxConcurrentScans = Number.isFinite(parsed) && parsed > 0 ? parsed : 2;
    this.metrics.setConcurrency(this.maxConcurrentScans);
  }

  enqueue(task: QueueTask): void {
    this.queue.push(task);
    this.metrics.setQueuedScans(this.queue.length);
    void this.drain();
  }

  getQueueStats() {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrentScans: this.maxConcurrentScans,
    };
  }

  private async drain(): Promise<void> {
    while (this.running < this.maxConcurrentScans && this.queue.length > 0) {
      const task = this.queue.shift();
      this.metrics.setQueuedScans(this.queue.length);
      if (!task) return;

      this.running += 1;
      void task()
        .catch(() => {
          // Scan error handling is performed inside scan service.
        })
        .finally(() => {
          this.running = Math.max(0, this.running - 1);
          this.metrics.setQueuedScans(this.queue.length);
          void this.drain();
        });
    }
  }
}
