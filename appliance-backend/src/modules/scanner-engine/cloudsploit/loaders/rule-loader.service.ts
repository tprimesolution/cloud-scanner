import { Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

const CLOUDSPLOIT_DIR = process.env.CLOUDSPLOIT_DIR || "/opt/cloudsploit";
const PROVIDER_MAP: Record<string, string> = {
  aws: "aws",
  azure: "azure",
  gcp: "google",
  oci: "oracle",
};

export interface LoadedRule {
  provider: string;
  service: string;
  ruleName: string;
  severity: string;
  description: string;
  compliance: Record<string, string>;
}

@Injectable()
export class CloudSploitRuleLoaderService {
  private exportsModule: Record<string, Record<string, { title?: string; category?: string; severity?: string; description?: string; compliance?: Record<string, string> }>> | null = null;

  getCloudSploitDir(): string {
    return CLOUDSPLOIT_DIR;
  }

  /** Load all rules from CloudSploit exports.js. */
  loadAllRules(): LoadedRule[] {
    const exportsPath = path.join(CLOUDSPLOIT_DIR, "exports.js");
    if (!fs.existsSync(exportsPath)) return [];

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const exports = require(exportsPath) as Record<string, Record<string, { title?: string; category?: string; severity?: string; description?: string; compliance?: Record<string, string> }>>;
      this.exportsModule = exports;

      const rules: LoadedRule[] = [];
      const providers = ["aws", "azure", "google", "oracle"];

      for (const cloud of providers) {
        const pluginMap = exports[cloud];
        if (!pluginMap || typeof pluginMap !== "object") continue;

        const ourProvider = Object.entries(PROVIDER_MAP).find(([, v]) => v === cloud)?.[0] || cloud;

        for (const [ruleId, plugin] of Object.entries(pluginMap)) {
          if (!plugin || typeof plugin !== "object") continue;
          const category = (plugin.category as string) || "Unknown";
          const severity = this.normalizeSeverity((plugin.severity as string) || "medium");
          rules.push({
            provider: ourProvider,
            service: category,
            ruleName: ruleId,
            severity,
            description: (plugin.description as string) || "",
            compliance: (plugin.compliance as Record<string, string>) || {},
          });
        }
      }
      return rules;
    } catch {
      return [];
    }
  }

  /** Load rules for a single provider. */
  loadRulesForProvider(provider: string): LoadedRule[] {
    const all = this.loadAllRules();
    return all.filter((r) => r.provider === provider);
  }

  /** Get CloudSploit cloud name from our provider. */
  getCloudName(provider: string): string {
    return PROVIDER_MAP[provider?.toLowerCase()] || provider;
  }

  /** Get list of available plugins for a provider. */
  getPluginIds(provider: string): string[] {
    const cloud = this.getCloudName(provider);
    if (!this.exportsModule) this.loadAllRules();
    const pluginMap = this.exportsModule?.[cloud];
    if (!pluginMap) return [];
    return Object.keys(pluginMap);
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
