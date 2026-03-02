from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List

import boto3

from .base_scanner import BaseScanner, Finding


class ComputeScanner(BaseScanner):
    """Compute & OS level checks."""

    category = "Compute"

    def scan_region(self, session: boto3.Session, region: str) -> List[Finding]:
        ec2 = self._client(session, "ec2", region)
        ssm = self._client(session, "ssm", region)
        sts = session.client("sts")
        account_id = sts.get_caller_identity()["Account"]
        findings: List[Finding] = []

        now = datetime.now(timezone.utc)
        outdated_ami_threshold = now - timedelta(days=365)

        reservations = ec2.describe_instances().get("Reservations", [])
        for res in reservations:
            for inst in res.get("Instances", []):
                instance_id = inst["InstanceId"]
                image_id = inst.get("ImageId", "")

                # Outdated AMIs – heuristic based on image creation date.
                if image_id:
                    try:
                        images = ec2.describe_images(ImageIds=[image_id])["Images"]
                        if images:
                            created = images[0].get("CreationDate")
                            if created:
                                created_at = datetime.fromisoformat(created.replace("Z", "+00:00"))
                                if created_at < outdated_ami_threshold:
                                    findings.append(
                                        Finding(
                                            account_id=account_id,
                                            region=region,
                                            resource_id=instance_id,
                                            resource_type="ec2_instance",
                                            service="ec2",
                                            issue="EC2 instance is running on an AMI older than 12 months",
                                            severity="medium",
                                            remediation="Rebuild instances on current hardened AMIs and apply patches.",
                                            compliance_mapping=["AWS-COMP-AMI-AGE"],
                                            category=self.category,
                                            raw={"instance": inst, "image": images[0]},
                                        )
                                    )
                    except Exception:  # noqa: BLE001
                        # Do not fail the scan if describe_images is restricted.
                        pass

        # Patch compliance via SSM – basic check for managed instances.
        try:
            managed_instances = ssm.describe_instance_information()["InstanceInformationList"]
            for mi in managed_instances:
                if mi.get("PingStatus") != "Online":
                    continue
                # If SSM has no platform details or agent is old, flag for review.
                if mi.get("PlatformName") and mi.get("PlatformVersion"):
                    continue
                findings.append(
                    Finding(
                        account_id=account_id,
                        region=region,
                        resource_id=mi["InstanceId"],
                        resource_type="ec2_instance",
                        service="ssm",
                        issue="EC2 instance managed by SSM but missing platform details (patch baseline unknown)",
                        severity="low",
                        remediation="Ensure SSM agent is up to date and patch compliance is reported.",
                        compliance_mapping=["AWS-COMP-SSM-PATCH"],
                        category=self.category,
                        raw={"ssm_instance": mi},
                    )
                )
        except Exception:  # noqa: BLE001
            # SSM may not be enabled in the account/region – ignore.
            pass

        # CVE scanning hook – intentionally pluggable.
        # Here we only emit a placeholder; a separate engine can attach image/OS scanner results.

        return findings

