import type { IRulePlugin, RuleResult } from "../../interfaces/rule-plugin.interface";
import type { NormalizedResource } from "../../../resource-collection/interfaces/fetcher.interface";

export class S3PublicAccessRule implements IRulePlugin {
  readonly code = "S3_PUBLIC_ACCESS_BLOCK";
  readonly name = "S3 bucket must have public access block configured";
  readonly description = "Block public access should be enabled on S3 buckets";
  readonly resourceType = "s3";
  readonly severity = "high";
  readonly controlIds = ["CIS-1.20", "SOC2-CC6.1"];
  readonly remediation = "Enable Block Public Access on the S3 bucket";

  evaluate(resource: NormalizedResource): RuleResult {
    const block = resource.metadata?.publicAccessBlock as boolean | undefined;
    if (block === true) {
      return { passed: true };
    }
    return {
      passed: false,
      message: `S3 bucket ${resource.metadata?.name ?? resource.id} does not have Block Public Access enabled`,
    };
  }
}
