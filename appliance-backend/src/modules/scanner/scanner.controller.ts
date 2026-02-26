import { Controller, Get, Post, Body, Param, Query } from "@nestjs/common";
import { ScannerService } from "./scanner.service";

@Controller("scanner")
export class ScannerController {
  constructor(private readonly scannerService: ScannerService) {}

  @Get("status")
  getStatus() {
    return this.scannerService.getStatus();
  }

  @Get("jobs")
  async getJobs(@Query("limit") limit?: string) {
    return this.scannerService.getJobs(limit ? parseInt(limit, 10) : 20);
  }

  @Get("jobs/:id")
  async getJob(@Param("id") id: string) {
    return this.scannerService.getJob(id);
  }

  @Post("scan")
  async triggerScan() {
    return this.scannerService.triggerScan();
  }

  @Get("findings")
  async getFindings(
    @Query("status") status?: string,
    @Query("severity") severity?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.scannerService.getFindings({
      status,
      severity,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post("findings/:id/status")
  async updateFindingStatus(
    @Param("id") id: string,
    @Body("status") status: string,
  ) {
    await this.scannerService.updateFindingStatus(id, status);
    return { ok: true };
  }
}
