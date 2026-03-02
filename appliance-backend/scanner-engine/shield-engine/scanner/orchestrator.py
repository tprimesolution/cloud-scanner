from __future__ import annotations

import asyncio
from typing import Any, Dict, Iterable, List, Optional

import boto3

from .base_scanner import AwsSessionFactory, Finding, compute_risk_score
from .exposure_graph import ExposureGraph
from .container_scanner import ContainerScanner
from .compute_scanner import ComputeScanner
from .iam_scanner import IamScanner
from .monitoring_scanner import MonitoringScanner
from .network_scanner import NetworkScanner
from .org_scanner import OrgScanner
from .serverless_scanner import ServerlessScanner
from .storage_scanner import StorageScanner


DEFAULT_SCOPES = {
    "iam",
    "network",
    "compute",
    "storage",
    "container",
    "serverless",
    "monitoring",
    "org",
}


async def run_infra_scan(
    account_id: Optional[str] = None,
    role_arn: Optional[str] = None,
    regions: Optional[Iterable[str]] = None,
    scopes: Optional[Iterable[str]] = None,
) -> Dict[str, Any]:
    """Entry point used by FastAPI to execute all infra scanners."""
    base_session = boto3.Session()
    sts = base_session.client("sts")
    caller = sts.get_caller_identity()
    account_id = account_id or caller["Account"]

    # Discover regions if not explicitly provided.
    if regions is None:
        ec2 = base_session.client("ec2")
        resp = ec2.describe_regions(AllRegions=False)
        regions = [r["RegionName"] for r in resp["Regions"]]

    region_list = list(regions)
    scope_set = set(scopes or DEFAULT_SCOPES)

    session_factory = AwsSessionFactory(account_id=account_id, role_arn=role_arn, base_session=base_session)

    scanners = []
    if "iam" in scope_set:
        scanners.append(IamScanner(session_factory, ["us-east-1"]))  # IAM/global
    if "network" in scope_set:
        scanners.append(NetworkScanner(session_factory, region_list))
    if "compute" in scope_set:
        scanners.append(ComputeScanner(session_factory, region_list))
    if "storage" in scope_set:
        scanners.append(StorageScanner(session_factory, region_list))
    if "container" in scope_set:
        scanners.append(ContainerScanner(session_factory, region_list))
    if "serverless" in scope_set:
        scanners.append(ServerlessScanner(session_factory, region_list))
    if "monitoring" in scope_set:
        scanners.append(MonitoringScanner(session_factory, region_list))
    if "org" in scope_set:
        scanners.append(OrgScanner(session_factory, ["us-east-1"]))

    results: List[List[Finding]] = await asyncio.gather(*(s.scan() for s in scanners))
    findings: List[Finding] = [f for group in results for f in group]

    risk = compute_risk_score(findings)

    # Basic stats for dashboards.
    by_category: Dict[str, int] = {}
    for f in findings:
        by_category[f.category] = by_category.get(f.category, 0) + 1

    # Build a lightweight exposure graph for potential lateral movement.
    graph = ExposureGraph()
    for f in findings:
        raw = f.raw or {}
        if f.resource_type == "ec2_instance" and "instance" in raw:
            inst = raw["instance"]
            profile = (inst.get("IamInstanceProfile") or {}).get("Arn")
            if profile:
                graph.add_edge(
                    source=f.resource_id,
                    target=profile,
                    relationship="instance_profile",
                )

    exposure_paths: Dict[str, int] = {}
    for f in findings:
        if f.resource_type == "ec2_instance":
            reachable = graph.get_reachable(f.resource_id)
            exposure_paths[f.resource_id] = max(len(reachable) - 1, 0)

    return {
        "account_id": account_id,
        "regions": region_list,
        "scopes": sorted(scope_set),
        "risk": risk,
        "summary": {
            "by_category": by_category,
            "exposure_paths": exposure_paths,
        },
        "results": [f.to_dict() for f in findings],
    }

