from __future__ import annotations

from typing import List

import boto3

from .base_scanner import BaseScanner, Finding


class MonitoringScanner(BaseScanner):
    """Logging & monitoring checks."""

    category = "Monitoring"

    def scan_region(self, session: boto3.Session, region: str) -> List[Finding]:
        sts = session.client("sts")
        account_id = sts.get_caller_identity()["Account"]
        findings: List[Finding] = []

        # CloudTrail
        ct = self._client(session, "cloudtrail", region)
        try:
            trails = ct.describe_trails(includeShadowTrails=False)["trailList"]
            if not trails:
                findings.append(
                    Finding(
                        account_id=account_id,
                        region=region,
                        resource_id=account_id,
                        resource_type="account",
                        service="cloudtrail",
                        issue="CloudTrail not configured in region",
                        severity="high",
                        remediation="Enable CloudTrail with organization-wide multi-region trails.",
                        compliance_mapping=["CIS-2.1"],
                        category=self.category,
                        raw={},
                    )
                )
        except Exception:  # noqa: BLE001
            pass

        # GuardDuty
        gd = self._client(session, "guardduty", region)
        try:
            detectors = gd.list_detectors()["DetectorIds"]
            if not detectors:
                findings.append(
                    Finding(
                        account_id=account_id,
                        region=region,
                        resource_id=account_id,
                        resource_type="account",
                        service="guardduty",
                        issue="GuardDuty is not enabled in region",
                        severity="medium",
                        remediation="Enable Amazon GuardDuty in all active regions and integrate with central monitoring.",
                        compliance_mapping=["AWS-MON-GD"],
                        category=self.category,
                        raw={},
                    )
                )
        except Exception:  # noqa: BLE001
            pass

        # AWS Config
        cfg = self._client(session, "config", region)
        try:
            recorders = cfg.describe_configuration_recorders()["ConfigurationRecorders"]
            if not recorders:
                findings.append(
                    Finding(
                        account_id=account_id,
                        region=region,
                        resource_id=account_id,
                        resource_type="account",
                        service="config",
                        issue="AWS Config is not enabled in region",
                        severity="medium",
                        remediation="Enable AWS Config in all regions with appropriate recording groups.",
                        compliance_mapping=["CIS-2.5"],
                        category=self.category,
                        raw={},
                    )
                )
        except Exception:  # noqa: BLE001
            pass

        return findings

