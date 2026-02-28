"""Environment-driven runtime settings for hardened execution."""

from __future__ import annotations

import os
from dataclasses import dataclass


def _env_int(name: str, default: int, minimum: int = 1) -> int:
    raw = os.getenv(name, str(default)).strip()
    try:
        value = int(raw)
    except ValueError:
        return default
    return max(minimum, value)


@dataclass(frozen=True)
class EngineSettings:
    engine_max_workers: int
    collector_timeout_seconds: int
    rule_timeout_seconds: int
    service_timeout_seconds: int
    global_timeout_seconds: int
    engine_request_timeout_seconds: int
    queue_max_size: int
    queue_worker_count: int
    collector_retry_count: int
    rule_batch_size: int
    auth_token: str
    expected_rule_baseline: int
    expected_compliance_mappings_baseline: int


def get_settings() -> EngineSettings:
    return EngineSettings(
        engine_max_workers=_env_int("ENGINE_MAX_WORKERS", 8),
        collector_timeout_seconds=_env_int("COLLECTOR_TIMEOUT_SECONDS", 60),
        rule_timeout_seconds=_env_int("RULE_TIMEOUT_SECONDS", 45),
        service_timeout_seconds=_env_int("SERVICE_TIMEOUT_SECONDS", 300),
        global_timeout_seconds=_env_int("GLOBAL_SCAN_TIMEOUT_SECONDS", 1800),
        engine_request_timeout_seconds=_env_int("ENGINE_REQUEST_TIMEOUT_SECONDS", 1900),
        queue_max_size=_env_int("ENGINE_QUEUE_MAX_SIZE", 128),
        queue_worker_count=_env_int("ENGINE_QUEUE_WORKERS", 2),
        collector_retry_count=_env_int("COLLECTOR_RETRY_COUNT", 2),
        rule_batch_size=_env_int("RULE_BATCH_SIZE", 100),
        auth_token=os.getenv("ENGINE_AUTH_TOKEN", "").strip(),
        expected_rule_baseline=_env_int("EXPECTED_RULE_BASELINE", 1, minimum=0),
        expected_compliance_mappings_baseline=_env_int(
            "EXPECTED_COMPLIANCE_MAPPINGS_BASELINE", 1, minimum=0
        ),
    )
