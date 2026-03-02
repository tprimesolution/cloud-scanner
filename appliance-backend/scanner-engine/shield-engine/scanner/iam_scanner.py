from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List

import boto3

from .base_scanner import BaseScanner, Finding
from .privilege_escalation_analyzer import analyze_policies_for_escalation


class IamScanner(BaseScanner):
    """Identity & Access Management checks."""

    category = "IAM"

    def scan_region(self, session: boto3.Session, region: str) -> List[Finding]:
        # IAM is global; we only execute once in a single pseudo-region.
        if region != "us-east-1":
            return []

        iam = session.client("iam")
        sts = session.client("sts")
        account_id = sts.get_caller_identity()["Account"]
        findings: List[Finding] = []

        # Over-permissive policies and privilege escalation.
        policies = []
        paginator = iam.get_paginator("list_policies")
        for page in paginator.paginate(Scope="Local", OnlyAttached=False):
            for policy in page.get("Policies", []):
                version = iam.get_policy_version(
                    PolicyArn=policy["Arn"],
                    VersionId=policy["DefaultVersionId"],
                )["PolicyVersion"]["Document"]
                policies.append({"Arn": policy["Arn"], "Document": version})
                if self._is_over_permissive(version):
                    findings.append(
                        Finding(
                            account_id=account_id,
                            region="aws-global",
                            resource_id=policy["Arn"],
                            resource_type="iam_policy",
                            service="iam",
                            issue="Over-permissive IAM policy with wildcard action and/or resource",
                            severity="high",
                            remediation="Refactor the policy to follow least-privilege. Avoid * on Action or Resource.",
                            compliance_mapping=["CIS-1.2"],
                            category=self.category,
                            raw={"policy": policy},
                        )
                    )

        findings.extend(analyze_policies_for_escalation(account_id, policies))

        # Admin users without MFA and access keys > 90 days.
        users = iam.list_users()["Users"]
        credential_report = self._get_credential_report(iam)
        ninety_days_ago = datetime.now(timezone.utc) - timedelta(days=90)

        for user in users:
            username = user["UserName"]
            arn = user["Arn"]
            is_admin = self._is_admin_user(iam, username)
            mfa_devices = iam.list_mfa_devices(UserName=username)["MFADevices"]

            if is_admin and not mfa_devices:
                findings.append(
                    Finding(
                        account_id=account_id,
                        region="aws-global",
                        resource_id=arn,
                        resource_type="iam_user",
                        service="iam",
                        issue="Admin IAM user without MFA enabled",
                        severity="critical",
                        remediation="Enable MFA for admin users or migrate to role-based access.",
                        compliance_mapping=["CIS-1.2"],
                        category=self.category,
                        raw={"user": user},
                    )
                )

            # Access keys older than 90 days.
            row = credential_report.get(username)
            if row:
                for idx in (1, 2):
                    active_key = row.get(f"access_key_{idx}_active") == "true"
                    last_rotated = row.get(f"access_key_{idx}_last_rotated")
                    if active_key and last_rotated and last_rotated != "N/A":
                        rotated_at = datetime.fromisoformat(last_rotated.replace("Z", "+00:00"))
                        if rotated_at < ninety_days_ago:
                            findings.append(
                                Finding(
                                    account_id=account_id,
                                    region="aws-global",
                                    resource_id=f"{arn}:access-key-{idx}",
                                    resource_type="iam_access_key",
                                    service="iam",
                                    issue="Active IAM access key older than 90 days",
                                    severity="medium",
                                    remediation="Rotate IAM access keys at least every 90 days.",
                                    compliance_mapping=["CIS-1.3"],
                                    category=self.category,
                                    raw={"user": user, "credential_report": row},
                                )
                            )

        # Root account usage.
        root_row = credential_report.get("<root_account>")
        if root_row and root_row.get("password_last_used") not in (None, "N/A"):
            findings.append(
                Finding(
                    account_id=account_id,
                    region="aws-global",
                    resource_id=f"{account_id}:root",
                    resource_type="iam_root",
                    service="iam",
                    issue="Root account used recently",
                    severity="high",
                    remediation="Stop using the root account for daily operations. Use role-based access instead.",
                    compliance_mapping=["CIS-1.1"],
                    category=self.category,
                    raw={"credential_report": root_row},
                )
            )

        # Unused users and roles (basic heuristic using credential report).
        for username, row in credential_report.items():
            if username in ("<root_account>",):
                continue
            if (
                row.get("password_enabled") == "false"
                and row.get("access_key_1_active") == "false"
                and row.get("access_key_2_active") == "false"
            ):
                findings.append(
                    Finding(
                        account_id=account_id,
                        region="aws-global",
                        resource_id=f"iam:user/{username}",
                        resource_type="iam_user",
                        service="iam",
                        issue="IAM user appears unused (no password and no active access keys)",
                        severity="low",
                        remediation="Remove unused IAM users to reduce attack surface.",
                        compliance_mapping=["AWS-BP-IAM-USER-CLEANUP"],
                        category=self.category,
                        raw={"credential_report": row},
                    )
                )

        return findings

    @staticmethod
    def _is_over_permissive(policy_doc: dict) -> bool:
        statements = policy_doc.get("Statement", [])
        if isinstance(statements, dict):
            statements = [statements]
        for stmt in statements:
            if stmt.get("Effect") != "Allow":
                continue
            action = stmt.get("Action")
            resource = stmt.get("Resource")
            if action in ("*", ["*"]) or resource in ("*", ["*"]):
                return True
        return False

    @staticmethod
    def _is_admin_user(iam, username: str) -> bool:
        attached = iam.list_attached_user_policies(UserName=username)["AttachedPolicies"]
        for pol in attached:
            if "AdministratorAccess" in pol["PolicyName"]:
                return True
        return False

    def _get_credential_report(self, iam):
        """Return parsed credential report keyed by user name."""
        try:
            iam.get_credential_report()
        except iam.exceptions.CredentialReportNotPresentException:
            iam.generate_credential_report()
        except iam.exceptions.CredentialReportNotReadyException:
            iam.generate_credential_report()

        report = iam.get_credential_report()["Content"].decode("utf-8").splitlines()
        header = report[0].split(",")
        rows = {}
        for line in report[1:]:
            cols = line.split(",")
            data = dict(zip(header, cols))
            rows[data["user"]] = data
        return rows

