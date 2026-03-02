from __future__ import annotations

from typing import List

import boto3

from .base_scanner import BaseScanner, Finding


class ServerlessScanner(BaseScanner):
    """Serverless checks (Lambda, API Gateway)."""

    category = "Serverless"

    def scan_region(self, session: boto3.Session, region: str) -> List[Finding]:
        sts = session.client("sts")
        account_id = sts.get_caller_identity()["Account"]
        findings: List[Finding] = []

        lambda_client = self._client(session, "lambda", region)

        # Lambda role permissions and env var secrets.
        paginator = lambda_client.get_paginator("list_functions")
        for page in paginator.paginate():
            for fn in page.get("Functions", []):
                role_arn = fn.get("Role", "")
                env = (fn.get("Environment") or {}).get("Variables") or {}

                if role_arn and ("FullAccess" in role_arn or "Admin" in role_arn):
                    findings.append(
                        Finding(
                            account_id=account_id,
                            region=region,
                            resource_id=fn["FunctionArn"],
                            resource_type="lambda_function",
                            service="lambda",
                            issue="Lambda function appears to use an overly privileged role",
                            severity="high",
                            remediation="Use least-privilege IAM roles for Lambda functions.",
                            compliance_mapping=["AWS-SRVLESS-IAM"],
                            category=self.category,
                            raw={"function": fn},
                        )
                    )

                # Secrets in environment variables – heuristic: look for common secret keywords.
                for key, value in env.items():
                    if any(s in key.lower() for s in ("secret", "token", "password", "key")):
                        findings.append(
                            Finding(
                                account_id=account_id,
                                region=region,
                                resource_id=f"{fn['FunctionArn']}:{key}",
                                resource_type="lambda_env",
                                service="lambda",
                                issue="Lambda environment variable name suggests a secret is stored directly",
                                severity="medium",
                                remediation="Store secrets in AWS Secrets Manager or SSM Parameter Store, not in environment variables.",
                                compliance_mapping=["AWS-SRVLESS-SECRETS"],
                                category=self.category,
                                raw={"function": fn, "env_key": key},
                            )
                        )

        # API Gateway – publicly exposed endpoints (basic check).
        apigw = self._client(session, "apigateway", region)
        try:
            apis = apigw.get_rest_apis().get("items", [])
            for api in apis:
                # A full exposure check is complex; here we at least record APIs without usage plans / auth.
                if not api.get("endpointConfiguration"):
                    findings.append(
                        Finding(
                            account_id=account_id,
                            region=region,
                            resource_id=api["id"],
                            resource_type="api_gateway",
                            service="apigateway",
                            issue="API Gateway REST API may be publicly exposed without explicit configuration",
                            severity="medium",
                            remediation="Ensure API Gateway endpoints use authorizers and are not publicly open unless required.",
                            compliance_mapping=["AWS-SRVLESS-API-EXPOSURE"],
                            category=self.category,
                            raw={"api": api},
                        )
                    )
        except Exception:  # noqa: BLE001
            # API Gateway may not be enabled.
            pass

        return findings

