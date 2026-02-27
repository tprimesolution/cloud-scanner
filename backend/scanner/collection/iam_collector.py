"""IAM roles and policies collector."""
from typing import Any

import boto3

from .base_collector import BaseCollector


class IAMCollector(BaseCollector):
    """Collect IAM roles and policies. IAM is global."""

    resource_type = "iam_role"
    service_name = "iam"

    def collect(self) -> list[dict[str, Any]]:
        """Collect IAM roles with attached policies."""
        results = []
        try:
            client = boto3.client("iam")

            # Roles
            paginator = client.get_paginator("list_roles")
            for page in paginator.paginate():
                for role in page.get("Roles", []):
                    role_name = role.get("RoleName", "")
                    role_arn = role.get("Arn", "")

                    metadata = self._safe_json(role)

                    # Attached policies
                    try:
                        policies = client.list_attached_role_policies(RoleName=role_name)
                        metadata["AttachedPolicies"] = policies.get("AttachedPolicies", [])
                    except Exception:
                        metadata["AttachedPolicies"] = []

                    # Inline policies
                    try:
                        inline = client.list_role_policies(RoleName=role_name)
                        metadata["InlinePolicies"] = inline.get("PolicyNames", [])
                    except Exception:
                        metadata["InlinePolicies"] = []

                    results.append(
                        self._normalize(role_arn, "global", metadata)
                    )

            # Policies (managed, customer-managed only)
            paginator = client.get_paginator("list_policies")
            for page in paginator.paginate(Scope="Local"):
                for policy in page.get("Policies", []):
                    arn = policy.get("Arn", "")
                    metadata = self._safe_json(policy)
                    item = self._normalize(arn, "global", {"_type": "policy", **metadata})
                    item["resource_type"] = "iam_policy"
                    results.append(item)

        except Exception as e:
            results.append({
                "resource_id": "iam-error",
                "resource_type": self.resource_type,
                "region": "global",
                "raw_metadata": {"_error": str(e)},
            })
        return results
