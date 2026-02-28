"""AWS SDK utilities for regional scans, pagination, and safe calls."""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any, Iterable

from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger(__name__)


class AwsClientFactory:
    """Caches boto3 clients per service+region to avoid redundant creation."""

    def __init__(self, session: Any) -> None:
        self._session = session
        self._clients: dict[tuple[str, str], Any] = {}

    def client(self, service_name: str, region_name: str) -> Any:
        key = (service_name, region_name)
        if key not in self._clients:
            self._clients[key] = self._session.client(service_name, region_name=region_name)
        return self._clients[key]


def safe_call(func: Any, *args: Any, **kwargs: Any) -> Any:
    """Execute boto3 call and return None on API errors."""
    try:
        return func(*args, **kwargs)
    except (ClientError, BotoCoreError) as exc:
        logger.warning("aws_api_error operation=%s error=%s", getattr(func, "__name__", "unknown"), exc)
        return None


def paginate(client: Any, operation_name: str, result_key: str, **kwargs: Any) -> Iterable[dict[str, Any]]:
    """Yield items from paginated AWS APIs."""
    try:
        paginator = client.get_paginator(operation_name)
        for page in paginator.paginate(**kwargs):
            for item in page.get(result_key, []):
                yield item
    except (ClientError, BotoCoreError) as exc:
        logger.warning(
            "aws_pagination_error service=%s operation=%s error=%s",
            getattr(client, "meta", None).service_model.service_name if hasattr(client, "meta") else "unknown",
            operation_name,
            exc,
        )
        return


@lru_cache(maxsize=1)
def list_enabled_regions(session: Any) -> list[str]:
    """Discover enabled regions once per process."""
    ec2 = session.client("ec2", region_name="us-east-1")
    response = safe_call(ec2.describe_regions, AllRegions=False) or {}
    regions = sorted(region["RegionName"] for region in response.get("Regions", []) if "RegionName" in region)
    return regions or ["us-east-1"]


def account_id(session: Any) -> str:
    sts = session.client("sts", region_name="us-east-1")
    identity = safe_call(sts.get_caller_identity) or {}
    return identity.get("Account", "unknown-account")

