"""Compatibility validator for embedded Prowler version and schema integrity."""

from __future__ import annotations

import logging
from importlib import metadata as importlib_metadata

from .compliance_parser import SUPPORTED_PROVIDERS, parse_compliance_mappings
from .rule_loader import discover_checks
from .settings import EngineSettings

logger = logging.getLogger(__name__)

REQUIRED_METADATA_FIELDS = {"CheckID", "ServiceName", "Severity", "CheckTitle"}


def get_prowler_version() -> str:
    try:
        return importlib_metadata.version("prowler")
    except importlib_metadata.PackageNotFoundError:
        return "unknown"


def validate_compatibility(settings: EngineSettings) -> dict[str, object]:
    warnings: list[str] = []
    checks = discover_checks()
    rule_count = len(checks)
    if settings.expected_rule_baseline and rule_count < settings.expected_rule_baseline:
        warnings.append(
            f"rule count {rule_count} is below expected baseline {settings.expected_rule_baseline}"
        )

    invalid_metadata = 0
    for _, _, _, meta in checks:
        missing = [f for f in REQUIRED_METADATA_FIELDS if f not in meta]
        if missing:
            invalid_metadata += 1
    if invalid_metadata:
        warnings.append(f"{invalid_metadata} checks have missing metadata schema fields")

    mapping_count = 0
    for provider in SUPPORTED_PROVIDERS:
        mappings = parse_compliance_mappings(provider)
        mapping_count += sum(len(v) for v in mappings.values())
    if (
        settings.expected_compliance_mappings_baseline
        and mapping_count < settings.expected_compliance_mappings_baseline
    ):
        warnings.append(
            "compliance mapping count "
            f"{mapping_count} below baseline {settings.expected_compliance_mappings_baseline}"
        )

    report = {
        "prowler_version": get_prowler_version(),
        "rule_count": rule_count,
        "compliance_mapping_count": mapping_count,
        "warnings": warnings,
    }
    if warnings:
        logger.warning("compatibility validation warnings: %s", warnings)
    else:
        logger.info("compatibility validation passed")
    return report
