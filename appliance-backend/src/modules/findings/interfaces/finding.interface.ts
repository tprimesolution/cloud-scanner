export type FindingStatus = "open" | "acknowledged" | "resolved" | "suppressed";

export interface FindingFilter {
  status?: FindingStatus;
  severity?: string;
  resourceType?: string;
  limit?: number;
  offset?: number;
}
