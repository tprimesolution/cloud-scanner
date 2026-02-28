"""Hardened execution pipeline with bounded concurrency and timeout controls."""

from __future__ import annotations

import asyncio
import gc
import importlib
import logging
import os
import sys
import time
import tracemalloc
from argparse import Namespace
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Optional

from .compliance_parser import parse_compliance_mappings
from .context import build_provider_args
from .metrics import metrics
from .result_normalizer import extract_compliance_from_finding, normalize_finding
from .settings import get_settings

_core = os.environ.get("PROWLER_CORE", "")
if _core and _core not in sys.path:
    sys.path.insert(0, _core)

logger = logging.getLogger(__name__)


def _service_from_check(provider: str, check_name: str) -> str:
    service = check_name.split("_")[0]
    if provider == "aws" and service == "lambda":
        return "awslambda"
    return service


def _import_check(provider: str, check_name: str) -> Any:
    service = _service_from_check(provider, check_name)
    module_path = f"prowler.providers.{provider}.services.{service}.{check_name}.{check_name}"
    try:
        lib = importlib.import_module(module_path)
        cls = getattr(lib, check_name)
        return cls()
    except (ModuleNotFoundError, AttributeError):
        return None


def _execute_check_sync(check_instance: Any, global_provider: Any, output_options: Namespace) -> list[Any]:
    try:
        from prowler.lib.check.check import execute

        return execute(check_instance, global_provider, None, output_options)
    except Exception:
        return []


def _init_provider(args: Namespace) -> Any:
    from prowler.providers.common.provider import Provider

    Provider.init_global_provider(args)
    return Provider.get_global_provider()


async def _collector_with_retry(
    provider: str,
    service: str,
    timeout_seconds: int,
    retry_count: int,
) -> list[str]:
    from prowler.lib.check.utils import recover_checks_from_provider

    last_error: Exception | None = None
    for attempt in range(retry_count + 1):
        start = time.perf_counter()
        try:
            recovered = await asyncio.wait_for(
                asyncio.to_thread(recover_checks_from_provider, provider, service),
                timeout=timeout_seconds,
            )
            elapsed = time.perf_counter() - start
            logger.info("collector_complete service=%s elapsed=%.3fs", service, elapsed)
            return [cname for cname, _ in recovered]
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            logger.warning("collector_retry service=%s attempt=%d error=%s", service, attempt + 1, exc)
            await asyncio.sleep(0.2 * (attempt + 1))
    logger.error("collector_failed service=%s error=%s", service, last_error)
    return []


def _timeout_result(provider: str, service: str, check_id: str, message: str) -> dict[str, Any]:
    return {
        "provider": provider,
        "service": service,
        "check_id": check_id,
        "status": "FAIL",
        "severity": "high",
        "resource_id": f"{provider}:{service}:{check_id}",
        "description": message,
        "risk": message,
        "remediation": "Retry scan with higher timeout or investigate provider latency.",
        "compliance": [],
        "region": "",
    }


async def _execute_rule(
    provider: str,
    service: str,
    check_name: str,
    global_provider: Any,
    args: Namespace,
    compliance_map: dict[str, list[dict[str, str]]],
    semaphore: asyncio.Semaphore,
    pool: ThreadPoolExecutor,
    rule_timeout_seconds: int,
) -> list[dict[str, Any]]:
    start = time.perf_counter()
    async with semaphore:
        metrics.inc_active_workers()
        try:
            check_instance = await asyncio.to_thread(_import_check, provider, check_name)
            if check_instance is None:
                metrics.record_rule(time.perf_counter() - start, failed=True)
                return []

            loop = asyncio.get_running_loop()
            findings = await asyncio.wait_for(
                loop.run_in_executor(pool, _execute_check_sync, check_instance, global_provider, args),
                timeout=rule_timeout_seconds,
            )
            elapsed = time.perf_counter() - start
            failed = False
            normalized: list[dict[str, Any]] = []
            for finding in findings:
                comp = extract_compliance_from_finding(finding)
                if not comp and check_name in compliance_map:
                    for entry in compliance_map[check_name]:
                        comp.append(f"{entry['framework']}:{entry['requirement_id']}")
                norm = normalize_finding(finding, provider, comp)
                failed = failed or norm["status"] == "FAIL"
                normalized.append(norm)
            metrics.record_rule(elapsed, failed=failed)
            logger.info("rule_complete check_id=%s elapsed=%.3fs", check_name, elapsed)
            return normalized
        except asyncio.TimeoutError:
            elapsed = time.perf_counter() - start
            metrics.record_rule(elapsed, failed=True)
            logger.warning("rule_timeout check_id=%s timeout=%ss", check_name, rule_timeout_seconds)
            return [_timeout_result(provider, service, check_name, "Rule execution timeout")]
        except Exception as exc:  # noqa: BLE001
            elapsed = time.perf_counter() - start
            metrics.record_rule(elapsed, failed=True)
            logger.exception("rule_error check_id=%s error=%s", check_name, exc)
            return [_timeout_result(provider, service, check_name, f"Rule execution error: {exc}")]
        finally:
            metrics.dec_active_workers()


async def run_scan_async(
    provider: str,
    checks: Optional[list[str]] = None,
    region: Optional[str] = None,
    services: Optional[list[str]] = None,
    compliance: Optional[list[str]] = None,
    severity: Optional[list[str]] = None,
    config_file: Optional[str] = None,
    **kwargs: Any,
) -> list[dict[str, Any]]:
    settings = get_settings()
    args = build_provider_args(
        provider=provider,
        region=region,
        services=services,
        compliance=compliance,
        severity=severity,
        config_file=config_file,
        **kwargs,
    )
    args.only_logs = True
    args.verbose = False

    tracemalloc.start()
    try:
        global_provider = _init_provider(args)
    except (Exception, SystemExit) as exc:
        return [
            {
                "provider": provider,
                "service": "engine",
                "check_id": "init_error",
                "status": "FAIL",
                "severity": "critical",
                "resource_id": "prowler-engine",
                "description": f"Provider init failed: {exc}",
                "risk": str(exc),
                "remediation": "Check credentials and provider configuration.",
                "compliance": [],
                "region": "",
            }
        ]

    compliance_map = parse_compliance_mappings(provider)
    semaphore = asyncio.Semaphore(settings.engine_max_workers)
    cache_lock = asyncio.Lock()
    service_cache: dict[str, list[str]] = {}

    async def _collect_services() -> dict[str, list[str]]:
        if checks:
            grouped: dict[str, list[str]] = {}
            for check_name in checks:
                service_name = _service_from_check(provider, check_name)
                grouped.setdefault(service_name, []).append(check_name)
            return grouped

        from prowler.lib.check.check import list_services

        service_list = list(services) if services else list(list_services(provider))
        collector_tasks = [
            _collector_with_retry(
                provider=provider,
                service=svc,
                timeout_seconds=settings.collector_timeout_seconds,
                retry_count=settings.collector_retry_count,
            )
            for svc in service_list
        ]
        collected = await asyncio.gather(*collector_tasks)
        result: dict[str, list[str]] = {}
        for svc, check_names in zip(service_list, collected):
            if check_names:
                result[svc] = check_names
        return result

    async def _execute_service(service_name: str, check_names: list[str]) -> list[dict[str, Any]]:
        start = time.perf_counter()
        async with cache_lock:
            service_cache[service_name] = list(check_names)

        pool = ThreadPoolExecutor(max_workers=settings.engine_max_workers)
        try:
            flat: list[dict[str, Any]] = []
            batch_size = max(1, settings.rule_batch_size)
            for i in range(0, len(check_names), batch_size):
                batch = check_names[i : i + batch_size]
                tasks = [
                    _execute_rule(
                        provider=provider,
                        service=service_name,
                        check_name=check_name,
                        global_provider=global_provider,
                        args=args,
                        compliance_map=compliance_map,
                        semaphore=semaphore,
                        pool=pool,
                        rule_timeout_seconds=settings.rule_timeout_seconds,
                    )
                    for check_name in batch
                ]
                nested = await asyncio.gather(*tasks)
                for chunk in nested:
                    flat.extend(chunk)
            elapsed = time.perf_counter() - start
            current_mem, peak_mem = tracemalloc.get_traced_memory()
            logger.info(
                "service_complete service=%s elapsed=%.3fs current_mem=%d peak_mem=%d findings=%d",
                service_name,
                elapsed,
                current_mem,
                peak_mem,
                len(flat),
            )
            return flat
        finally:
            pool.shutdown(wait=True, cancel_futures=True)
            async with cache_lock:
                service_cache.pop(service_name, None)
            gc.collect()

    async def _orchestrate() -> list[dict[str, Any]]:
        service_map = await _collect_services()
        all_results: list[dict[str, Any]] = []
        for service_name, check_names in service_map.items():
            try:
                svc_results = await asyncio.wait_for(
                    _execute_service(service_name, check_names),
                    timeout=settings.service_timeout_seconds,
                )
                all_results.extend(svc_results)
            except asyncio.TimeoutError:
                logger.warning("service_timeout service=%s timeout=%ss", service_name, settings.service_timeout_seconds)
                all_results.append(
                    _timeout_result(provider, service_name, "service_timeout", "Service execution timeout")
                )
        return all_results

    try:
        return await asyncio.wait_for(_orchestrate(), timeout=settings.global_timeout_seconds)
    except asyncio.TimeoutError:
        logger.warning("global_timeout timeout=%ss", settings.global_timeout_seconds)
        return [
            _timeout_result(
                provider,
                "engine",
                "global_timeout",
                "Global scan timeout exceeded; partial execution may have completed.",
            )
        ]
    finally:
        tracemalloc.stop()


def run_scan(
    provider: str,
    checks: Optional[list[str]] = None,
    region: Optional[str] = None,
    services: Optional[list[str]] = None,
    compliance: Optional[list[str]] = None,
    severity: Optional[list[str]] = None,
    config_file: Optional[str] = None,
    **kwargs: Any,
) -> list[dict[str, Any]]:
    """Synchronous compatibility wrapper for existing callers."""
    return asyncio.run(
        run_scan_async(
            provider=provider,
            checks=checks,
            region=region,
            services=services,
            compliance=compliance,
            severity=severity,
            config_file=config_file,
            **kwargs,
        )
    )
