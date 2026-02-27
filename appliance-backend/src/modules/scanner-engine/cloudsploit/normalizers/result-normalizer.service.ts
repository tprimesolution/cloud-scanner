import { Injectable } from "@nestjs/common";
import { CloudSploitRuleLoaderService } from "../loaders/rule-loader.service";
import type { CloudSploitRawResult } from "../executor/cloudsploit-executor.service";
import type { CloudSploitScanResultOutput } from "../interfaces/cloudsploit-scan.interface";

@Injectable()
export class CloudSploitResultNormalizerService {
  constructor(private readonly ruleLoader: CloudSploitRuleLoaderService) {}

  /** Normalize raw CloudSploit output to standardized format. */
  normalize(
    raw: CloudSploitRawResult[],
    provider: string
  ): CloudSploitScanResultOutput[] {
    const results: CloudSploitScanResultOutput[] = [];
    const rules = this.ruleLoader.loadAllRules();
    const ruleMap = new Map(rules.map((r) => [r.ruleName, r]));

    for (const r of raw) {
      const pluginId = r.plugin || "unknown";
      const rule = ruleMap.get(pluginId);
      const status = this.mapStatus(r.status);
      const severity = this.normalizeSeverity(rule?.severity || "medium");

      results.push({
        provider,
        service: (r.category as string) || "Unknown",
        rule_id: pluginId,
        status,
        severity: severity as "critical" | "high" | "medium" | "low",
        description: (r.description as string) || (r.title as string) || "",
        recommendation: "",
        resource: (r.resource as string) || "N/A",
        region: (r.region as string) || "global",
        message: r.message,
        compliance: r.compliance ? [r.compliance] : [],
      });
    }
    return results;
  }

  private mapStatus(s: string | undefined): "PASS" | "FAIL" | "INFO" {
    const u = (s || "").toUpperCase();
    if (u === "OK") return "PASS";
    if (u === "FAIL") return "FAIL";
    if (u === "WARN") return "INFO";
    return "PASS";
  }

  private normalizeSeverity(sev: string): string {
    const m: Record<string, string> = {
      critical: "critical",
      high: "high",
      medium: "medium",
      low: "low",
    };
    return m[(sev || "").toLowerCase()] || "medium";
  }
}
