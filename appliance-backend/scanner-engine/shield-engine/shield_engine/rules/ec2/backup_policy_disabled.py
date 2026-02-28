"""BACKUP_POLICY_DISABLED

Description: Detect RDS/EBS resources without effective backup coverage.
AWS APIs: rds:describe_db_instances, ec2:describe_volumes, ec2:describe_snapshots
Compliance mapping: CIS AWS 2.3.x, ISO 27001 A.12.3.1
Remediation: Configure backup retention for RDS and ensure scheduled snapshots for EBS.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from ...aws_utils import AwsClientFactory, list_enabled_regions, paginate
from ...types import RuleResult, build_result


class ComplianceRule:
    RULE_ID = "BACKUP_POLICY_DISABLED"
    SEVERITY = "high"
    REMEDIATION = "Set RDS backup retention > 0 and enforce periodic EBS snapshots using AWS Backup or DLM."
    SNAPSHOT_LOOKBACK_DAYS = 7

    def run(self, session: Any) -> list[RuleResult]:
        regions = list_enabled_regions(session)
        factory = AwsClientFactory(session)
        results: list[RuleResult] = []
        for region in regions:
            rds = factory.client("rds", region)
            ec2 = factory.client("ec2", region)
            results.extend(self._scan_rds(rds, region))
            results.extend(self._scan_ebs(ec2, region))
        return results

    def _scan_rds(self, rds: Any, region: str) -> list[RuleResult]:
        results: list[RuleResult] = []
        for db in paginate(rds, "describe_db_instances", "DBInstances"):
            db_id = db.get("DBInstanceIdentifier", "unknown-db")
            retention = int(db.get("BackupRetentionPeriod", 0) or 0)
            enabled = retention > 0
            results.append(
                build_result(
                    self.RULE_ID,
                    "PASS" if enabled else "FAIL",
                    db_id,
                    region,
                    self.SEVERITY,
                    "RDS backup retention is configured."
                    if enabled
                    else "RDS backup retention is disabled (0 days).",
                    self.REMEDIATION,
                )
            )
        return results

    def _scan_ebs(self, ec2: Any, region: str) -> list[RuleResult]:
        volumes = list(paginate(ec2, "describe_volumes", "Volumes"))
        recent_cutoff = datetime.now(timezone.utc) - timedelta(days=self.SNAPSHOT_LOOKBACK_DAYS)
        snapshots = list(
            paginate(
                ec2,
                "describe_snapshots",
                "Snapshots",
                OwnerIds=["self"],
                Filters=[{"Name": "status", "Values": ["completed"]}],
            )
        )
        recent_by_volume = {
            snap.get("VolumeId")
            for snap in snapshots
            if snap.get("VolumeId") and snap.get("StartTime") and snap["StartTime"] >= recent_cutoff
        }
        results: list[RuleResult] = []
        for vol in volumes:
            vol_id = vol.get("VolumeId", "unknown-volume")
            has_recent_backup = vol_id in recent_by_volume
            results.append(
                build_result(
                    self.RULE_ID,
                    "PASS" if has_recent_backup else "FAIL",
                    vol_id,
                    region,
                    self.SEVERITY,
                    "EBS volume has a recent snapshot backup."
                    if has_recent_backup
                    else f"EBS volume has no snapshot in the last {self.SNAPSHOT_LOOKBACK_DAYS} days.",
                    self.REMEDIATION,
                )
            )
        return results

