import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { PrismaService } from "../../shared/prisma.service";
import { GuardEngineModule } from "../scanner-engine/guard-engine/guard-engine.module";

@Module({
  imports: [GuardEngineModule],
  controllers: [DashboardController],
  providers: [DashboardService, PrismaService],
})
export class DashboardModule {}
