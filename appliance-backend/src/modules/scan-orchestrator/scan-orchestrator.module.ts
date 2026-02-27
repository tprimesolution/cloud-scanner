import { Module } from "@nestjs/common";
import { ScanOrchestratorService } from "./scan-orchestrator.service";
import { ScanQueueService } from "./scan-queue.service";
import { BatchProcessorService } from "./batch-processor.service";
import { ResourceCollectionModule } from "../resource-collection/resource-collection.module";
import { RuleEngineModule } from "../rule-engine/rule-engine.module";
import { FindingsModule } from "../findings/findings.module";
import { ExternalScannerModule } from "../external-scanner/external-scanner.module";
import { PrismaService } from "../../shared/prisma.service";

@Module({
  imports: [
    ResourceCollectionModule,
    RuleEngineModule,
    FindingsModule,
    ExternalScannerModule,
  ],
  providers: [ScanOrchestratorService, ScanQueueService, BatchProcessorService, PrismaService],
  exports: [ScanOrchestratorService, ScanQueueService],
})
export class ScanOrchestratorModule {}
