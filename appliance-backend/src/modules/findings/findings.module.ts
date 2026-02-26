import { Module } from "@nestjs/common";
import { FindingsService } from "./findings.service";
import { DeduplicationService } from "./deduplication.service";
import { LifecycleService } from "./lifecycle.service";
import { RuleEngineModule } from "../rule-engine/rule-engine.module";
import { PrismaService } from "../../shared/prisma.service";

@Module({
  imports: [RuleEngineModule],
  providers: [FindingsService, DeduplicationService, LifecycleService, PrismaService],
  exports: [FindingsService],
})
export class FindingsModule {}
