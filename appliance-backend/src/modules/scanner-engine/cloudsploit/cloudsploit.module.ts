import { Module } from "@nestjs/common";
import { PrismaService } from "../../../shared/prisma.service";
import { CloudSploitRuleLoaderService } from "./loaders/rule-loader.service";
import { CloudSploitExecutorService } from "./executor/cloudsploit-executor.service";
import { CloudSploitQueueService } from "./executor/cloudsploit-queue.service";
import { CloudSploitMetricsService } from "./executor/cloudsploit-metrics.service";
import { CloudSploitConfigGeneratorService } from "./config/config-generator.service";
import { CloudSploitResultNormalizerService } from "./normalizers/result-normalizer.service";
import { CloudSploitScanService } from "./services/cloudsploit-scan.service";
import { CloudSploitScanController } from "./cloudsploit-scan.controller";

@Module({
  controllers: [CloudSploitScanController],
  providers: [
    PrismaService,
    CloudSploitRuleLoaderService,
    CloudSploitMetricsService,
    CloudSploitQueueService,
    CloudSploitExecutorService,
    CloudSploitConfigGeneratorService,
    CloudSploitResultNormalizerService,
    CloudSploitScanService,
  ],
  exports: [CloudSploitScanService, CloudSploitRuleLoaderService],
})
export class CloudSploitModule {}
