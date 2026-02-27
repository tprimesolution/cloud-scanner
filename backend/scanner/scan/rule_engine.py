"""YAML-based compliance rule engine. Evaluates collected resources against rules."""
import re
from pathlib import Path
from typing import Any

import yaml


def load_rules(rules_dir: str | Path | None = None) -> list[dict]:
    """Load all YAML rules from directory."""
    rules_dir = Path(rules_dir or Path(__file__).parent.parent / "rules")
    rules = []
    for path in rules_dir.glob("*.yaml"):
        try:
            data = yaml.safe_load(path.read_text())
            if data and data.get("rule_id"):
                rules.append(data)
        except Exception:
            continue
    return rules


def evaluate_rule(rule: dict, resource: dict) -> tuple[bool, str]:
    """
    Evaluate a rule against a resource.
    Returns (passed, message).
    """
    rtype = rule.get("resource_type", "")
    if resource.get("resource_type") != rtype:
        return True, "N/A"  # Rule doesn't apply

    eval_str = rule.get("evaluation", "")
    if not eval_str:
        return True, "OK"

    # Simple eval - extract the evaluate function logic
    # We use a safe subset: check metadata fields directly
    return _evaluate_inline(rule, resource)


def _evaluate_inline(rule: dict, resource: dict) -> tuple[bool, str]:
    """Evaluate using inline logic - no exec for safety."""
    rule_id = rule.get("rule_id", "")
    meta = resource.get("raw_metadata", {})

    if rule_id == "s3_public_access":
        pab = meta.get("PublicAccessBlock", {})
        config = pab.get("PublicAccessBlockConfiguration", {})
        if not config.get("BlockPublicAcls") or not config.get("BlockPublicPolicy"):
            return False, "Public access block not fully configured"
        return True, "OK"

    if rule_id == "s3_encryption":
        if "ServerSideEncryptionConfiguration" not in meta.get("Encryption", {}):
            return False, "Server-side encryption not configured"
        return True, "OK"

    if rule_id == "sg_public_ingress":
        perms = meta.get("IpPermissions", [])
        bad_ports = [22, 3389, 5432, 3306, 1433]
        for p in perms:
            from_port = p.get("FromPort") or 0
            to_port = p.get("ToPort") or 65535
            for rng in p.get("IpRanges", []) + p.get("Ipv6Ranges", []):
                cidr = rng.get("CidrIp") or rng.get("CidrIpv6", "")
                if "0.0.0.0/0" in cidr or "::/0" in cidr:
                    for port in bad_ports:
                        if from_port <= port <= to_port:
                            return False, f"Public access on port {port}"
        return True, "OK"

    if rule_id == "rds_encryption":
        if not meta.get("StorageEncrypted"):
            return False, "RDS storage encryption not enabled"
        return True, "OK"

    if rule_id == "vpc_flow_logs":
        logs = meta.get("FlowLogs", [])
        active = [l for l in logs if l.get("FlowLogStatus") == "ACTIVE"]
        if not active:
            return False, "VPC flow logs not enabled"
        return True, "OK"

    return True, "OK"
