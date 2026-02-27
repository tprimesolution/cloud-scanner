import { Injectable } from "@nestjs/common";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { ExternalFinding } from "./interfaces/external-finding.interface";

const CLOUDSPLOIT_DIR = process.env.CLOUDSPLOIT_DIR || "/opt/cloudsploit";
const CLOUDSPLOIT_TIMEOUT_MS = 3600_000; // 1 hour

@Injectable()
export class CloudSploitRunnerService {
  async run(compliance?: string): Promise<ExternalFinding[]> {
    const indexJs = path.join(CLOUDSPLOIT_DIR, "index.js");
    if (!fs.existsSync(indexJs)) {
      return [];
    }

    const outFile = path.join(os.tmpdir(), `cloudsploit_${Date.now()}.json`);
    const cmd = ["node", indexJs, "--json", outFile, "--console", "none"];
    if (compliance) {
      cmd.push("--compliance", compliance);
    }

    try {
      await this.exec(cmd, {
        cwd: CLOUDSPLOIT_DIR,
        timeout: CLOUDSPLOIT_TIMEOUT_MS,
        env: {
          ...process.env,
          AWS_DEFAULT_REGION: process.env.AWS_REGION || "us-east-1",
        },
      });
    } catch {
      try {
        fs.unlinkSync(outFile);
      } catch {
        /* ignore */
      }
      return [];
    }

    let data: unknown;
    try {
      const content = fs.readFileSync(outFile, "utf-8");
      data = JSON.parse(content);
    } catch {
      return [];
    } finally {
      try {
        fs.unlinkSync(outFile);
      } catch {
        /* ignore */
      }
    }

    return this.parseCloudSploitOutput(data);
  }

  private parseCloudSploitOutput(data: unknown): ExternalFinding[] {
    let items: Record<string, unknown>[] = [];
    if (Array.isArray(data)) {
      items = data as Record<string, unknown>[];
    } else if (data && typeof data === "object" && "results" in data) {
      const r = (data as { results?: unknown[] }).results;
      items = (Array.isArray(r) ? r : []) as Record<string, unknown>[];
    }

    const findings: ExternalFinding[] = [];
    for (const r of items) {
      const status = String(r.status || "").toUpperCase();
      if (status === "OK") continue;

      const resourceId =
        (r.resource as string) ||
        (r.resourceId as string) ||
        (r.ResourceId as string) ||
        `cloudsploit-${r.plugin || r.pluginId || "unknown"}-${r.region || "global"}`;
      const region = (r.region as string) || (r.Region as string) || "global";
      const plugin = (r.plugin as string) || (r.pluginId as string) || (r.plugin_id as string) || "unknown";
      const resourceType = this.mapResourceType(plugin);
      const ruleCode = `cloudsploit_${plugin}`;
      const ruleName = (r.title as string) || (r.description as string) || plugin;
      const severity = this.mapSeverity((r.severity as string) || (r.Severity as string));
      const message = (r.message as string) || (r.statusExtended as string) || ruleName;

      const controlIds = this.extractControlIds(r.compliance as Record<string, unknown> | undefined);

      findings.push({
        source: "cloudsploit",
        resourceId: String(resourceId).slice(0, 512),
        resourceType,
        region,
        ruleCode,
        ruleName,
        severity,
        message: String(message).slice(0, 2000),
        controlIds,
        rawResource: r as Record<string, unknown>,
      });
    }
    return findings;
  }

  private mapResourceType(plugin: string): string {
    const pl = (plugin || "").toLowerCase();
    if (pl.includes("s3") || pl.includes("bucket")) return "s3";
    if (pl.includes("ec2") || pl.includes("instance")) return "ebs";
    if (pl.includes("iam")) return "iam_user";
    if (pl.includes("cloudtrail")) return "cloudtrail";
    if (pl.includes("rds")) return "rds";
    if (pl.includes("lambda")) return "aws_lambda";
    if (pl.includes("kms")) return "aws_kms";
    if (pl.includes("vpc") || pl.includes("security") || pl.includes("sg")) return "security_group";
    return "aws_resource";
  }

  private mapSeverity(sev: string): string {
    const m: Record<string, string> = {
      critical: "critical",
      high: "high",
      medium: "medium",
      low: "low",
    };
    return m[(sev || "").toLowerCase()] || "medium";
  }

  private extractControlIds(compliance: Record<string, unknown> | undefined): string[] {
    if (!compliance || typeof compliance !== "object") return [];
    const ids: string[] = [];
    for (const v of Object.values(compliance)) {
      if (typeof v === "string" && v) ids.push(v);
      else if (Array.isArray(v)) {
        for (const item of v) {
          if (typeof item === "string" && item) ids.push(item);
        }
      }
    }
    return ids.length > 0 ? ids : ["CloudSploit"];
  }

  private exec(
    args: string[],
    opts: { cwd?: string; timeout?: number; env?: NodeJS.ProcessEnv }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const [bin, ...rest] = args;
      const child = spawn(bin, rest, {
        cwd: opts.cwd,
        env: opts.env || process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });

      const timeout = opts.timeout || 60000;
      const t = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("CloudSploit timeout"));
      }, timeout);

      child.on("error", (err) => {
        clearTimeout(t);
        reject(err);
      });
      child.on("close", (code) => {
        clearTimeout(t);
        // CloudSploit may exit non-zero when findings exist
        resolve();
      });
    });
  }
}
