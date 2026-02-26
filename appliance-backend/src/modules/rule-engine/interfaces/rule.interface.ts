export type Severity = "critical" | "high" | "medium" | "low" | "informational";

export type RuleResourceType = "s3" | "iam_user" | "security_group" | "rds" | "ebs" | "cloudtrail";

export interface RuleDefinition {
  id: string;
  code: string;
  name: string;
  description?: string;
  resourceType: RuleResourceType;
  severity: Severity;
  conditions?: unknown;
  controlIds: string[];
  enabled: boolean;
  remediation?: string;
}
