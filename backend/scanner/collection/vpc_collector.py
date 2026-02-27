"""VPC configurations collector."""
from typing import Any

from .base_collector import BaseCollector


class VPCCollector(BaseCollector):
    """Collect VPC and subnet metadata."""

    resource_type = "vpc"
    service_name = "ec2"

    def collect(self) -> list[dict[str, Any]]:
        """Collect VPCs per region."""
        results = []
        regions = self._get_regions()

        for region in regions:
            try:
                client = boto3.client("ec2", region_name=region)
                paginator = client.get_paginator("describe_vpcs")
                for page in paginator.paginate():
                    for vpc in page.get("Vpcs", []):
                        vpc_id = vpc.get("VpcId", "")
                        metadata = self._safe_json(vpc)

                        # Subnets
                        try:
                            subnets = client.describe_subnets(
                                Filters=[{"Name": "vpc-id", "Values": [vpc_id]}]
                            )
                            metadata["Subnets"] = subnets.get("Subnets", [])
                        except Exception:
                            metadata["Subnets"] = []

                        # Flow logs
                        try:
                            flow = client.describe_flow_logs(
                                Filter=[{"Name": "resource-id", "Values": [vpc_id]}]
                            )
                            metadata["FlowLogs"] = flow.get("FlowLogs", [])
                        except Exception:
                            metadata["FlowLogs"] = []

                        results.append(
                            self._normalize(vpc_id, region, metadata)
                        )
            except Exception as e:
                results.append({
                    "resource_id": f"vpc-error-{region}",
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
