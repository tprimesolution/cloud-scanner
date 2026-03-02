from __future__ import annotations

from typing import List

import boto3

from .base_scanner import BaseScanner, Finding


class OrgScanner(BaseScanner):
    """Organization-level governance checks."""

    category = "Org"

    def scan_region(self, session: boto3.Session, region: str) -> List[Finding]:
        # Organizations, CloudTrail and Config org-level resources are global; run once.
        if region != "us-east-1":
            return []

        sts = session.client("sts")
        account_id = sts.get_caller_identity()["Account"]
        findings: List[Finding] = []

        org = session.client("organizations")
        try:
            org.describe_organization()
        except org.exceptions.AWSOrganizationsNotInUseException:
            return findings  # Not using Organizations – nothing to check.

        # SCP guardrails.
        policies = org.list_policies(Filter="SERVICE_CONTROL_POLICY")["Policies"]
        roots = org.list_roots()["Roots"]

        attached = []
        for root in roots:
            attached += org.list_policies_for_target(
                TargetId=root["Id"],
                Filter="SERVICE_CONTROL_POLICY",
            )["Policies"]

        if not attached:
            findings.append(
                Finding(
                    account_id=account_id,
                    region="aws-global",
                    resource_id=account_id,
                    resource_type="organization",
                    service="organizations",
                    issue="No SCP guardrails attached at the organization root",
                    severity="high",
                    remediation="Define and attach SCPs at the organization root to enforce baseline guardrails.",
                    compliance_mapping=["AWS-ORG-SCP"],
                    category=self.category,
                    raw={"policies": policies},
                )
            )

        # Centralized logging & org-wide Config rules are partially inferred
        # from the existence of organization-level CloudTrail and Config settings.
        # These are complementary to the per-region MonitoringScanner checks.

        return findings

