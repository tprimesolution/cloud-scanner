from __future__ import annotations

from typing import List

import boto3

from .base_scanner import BaseScanner, Finding


class StorageScanner(BaseScanner):
    """Storage & database security checks."""

    category = "Storage"

    def scan_region(self, session: boto3.Session, region: str) -> List[Finding]:
        sts = session.client("sts")
        account_id = sts.get_caller_identity()["Account"]
        findings: List[Finding] = []

        # S3 is global – only run once but we still record region as aws-global.
        if region == "us-east-1":
            s3 = session.client("s3")
            buckets = s3.list_buckets()["Buckets"]
            for b in buckets:
                name = b["Name"]
                # Public access
                try:
                    pab = s3.get_public_access_block(Bucket=name)["PublicAccessBlockConfiguration"]
                    if not all(pab.get(k, False) for k in ("BlockPublicAcls", "BlockPublicPolicy", "RestrictPublicBuckets")):
                        findings.append(
                            Finding(
                                account_id=account_id,
                                region="aws-global",
                                resource_id=name,
                                resource_type="s3_bucket",
                                service="s3",
                                issue="S3 bucket may be publicly accessible (public access block not strict)",
                                severity="high",
                                remediation="Enable S3 Block Public Access and review bucket policies.",
                                compliance_mapping=["CIS-3.1"],
                                category=self.category,
                                raw={"bucket": b, "public_access_block": pab},
                            )
                        )
                except s3.exceptions.NoSuchPublicAccessBlockConfiguration:
                    findings.append(
                        Finding(
                            account_id=account_id,
                            region="aws-global",
                            resource_id=name,
                            resource_type="s3_bucket",
                            service="s3",
                            issue="S3 bucket missing public access block configuration",
                            severity="medium",
                            remediation="Configure S3 Block Public Access for the bucket.",
                            compliance_mapping=["CIS-3.1"],
                            category=self.category,
                            raw={"bucket": b},
                        )
                    )

                # Encryption
                try:
                    s3.get_bucket_encryption(Bucket=name)
                except s3.exceptions.ClientError:
                    findings.append(
                        Finding(
                            account_id=account_id,
                            region="aws-global",
                            resource_id=name,
                            resource_type="s3_bucket",
                            service="s3",
                            issue="S3 bucket does not enforce default encryption",
                            severity="medium",
                            remediation="Enable default encryption for S3 buckets.",
                            compliance_mapping=["CIS-3.2"],
                            category=self.category,
                            raw={"bucket": b},
                        )
                    )

        # EBS and snapshots
        ec2 = self._client(session, "ec2", region)
        for vol in self._paginate(ec2, "describe_volumes", "Volumes"):
            if not vol.get("Encrypted", False):
                findings.append(
                    Finding(
                        account_id=account_id,
                        region=region,
                        resource_id=vol["VolumeId"],
                        resource_type="ebs_volume",
                        service="ec2",
                        issue="EBS volume is not encrypted",
                        severity="medium",
                        remediation="Enable encryption by default for EBS volumes and re-create unencrypted volumes where possible.",
                        compliance_mapping=["CIS-3.5"],
                        category=self.category,
                        raw={"volume": vol},
                    )
                )

        # Public EBS snapshots
        for snap in self._paginate(ec2, "describe_snapshots", "Snapshots", OwnerIds=[account_id]):
            if snap.get("Encrypted") is False and any(
                p.get("Group") == "all" for p in snap.get("CreateVolumePermissions", [])
            ):
                findings.append(
                    Finding(
                        account_id=account_id,
                        region=region,
                        resource_id=snap["SnapshotId"],
                        resource_type="ebs_snapshot",
                        service="ec2",
                        issue="EBS snapshot is public and unencrypted",
                        severity="high",
                        remediation="Remove public permissions on snapshots and ensure encryption is enabled.",
                        compliance_mapping=["AWS-STO-SNAP-PUBLIC"],
                        category=self.category,
                        raw={"snapshot": snap},
                    )
                )

        # RDS encryption and backups
        rds = self._client(session, "rds", region)
        for db in rds.describe_db_instances().get("DBInstances", []):
            if not db.get("StorageEncrypted", False):
                findings.append(
                    Finding(
                        account_id=account_id,
                        region=region,
                        resource_id=db["DBInstanceIdentifier"],
                        resource_type="rds_instance",
                        service="rds",
                        issue="RDS instance is not encrypted at rest",
                        severity="high",
                        remediation="Enable encryption at rest for RDS instances using KMS.",
                        compliance_mapping=["CIS-3.6"],
                        category=self.category,
                        raw={"db_instance": db},
                    )
                )
            if db.get("BackupRetentionPeriod", 0) == 0:
                findings.append(
                    Finding(
                        account_id=account_id,
                        region=region,
                        resource_id=db["DBInstanceIdentifier"],
                        resource_type="rds_instance",
                        service="rds",
                        issue="RDS instance has automated backups disabled",
                        severity="medium",
                        remediation="Enable automated backups for RDS instances with an appropriate retention period.",
                        compliance_mapping=["AWS-STO-RDS-BACKUP"],
                        category=self.category,
                        raw={"db_instance": db},
                    )
                )

        return findings

