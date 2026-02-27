import type { ScanResult } from "./scan-result.interface";
import type { ScanFilter } from "./scan-filter.interface";

/** Provider abstraction for pluggable scanning. */
export interface ScannerProvider {
  readonly name: string;
  run(filter?: ScanFilter): Promise<ScanResult[]>;
}
