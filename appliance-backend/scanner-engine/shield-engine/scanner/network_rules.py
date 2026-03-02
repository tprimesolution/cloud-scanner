from __future__ import annotations

from typing import List

import boto3

from .rule_engine import RuleCategory, RuleDefinition, RuleResult


def _sg_open_detector(session: boto3.Session, region: str, account_id: str) -> List[RuleResult]:
  ec2 = session.client("ec2", region_name=region)
  results: List[RuleResult] = []

  paginator = ec2.get_paginator("describe_security_groups")
  for page in paginator.paginate():
    for sg in page.get("SecurityGroups", []):
      for perm in sg.get("IpPermissions", []):
        from_port = perm.get("FromPort")
        to_port = perm.get("ToPort")
        for ip_range in perm.get("IpRanges", []):
          cidr = ip_range.get("CidrIp")
          if cidr == "0.0.0.0/0":
            results.append(
              RuleResult(
                resource_id=sg["GroupId"],
                region=region,
                rule_id="NET_SG_OPEN_0_0_0_0",
                severity="High",
                frameworks=[
                  "CIS:4.1",
                  "NIST-800-53:SC-7",
                  "PCI-DSS:1.2",
                  "CCM:IVS-09",
                ],
                status="FAIL",
                remediation="Restrict security group rules that allow 0.0.0.0/0; use specific CIDR ranges or security groups.",
                details={"security_group": sg, "from_port": from_port, "to_port": to_port},
              )
            )
  return results


def _public_rds_detector(session: boto3.Session, region: str, account_id: str) -> List[RuleResult]:
  rds = session.client("rds", region_name=region)
  results: List[RuleResult] = []

  for db in rds.describe_db_instances().get("DBInstances", []):
    if db.get("PubliclyAccessible"):
      results.append(
        RuleResult(
          resource_id=db["DBInstanceIdentifier"],
          region=region,
          rule_id="NET_PUBLIC_RDS",
          severity="High",
          frameworks=[
            "CIS:4.4",
            "NIST-800-53:SC-7",
            "PCI-DSS:1.3",
          ],
          status="FAIL",
          remediation="Disable public accessibility for RDS instances and use private connectivity.",
          details={"db_instance": db},
        )
      )
  return results


def _public_ec2_detector(session: boto3.Session, region: str, account_id: str) -> List[RuleResult]:
  ec2 = session.client("ec2", region_name=region)
  results: List[RuleResult] = []

  reservations = ec2.describe_instances().get("Reservations", [])
  for res in reservations:
    for inst in res.get("Instances", []):
      if inst.get("PublicIpAddress"):
        results.append(
          RuleResult(
            resource_id=inst["InstanceId"],
            region=region,
            rule_id="NET_PUBLIC_EC2",
            severity="High",
            frameworks=[
              "CIS:5.1",
              "NIST-800-53:SC-7",
              "PCI-DSS:1.3",
            ],
            status="FAIL",
            remediation="Place EC2 instances behind load balancers or VPN in private subnets; avoid direct public IPs on sensitive workloads.",
            details={"instance": inst},
          )
        )
  return results


def _eks_public_api_detector(session: boto3.Session, region: str, account_id: str) -> List[RuleResult]:
  eks = session.client("eks", region_name=region)
  results: List[RuleResult] = []

  try:
    clusters = eks.list_clusters()["clusters"]
  except Exception:  # noqa: BLE001
    return results

  for name in clusters:
    cluster = eks.describe_cluster(name=name)["cluster"]
    public = cluster.get("resourcesVpcConfig", {}).get("endpointPublicAccess", False)
    if public:
      results.append(
        RuleResult(
          resource_id=cluster["arn"],
          region=region,
          rule_id="NET_EKS_PUBLIC_API",
          severity="High",
          frameworks=[
            "CIS:5.1",
            "NIST-800-53:SC-7",
            "CCM:IVS-09",
          ],
          status="FAIL",
          remediation="Restrict EKS API endpoint access using private endpoints, VPN, or IP allowlists.",
          details={"cluster": cluster},
        )
      )
  return results


NETWORK_RULES: List[RuleDefinition] = [
  RuleDefinition(
    rule_id="NET_SG_OPEN_0_0_0_0",
    title="Security groups allow 0.0.0.0/0",
    category=RuleCategory.NETWORK_SECURITY,
    severity="High",
    service="ec2",
    frameworks=["CIS:4.1", "NIST-800-53:SC-7", "PCI-DSS:1.2", "CCM:IVS-09"],
    detector=_sg_open_detector,
  ),
  RuleDefinition(
    rule_id="NET_PUBLIC_RDS",
    title="Publicly accessible RDS instances",
    category=RuleCategory.NETWORK_SECURITY,
    severity="High",
    service="rds",
    frameworks=["CIS:4.4", "NIST-800-53:SC-7", "PCI-DSS:1.3"],
    detector=_public_rds_detector,
  ),
  RuleDefinition(
    rule_id="NET_PUBLIC_EC2",
    title="Publicly accessible EC2 instances",
    category=RuleCategory.NETWORK_SECURITY,
    severity="High",
    service="ec2",
    frameworks=["CIS:5.1", "NIST-800-53:SC-7", "PCI-DSS:1.3"],
    detector=_public_ec2_detector,
  ),
  RuleDefinition(
    rule_id="NET_EKS_PUBLIC_API",
    title="EKS clusters with public API endpoints",
    category=RuleCategory.NETWORK_SECURITY,
    severity="High",
    service="eks",
    frameworks=["CIS:5.1", "NIST-800-53:SC-7", "CCM:IVS-09"],
    detector=_eks_public_api_detector,
  ),
]

