"""Shared types and helpers for Shield compliance rules."""

from __future__ import annotations

from typing import TypedDict


class RuleResult(TypedDict):
    rule_id: str
    status: str
    resource_id: str
    region: str
    severity: str
    description: str
    remediation: str


def build_result(
    rule_id: str,
    status: str,
    resource_id: str,
    region: str,
    severity: str,
    description: str,
    remediation: str,
) -> RuleResult:
    return {
        "rule_id": rule_id,
        "status": status,
        "resource_id": resource_id,
        "region": region,
        "severity": severity,
        "description": description,
        "remediation": remediation,
    }

