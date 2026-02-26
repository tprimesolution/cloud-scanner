import { Controller, Get } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("metrics")
  getMetrics() {
    return this.dashboard.getMetrics();
  }

  @Get("compliance-score")
  getComplianceScore() {
    return this.dashboard.getComplianceScore();
  }

  @Get("findings-by-severity")
  getFindingsBySeverity() {
    return this.dashboard.getFindingsBySeverity();
  }

  @Get("framework-scores")
  getFrameworkScores() {
    return this.dashboard.getFrameworkScores();
  }

  @Get("risk-trend")
  getRiskTrend() {
    return this.dashboard.getRiskTrend();
  }
}
