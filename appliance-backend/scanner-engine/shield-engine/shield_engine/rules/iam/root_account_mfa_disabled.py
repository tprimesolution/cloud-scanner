"""ROOT_ACCOUNT_MFA_DISABLED

Description: Detect root account without MFA enabled.
AWS APIs: iam:get_account_summary
Compliance mapping: CIS AWS 1.5, ISO 27001 A.9.2.3
Remediation: Enable MFA on the root user and avoid root daily usage.
"""

from __future__ import annotations

from typing import Any

from ...aws_utils import account_id, safe_call
from ...types import RuleResult, build_result


class ComplianceRule:
    RULE_ID = "ROOT_ACCOUNT_MFA_DISABLED"
    SEVERITY = "critical"
    REMEDIATION = "Enable MFA on the AWS root account and use IAM roles for administration."

    def run(self, session: Any) -> list[RuleResult]:
        iam = session.client("iam")
        acct = account_id(session)
        summary = safe_call(iam.get_account_summary) or {}
        account_summary = summary.get("SummaryMap", {})
        enabled = account_summary.get("AccountMFAEnabled", 0) == 1
        return [
            build_result(
                self.RULE_ID,
                "PASS" if enabled else "FAIL",
                f"arn:aws:iam::{acct}:root",
                "global",
                self.SEVERITY,
                "Root account MFA is enabled." if enabled else "Root account MFA is not enabled.",
                self.REMEDIATION,
            )
        ]

