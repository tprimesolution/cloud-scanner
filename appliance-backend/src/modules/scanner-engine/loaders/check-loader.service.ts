import { Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

export interface ProwlerCheckMetadata {
  Provider: string;
  CheckID: string;
  CheckTitle: string;
  ServiceName: string;
  Severity: string;
  Description?: string;
  Risk?: string;
  Remediation?: { Recommendation?: { Text?: string }; Code?: { Other?: string } };
  [key: string]: unknown;
}

export interface LoadedCheck {
  provider: string;
  service: string;
  checkName: string;
  severity: string;
  description: string;
  risk: string;
  remediation: string;
  metadata: ProwlerCheckMetadata;
}

const SUPPORTED_PROVIDERS = ["aws", "azure", "gcp", "kubernetes"] as const;

@Injectable()
export class CheckLoaderService {
  private shieldPath: string | null = null;

  /** Resolve Shield installation path (no subprocess - env only). */
  getProwlerPath(): string | null {
    if (this.shieldPath) return this.shieldPath;
    const envPath = process.env.SHIELD_PATH || process.env.PROWLER_PATH;
    if (envPath && fs.existsSync(envPath)) {
      this.shieldPath = envPath;
      return envPath;
    }
    const corePath = process.env.SHIELD_CORE || process.env.PROWLER_CORE;
    if (corePath && fs.existsSync(corePath)) {
      const pkgPath = path.join(corePath, "prowler");
      if (fs.existsSync(path.join(pkgPath, "providers"))) {
        this.shieldPath = pkgPath;
        return pkgPath;
      }
      if (fs.existsSync(path.join(corePath, "providers"))) {
        this.shieldPath = corePath;
        return corePath;
      }
    }
    return null;
  }

  /** Load all checks from Shield providers. */
  loadAllChecks(): LoadedCheck[] {
    const base = this.getProwlerPath();
    if (!base) return [];

    const checks: LoadedCheck[] = [];
    const providersDir = path.join(base, "providers");

    if (!fs.existsSync(providersDir)) return [];

    for (const provider of SUPPORTED_PROVIDERS) {
      const providerPath = path.join(providersDir, provider);
      if (!fs.existsSync(providerPath)) continue;

      const servicesDir = path.join(providerPath, "services");
      if (!fs.existsSync(servicesDir)) continue;

      const services = fs.readdirSync(servicesDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
        .map((d) => d.name);

      for (const service of services) {
        const servicePath = path.join(servicesDir, service);
        const items = fs.readdirSync(servicePath, { withFileTypes: true })
          .filter((d) => d.isDirectory() && !d.name.startsWith("_") && d.name !== "lib")
          .map((d) => d.name);

        for (const checkDir of items) {
          const meta = this.loadMetadata(base, provider, service, checkDir);
          if (meta) checks.push(meta);
        }
      }
    }
    return checks;
  }

  /** Load checks for a single provider. */
  loadChecksForProvider(provider: string): LoadedCheck[] {
    const base = this.getProwlerPath();
    if (!base) return [];

    const providerPath = path.join(base, "providers", provider);
    if (!fs.existsSync(providerPath)) return [];

    const servicesDir = path.join(providerPath, "services");
    if (!fs.existsSync(servicesDir)) return [];

    const checks: LoadedCheck[] = [];
    const services = fs.readdirSync(servicesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
      .map((d) => d.name);

    for (const service of services) {
      const servicePath = path.join(servicesDir, service);
      const items = fs.readdirSync(servicePath, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith("_") && d.name !== "lib")
        .map((d) => d.name);

      for (const checkDir of items) {
        const meta = this.loadMetadata(base, provider, service, checkDir);
        if (meta) checks.push(meta);
      }
    }
    return checks;
  }

  private loadMetadata(
    base: string,
    provider: string,
    service: string,
    checkDir: string
  ): LoadedCheck | null {
    const metaPath = path.join(
      base,
      "providers",
      provider,
      "services",
      service,
      checkDir,
      `${checkDir}.metadata.json`
    );
    if (!fs.existsSync(metaPath)) return null;

    try {
      const raw = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as ProwlerCheckMetadata;
      const remediation =
        raw.Remediation?.Recommendation?.Text ||
        raw.Remediation?.Code?.Other ||
        "";
      return {
        provider: (raw.Provider || provider).toLowerCase(),
        service: (raw.ServiceName || service).toLowerCase(),
        checkName: raw.CheckID || checkDir,
        severity: this.normalizeSeverity(raw.Severity),
        description: raw.Description || "",
        risk: raw.Risk || "",
        remediation,
        metadata: raw,
      };
    } catch {
      return null;
    }
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
