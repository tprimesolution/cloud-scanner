"""CLOUDTRAIL_DISABLED

Description: Detect if CloudTrail is not enabled/logging in all enabled regions.
AWS APIs: cloudtrail:describe_trails, cloudtrail:get_trail_status, ec2:describe_regions
Compliance mapping: CIS AWS 3.1, ISO 27001 A.12.4.1
Remediation: Enable organization or multi-region CloudTrail with logging enabled.
"""

from __future__ import annotations

from typing import Any

from ...aws_utils import AwsClientFactory, list_enabled_regions, safe_call
from ...types import RuleResult, build_result


class ComplianceRule:
    RULE_ID = "CLOUDTRAIL_DISABLED"
    SEVERITY = "critical"
    REMEDIATION = "Create and enable a multi-region CloudTrail trail and validate logging status in each region."

    def run(self, session: Any) -> list[RuleResult]:
        regions = list_enabled_regions(session)
        factory = AwsClientFactory(session)
        results: list[RuleResult] = []

        for region in regions:
            client = factory.client("cloudtrail", region)
            trails_response = safe_call(client.describe_trails, includeShadowTrails=True) or {}
            trails = trails_response.get("trailList", [])
            active = False
            for trail in trails:
                arn = trail.get("TrailARN")
                if not arn:
                    continue
                status = safe_call(client.get_trail_status, Name=arn) or {}
                if status.get("IsLogging"):
                    active = True
                    break
            results.append(
                build_result(
                    self.RULE_ID,
                    "PASS" if active else "FAIL",
                    f"cloudtrail:{region}",
                    region,
                    self.SEVERITY,
                    "CloudTrail logging is enabled in region."
                    if active
                    else "No active CloudTrail logging detected in region.",
                    self.REMEDIATION,
                )
            )
        return results

