import { Module } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";
import { FrameworkCoverageController } from "./framework-coverage.controller";
import { FrameworkCoverageService } from "./framework-coverage.service";
import { FrameworkCoverageAggregationService } from "./framework-coverage-aggregation.service";

@Module({
  controllers: [FrameworkCoverageController],
  providers: [FrameworkCoverageService, FrameworkCoverageAggregationService, PrismaService],
  exports: [FrameworkCoverageService],
})
export class FrameworkCoverageModule {}
