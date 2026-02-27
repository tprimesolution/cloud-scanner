import { Module } from "@nestjs/common";
import { ComplianceController } from "./compliance.controller";
import { ComplianceService } from "./compliance.service";
import { ComplianceCoverageService } from "./compliance-coverage.service";
import { ComplianceMappingModule } from "../compliance-mapping/compliance-mapping.module";
import { PrismaService } from "../../shared/prisma.service";

@Module({
  imports: [ComplianceMappingModule],
  controllers: [ComplianceController],
  providers: [ComplianceService, ComplianceCoverageService, PrismaService],
  exports: [ComplianceCoverageService],
})
export class ComplianceModule {}

