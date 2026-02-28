## Prowler Engine Configuration

All hardening controls are environment-driven.

- `ENGINE_MAX_WORKERS`: max concurrent rule workers (bounded semaphore + thread pool).
- `COLLECTOR_TIMEOUT_SECONDS`: timeout for per-service collector discovery.
- `RULE_TIMEOUT_SECONDS`: timeout for each rule execution.
- `SERVICE_TIMEOUT_SECONDS`: timeout for one service segment execution.
- `GLOBAL_SCAN_TIMEOUT_SECONDS`: timeout for entire scan request.
- `ENGINE_REQUEST_TIMEOUT_SECONDS`: HTTP request timeout middleware ceiling.
- `ENGINE_QUEUE_MAX_SIZE`: bounded in-memory scan queue size.
- `ENGINE_QUEUE_WORKERS`: queue worker count.
- `COLLECTOR_RETRY_COUNT`: retry attempts for transient collector failures.
- `RULE_BATCH_SIZE`: optional per-service batch size for large rule sets.
- `ENGINE_AUTH_TOKEN`: optional auth placeholder (`x-engine-token` header).
- `EXPECTED_RULE_BASELINE`: compatibility validator minimum rule count.
- `EXPECTED_COMPLIANCE_MAPPINGS_BASELINE`: compatibility validator minimum mapping count.

### Runtime behavior

- Collectors execute concurrently per service with retry + timeout.
- Rules execute in parallel with bounded workers.
- Execution is segmented service-by-service for memory safety.
- Garbage collection is triggered after each service segment.
- `/metrics` exposes:
  - total rules executed
  - failed rules count
  - average rule execution time
  - active worker count
