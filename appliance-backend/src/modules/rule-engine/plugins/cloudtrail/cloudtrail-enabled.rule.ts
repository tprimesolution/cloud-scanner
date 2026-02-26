import type { IRulePlugin, RuleResult } from "../../interfaces/rule-plugin.interface";
import type { NormalizedResource } from "../../../resource-collection/interfaces/fetcher.interface";

export class CloudTrailEnabledRule implements IRulePlugin {
  readonly code = "CLOUDTRAIL_ENABLED";
  readonly name = "CloudTrail must be enabled";
  readonly description = "At least one CloudTrail trail should exist";
  readonly resourceType = "cloudtrail";
  readonly severity = "critical";
  readonly controlIds = ["CIS-3.1", "SOC2-CC7.2"];
  readonly remediation = "Enable CloudTrail for audit logging";

  evaluate(resource: NormalizedResource): RuleResult {
    const trailName = resource.metadata?.trailName as string | undefined;
    if (trailName && trailName !== "none") {
      return { passed: true };
    }
    return {
      passed: false,
      message: "No CloudTrail trail is configured",
    };
  }
}
