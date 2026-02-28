"""Parse compliance JSON files from prowler/compliance/<provider>/."""

import json
import os
from pathlib import Path
from typing import Optional

SUPPORTED_PROVIDERS = ["aws", "azure", "gcp", "kubernetes"]


def get_prowler_path() -> Optional[str]:
    """Resolve Prowler installation path (directory containing compliance/)."""
    prowler_core = os.environ.get("PROWLER_CORE", "")
    if prowler_core and os.path.isdir(prowler_core):
        pkg = os.path.join(prowler_core, "prowler")
        if os.path.isdir(os.path.join(pkg, "compliance")):
            return pkg
        if os.path.isdir(os.path.join(prowler_core, "compliance")):
            return prowler_core
    try:
        import prowler
        return os.path.dirname(os.path.dirname(prowler.__file__))
    except ImportError:
        pass
    return None


def parse_compliance_mappings(
    provider: str,
) -> dict[str, list[dict[str, str]]]:
    """
    Parse JSON files from prowler/compliance/<provider>/.
    Returns mapping: check_id -> list of {framework, requirement_id, requirement_name}.
    """
    prowler_path = get_prowler_path()
    if not prowler_path or provider not in SUPPORTED_PROVIDERS:
        return {}

    compliance_dir = Path(prowler_path) / "compliance" / provider
    if not compliance_dir.exists():
        return {}

    check_to_frameworks: dict[str, list[dict[str, str]]] = {}

    for json_file in compliance_dir.glob("*.json"):
        try:
            with open(json_file) as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            continue

        framework = data.get("Framework") or data.get("Name") or json_file.stem
        requirements = data.get("Requirements") or []

        for req in requirements:
            req_id = req.get("Id", "")
            req_name = req.get("Name", "")
            checks = req.get("Checks") or []
            for check_id in checks:
                if not check_id:
                    continue
                if check_id not in check_to_frameworks:
                    check_to_frameworks[check_id] = []
                entry = {
                    "framework": str(framework),
                    "requirement_id": str(req_id),
                    "requirement_name": str(req_name),
                }
                if entry not in check_to_frameworks[check_id]:
                    check_to_frameworks[check_id].append(entry)

    return check_to_frameworks


def get_framework_list(provider: str) -> list[dict[str, str]]:
    """List available compliance frameworks for a provider."""
    prowler_path = get_prowler_path()
    if not prowler_path or provider not in SUPPORTED_PROVIDERS:
        return []

    compliance_dir = Path(prowler_path) / "compliance" / provider
    if not compliance_dir.exists():
        return []

    frameworks = []
    seen = set()
    for json_file in compliance_dir.glob("*.json"):
        try:
            with open(json_file) as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            continue

        framework = data.get("Framework") or data.get("Name") or json_file.stem
        key = (framework, data.get("Version", ""))
        if key in seen:
            continue
        seen.add(key)
        frameworks.append({
            "framework": str(framework),
            "version": str(data.get("Version", "")),
            "provider": str(data.get("Provider", provider)),
            "description": str(data.get("Description", "")),
        })
    return frameworks
