import type { IRulePlugin, RuleResult } from "../../interfaces/rule-plugin.interface";
import type { NormalizedResource } from "../../../resource-collection/interfaces/fetcher.interface";

export class IamMfaRule implements IRulePlugin {
  readonly code = "IAM_MFA_ENABLED";
  readonly name = "IAM user must have MFA enabled";
  readonly description = "IAM users with console access should have MFA enabled";
  readonly resourceType = "iam_user";
  readonly severity = "high";
  readonly controlIds = ["CIS-1.10", "SOC2-CC6.1"];
  readonly remediation = "Enable MFA for the IAM user";

  evaluate(resource: NormalizedResource): RuleResult {
    const mfaActive = resource.metadata?.mfaActive as boolean | undefined;
    const accessKeysCount = (resource.metadata?.accessKeysCount as number) ?? 0;

    // Users with no access keys may not need MFA (e.g. service accounts)
    if (accessKeysCount === 0 && !resource.metadata?.passwordLastUsed) {
      return { passed: true }; // Skip users with no activity
    }

    if (mfaActive === true) {
      return { passed: true };
    }
    return {
      passed: false,
      message: `IAM user ${resource.metadata?.userName ?? resource.id} does not have MFA enabled`,
    };
  }
}
