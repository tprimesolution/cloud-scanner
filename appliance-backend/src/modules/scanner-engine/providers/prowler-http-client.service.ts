import { Injectable } from "@nestjs/common";
import type { ScanFilter } from "../interfaces/scan-filter.interface";
import type { ScanResult } from "../interfaces/scan-result.interface";

const SHIELD_ENGINE_URL =
  process.env.SHIELD_ENGINE_URL ||
  process.env.PROWLER_ENGINE_URL ||
  "http://localhost:8001";

export interface ProwlerEngineScanRequest {
  provider: string;
  checks?: string[];
  region?: string;
  services?: string[];
  compliance?: string[];
  severity?: string[];
  config_file?: string;
  profile?: string;
  role?: string;
}

@Injectable()
export class ProwlerHttpClientService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = SHIELD_ENGINE_URL.replace(/\/$/, "");
  }

  async runScan(
    provider: string,
    filter?: ScanFilter
  ): Promise<ScanResult[]> {
    const body: ProwlerEngineScanRequest = {
      provider,
    };
    if (filter?.checks?.length) body.checks = filter.checks;
    if (filter?.service) body.services = [filter.service];
    if (filter?.compliance) body.compliance = [filter.compliance];
    if (filter?.severity) body.severity = [filter.severity];
    if (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION)
      body.region =
        process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || undefined;

    const res = await fetch(`${this.baseUrl}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shield engine error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as { results: ScanResult[] };
    return data.results || [];
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
