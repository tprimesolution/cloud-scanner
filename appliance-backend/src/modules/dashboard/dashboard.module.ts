import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { PrismaService } from "../../shared/prisma.service";
import { CloudSploitModule } from "../scanner-engine/cloudsploit/cloudsploit.module";

@Module({
  imports: [CloudSploitModule],
  controllers: [DashboardController],
  providers: [DashboardService, PrismaService],
})
export class DashboardModule {}
