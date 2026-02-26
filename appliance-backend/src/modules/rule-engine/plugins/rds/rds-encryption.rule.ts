import type { IRulePlugin, RuleResult } from "../../interfaces/rule-plugin.interface";
import type { NormalizedResource } from "../../../resource-collection/interfaces/fetcher.interface";

export class RdsEncryptionRule implements IRulePlugin {
  readonly code = "RDS_STORAGE_ENCRYPTED";
  readonly name = "RDS instance must have storage encryption enabled";
  readonly description = "RDS instances should use encrypted storage";
  readonly resourceType = "rds";
  readonly severity = "high";
  readonly controlIds = ["CIS-4.3", "SOC2-CC6.1", "HIPAA-164.312"];
  readonly remediation = "Enable storage encryption on the RDS instance";

  evaluate(resource: NormalizedResource): RuleResult {
    const encrypted = resource.metadata?.storageEncrypted as boolean | undefined;
    if (encrypted === true) {
      return { passed: true };
    }
    return {
      passed: false,
      message: `RDS instance ${resource.metadata?.instanceId ?? resource.id} does not have storage encryption enabled`,
    };
  }
}
