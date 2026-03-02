from __future__ import annotations

from typing import List

import boto3

from .base_scanner import BaseScanner, Finding


class ContainerScanner(BaseScanner):
    """Container & Kubernetes checks."""

    category = "Container"

    def scan_region(self, session: boto3.Session, region: str) -> List[Finding]:
        sts = session.client("sts")
        account_id = sts.get_caller_identity()["Account"]
        findings: List[Finding] = []

        # ECR checks
        ecr = self._client(session, "ecr", region)
        try:
            repos = ecr.describe_repositories()["repositories"]
            for repo in repos:
                if repo.get("imageScanningConfiguration", {}).get("scanOnPush") is False:
                    findings.append(
                        Finding(
                            account_id=account_id,
                            region=region,
                            resource_id=repo["repositoryArn"],
                            resource_type="ecr_repository",
                            service="ecr",
                            issue="ECR repository has image scan on push disabled",
                            severity="medium",
                            remediation="Enable image scanning on push for ECR repositories.",
                            compliance_mapping=["AWS-CONT-ECR-SCAN"],
                            category=self.category,
                            raw={"repository": repo},
                        )
                    )
                # Public repo
                if repo.get("repositoryUri", "").startswith(f"{account_id}.dkr.ecr") is False:
                    # Non-standard URI – this is a heuristic; public access is better checked via get_repository_policy.
                    pass
                try:
                    policy = ecr.get_repository_policy(repositoryName=repo["repositoryName"])
                    if "Allow" in policy.get("policyText", "") and "Principal\":\"*" in policy.get(
                        "policyText", ""
                    ):
                        findings.append(
                            Finding(
                                account_id=account_id,
                                region=region,
                                resource_id=repo["repositoryArn"],
                                resource_type="ecr_repository",
                                service="ecr",
                                issue="ECR repository policy may allow public access",
                                severity="high",
                                remediation="Restrict ECR repository policies to specific principals.",
                                compliance_mapping=["AWS-CONT-ECR-PUBLIC"],
                                category=self.category,
                                raw={"repository": repo, "policy": policy},
                            )
                        )
                except ecr.exceptions.RepositoryPolicyNotFoundException:
                    pass
        except Exception:  # noqa: BLE001
            # ECR may not be enabled.
            pass

        # EKS checks – public endpoint exposure and basic RBAC indicators.
        eks = self._client(session, "eks", region)
        try:
            clusters = eks.list_clusters()["clusters"]
            for name in clusters:
                cluster = eks.describe_cluster(name=name)["cluster"]
                endpoint_public = cluster.get("resourcesVpcConfig", {}).get("endpointPublicAccess", False)
                if endpoint_public:
                    findings.append(
                        Finding(
                            account_id=account_id,
                            region=region,
                            resource_id=cluster["arn"],
                            resource_type="eks_cluster",
                            service="eks",
                            issue="EKS cluster endpoint is publicly accessible",
                            severity="high",
                            remediation="Restrict EKS API server access using private endpoints, VPN, or IP allowlists.",
                            compliance_mapping=["AWS-CONT-EKS-ENDPOINT"],
                            category=self.category,
                            raw={"cluster": cluster},
                        )
                    )

                # RBAC / privileged containers – full inspection requires Kubernetes API;
                # here we only emit a placeholder hook based on enabled logging/addons.
        except Exception:  # noqa: BLE001
            pass

        return findings

