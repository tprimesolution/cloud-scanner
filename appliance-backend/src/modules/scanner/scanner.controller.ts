import { Controller, Get, Post, Body, Param, Query } from "@nestjs/common";
import { ScannerService } from "./scanner.service";
import { UpdateFindingStatusDto } from "./dto/update-finding-status.dto";
import { GetFindingsQueryDto } from "./dto/get-findings-query.dto";

@Controller("scanner")
export class ScannerController {
  constructor(private readonly scannerService: ScannerService) {}

  @Get("status")
  async getStatus() {
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
  async getFindings(@Query() query: GetFindingsQueryDto) {
    return this.scannerService.getFindings(query);
  }

  @Post("findings/:id/status")
  async updateFindingStatus(
    @Param("id") id: string,
    @Body() body: UpdateFindingStatusDto,
  ) {
    await this.scannerService.updateFindingStatus(id, body.status);
    return { ok: true };
  }
}
