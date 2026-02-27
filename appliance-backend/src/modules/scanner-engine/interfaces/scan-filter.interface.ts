/** Filter options for scan execution. */
export interface ScanFilter {
  provider?: string;
  service?: string;
  compliance?: string;
  severity?: string;
  checks?: string[];
}
