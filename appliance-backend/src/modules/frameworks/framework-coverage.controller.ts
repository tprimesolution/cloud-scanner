import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CriteriaScopeStatus } from "@prisma/client";
import { FrameworkCoverageService } from "./framework-coverage.service";

@Controller()
export class FrameworkCoverageController {
  constructor(private readonly coverage: FrameworkCoverageService) {}

  @Get("frameworks")
  getFrameworks() {
    return this.coverage.listFrameworks();
  }

  @Get("frameworks/:id/summary")
  getFrameworkSummary(@Param("id") id: string) {
    return this.coverage.getFrameworkSummary(id);
  }

  @Get("frameworks/:id/criteria")
  getFrameworkCriteria(@Param("id") id: string) {
    return this.coverage.getFrameworkCriteria(id);
  }

  @Get("criteria/:id/controls")
  getCriteriaControls(@Param("id") id: string) {
    return this.coverage.getCriteriaControls(id);
  }

  @Get("controls/:id/checks")
  getControlChecks(@Param("id") id: string) {
    return this.coverage.getControlChecks(id);
  }

  @Post("criteria/:id/scope")
  updateCriteriaScope(
    @Param("id") id: string,
    @Body() body: { scope: "IN_SCOPE" | "OUT_OF_SCOPE" }
  ) {
    const scope =
      body.scope === "OUT_OF_SCOPE"
        ? CriteriaScopeStatus.OUT_OF_SCOPE
        : CriteriaScopeStatus.IN_SCOPE;
    return this.coverage.setCriteriaScope(id, scope);
  }
}
