/** External finding from Shield, Guard, or infra scanner. */
export interface ExternalFinding {
  source: "shield" | "guard";
  resourceId: string;
  resourceType: string;
  region: string;
  ruleCode: string;
  ruleName: string;
  severity: string;
  message: string;
  controlIds: string[];
  rawResource?: Record<string, unknown>;
}
