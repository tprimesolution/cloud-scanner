"""PUBLIC_DATABASE_INSTANCE

Description: Detect RDS instances marked as publicly accessible.
AWS APIs: rds:describe_db_instances
Compliance mapping: CIS AWS 2.3.2, ISO 27001 A.13.1.1
Remediation: Disable public accessibility and place DB instances in private subnets.
"""

from __future__ import annotations

from typing import Any

from ...aws_utils import AwsClientFactory, list_enabled_regions, paginate
from ...types import RuleResult, build_result


class ComplianceRule:
    RULE_ID = "PUBLIC_DATABASE_INSTANCE"
    SEVERITY = "critical"
    REMEDIATION = "Set PubliclyAccessible=false and restrict DB access through private networking."

    def run(self, session: Any) -> list[RuleResult]:
        regions = list_enabled_regions(session)
        factory = AwsClientFactory(session)
        results: list[RuleResult] = []
        for region in regions:
            rds = factory.client("rds", region)
            for db in paginate(rds, "describe_db_instances", "DBInstances"):
                db_id = db.get("DBInstanceIdentifier", "unknown-db")
                public = bool(db.get("PubliclyAccessible", False))
                results.append(
                    build_result(
                        self.RULE_ID,
                        "FAIL" if public else "PASS",
                        db_id,
                        region,
                        self.SEVERITY,
                        "RDS instance is publicly accessible."
                        if public
                        else "RDS instance is not publicly accessible.",
                        self.REMEDIATION,
                    )
                )
        return results

