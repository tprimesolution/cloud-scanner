import type { NormalizedResource } from "../../resource-collection/interfaces/fetcher.interface";

export type Severity = "critical" | "high" | "medium" | "low" | "informational";

export interface RuleResult {
  passed: boolean;
  message?: string;
}

export interface IRulePlugin {
  readonly code: string;
  readonly name: string;
  readonly description?: string;
  readonly resourceType: string;
  readonly severity: Severity;
  readonly controlIds: string[];
  readonly remediation: string;
  evaluate(resource: NormalizedResource): RuleResult;
}
