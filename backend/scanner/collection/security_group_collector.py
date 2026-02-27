"""Security groups collector."""
from typing import Any

from .base_collector import BaseCollector


class SecurityGroupCollector(BaseCollector):
    """Collect EC2 security groups."""

    resource_type = "security_group"
    service_name = "ec2"

    def collect(self) -> list[dict[str, Any]]:
        """Collect security groups per region."""
        results = []
        regions = self._get_regions()

        for region in regions:
            try:
                client = boto3.client("ec2", region_name=region)
                paginator = client.get_paginator("describe_security_groups")
                for page in paginator.paginate():
                    for sg in page.get("SecurityGroups", []):
                        sg_id = sg.get("GroupId", "")
                        metadata = self._safe_json(sg)
                        metadata["IpPermissions"] = sg.get("IpPermissions", [])
                        metadata["IpPermissionsEgress"] = sg.get("IpPermissionsEgress", [])
                        results.append(
                            self._normalize(sg_id, region, metadata)
                        )
            except Exception as e:
                results.append({
                    "resource_id": f"sg-error-{region}",
                    "resource_type": self.resource_type,
                    "region": region,
                    "raw_metadata": {"_error": str(e)},
                })
        return results

    def _get_regions(self) -> list[str]:
        try:
            ec2 = boto3.client("ec2", region_name=self.region)
            resp = ec2.describe_regions()
            return [r["RegionName"] for r in resp.get("Regions", [])]
        except Exception:
            return [self.region]
