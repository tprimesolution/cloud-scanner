from __future__ import annotations

import asyncio
from dataclasses import dataclass
from enum import Enum
from typing import Any, Awaitable, Callable, Dict, Iterable, List, Optional, Tuple

import boto3

from .base_scanner import AwsSessionFactory


class RuleCategory(str, Enum):
    IAM_SECURITY = "IAM_SECURITY"
    NETWORK_SECURITY = "NETWORK_SECURITY"
    ENCRYPTION = "ENCRYPTION"
    LOGGING_MONITORING = "LOGGING_MONITORING"
    COMPUTE_HARDENING = "COMPUTE_HARDENING"
    STORAGE_SECURITY = "STORAGE_SECURITY"
    CONTAINER_SECURITY = "CONTAINER_SECURITY"


@dataclass
class RuleDefinition:
    rule_id: str
    title: str
    category: RuleCategory
    severity: str  # Critical | High | Medium | Low
    service: str   # AWS service name, e.g. iam, ec2
    frameworks: List[str]  # e.g. ["CIS:1.2", "NIST-800-53:AC-6"]
    detector: Callable[[boto3.Session, str, str], List["RuleResult"]]
    # detector(session, region, account_id) -> list[RuleResult]


@dataclass
class RuleResult:
    resource_id: str
    region: str
    rule_id: str
    severity: str
    frameworks: List[str]
    status: str  # PASS | FAIL (we emit FAIL-only for efficiency)
    remediation: str
    details: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "resource_id": self.resource_id,
            "region": self.region,
            "rule_id": self.rule_id,
            "severity": self.severity,
            "frameworks": self.frameworks,
            "status": self.status,
            "remediation": self.remediation,
            "details": self.details,
        }


async def _run_rule_for_region(
    rule: RuleDefinition,
    session_factory: AwsSessionFactory,
    region: str,
    account_id: str,
) -> List[RuleResult]:
    session = session_factory.create_session()
    return await asyncio.to_thread(rule.detector, session, region, account_id)


async def run_rules(
    rules: Iterable[RuleDefinition],
    account_id: Optional[str] = None,
    role_arn: Optional[str] = None,
    regions: Optional[Iterable[str]] = None,
) -> Dict[str, Any]:
    """Run a set of rules across all regions asynchronously.

    Returns JSON-serializable result with one entry per failed rule/resource.
    """
    base_session = boto3.Session()
    sts = base_session.client("sts")
    caller = sts.get_caller_identity()
    account_id = account_id or caller["Account"]

    if regions is None:
        ec2 = base_session.client("ec2")
        resp = ec2.describe_regions(AllRegions=False)
        regions = [r["RegionName"] for r in resp["Regions"]]

    region_list = list(regions)
    session_factory = AwsSessionFactory(account_id=account_id, role_arn=role_arn, base_session=base_session)

    tasks: List[Awaitable[Tuple[RuleDefinition, str, List[RuleResult]]]] = []
    for rule in rules:
        for region in region_list:
            tasks.append(
                _run_rule_for_region(rule, session_factory, region, account_id).then(
                    lambda results, r=rule, reg=region: (r, reg, results)
                )
            )

    # asyncio doesn't natively support .then on Awaitables; instead we gather and annotate explicitly.
    # To keep things simple and avoid extra future glue, we build tasks manually below.
    results: List[RuleResult] = []
    for rule in rules:
        region_tasks = [
            _run_rule_for_region(rule, session_factory, region, account_id) for region in region_list
        ]
        region_results = await asyncio.gather(*region_tasks)
        for rule_results in region_results:
            results.extend(rule_results)

    return {
        "account_id": account_id,
        "regions": region_list,
        "results": [r.to_dict() for r in results],
    }

