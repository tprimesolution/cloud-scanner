/** Standardized scan result format for all providers. */
export interface ScanResult {
  provider: string;
  service: string;
  check_id: string;
  resource_id: string;
  status: "PASS" | "FAIL" | "INFO";
  severity: "critical" | "high" | "medium" | "low";
  compliance: string[];
  description: string;
  risk: string;
  remediation: string;
  region?: string;
  raw?: Record<string, unknown>;
}
