import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { ScanOrchestratorService } from "../scan-orchestrator/scan-orchestrator.service";

@Injectable()
export class SchedulerService {
  constructor(
    private readonly orchestrator: ScanOrchestratorService,
    private readonly config: ConfigService,
  ) {}

  @Cron("0 2 * * *") // 2 AM daily - full scan
  async runDailyFullScan(): Promise<void> {
    if (this.config.get<string>("SCHEDULER_ENABLED") === "false") return;
    try {
      await this.orchestrator.runScan("full");
    } catch (err) {
      console.error("Daily full scan failed:", err);
    }
  }

  @Cron("0 * * * *") // Every hour - incremental
  async runHourlyIncrementalScan(): Promise<void> {
    if (this.config.get<string>("SCHEDULER_ENABLED") === "false") return;
    try {
      await this.orchestrator.runScan("incremental");
    } catch (err) {
      console.error("Hourly incremental scan failed:", err);
    }
  }
}
