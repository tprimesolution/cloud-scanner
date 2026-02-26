import { Injectable } from "@nestjs/common";

export interface QueuedScan {
  type: string;
  config?: { regions?: string[] };
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

@Injectable()
export class ScanQueueService {
  private queue: QueuedScan[] = [];
  private processing = false;

  enqueue(type: string, config?: { regions?: string[] }): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.queue.push({ type, config, resolve, reject });
    });
  }

  dequeue(): QueuedScan | undefined {
    return this.queue.shift();
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  setProcessing(value: boolean): void {
    this.processing = value;
  }

  isProcessing(): boolean {
    return this.processing;
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}
