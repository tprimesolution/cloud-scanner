"""S3 buckets collector."""
from typing import Any

import boto3
from botocore.exceptions import ClientError

from .base_collector import BaseCollector


class S3Collector(BaseCollector):
    """Collect S3 bucket metadata. S3 is global - no region."""

    resource_type = "s3_bucket"
    service_name = "s3"

    def collect(self) -> list[dict[str, Any]]:
        """Collect S3 buckets and their config."""
        results = []
        try:
            client = boto3.client("s3")
            buckets = client.list_buckets().get("Buckets", [])

            for bucket in buckets:
                name = bucket.get("Name", "")
                metadata = {"Name": name, "CreationDate": str(bucket.get("CreationDate", ""))}

                # Get bucket config (versioning, encryption, public access block)
                try:
                    loc = client.get_bucket_location(Bucket=name)
                    metadata["LocationConstraint"] = loc.get("LocationConstraint") or "us-east-1"
                except ClientError:
                    pass

                try:
                    ver = client.get_bucket_versioning(Bucket=name)
                    metadata["Versioning"] = ver
                except ClientError:
                    metadata["Versioning"] = {}

                try:
                    enc = client.get_bucket_encryption(Bucket=name)
                    metadata["Encryption"] = enc
                except ClientError:
                    metadata["Encryption"] = {}

                try:
                    pab = client.get_public_access_block(Bucket=name)
                    metadata["PublicAccessBlock"] = pab
                except ClientError:
                    metadata["PublicAccessBlock"] = {}

                metadata = self._safe_json(metadata)
                results.append(
                    self._normalize(f"arn:aws:s3:::{name}", "us-east-1", metadata)
                )
        except Exception as e:
            results.append({
                "resource_id": "s3-error",
                "resource_type": self.resource_type,
                "region": "global",
                "raw_metadata": {"_error": str(e)},
            })
        return results
