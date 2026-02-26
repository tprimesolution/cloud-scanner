/**
 * Normalized resource types for rule evaluation.
 * Minimal fields - only what rules need.
 */

export type ResourceType = "s3" | "iam_user" | "security_group" | "rds" | "ebs" | "cloudtrail";

export interface BaseNormalizedResource {
  id: string;
  type: ResourceType;
  region: string;
  accountId?: string;
  arn?: string;
  metadata: Record<string, unknown>;
  fetchedAt: Date;
}
