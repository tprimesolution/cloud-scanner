import { Module } from "@nestjs/common";
import { ComplianceMappingService } from "./compliance-mapping.service";

@Module({
  providers: [ComplianceMappingService],
  exports: [ComplianceMappingService],
})
export class ComplianceMappingModule {}
