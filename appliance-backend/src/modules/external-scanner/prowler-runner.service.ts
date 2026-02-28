import { Injectable } from "@nestjs/common";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { ExternalFinding } from "./interfaces/external-finding.interface";

const SHIELD_BIN = process.env.SHIELD_BIN || process.env.PROWLER_BIN || "prowler";
const SHIELD_TIMEOUT_MS = 3600_000; // 1 hour

@Injectable()
export class ProwlerRunnerService {
  async run(compliance?: string): Promise<ExternalFinding[]> {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shield-"));
    const outFile = path.join(tmpDir, "shield_output.json");
    const outStem = "shield_output";

    const cmd = [
      SHIELD_BIN,
      "aws",
      "-M",
      "json",
      "-F",
      outStem,
      "-o",
      tmpDir,
      "--quiet",
    ];
    if (compliance) {
      cmd.push("--compliance", compliance);
    }

    try {
      await this.exec(cmd, {
        cwd: tmpDir,
        timeout: SHIELD_TIMEOUT_MS,
        env: {
          ...process.env,
          AWS_DEFAULT_REGION: process.env.AWS_REGION || "us-east-1",
        },
      });
    } catch {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      return [];
    }

    let data: unknown;
    try {
      // Prowler may name file as {stem}.json or {stem}-{account}-{date}.json
      let content: string;
      if (fs.existsSync(outFile)) {
        content = fs.readFileSync(outFile, "utf-8");
      } else {
        const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".json"));
        const jsonFile = files[0] ? path.join(tmpDir, files[0]) : outFile;
        content = fs.readFileSync(jsonFile, "utf-8");
      }
      data = JSON.parse(content);
    } catch {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      return [];
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }

    const results = this.parseProwlerOutput(data);
    return results;
  }

  private parseProwlerOutput(data: unknown): ExternalFinding[] {
    let items: Record<string, unknown>[] = [];
    if (Array.isArray(data)) {
      items = data as Record<string, unknown>[];
    } else if (data && typeof data === "object" && "results" in data) {
      const r = (data as { results?: unknown[] }).results;
      items = (Array.isArray(r) ? r : []) as Record<string, unknown>[];
    }

    const findings: ExternalFinding[] = [];
    for (const r of items) {
      if (r.Status !== "FAIL") continue;

      const resourceId =
        (r.ResourceId as string) ||
        (r.ResourceArn as string) ||
        (r.ResourceIdExtended as string) ||
        `shield-${r.CheckID || "unknown"}-${r.Region || "global"}`;
      const region = (r.Region as string) || "global";
      const service = (r.ServiceName as string) || "unknown";
      const resourceType = this.mapResourceType(service);
      const ruleCode = `shield_${r.CheckID || "unknown"}`;
      const ruleName = (r.CheckTitle as string) || ruleCode;
      const severity = this.mapSeverity(r.Severity as string);
      const message = (r.StatusExtended as string) || ruleName;

      const controlIds = this.extractControlIds(r.Compliance as Record<string, unknown> | undefined);

      findings.push({
        source: "shield",
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

  private mapResourceType(service: string): string {
    const m: Record<string, string> = {
      rds: "rds",
      s3: "s3",
      ec2: "ebs",
      iam: "iam_user",
      cloudtrail: "cloudtrail",
      kms: "aws_kms",
      lambda: "aws_lambda",
      secretsmanager: "aws_secrets",
      vpc: "security_group",
      elbv2: "aws_elbv2",
      elb: "aws_elb",
    };
    return m[service?.toLowerCase()] || "aws_resource";
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
      if (Array.isArray(v)) {
        for (const item of v) {
          if (typeof item === "string" && item) ids.push(item);
          else if (item && typeof item === "object" && "Id" in item)
            ids.push(String((item as { Id?: string }).Id));
          else if (item && typeof item === "object" && "Framework" in item)
            ids.push(String((item as { Framework?: string }).Framework));
        }
      } else if (typeof v === "string" && v) {
        ids.push(v);
      }
    }
    return ids.length > 0 ? ids : ["Shield"];
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
        reject(new Error("Shield timeout"));
      }, timeout);

      child.on("error", (err) => {
        clearTimeout(t);
        reject(err);
      });
      child.on("close", (code) => {
        clearTimeout(t);
        // Shield may exit non-zero when findings exist; we still want the output
        resolve();
      });
    });
  }
}
