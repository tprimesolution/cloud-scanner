import type { IRulePlugin, RuleResult } from "../../interfaces/rule-plugin.interface";
import type { NormalizedResource } from "../../../resource-collection/interfaces/fetcher.interface";

export class EbsEncryptionRule implements IRulePlugin {
  readonly code = "EBS_VOLUME_ENCRYPTED";
  readonly name = "EBS volume must be encrypted";
  readonly description = "EBS volumes should use encryption";
  readonly resourceType = "ebs";
  readonly severity = "high";
  readonly controlIds = ["CIS-4.2", "SOC2-CC6.1", "HIPAA-164.312"];
  readonly remediation = "Enable encryption on the EBS volume";

  evaluate(resource: NormalizedResource): RuleResult {
    const encrypted = resource.metadata?.encrypted as boolean | undefined;
    if (encrypted === true) {
      return { passed: true };
    }
    return {
      passed: false,
      message: `EBS volume ${resource.metadata?.volumeId ?? resource.id} is not encrypted`,
    };
  }
}
