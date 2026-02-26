/**
 * Finding produced by the rule engine when a resource violates a rule.
 */

import type { Severity } from "./rule.interface";
import type { FetchedResource } from "./resource.interface";

export type FindingStatus = "open" | "acknowledged" | "resolved" | "suppressed";

export interface FindingInput {
  resourceId: string;
  resourceType: string;
  ruleCode: string;
  ruleId: string;
  severity: Severity;
  message: string;
  rawResource?: Partial<FetchedResource>;
  controlIds: string[];
}

export interface FindingRecord extends FindingInput {
  id: string;
  status: FindingStatus;
  firstSeenAt: Date;
  lastSeenAt: Date;
}
