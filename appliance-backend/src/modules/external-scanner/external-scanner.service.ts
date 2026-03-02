import { Injectable } from "@nestjs/common";
import { ProwlerRunnerService } from "./prowler-runner.service";
import { CloudSploitRunnerService } from "./cloudsploit-runner.service";
import { InfraRunnerService } from "./infra-runner.service";
import { FindingsService } from "../findings/findings.service";

export interface ExternalScannerConfig {
  enableShield?: boolean;
  enableGuard?: boolean;
  enableInfra?: boolean;
  shieldCompliance?: string;
  guardCompliance?: string;
}

@Injectable()
export class ExternalScannerService {
  constructor(
    private readonly prowler: ProwlerRunnerService,
    private readonly cloudsploit: CloudSploitRunnerService,
    private readonly infra: InfraRunnerService,
    private readonly findings: FindingsService,
  ) {}

  async runExternalScans(scanJobId: string, config?: ExternalScannerConfig): Promise<number> {
    const enableShield = config?.enableShield ?? true;
    const enableGuard = config?.enableGuard ?? true;
    const enableInfra = config?.enableInfra ?? (process.env.ENABLE_INFRA_SCANNER !== "false");

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

    if (enableInfra) {
      try {
        const infraFindings = await this.infra.run();
        for (const f of infraFindings) {
          await this.findings.upsertFromExternalFinding(f, scanJobId);
          count++;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Infra scan failed:", err);
      }
    }

    return count;
  }
}
