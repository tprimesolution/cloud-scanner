import { Controller, Get, Param, Query } from "@nestjs/common";
import { ComplianceService } from "./compliance.service";

@Controller("compliance")
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Get("frameworks")
  getFrameworks() {
    return this.compliance.getFrameworks();
  }

  @Get("frameworks/:frameworkId/findings")
  getFrameworkFindings(
    @Param("frameworkId") frameworkId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    return this.compliance.getFrameworkFindings(
      frameworkId,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0
    );
  }

  @Get("categories")
  getCategories() {
    return this.compliance.getCategories();
  }

  @Get("categories/:categoryId/findings")
  getCategoryFindings(
    @Param("categoryId") categoryId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    return this.compliance.getCategoryFindings(
      categoryId,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0
    );
  }
}
