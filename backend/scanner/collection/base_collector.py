"""Base collector - uses boto3 default credential chain (EC2 IAM role)."""
import json
from abc import ABC, abstractmethod
from typing import Any

import boto3
from botocore.exceptions import ClientError


class BaseCollector(ABC):
    """Base class for AWS resource collectors. Uses default credential chain."""

    resource_type: str = ""

    def __init__(self, region: str = "us-east-1"):
        self.region = region
        self._client = None

    @property
    @abstractmethod
    def service_name(self) -> str:
        """Boto3 service name (e.g. ec2, s3)."""
        pass

    @property
    def client(self):
        """Lazy boto3 client - uses default credential chain (EC2 IAM role)."""
        if self._client is None:
            self._client = boto3.client(self.service_name, region_name=self.region)
        return self._client

    @abstractmethod
    def collect(self) -> list[dict[str, Any]]:
        """Collect resources. Returns list of {resource_id, region, metadata}."""
        pass

    def _normalize(self, resource_id: str, region: str, metadata: dict) -> dict:
        """Normalize for storage."""
        return {
            "resource_id": resource_id,
            "resource_type": self.resource_type,
            "region": region,
            "raw_metadata": metadata,
        }

    def _safe_json(self, obj: Any) -> dict:
        """Convert to JSON-serializable dict."""
        if obj is None:
            return {}
        try:
            return json.loads(json.dumps(obj, default=str))
        except (TypeError, ValueError):
            return {"_raw": str(obj)}
