/** Standardized CloudSploit scan result format. */
export interface CloudSploitScanResultOutput {
  provider: string;
  service: string;
  rule_id: string;
  status: "PASS" | "FAIL" | "INFO";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  recommendation: string;
  resource: string;
  region: string;
  message?: string;
  compliance?: string[];
}

/** Scan input parameters. */
export interface CloudSploitScanInput {
  provider: string;
  credentials?: Record<string, unknown>;
  region?: string;
  services?: string[];
  compliance?: string;
  plugins?: string[];
}
