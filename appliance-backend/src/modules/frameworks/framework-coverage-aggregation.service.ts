import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { FrameworkCoverageService } from "./framework-coverage.service";

@Injectable()
export class FrameworkCoverageAggregationService {
  private readonly logger = new Logger(FrameworkCoverageAggregationService.name);

  constructor(private readonly coverage: FrameworkCoverageService) {}

  @Cron("*/2 * * * *")
  async processPendingScans() {
    const pending = await this.coverage.getPendingScanIds(20);
    if (pending.length === 0) return;

    for (const scanId of pending) {
      try {
        await this.coverage.aggregateScan(scanId);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`framework_coverage_aggregation_failed scanId=${scanId} error=${msg}`);
      }
    }
  }
}
