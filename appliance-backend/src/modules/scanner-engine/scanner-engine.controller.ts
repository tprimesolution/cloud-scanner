import { Controller, Get, Post, Body, HttpCode, HttpStatus } from "@nestjs/common";
import { ScannerEngineService } from "./services/scanner-engine.service";
import { ScannerEngineSyncService } from "./services/sync.service";
import type { ScanFilter } from "./interfaces/scan-filter.interface";

@Controller("scanner-engine")
export class ScannerEngineController {
  constructor(
    private readonly engine: ScannerEngineService,
    private readonly syncService: ScannerEngineSyncService,
  ) {}

  /** Run scan for a provider. */
  @Post("scan")
  @HttpCode(HttpStatus.OK)
  async runScan(
    @Body() body: { provider: string; filter?: ScanFilter },
  ) {
    const { provider, filter } = body;
    const results = await this.engine.runProvider(provider || "aws", filter);
    return { provider: provider || "aws", results, count: results.length };
  }

  /** Run scans for multiple providers. */
  @Post("scan/multi")
  @HttpCode(HttpStatus.OK)
  async runMultiScan(
    @Body() body: { providers: string[]; filter?: ScanFilter },
  ) {
    const { providers = ["aws"], filter } = body;
    const output = await this.engine.runProviders(providers, filter);
    return {
      providers: output.map((o) => o.provider),
      results: output.flatMap((o) => o.results),
      count: output.reduce((s, o) => s + o.results.length, 0),
    };
  }

  /** List supported providers. */
  @Get("providers")
  getProviders() {
    return { providers: this.engine.getProviders() };
  }

  /** Sync checks and compliance from Shield. */
  @Post("sync")
  @HttpCode(HttpStatus.OK)
  async sync() {
    const result = await this.syncService.syncAll();
    return result;
  }
}
