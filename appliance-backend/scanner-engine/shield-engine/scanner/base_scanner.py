from __future__ import annotations

import asyncio
import logging
import random
import time
from dataclasses import dataclass, asdict
from typing import Any, Dict, Iterable, List, Optional

import boto3
from botocore.exceptions import ClientError


logger = logging.getLogger(__name__)


SEVERITY_WEIGHTS: Dict[str, int] = {
    "critical": 25,
    "high": 10,
    "medium": 5,
    "low": 1,
}


@dataclass
class Finding:
    account_id: str
    region: str
    resource_id: str
    resource_type: str
    service: str
    issue: str
    severity: str  # critical | high | medium | low
    remediation: str
    compliance_mapping: List[str]
    category: str  # IAM, Network, Storage, etc.
    raw: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class AwsSessionFactory:
    """Creates boto3 sessions, supporting optional AssumeRole."""

    def __init__(
        self,
        account_id: Optional[str] = None,
        role_arn: Optional[str] = None,
        session_name: str = "nimbus-guard-infra-scan",
        base_session: Optional[boto3.Session] = None,
    ) -> None:
        self.account_id = account_id
        self.role_arn = role_arn
        self.session_name = session_name
        self._base_session = base_session or boto3.Session()

    def create_session(self) -> boto3.Session:
        if not self.role_arn:
            return self._base_session

        sts = self._base_session.client("sts")
        resp = sts.assume_role(
            RoleArn=self.role_arn,
            RoleSessionName=self.session_name,
        )
        creds = resp["Credentials"]
        return boto3.Session(
            aws_access_key_id=creds["AccessKeyId"],
            aws_secret_access_key=creds["SecretAccessKey"],
            aws_session_token=creds["SessionToken"],
        )


class BaseScanner:
    """Base class with helpers for region-aware, throttling-safe AWS scans."""

    category: str = "Generic"

    def __init__(
        self,
        session_factory: AwsSessionFactory,
        regions: Iterable[str],
        max_concurrent_regions: int = 5,
    ) -> None:
        self.session_factory = session_factory
        self.regions = list(regions)
        self.max_concurrent_regions = max_concurrent_regions

    async def scan(self) -> List[Finding]:
        """Run the scanner across all configured regions concurrently."""
        semaphore = asyncio.Semaphore(self.max_concurrent_regions)
        tasks = [
            self._run_region_with_semaphore(region, semaphore)
            for region in self.regions
        ]
        results: List[List[Finding]] = await asyncio.gather(*tasks)
        return [f for group in results for f in group]

    async def _run_region_with_semaphore(
        self,
        region: str,
        semaphore: asyncio.Semaphore,
    ) -> List[Finding]:
        async with semaphore:
            try:
                session = self.session_factory.create_session()
                return await asyncio.to_thread(self.scan_region, session, region)
            except Exception as exc:  # noqa: BLE001
                logger.exception(
                    "scanner_region_error category=%s region=%s error=%s",
                    self.category,
                    region,
                    exc,
                )
                return []

    # Subclasses implement this synchronously using boto3.
    def scan_region(self, session: boto3.Session, region: str) -> List[Finding]:
        raise NotImplementedError

    # ---- AWS helpers ----

    def _client(self, session: boto3.Session, service: str, region: str):
        return session.client(service, region_name=region)

    def _call_aws(
        self,
        func,
        *args,
        max_attempts: int = 5,
        base_delay: float = 0.5,
        **kwargs,
    ):
        """Wrap AWS API calls with retry and exponential backoff for throttling."""
        attempt = 0
        while True:
            try:
                return func(*args, **kwargs)
            except ClientError as exc:
                code = exc.response["Error"]["Code"]
                if code in ("Throttling", "ThrottlingException", "RequestLimitExceeded"):
                    attempt += 1
                    if attempt >= max_attempts:
                        raise
                    delay = base_delay * (2 ** (attempt - 1))
                    delay *= 0.5 + random.random()  # jitter
                    logger.warning(
                        "aws_throttle op=%s attempt=%d delay=%.2fs",
                        func.__name__,
                        attempt,
                        delay,
                    )
                    time.sleep(delay)
                    continue
                raise

    def _paginate(
        self,
        client,
        method_name: str,
        result_key: str,
        **kwargs,
    ):
        paginator = client.get_paginator(method_name)
        for page in paginator.paginate(**kwargs):
            for item in page.get(result_key, []):
                yield item


def compute_risk_score(findings: List[Finding]) -> Dict[str, Any]:
    """Compute aggregate risk score from findings."""
    by_severity: Dict[str, int] = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for f in findings:
        sev = f.severity.lower()
        if sev in by_severity:
            by_severity[sev] += 1

    weighted = sum(by_severity[sev] * SEVERITY_WEIGHTS[sev] for sev in by_severity)
    # Tunable normalization factor; higher value means more tolerant.
    k = 200.0
    score = max(0, int(round(100 - (weighted / k))))

    return {
        "score": score,
        "by_severity": by_severity,
        "total_findings": sum(by_severity.values()),
    }

