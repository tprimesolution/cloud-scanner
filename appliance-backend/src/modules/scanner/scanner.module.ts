import { Module } from "@nestjs/common";
import { ScannerController } from "./scanner.controller";
import { ScannerService } from "./scanner.service";
import { ScanOrchestratorModule } from "../scan-orchestrator/scan-orchestrator.module";
import { FindingsModule } from "../findings/findings.module";
import { PrismaService } from "../../shared/prisma.service";

@Module({
  imports: [ScanOrchestratorModule, FindingsModule],
  controllers: [ScannerController],
  providers: [ScannerService, PrismaService],
  exports: [ScannerService],
})
export class ScannerModule {}
