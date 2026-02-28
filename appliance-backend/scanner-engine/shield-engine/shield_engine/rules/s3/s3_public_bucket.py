"""S3_PUBLIC_BUCKET

Description: Detect publicly accessible S3 buckets.
AWS APIs: s3:list_buckets, s3:get_bucket_location, s3:get_public_access_block,
          s3:get_bucket_policy_status, s3:get_bucket_acl
Compliance mapping: CIS AWS 2.1.1/2.1.2, ISO 27001 A.8.2.3
Remediation: Block public access account-wide and bucket-wide, remove public ACL/policies.
"""

from __future__ import annotations

from typing import Any

from ...aws_utils import safe_call
from ...types import RuleResult, build_result


class ComplianceRule:
    RULE_ID = "S3_PUBLIC_BUCKET"
    SEVERITY = "critical"
    REMEDIATION = (
        "Enable S3 Block Public Access, remove public bucket ACL grants, "
        "and remove bucket policies that allow public access."
    )

    def run(self, session: Any) -> list[RuleResult]:
        s3 = session.client("s3")
        response = safe_call(s3.list_buckets) or {}
        results: list[RuleResult] = []
        for bucket in response.get("Buckets", []):
            bucket_name = bucket.get("Name", "unknown-bucket")
            region = self._bucket_region(s3, bucket_name)
            is_public = self._is_public(s3, bucket_name)
            results.append(
                build_result(
                    self.RULE_ID,
                    "FAIL" if is_public else "PASS",
                    f"arn:aws:s3:::{bucket_name}",
                    region,
                    self.SEVERITY,
                    "Bucket appears publicly accessible." if is_public else "Bucket is not publicly accessible.",
                    self.REMEDIATION,
                )
            )
        if not results:
            results.append(
                build_result(
                    self.RULE_ID,
                    "PASS",
                    "s3:no-buckets",
                    "global",
                    self.SEVERITY,
                    "No S3 buckets found.",
                    self.REMEDIATION,
                )
            )
        return results

    def _bucket_region(self, s3: Any, bucket_name: str) -> str:
        location = safe_call(s3.get_bucket_location, Bucket=bucket_name) or {}
        region = location.get("LocationConstraint")
        return "us-east-1" if region in (None, "") else str(region)

    def _is_public(self, s3: Any, bucket_name: str) -> bool:
        pab_blocked = False
        pab = safe_call(s3.get_public_access_block, Bucket=bucket_name)
        if pab and "PublicAccessBlockConfiguration" in pab:
            conf = pab["PublicAccessBlockConfiguration"]
            pab_blocked = all(
                bool(conf.get(key, False))
                for key in (
                    "BlockPublicAcls",
                    "IgnorePublicAcls",
                    "BlockPublicPolicy",
                    "RestrictPublicBuckets",
                )
            )

        policy_public = False
        policy_status = safe_call(s3.get_bucket_policy_status, Bucket=bucket_name)
        if policy_status:
            policy_public = bool(policy_status.get("PolicyStatus", {}).get("IsPublic", False))

        acl_public = False
        acl = safe_call(s3.get_bucket_acl, Bucket=bucket_name) or {}
        for grant in acl.get("Grants", []):
            grantee = grant.get("Grantee", {})
            uri = grantee.get("URI", "")
            if "AllUsers" in uri or "AuthenticatedUsers" in uri:
                acl_public = True
                break

        if pab_blocked:
            return False
        return policy_public or acl_public

