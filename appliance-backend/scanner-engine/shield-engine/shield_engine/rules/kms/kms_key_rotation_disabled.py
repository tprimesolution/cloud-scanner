"""KMS_KEY_ROTATION_DISABLED

Description: Detect customer-managed KMS keys without automatic rotation enabled.
AWS APIs: kms:list_keys, kms:describe_key, kms:get_key_rotation_status
Compliance mapping: CIS AWS 3.8, ISO 27001 A.10.1.2
Remediation: Enable automatic annual rotation for customer-managed symmetric KMS keys.
"""

from __future__ import annotations

from typing import Any

from ...aws_utils import AwsClientFactory, list_enabled_regions, paginate, safe_call
from ...types import RuleResult, build_result


class ComplianceRule:
    RULE_ID = "KMS_KEY_ROTATION_DISABLED"
    SEVERITY = "medium"
    REMEDIATION = "Enable automatic key rotation on customer-managed symmetric KMS keys."

    def run(self, session: Any) -> list[RuleResult]:
        regions = list_enabled_regions(session)
        factory = AwsClientFactory(session)
        results: list[RuleResult] = []
        for region in regions:
            kms = factory.client("kms", region)
            for key in paginate(kms, "list_keys", "Keys"):
                key_id = key.get("KeyId")
                if not key_id:
                    continue
                meta_resp = safe_call(kms.describe_key, KeyId=key_id) or {}
                metadata = meta_resp.get("KeyMetadata", {})
                if metadata.get("KeyManager") != "CUSTOMER":
                    continue
                key_arn = metadata.get("Arn", key_id)
                if metadata.get("KeyState") != "Enabled":
                    continue
                rotation = safe_call(kms.get_key_rotation_status, KeyId=key_id) or {}
                enabled = bool(rotation.get("KeyRotationEnabled", False))
                results.append(
                    build_result(
                        self.RULE_ID,
                        "PASS" if enabled else "FAIL",
                        key_arn,
                        region,
                        self.SEVERITY,
                        "KMS key rotation is enabled."
                        if enabled
                        else "KMS key rotation is disabled for a customer-managed key.",
                        self.REMEDIATION,
                    )
                )
        return results

