"""SECURITY_GROUP_OPEN_TO_WORLD

Description: Detect SG ingress rules exposing sensitive ports to 0.0.0.0/0 or ::/0.
AWS APIs: ec2:describe_security_groups
Compliance mapping: CIS AWS 5.2/5.3/5.4, ISO 27001 A.13.1.1
Remediation: Restrict inbound security group rules to approved CIDRs and least privilege ports.
"""

from __future__ import annotations

from typing import Any

from ...aws_utils import AwsClientFactory, list_enabled_regions, paginate
from ...types import RuleResult, build_result

SENSITIVE_PORTS = {22, 3389, 3306, 5432, 6379, 27017}


class ComplianceRule:
    RULE_ID = "SECURITY_GROUP_OPEN_TO_WORLD"
    SEVERITY = "high"
    REMEDIATION = "Remove world-open ingress on sensitive ports and restrict source ranges."

    def run(self, session: Any) -> list[RuleResult]:
        regions = list_enabled_regions(session)
        factory = AwsClientFactory(session)
        results: list[RuleResult] = []

        for region in regions:
            ec2 = factory.client("ec2", region)
            for sg in paginate(ec2, "describe_security_groups", "SecurityGroups"):
                group_id = sg.get("GroupId", "unknown-sg")
                open_world = self._has_world_open_sensitive_rule(sg.get("IpPermissions", []))
                results.append(
                    build_result(
                        self.RULE_ID,
                        "FAIL" if open_world else "PASS",
                        group_id,
                        region,
                        self.SEVERITY,
                        "Security group allows world access to sensitive ports."
                        if open_world
                        else "Security group does not expose sensitive ports to the world.",
                        self.REMEDIATION,
                    )
                )
        return results

    def _has_world_open_sensitive_rule(self, permissions: list[dict[str, Any]]) -> bool:
        for perm in permissions:
            protocol = perm.get("IpProtocol")
            if protocol not in ("tcp", "-1"):
                continue
            from_port = perm.get("FromPort", -1)
            to_port = perm.get("ToPort", -1)
            world_open = any(
                rng.get("CidrIp") == "0.0.0.0/0" for rng in perm.get("IpRanges", [])
            ) or any(rng.get("CidrIpv6") == "::/0" for rng in perm.get("Ipv6Ranges", []))
            if not world_open:
                continue
            if protocol == "-1":
                return True
            for port in SENSITIVE_PORTS:
                if from_port <= port <= to_port:
                    return True
        return False

