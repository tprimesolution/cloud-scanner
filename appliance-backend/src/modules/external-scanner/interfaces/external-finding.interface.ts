/** External finding from Prowler or CloudSploit. */
export interface ExternalFinding {
  source: "prowler" | "cloudsploit";
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
