"""EC2 instances collector."""
from typing import Any

from .base_collector import BaseCollector


class EC2Collector(BaseCollector):
    """Collect EC2 instance metadata."""

    resource_type = "ec2_instance"
    service_name = "ec2"

    def collect(self) -> list[dict[str, Any]]:
        """Collect EC2 instances across regions."""
        results = []
        regions = self._get_regions()

        for region in regions:
            try:
                client = boto3.client("ec2", region_name=region)
                paginator = client.get_paginator("describe_instances")
                for page in paginator.paginate():
                    for reservation in page.get("Reservations", []):
                        for instance in reservation.get("Instances", []):
                            instance_id = instance.get("InstanceId", "")
                            metadata = self._safe_json(instance)
                            results.append(
                                self._normalize(instance_id, region, metadata)
                            )
            except Exception as e:
                results.append({
                    "resource_id": f"ec2-error-{region}",
                    "resource_type": self.resource_type,
                    "region": region,
                    "raw_metadata": {"_error": str(e)},
                })
        return results

    def _get_regions(self) -> list[str]:
        """Get enabled regions."""
        try:
            ec2 = boto3.client("ec2", region_name=self.region)
            resp = ec2.describe_regions()
            return [r["RegionName"] for r in resp.get("Regions", [])]
        except Exception:
            return [self.region]
