import { Injectable } from "@nestjs/common";
import type { ExternalFinding } from "./interfaces/external-finding.interface";

const SHIELD_ENGINE_URL =
  process.env.SHIELD_ENGINE_URL ||
  process.env.PROWLER_ENGINE_URL ||
  "http://shield-engine:8001";

@Injectable()
export class InfraRunnerService {
  /**
   * Invoke the Shield engine's infra-scan endpoint and normalize results into ExternalFinding objects.
   *
   * The infra scanner runs inside the shield-engine container and uses the instance role
   * (or optional AssumeRole within that container) to enumerate AWS resources.
   */
  async run(): Promise<ExternalFinding[]> {
    const baseUrl = SHIELD_ENGINE_URL.replace(/\/$/, "");
    const url = `${baseUrl}/infra-scan`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // For now rely on default account/regions/scopes as determined by engine.
        body: JSON.stringify({}),
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Infra scan HTTP error:", err);
      return [];
    }

    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error("Infra scan failed:", res.status, await safeReadText(res));
      return [];
    }

    let data: unknown;
    try {
      data = (await res.json()) as unknown;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Infra scan invalid JSON:", err);
      return [];
    }

    return this.parseInfraScanOutput(data);
  }

  private parseInfraScanOutput(data: unknown): ExternalFinding[] {
    if (!data || typeof data !== "object" || !("results" in data)) return [];
    const results = (data as { results?: unknown[] }).results;
    if (!Array.isArray(results)) return [];

    const findings: ExternalFinding[] = [];
    for (const r of results as Record<string, unknown>[]) {
      const resourceId = String(r.resource_id || r.resourceId || "unknown");
      const resourceType = String(r.resource_type || r.resourceType || "aws_resource");
      const region = String(r.region || "global");
      const severity = String(r.severity || "medium").toLowerCase();
      const issue = String(r.issue || "AWS infra issue");
      const service = String(r.service || "unknown");
      const compliance = (r.compliance_mapping as string[] | undefined) || [];

      const ruleCode = this.buildRuleCode(service, issue);

      findings.push({
        source: "shield",
        resourceId: resourceId.slice(0, 512),
        resourceType,
        region,
        ruleCode,
        ruleName: issue,
        severity,
        message: issue,
        controlIds: compliance.length > 0 ? compliance : ["AWS-INFRA"],
        rawResource: r,
      });
    }
    return findings;
  }

  private buildRuleCode(service: string, issue: string): string {
    const slug = `${service || "infra"}_${issue}`.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 64);
    return `infra_${slug}`;
  }
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

