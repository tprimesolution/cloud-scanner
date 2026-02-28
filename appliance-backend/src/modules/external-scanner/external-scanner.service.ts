import { Injectable } from "@nestjs/common";
import { ProwlerRunnerService } from "./prowler-runner.service";
import { CloudSploitRunnerService } from "./cloudsploit-runner.service";
import { FindingsService } from "../findings/findings.service";

export interface ExternalScannerConfig {
  enableShield?: boolean;
  enableGuard?: boolean;
  shieldCompliance?: string;
  guardCompliance?: string;
}

@Injectable()
export class ExternalScannerService {
  constructor(
    private readonly prowler: ProwlerRunnerService,
    private readonly cloudsploit: CloudSploitRunnerService,
    private readonly findings: FindingsService,
  ) {}

  async runExternalScans(scanJobId: string, config?: ExternalScannerConfig): Promise<number> {
    const enableShield = config?.enableShield ?? true;
    const enableGuard = config?.enableGuard ?? true;

    let count = 0;

    if (enableShield) {
      try {
        const prowlerFindings = await this.prowler.run(config?.shieldCompliance);
        for (const f of prowlerFindings) {
          await this.findings.upsertFromExternalFinding(f, scanJobId);
          count++;
        }
      } catch (err) {
        console.error("Shield scan failed:", err);
      }
    }

    if (enableGuard) {
      try {
        const cloudsploitFindings = await this.cloudsploit.run(config?.guardCompliance);
        for (const f of cloudsploitFindings) {
          await this.findings.upsertFromExternalFinding(f, scanJobId);
          count++;
        }
      } catch (err) {
        console.error("Guard scan failed:", err);
      }
    }

    return count;
  }
}
