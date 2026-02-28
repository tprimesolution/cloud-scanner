"""MONITORING_ALERTS_DISABLED

Description: Detect missing CloudWatch alarms for critical EC2/RDS resources.
AWS APIs: cloudwatch:describe_alarms, ec2:describe_instances, rds:describe_db_instances
Compliance mapping: CIS AWS 3.x, ISO 27001 A.12.4.1
Remediation: Create CloudWatch alarms (e.g., CPU, errors, storage) for production EC2 and RDS assets.
"""

from __future__ import annotations

from typing import Any

from ...aws_utils import AwsClientFactory, list_enabled_regions, paginate
from ...types import RuleResult, build_result


class ComplianceRule:
    RULE_ID = "MONITORING_ALERTS_DISABLED"
    SEVERITY = "medium"
    REMEDIATION = "Define actionable CloudWatch alarms for critical resources and integrate with incident channels."

    def run(self, session: Any) -> list[RuleResult]:
        regions = list_enabled_regions(session)
        factory = AwsClientFactory(session)
        results: list[RuleResult] = []
        for region in regions:
            cloudwatch = factory.client("cloudwatch", region)
            ec2 = factory.client("ec2", region)
            rds = factory.client("rds", region)
            alarm_targets = self._alarm_targets(cloudwatch)
            results.extend(self._scan_ec2(ec2, region, alarm_targets))
            results.extend(self._scan_rds(rds, region, alarm_targets))
        return results

    def _alarm_targets(self, cloudwatch: Any) -> set[str]:
        targets: set[str] = set()
        for alarm in paginate(cloudwatch, "describe_alarms", "MetricAlarms"):
            for dim in alarm.get("Dimensions", []):
                name = dim.get("Name")
                value = dim.get("Value")
                if name in {"InstanceId", "DBInstanceIdentifier"} and value:
                    targets.add(str(value))
        return targets

    def _scan_ec2(self, ec2: Any, region: str, alarm_targets: set[str]) -> list[RuleResult]:
        results: list[RuleResult] = []
        for reservation in paginate(ec2, "describe_instances", "Reservations"):
            for instance in reservation.get("Instances", []):
                instance_id = instance.get("InstanceId", "unknown-instance")
                has_alarm = instance_id in alarm_targets
                results.append(
                    build_result(
                        self.RULE_ID,
                        "PASS" if has_alarm else "FAIL",
                        instance_id,
                        region,
                        self.SEVERITY,
                        "CloudWatch alarm found for EC2 instance."
                        if has_alarm
                        else "No CloudWatch alarm found for EC2 instance.",
                        self.REMEDIATION,
                    )
                )
        return results

    def _scan_rds(self, rds: Any, region: str, alarm_targets: set[str]) -> list[RuleResult]:
        results: list[RuleResult] = []
        for db in paginate(rds, "describe_db_instances", "DBInstances"):
            db_id = db.get("DBInstanceIdentifier", "unknown-db")
            has_alarm = db_id in alarm_targets
            results.append(
                build_result(
                    self.RULE_ID,
                    "PASS" if has_alarm else "FAIL",
                    db_id,
                    region,
                    self.SEVERITY,
                    "CloudWatch alarm found for RDS instance."
                    if has_alarm
                    else "No CloudWatch alarm found for RDS instance.",
                    self.REMEDIATION,
                )
            )
        return results

