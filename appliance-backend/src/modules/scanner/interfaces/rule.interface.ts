/**
 * Rule definition for the compliance evaluation engine.
 * Rules are loaded from DB and evaluated dynamically.
 */

export type Severity = "critical" | "high" | "medium" | "low" | "informational";

export type RuleResourceType = "s3" | "iam_user" | "security_group" | "rds" | "ebs";

/** Condition operator for dynamic evaluation */
export type ConditionOperator =
  | "eq"
  | "neq"
  | "exists"
  | "not_exists"
  | "in"
  | "not_in"
  | "gt"
  | "gte"
  | "lt"
  | "lte";

export interface RuleCondition {
  /** JSON path into resource (e.g. "encryption", "publicAccessBlock") */
  path: string;
  operator: ConditionOperator;
  value?: unknown;
}

export interface RuleDefinition {
  id: string;
  code: string;
  name: string;
  description?: string;
  resourceType: RuleResourceType;
  severity: Severity;
  /** Conditions (AND). Pass when all conditions match. */
  conditions: RuleCondition[];
  /** Control IDs this rule maps to (e.g. CIS, SOC2) */
  controlIds: string[];
  enabled: boolean;
}
