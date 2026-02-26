import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { AssetModule } from "./modules/asset/asset.module";
import { ComplianceModule } from "./modules/compliance/compliance.module";
import { ControlEngineModule } from "./modules/control-engine/control-engine.module";
import { EvidenceModule } from "./modules/evidence/evidence.module";
import { RiskModule } from "./modules/risk/risk.module";
import { AuditModule } from "./modules/audit/audit.module";
import { MonitoringModule } from "./modules/monitoring/monitoring.module";
import { LoggingModule } from "./modules/logging/logging.module";
import { ScannerModule } from "./modules/scanner/scanner.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { RulesModule } from "./modules/rules/rules.module";
import { SchedulerModule } from "./modules/scheduler/scheduler.module";
import { HealthController } from "./health.controller";
import { PrismaService } from "./shared/prisma.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env"],
    }),
    ScheduleModule.forRoot(),
    AssetModule,
    ComplianceModule,
    ControlEngineModule,
    EvidenceModule,
    RiskModule,
    AuditModule,
    MonitoringModule,
    LoggingModule,
    ScannerModule,
    DashboardModule,
    RulesModule,
    SchedulerModule,
  ],
  controllers: [HealthController],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}

