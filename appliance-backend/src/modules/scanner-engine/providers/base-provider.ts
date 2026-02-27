import type { ScanResult } from "../interfaces/scan-result.interface";
import type { ScanFilter } from "../interfaces/scan-filter.interface";
import { ProwlerHttpClientService } from "./prowler-http-client.service";

/** Base provider that runs Prowler via Python engine HTTP API (no CLI). */
export abstract class BaseProwlerProvider {
  abstract readonly name: string;

  constructor(protected readonly httpClient: ProwlerHttpClientService) {}

  protected abstract getProwlerArgs(filter?: ScanFilter): string[];

  async run(filter?: ScanFilter): Promise<ScanResult[]> {
    try {
      const results = await this.httpClient.runScan(this.name, filter);
      return this.applyFilter(this.normalizeEngineResults(results), filter);
    } catch {
      return [];
    }
  }

  protected normalizeEngineResults(
    items: ScanResult[] | Array<Record<string, unknown>>
  ): ScanResult[] {
    return items.map((r) => ({
      provider: (r.provider as string) || this.name,
      service: (r.service as string) || "unknown",
      check_id: (r.check_id as string) || "unknown",
      resource_id: String(r.resource_id || "").slice(0, 512),
      status: (r.status as "PASS" | "FAIL" | "INFO") || "INFO",
      severity: (r.severity as "critical" | "high" | "medium" | "low") || "medium",
      compliance: Array.isArray(r.compliance) ? (r.compliance as string[]) : [],
      description: (r.description as string) || "",
      risk: (r.risk as string) || "",
      remediation: (r.remediation as string) || "",
      region: r.region as string,
      raw: r as Record<string, unknown>,
    }));
  }

  protected applyFilter(results: ScanResult[], filter?: ScanFilter): ScanResult[] {
    if (!filter) return results;
    if (filter.severity) {
      return results.filter((r) => r.severity === filter.severity);
    }
    return results;
  }
}
