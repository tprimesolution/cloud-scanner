import { Injectable } from "@nestjs/common";
import { ProwlerRunnerService } from "./prowler-runner.service";
import { CloudSploitRunnerService } from "./cloudsploit-runner.service";
import { FindingsService } from "../findings/findings.service";

export interface ExternalScannerConfig {
  enableProwler?: boolean;
  enableCloudSploit?: boolean;
  prowlerCompliance?: string;
  cloudsploitCompliance?: string;
}

@Injectable()
export class ExternalScannerService {
  constructor(
    private readonly prowler: ProwlerRunnerService,
    private readonly cloudsploit: CloudSploitRunnerService,
    private readonly findings: FindingsService,
  ) {}

  async runExternalScans(scanJobId: string, config?: ExternalScannerConfig): Promise<number> {
    const enableProwler = config?.enableProwler ?? true;
    const enableCloudSploit = config?.enableCloudSploit ?? true;

    let count = 0;

    if (enableProwler) {
      try {
        const prowlerFindings = await this.prowler.run(config?.prowlerCompliance);
        for (const f of prowlerFindings) {
          await this.findings.upsertFromExternalFinding(f, scanJobId);
          count++;
        }
      } catch (err) {
        console.error("Prowler scan failed:", err);
      }
    }

    if (enableCloudSploit) {
      try {
        const cloudsploitFindings = await this.cloudsploit.run(config?.cloudsploitCompliance);
        for (const f of cloudsploitFindings) {
          await this.findings.upsertFromExternalFinding(f, scanJobId);
          count++;
        }
      } catch (err) {
        console.error("CloudSploit scan failed:", err);
      }
    }

    return count;
  }
}
