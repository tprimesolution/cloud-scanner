"""Dynamic rule loader - recursively scans prowler/providers/*/services/*/*/."""

import importlib
import json
import os
import sys
from pathlib import Path
from typing import Any, Optional

# Add prowler-core to path
_core = os.environ.get("PROWLER_CORE", "")
if _core and _core not in sys.path:
    sys.path.insert(0, _core)

SUPPORTED_PROVIDERS = ["aws", "azure", "gcp", "kubernetes"]


def get_prowler_path() -> Optional[str]:
    """Resolve Prowler installation path (directory containing providers/)."""
    prowler_core = os.environ.get("PROWLER_CORE", "")
    if prowler_core and os.path.isdir(prowler_core):
        pkg = os.path.join(prowler_core, "prowler")
        if os.path.isdir(os.path.join(pkg, "providers")):
            return pkg
        if os.path.isdir(os.path.join(prowler_core, "providers")):
            return prowler_core
    try:
        import prowler
        return os.path.dirname(os.path.dirname(prowler.__file__))
    except ImportError:
        pass
    return None


def discover_checks(provider: Optional[str] = None) -> list[tuple[str, str, str, dict]]:
    """
    Recursively scan prowler/providers/*/services/*/*/ and load check metadata.
    Returns list of (provider, service, check_name, metadata).
    """
    prowler_path = get_prowler_path()
    if not prowler_path:
        return []

    providers_dir = Path(prowler_path) / "providers"
    if not providers_dir.exists():
        return []

    providers = [provider] if provider and provider in SUPPORTED_PROVIDERS else SUPPORTED_PROVIDERS
    checks = []

    for prov in providers:
        prov_path = providers_dir / prov / "services"
        if not prov_path.exists():
            continue
        for service_dir in prov_path.iterdir():
            if not service_dir.is_dir() or service_dir.name.startswith("_"):
                continue
            if service_dir.name == "lib":
                continue
            for check_dir in service_dir.iterdir():
                if not check_dir.is_dir() or check_dir.name.startswith("_"):
                    continue
                metadata_file = check_dir / f"{check_dir.name}.metadata.json"
                if not metadata_file.exists():
                    continue
                try:
                    with open(metadata_file) as f:
                        meta = json.load(f)
                    checks.append((prov, service_dir.name, check_dir.name, meta))
                except (json.JSONDecodeError, OSError):
                    continue
    return checks


def load_check_module(provider: str, service: str, check_name: str) -> Any:
    """Dynamically import a check module using importlib."""
    module_path = f"prowler.providers.{provider}.services.{service}.{check_name}.{check_name}"
    try:
        return importlib.import_module(module_path)
    except ModuleNotFoundError:
        return None


def get_check_class(provider: str, service: str, check_name: str):
    """Load and return the check class (instantiated)."""
    mod = load_check_module(provider, service, check_name)
    if mod is None:
        return None
    cls = getattr(mod, check_name, None)
    if cls is None:
        return None
    return cls()
