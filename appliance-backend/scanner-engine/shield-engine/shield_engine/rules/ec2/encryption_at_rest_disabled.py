"""ENCRYPTION_AT_REST_DISABLED

Description: Detect storage resources without encryption at rest:
             S3 buckets, EBS volumes, and RDS instances.
AWS APIs: s3:list_buckets/get_bucket_encryption/get_bucket_location,
          ec2:describe_volumes, rds:describe_db_instances
Compliance mapping: CIS AWS 2.1.1, 2.2.1, 2.3.1; ISO 27001 A.10.1
Remediation: Enable default encryption for S3, use encrypted EBS volumes,
             and enable RDS storage encryption.
"""

from __future__ import annotations

from typing import Any

from ...aws_utils import AwsClientFactory, list_enabled_regions, paginate, safe_call
from ...types import RuleResult, build_result


class ComplianceRule:
    RULE_ID = "ENCRYPTION_AT_REST_DISABLED"
    SEVERITY = "high"
    REMEDIATION = (
        "Enable encryption at rest for S3, EBS, and RDS resources. "
        "Use KMS-managed keys and enforce encryption in provisioning pipelines."
    )

    def run(self, session: Any) -> list[RuleResult]:
        regions = list_enabled_regions(session)
        factory = AwsClientFactory(session)
        results: list[RuleResult] = []
        results.extend(self._scan_s3(session))
        for region in regions:
            results.extend(self._scan_ebs(factory.client("ec2", region), region))
            results.extend(self._scan_rds(factory.client("rds", region), region))
        return results

    def _scan_s3(self, session: Any) -> list[RuleResult]:
        s3 = session.client("s3")
        response = safe_call(s3.list_buckets) or {}
        results: list[RuleResult] = []
        for bucket in response.get("Buckets", []):
            bucket_name = bucket.get("Name", "unknown-bucket")
            encrypted = self._bucket_encrypted(s3, bucket_name)
            loc = safe_call(s3.get_bucket_location, Bucket=bucket_name) or {}
            region = "us-east-1" if not loc.get("LocationConstraint") else str(loc["LocationConstraint"])
            results.append(
                build_result(
                    self.RULE_ID,
                    "PASS" if encrypted else "FAIL",
                    f"arn:aws:s3:::{bucket_name}",
                    region,
                    self.SEVERITY,
                    "S3 bucket encryption is enabled." if encrypted else "S3 bucket encryption is disabled.",
                    self.REMEDIATION,
                )
            )
        return results

    def _bucket_encrypted(self, s3: Any, bucket_name: str) -> bool:
        response = safe_call(s3.get_bucket_encryption, Bucket=bucket_name)
        rules = (response or {}).get("ServerSideEncryptionConfiguration", {}).get("Rules", [])
        return len(rules) > 0

    def _scan_ebs(self, ec2: Any, region: str) -> list[RuleResult]:
        results: list[RuleResult] = []
        for volume in paginate(ec2, "describe_volumes", "Volumes"):
            volume_id = volume.get("VolumeId", "unknown-volume")
            encrypted = bool(volume.get("Encrypted", False))
            results.append(
                build_result(
                    self.RULE_ID,
                    "PASS" if encrypted else "FAIL",
                    volume_id,
                    region,
                    self.SEVERITY,
                    "EBS volume encryption is enabled." if encrypted else "EBS volume encryption is disabled.",
                    self.REMEDIATION,
                )
            )
        return results

    def _scan_rds(self, rds: Any, region: str) -> list[RuleResult]:
        results: list[RuleResult] = []
        for db in paginate(rds, "describe_db_instances", "DBInstances"):
            db_id = db.get("DBInstanceIdentifier", "unknown-db")
            encrypted = bool(db.get("StorageEncrypted", False))
            results.append(
                build_result(
                    self.RULE_ID,
                    "PASS" if encrypted else "FAIL",
                    db_id,
                    region,
                    self.SEVERITY,
                    "RDS storage encryption is enabled." if encrypted else "RDS storage encryption is disabled.",
                    self.REMEDIATION,
                )
            )
        return results

