import { Module } from "@nestjs/common";
import { SchedulerService } from "./scheduler.service";
import { DriftDetectionService } from "./drift-detection.service";
import { ScanOrchestratorModule } from "../scan-orchestrator/scan-orchestrator.module";

@Module({
  imports: [ScanOrchestratorModule],
  providers: [SchedulerService, DriftDetectionService],
})
export class SchedulerModule {}
