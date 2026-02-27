import { Injectable, Logger } from "@nestjs/common";
import { execFileSync, spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { CloudSploitRuleLoaderService } from "../loaders/rule-loader.service";
import { CloudSploitMetricsService } from "./cloudsploit-metrics.service";

export interface CloudSploitRawResult {
  plugin?: string;
  category?: string;
  title?: string;
  description?: string;
  resource?: string;
  region?: string;
  status?: string;
  message?: string;
  compliance?: string;
}

export interface CloudSploitExecutionResult {
  results: CloudSploitRawResult[];
  metadata: {
    attempts: number;
    timedOut: boolean;
    memoryLimitExceeded: boolean;
    exitCode: number | null;
    durationMs: number;
  };
}

interface ProcessRunResult {
  timedOut: boolean;
  memoryLimitExceeded: boolean;
  exitCode: number | null;
  durationMs: number;
  stderr: string;
}

@Injectable()
export class CloudSploitExecutorService {
  private readonly logger = new Logger(CloudSploitExecutorService.name);

  constructor(
    private readonly ruleLoader: CloudSploitRuleLoaderService,
    private readonly metrics: CloudSploitMetricsService
  ) {}

  /** Execute CloudSploit scan via subprocess. */
  async execute(params: {
    provider: string;
    configPath?: string;
    compliance?: string;
    plugin?: string;
    region?: string;
    scanId?: string;
  }): Promise<CloudSploitExecutionResult> {
    const dir = this.ruleLoader.getCloudSploitDir();
    const indexJs = path.join(dir, "index.js");
    if (!fs.existsSync(indexJs)) {
      return {
        results: [],
        metadata: {
          attempts: 1,
          timedOut: false,
          memoryLimitExceeded: false,
          exitCode: 1,
          durationMs: 0,
        },
      };
    }

    const cloud = this.ruleLoader.getCloudName(params.provider);
    const outFile = path.join(os.tmpdir(), `cloudsploit_${Date.now()}_${cloud}.json`);

    const args = ["--json", outFile, "--console", "none", "--cloud", cloud];
    if (params.configPath) args.unshift("--config", params.configPath);
    if (params.compliance) args.push("--compliance", params.compliance);
    if (params.plugin) args.push("--plugin", params.plugin);

    const env = {
      ...process.env,
      AWS_DEFAULT_REGION: params.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1",
    };

    const retryCount = this.getRetryCount();
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= retryCount + 1; attempt++) {
      const startedAt = new Date();
      this.logger.log(
        JSON.stringify({
          event: "cloudsploit_scan_start",
          scanId: params.scanId,
          provider: params.provider,
          attempt,
          startedAt: startedAt.toISOString(),
        })
      );

      const run = await this.runProcess(
        ["node", indexJs, ...args],
        dir,
        env,
        params.provider,
        params.scanId
      );
      const parsed = this.tryReadOutput(outFile);

      const endedAt = new Date();
      this.logger.log(
        JSON.stringify({
          event: "cloudsploit_scan_end",
          scanId: params.scanId,
          provider: params.provider,
          attempt,
          exitCode: run.exitCode,
          timedOut: run.timedOut,
          memoryLimitExceeded: run.memoryLimitExceeded,
          durationMs: run.durationMs,
          endedAt: endedAt.toISOString(),
        })
      );

      if (parsed.valid && parsed.results.length > 0) {
        try { fs.unlinkSync(outFile); } catch { /* ignore */ }
        return {
          results: parsed.results,
          metadata: {
            attempts: attempt,
            timedOut: run.timedOut,
            memoryLimitExceeded: run.memoryLimitExceeded,
            exitCode: run.exitCode,
            durationMs: run.durationMs,
          },
        };
      }

      const transient = this.isTransientFailure(run.stderr);
      if (attempt <= retryCount && transient) {
        this.logger.warn(
          JSON.stringify({
            event: "cloudsploit_scan_retry",
            scanId: params.scanId,
            provider: params.provider,
            attempt,
            reason: run.stderr || "transient execution failure",
          })
        );
        continue;
      }

      lastError = new Error(
        `CloudSploit execution failed (exitCode=${run.exitCode}, timedOut=${run.timedOut}, memoryLimitExceeded=${run.memoryLimitExceeded})`
      );
      break;
    }

    try { fs.unlinkSync(outFile); } catch { /* ignore */ }
    if (lastError) {
      this.logger.error(lastError.message, lastError.stack);
      throw lastError;
    }
    return {
      results: [],
      metadata: {
        attempts: retryCount + 1,
        timedOut: false,
        memoryLimitExceeded: false,
        exitCode: 1,
        durationMs: 0,
      },
    };
  }

  private runProcess(
    args: string[],
    cwd: string,
    env: NodeJS.ProcessEnv,
    provider: string,
    scanId?: string
  ): Promise<ProcessRunResult> {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const [bin, ...rest] = args;
      const child = spawn(bin, rest, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
      const timeoutMs = this.getScanTimeoutMs(provider);
      const memoryLimitKb = this.getMemoryLimitKb();
      let timedOut = false;
      let memoryLimitExceeded = false;
      let stderr = "";

      child.stderr.on("data", (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });

      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, timeoutMs);

      const monitor = setInterval(() => {
        if (!child.pid) return;
        const rssKb = this.getProcessRssKb(child.pid);
        this.metrics.updateSubprocessMemory(rssKb);
        if (rssKb > memoryLimitKb) {
          memoryLimitExceeded = true;
          this.logger.warn(
            JSON.stringify({
              event: "cloudsploit_memory_limit_exceeded",
              scanId,
              provider,
              pid: child.pid,
              rssKb,
              memoryLimitKb,
            })
          );
          child.kill("SIGKILL");
        }
      }, 1000);

      child.on("error", (err) => {
        clearTimeout(timeoutHandle);
        clearInterval(monitor);
        reject(err);
      });
      child.on("close", (exitCode) => {
        clearTimeout(timeoutHandle);
        clearInterval(monitor);
        resolve({
          timedOut,
          memoryLimitExceeded,
          exitCode,
          durationMs: Date.now() - started,
          stderr,
        });
      });
    });
  }

  private tryReadOutput(outFile: string): { valid: boolean; results: CloudSploitRawResult[] } {
    try {
      const content = fs.readFileSync(outFile, "utf-8");
      const data = JSON.parse(content);
      if (!Array.isArray(data)) return { valid: false, results: [] };
      const valid = data.every((item) => this.isValidRawRecord(item));
      if (!valid) return { valid: false, results: [] };
      return { valid: true, results: data as CloudSploitRawResult[] };
    } catch {
      return { valid: false, results: [] };
    }
  }

  private isValidRawRecord(item: unknown): boolean {
    if (!item || typeof item !== "object") return false;
    const rec = item as CloudSploitRawResult;
    return typeof rec.plugin === "string" || typeof rec.title === "string";
  }

  private isTransientFailure(stderr: string): boolean {
    const msg = (stderr || "").toLowerCase();
    return (
      msg.includes("timeout") ||
      msg.includes("temporar") ||
      msg.includes("throttl") ||
      msg.includes("rate") ||
      msg.includes("429") ||
      msg.includes("econnreset") ||
      msg.includes("etimedout")
    );
  }

  private getScanTimeoutMs(provider: string): number {
    const byProvider = Number(
      process.env[`CLOUDSPLOIT_SCAN_TIMEOUT_${provider.toUpperCase()}`] || NaN
    );
    if (Number.isFinite(byProvider) && byProvider > 0) {
      return Math.floor(byProvider * 1000);
    }
    const global = Number(process.env.CLOUDSPLOIT_SCAN_TIMEOUT || 3600);
    return Number.isFinite(global) && global > 0 ? Math.floor(global * 1000) : 3600_000;
  }

  private getMemoryLimitKb(): number {
    const limitMb = Number(process.env.CLOUDSPLOIT_MEMORY_LIMIT || 1024);
    const mb = Number.isFinite(limitMb) && limitMb > 0 ? limitMb : 1024;
    return Math.floor(mb * 1024);
  }

  private getRetryCount(): number {
    const retries = Number(process.env.CLOUDSPLOIT_RETRY_COUNT || 1);
    return Number.isFinite(retries) && retries >= 0 ? Math.floor(retries) : 1;
  }

  private getProcessRssKb(pid: number): number {
    try {
      const output = execFileSync("ps", ["-o", "rss=", "-p", String(pid)], {
        encoding: "utf-8",
      });
      const value = Number((output || "").trim());
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch {
      return 0;
    }
  }
}
