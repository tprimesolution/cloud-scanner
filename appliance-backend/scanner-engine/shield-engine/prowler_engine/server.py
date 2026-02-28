"""FastAPI HTTP server for hardened Prowler execution."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from .compatibility import validate_compatibility
from .compliance_parser import get_framework_list, parse_compliance_mappings
from .executor import run_scan_async
from .metrics import metrics
from .rule_loader import discover_checks
from .scan_queue import ScanJobQueue
from .settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
scan_queue = ScanJobQueue(
    max_size=settings.queue_max_size,
    worker_count=settings.queue_worker_count,
)
compatibility_report: dict[str, object] = {}

app = FastAPI(title="Prowler Engine", version="1.1.0")


class ScanRequest(BaseModel):
    provider: str
    checks: Optional[list[str]] = None
    region: Optional[str] = None
    services: Optional[list[str]] = None
    compliance: Optional[list[str]] = None
    severity: Optional[list[str]] = None
    config_file: Optional[str] = None
    profile: Optional[str] = None
    role: Optional[str] = None


class ScanResponse(BaseModel):
    results: list[dict[str, Any]]


@app.middleware("http")
async def auth_placeholder_middleware(request: Request, call_next):
    if settings.auth_token:
        token = request.headers.get("x-engine-token", "")
        if token != settings.auth_token:
            raise HTTPException(status_code=401, detail="Unauthorized")
    return await call_next(request)


@app.middleware("http")
async def retry_timeout_middleware(request: Request, call_next):
    max_attempts = 2
    last_exc: Exception | None = None
    for attempt in range(max_attempts):
        try:
            start = time.perf_counter()
            response = await asyncio.wait_for(
                call_next(request),
                timeout=settings.engine_request_timeout_seconds,
            )
            elapsed = time.perf_counter() - start
            logger.info("http_request path=%s status=%s elapsed=%.3fs", request.url.path, response.status_code, elapsed)
            return response
        except asyncio.TimeoutError as exc:
            last_exc = exc
            logger.warning("http_timeout path=%s attempt=%d", request.url.path, attempt + 1)
            if attempt + 1 >= max_attempts:
                raise HTTPException(status_code=504, detail="Request timeout exceeded") from exc
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if attempt + 1 >= max_attempts:
                raise
    raise HTTPException(status_code=500, detail=f"Request failed: {last_exc}")


@app.on_event("startup")
async def _startup() -> None:
    global compatibility_report
    await scan_queue.start()
    compatibility_report = validate_compatibility(settings)


@app.on_event("shutdown")
async def _shutdown() -> None:
    await scan_queue.stop()


@app.post("/scan", response_model=ScanResponse)
async def run_scan_endpoint(req: ScanRequest) -> ScanResponse:
    """Execute Prowler checks via direct Python import (no CLI)."""
    if req.provider not in ("aws", "azure", "gcp", "kubernetes"):
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {req.provider}")

    async def _job():
        return await run_scan_async(
            provider=req.provider,
            checks=req.checks,
            region=req.region,
            services=req.services,
            compliance=req.compliance,
            severity=req.severity,
            config_file=req.config_file,
            profile=req.profile,
            role=req.role,
        )

    try:
        results = await scan_queue.submit(_job)
        return ScanResponse(results=results)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/checks")
async def list_checks(provider: Optional[str] = None) -> dict[str, Any]:
    checks = discover_checks(provider)
    return {
        "checks": [
            {"provider": p, "service": s, "check_name": c, "metadata": m}
            for p, s, c, m in checks
        ]
    }


@app.get("/compliance/{provider}")
async def list_compliance(provider: str) -> dict[str, Any]:
    return {"frameworks": get_framework_list(provider)}


@app.get("/compliance/{provider}/mappings")
async def get_compliance_mappings(provider: str) -> dict[str, Any]:
    return {"mappings": parse_compliance_mappings(provider)}


@app.get("/metrics")
async def get_metrics() -> PlainTextResponse:
    return PlainTextResponse(metrics.prometheus_text(), media_type="text/plain; version=0.0.4")


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "queue_size": scan_queue.size(),
        "compatibility": compatibility_report,
    }


def main() -> None:
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)


if __name__ == "__main__":
    main()
