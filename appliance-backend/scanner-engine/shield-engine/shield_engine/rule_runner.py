"""Parallel execution runner for Shield compliance rules."""

from __future__ import annotations

import importlib
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from .types import RuleResult

RULE_MODULES = [
    "shield_engine.rules.iam.iam_mfa_enabled",
    "shield_engine.rules.iam.root_account_mfa_disabled",
    "shield_engine.rules.s3.s3_public_bucket",
    "shield_engine.rules.ec2.encryption_at_rest_disabled",
    "shield_engine.rules.iam.cloudtrail_disabled",
    "shield_engine.rules.ec2.security_group_open_to_world",
    "shield_engine.rules.kms.kms_key_rotation_disabled",
    "shield_engine.rules.rds.public_database_instance",
    "shield_engine.rules.ec2.backup_policy_disabled",
    "shield_engine.rules.ec2.monitoring_alerts_disabled",
]


def _run_single(module_name: str, session: Any) -> list[RuleResult]:
    module = importlib.import_module(module_name)
    rule = module.ComplianceRule()
    return rule.run(session)


def run_all_rules(session: Any, max_workers: int = 6) -> list[RuleResult]:
    """Run all rule modules in parallel."""
    results: list[RuleResult] = []
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_run_single, module_name, session): module_name for module_name in RULE_MODULES}
        for fut in as_completed(futures):
            module_name = futures[fut]
            try:
                results.extend(fut.result())
            except Exception as exc:  # noqa: BLE001
                rule_id = module_name.split(".")[-1].upper()
                results.append(
                    {
                        "rule_id": rule_id,
                        "status": "FAIL",
                        "resource_id": f"rule:{module_name}",
                        "region": "global",
                        "severity": "high",
                        "description": f"Rule execution failed: {exc}",
                        "remediation": "Review IAM permissions and rule logic.",
                    }
                )
    return results


def to_json(results: list[RuleResult]) -> str:
    return json.dumps(results, indent=2, default=str)

