"""RDS instances collector."""
from typing import Any

from .base_collector import BaseCollector


class RDSCollector(BaseCollector):
    """Collect RDS instance metadata."""

    resource_type = "rds_instance"
    service_name = "rds"

    def collect(self) -> list[dict[str, Any]]:
        """Collect RDS instances per region."""
        results = []
        regions = self._get_regions()

        for region in regions:
            try:
                client = boto3.client("rds", region_name=region)
                paginator = client.get_paginator("describe_db_instances")
                for page in paginator.paginate():
                    for db in page.get("DBInstances", []):
                        db_id = db.get("DBInstanceIdentifier", "")
                        arn = db.get("DBInstanceArn", db_id)
                        metadata = self._safe_json(db)
                        results.append(
                            self._normalize(arn, region, metadata)
                        )
            except Exception as e:
                results.append({
                    "resource_id": f"rds-error-{region}",
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
