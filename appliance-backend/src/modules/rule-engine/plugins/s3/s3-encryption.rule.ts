import type { IRulePlugin, RuleResult } from "../../interfaces/rule-plugin.interface";
import type { NormalizedResource } from "../../../resource-collection/interfaces/fetcher.interface";

export class S3EncryptionRule implements IRulePlugin {
  readonly code = "S3_ENCRYPTION";
  readonly name = "S3 bucket should have encryption enabled";
  readonly description = "S3 buckets should use server-side encryption";
  readonly resourceType = "s3";
  readonly severity = "medium";
  readonly controlIds = ["CIS-1.21", "SOC2-CC6.1", "HIPAA-164.312"];
  readonly remediation = "Enable default encryption (SSE-S3 or SSE-KMS) on the S3 bucket";

  evaluate(resource: NormalizedResource): RuleResult {
    const encrypted = resource.metadata?.encryption as boolean | undefined;
    if (encrypted === true) {
      return { passed: true };
    }
    return {
      passed: false,
      message: `S3 bucket ${resource.metadata?.name ?? resource.id} does not have encryption enabled`,
    };
  }
}
