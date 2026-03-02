from __future__ import annotations

from typing import List

import boto3

from .base_scanner import BaseScanner, Finding


class NetworkScanner(BaseScanner):
    """Networking & exposure checks."""

    category = "Network"

    def scan_region(self, session: boto3.Session, region: str) -> List[Finding]:
        ec2 = self._client(session, "ec2", region)
        sts = session.client("sts")
        account_id = sts.get_caller_identity()["Account"]
        findings: List[Finding] = []

        # Security groups open to 0.0.0.0/0
        for sg in self._paginate(ec2, "describe_security_groups", "SecurityGroups"):
            for perm in sg.get("IpPermissions", []):
                from_port = perm.get("FromPort")
                to_port = perm.get("ToPort")
                for ip_range in perm.get("IpRanges", []):
                    cidr = ip_range.get("CidrIp")
                    if cidr == "0.0.0.0/0":
                        issue = "Security group allows inbound traffic from 0.0.0.0/0"
                        if from_port in (22, 3389) or to_port in (22, 3389):
                            issue += " on SSH/RDP port"
                        findings.append(
                            Finding(
                                account_id=account_id,
                                region=region,
                                resource_id=sg["GroupId"],
                                resource_type="security_group",
                                service="ec2",
                                issue=issue,
                                severity="high",
                                remediation=(
                                    "Restrict inbound rules to known IP ranges or use bastion/VPN. "
                                    "Avoid 0.0.0.0/0 on SSH (22) and RDP (3389)."
                                ),
                                compliance_mapping=["CIS-4.1"],
                                category=self.category,
                                raw={"security_group": sg},
                            )
                        )

        # Publicly accessible EC2 / IMDSv1 enabled / public subnets with sensitive workloads.
        reservations = ec2.describe_instances().get("Reservations", [])
        for res in reservations:
            for inst in res.get("Instances", []):
                instance_id = inst["InstanceId"]
                public_ip = inst.get("PublicIpAddress")
                subnet_id = inst.get("SubnetId")
                metadata_options = inst.get("MetadataOptions", {})
                imds_version = metadata_options.get("HttpTokens", "optional")

                if public_ip:
                    findings.append(
                        Finding(
                            account_id=account_id,
                            region=region,
                            resource_id=instance_id,
                            resource_type="ec2_instance",
                            service="ec2",
                            issue="EC2 instance is publicly reachable (has a public IP)",
                            severity="high",
                            remediation="Place sensitive workloads in private subnets behind load balancers or VPN.",
                            compliance_mapping=["CIS-5.1"],
                            category=self.category,
                            raw={"instance": inst},
                        )
                    )

                if imds_version.lower() != "required":
                    findings.append(
                        Finding(
                            account_id=account_id,
                            region=region,
                            resource_id=instance_id,
                            resource_type="ec2_instance",
                            service="ec2",
                            issue="Instance metadata service v1 enabled (HttpTokens not set to 'required')",
                            severity="medium",
                            remediation="Set instance metadata options HttpTokens=required to enforce IMDSv2.",
                            compliance_mapping=["AWS-IMDSV2"],
                            category=self.category,
                            raw={"instance": inst},
                        )
                    )

                # Public subnet with sensitive workloads: heuristic – public IP + non-empty EBS volumes.
                if public_ip and inst.get("BlockDeviceMappings"):
                    findings.append(
                        Finding(
                            account_id=account_id,
                            region=region,
                            resource_id=subnet_id or "unknown-subnet",
                            resource_type="subnet",
                            service="ec2",
                            issue="Public subnet appears to host EC2 instances with attached volumes",
                            severity="medium",
                            remediation="Review subnet route tables and move sensitive workloads to private subnets.",
                            compliance_mapping=["AWS-NET-ISO"],
                            category=self.category,
                            raw={"instance": inst},
                        )
                    )

        # Publicly accessible RDS
        rds = self._client(session, "rds", region)
        for db in rds.describe_db_instances().get("DBInstances", []):
            if db.get("PubliclyAccessible"):
                findings.append(
                    Finding(
                        account_id=account_id,
                        region=region,
                        resource_id=db["DBInstanceIdentifier"],
                        resource_type="rds_instance",
                        service="rds",
                        issue="RDS instance is publicly accessible",
                        severity="high",
                        remediation="Disable public access for RDS instances and use private connectivity.",
                        compliance_mapping=["CIS-4.4"],
                        category=self.category,
                        raw={"db_instance": db},
                    )
                )

        return findings

