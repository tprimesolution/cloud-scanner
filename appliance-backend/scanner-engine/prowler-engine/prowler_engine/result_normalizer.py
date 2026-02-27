"""Normalize Prowler findings to standard result format."""

from typing import Any


def normalize_finding(
    finding: Any,
    provider: str,
    compliance: list[str],
) -> dict[str, Any]:
    """
    Map a Prowler finding object to the standard result format.
    Finding objects have: status, check_metadata, resource_id, resource_arn, region, etc.
    """
    meta = getattr(finding, "check_metadata", None) or {}
    status = getattr(finding, "status", "INFO")
    if hasattr(status, "value"):
        status = status.value
    status = str(status).upper()
    if status not in ("PASS", "FAIL", "INFO"):
        status = "INFO"

    resource_id = (
        getattr(finding, "resource_id", None)
        or getattr(finding, "resource_arn", None)
        or getattr(finding, "resource_id_extended", None)
        or ""
    )
    resource_id = str(resource_id)[:512]

    check_id = getattr(meta, "CheckID", None) or ""
    service = getattr(meta, "ServiceName", None) or ""
    severity_raw = getattr(meta, "Severity", None)
    if hasattr(severity_raw, "value"):
        severity_raw = severity_raw.value
    severity = _normalize_severity(str(severity_raw or "medium"))

    description = getattr(meta, "CheckTitle", None) or ""
    risk = getattr(meta, "Risk", None) or ""
    remediation = getattr(meta, "Remediation", None) or ""
    status_extended = getattr(finding, "status_extended", None) or ""
    if status_extended and not remediation:
        remediation = str(status_extended)

    region = getattr(finding, "region", None) or ""

    return {
        "provider": provider,
        "service": str(service),
        "check_id": str(check_id),
        "status": status,
        "severity": severity,
        "resource_id": resource_id,
        "description": str(description),
        "risk": str(risk),
        "remediation": str(remediation),
        "compliance": compliance,
        "region": str(region),
    }


def _normalize_severity(sev: str) -> str:
    m = {"critical": "critical", "high": "high", "medium": "medium", "low": "low"}
    return m.get((sev or "").lower(), "medium")


def extract_compliance_from_finding(finding: Any) -> list[str]:
    """Extract compliance IDs from a finding's compliance attribute."""
    compliance = getattr(finding, "compliance", None)
    if not compliance or not isinstance(compliance, dict):
        return []
    ids: list[str] = []
    for v in compliance.values():
        if isinstance(v, list):
            for item in v:
                if isinstance(item, str) and item:
                    ids.append(item)
                elif isinstance(item, dict):
                    if "Id" in item:
                        ids.append(str(item["Id"]))
                    elif "Framework" in item:
                        ids.append(str(item["Framework"]))
        elif isinstance(v, str) and v:
            ids.append(v)
    return ids
