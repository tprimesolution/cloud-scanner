import { Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

export interface ComplianceRequirement {
  Id: string;
  Description?: string;
  Checks: string[];
  Attributes?: unknown[];
}

export interface ComplianceFrameworkJson {
  Framework: string;
  Name: string;
  Version?: string;
  Provider: string;
  Description?: string;
  Requirements: ComplianceRequirement[];
}

export interface ParsedComplianceMapping {
  framework: string;
  frameworkName: string;
  version?: string;
  provider: string;
  source: string;
  mappings: { controlId: string; checkName: string }[];
}

const SUPPORTED_PROVIDERS = ["aws", "azure", "gcp", "kubernetes"] as const;

@Injectable()
export class ComplianceParserService {
  private getProwlerPath(): string | null {
    const envPath = process.env.SHIELD_PATH || process.env.PROWLER_PATH;
    if (envPath && fs.existsSync(envPath)) return envPath;
    const corePath = process.env.SHIELD_CORE || process.env.PROWLER_CORE;
    if (corePath && fs.existsSync(corePath)) {
      const pkgPath = path.join(corePath, "prowler");
      if (fs.existsSync(path.join(pkgPath, "compliance"))) return pkgPath;
      if (fs.existsSync(path.join(corePath, "compliance"))) return corePath;
    }
    return null;
  }

  /** Parse all compliance frameworks from Shield. */
  parseAll(): ParsedComplianceMapping[] {
    const base = this.getProwlerPath();
    if (!base) return [];

    const results: ParsedComplianceMapping[] = [];
    const complianceDir = path.join(base, "compliance");

    if (!fs.existsSync(complianceDir)) return [];

    for (const provider of SUPPORTED_PROVIDERS) {
      const providerPath = path.join(complianceDir, provider);
      if (!fs.existsSync(providerPath)) continue;

      const files = fs.readdirSync(providerPath)
        .filter((f) => f.endsWith(".json"))
        .map((f) => path.join(providerPath, f));

      for (const filePath of files) {
        const parsed = this.parseFile(filePath, provider);
        if (parsed) results.push(parsed);
      }
    }
    return results;
  }

  /** Parse compliance for a single provider. */
  parseForProvider(provider: string): ParsedComplianceMapping[] {
    const base = this.getProwlerPath();
    if (!base) return [];

    const providerPath = path.join(base, "compliance", provider);
    if (!fs.existsSync(providerPath)) return [];

    const results: ParsedComplianceMapping[] = [];
    const files = fs.readdirSync(providerPath)
      .filter((f) => f.endsWith(".json"))
      .map((f) => path.join(providerPath, f));

    for (const filePath of files) {
      const parsed = this.parseFile(filePath, provider);
      if (parsed) results.push(parsed);
    }
    return results;
  }

  private parseFile(filePath: string, provider: string): ParsedComplianceMapping | null {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content) as ComplianceFrameworkJson;
      const source = path.basename(filePath);

      const mappings: { controlId: string; checkName: string }[] = [];
      const requirements = data.Requirements || [];

      for (const req of requirements) {
        const controlId = req.Id || "";
        const checks = req.Checks || [];
        for (const checkName of checks) {
          if (checkName && typeof checkName === "string") {
            mappings.push({ controlId, checkName });
          }
        }
      }

      return {
        framework: data.Framework || "Unknown",
        frameworkName: data.Name || source,
        version: data.Version,
        provider: (data.Provider || provider).toLowerCase(),
        source,
        mappings,
      };
    } catch {
      return null;
    }
  }
}
