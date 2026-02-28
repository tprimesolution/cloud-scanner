"""IAM_MFA_ENABLED

Description: Detect IAM users without MFA device assignment.
AWS APIs: iam:list_users, iam:list_mfa_devices
Compliance mapping: CIS AWS 1.2, ISO 27001 A.9.4.2
Remediation: Enable virtual or hardware MFA for every IAM user.
"""

from __future__ import annotations

from typing import Any

from ...aws_utils import account_id, paginate, safe_call
from ...types import RuleResult, build_result


class ComplianceRule:
    RULE_ID = "IAM_MFA_ENABLED"
    SEVERITY = "high"
    REMEDIATION = "Enable MFA for every IAM user and enforce MFA in IAM policies."

    def run(self, session: Any) -> list[RuleResult]:
        iam = session.client("iam")
        acct = account_id(session)
        results: list[RuleResult] = []
        users = list(paginate(iam, "list_users", "Users"))

        if not users:
            return [
                build_result(
                    self.RULE_ID,
                    "PASS",
                    f"account:{acct}",
                    "global",
                    self.SEVERITY,
                    "No IAM users found.",
                    self.REMEDIATION,
                )
            ]

        for user in users:
            user_name = user.get("UserName", "unknown")
            resp = safe_call(iam.list_mfa_devices, UserName=user_name) or {}
            has_mfa = len(resp.get("MFADevices", [])) > 0
            results.append(
                build_result(
                    self.RULE_ID,
                    "PASS" if has_mfa else "FAIL",
                    f"arn:aws:iam::{acct}:user/{user_name}",
                    "global",
                    self.SEVERITY,
                    "IAM user has MFA enabled." if has_mfa else "IAM user does not have MFA enabled.",
                    self.REMEDIATION,
                )
            )
        return results

