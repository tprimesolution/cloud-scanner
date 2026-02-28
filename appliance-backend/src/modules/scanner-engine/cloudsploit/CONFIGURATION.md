## Guard Hardened Execution Configuration

Guard remains subprocess-based (`node index.js`) and is not embedded.

### Environment variables

- `GUARD_MAX_CONCURRENT_SCANS`  
  Maximum concurrently running Guard subprocess scans.

- `GUARD_SCAN_TIMEOUT`  
  Global scan timeout in seconds.

- `GUARD_SCAN_TIMEOUT_<PROVIDER>`  
  Optional per-provider timeout override in seconds.  
  Example: `GUARD_SCAN_TIMEOUT_AWS=1200`

- `GUARD_MEMORY_LIMIT`  
  Per-subprocess memory limit in MB. If exceeded, process is terminated.

- `GUARD_RETRY_COUNT`  
  Retry count for transient failures (timeout/throttling/network errors).

### Runtime protections

- Bounded queue prevents unbounded subprocess spawning.
- Per-scan timeout enforcement with safe subprocess termination.
- Memory watchdog checks subprocess RSS and kills runaway processes.
- Retry policy applies only to transient execution failures.
- Output JSON is validated before normalization and persistence.

### Metrics endpoint

`GET /guard/metrics`

Includes:
- running scans
- queued scans
- max concurrent scans
- average scan duration
- failure rate
- last/peak subprocess memory

### Structured log examples

```json
{"event":"guard_scan_start","scanId":"abc123","provider":"aws","attempt":1,"startedAt":"2026-02-27T10:01:03.101Z"}
{"event":"guard_memory_limit_exceeded","scanId":"abc123","provider":"aws","pid":54321,"rssKb":1054336,"memoryLimitKb":1048576}
{"event":"guard_scan_end","scanId":"abc123","provider":"aws","attempt":1,"exitCode":null,"timedOut":false,"memoryLimitExceeded":true,"durationMs":45203,"endedAt":"2026-02-27T10:01:48.304Z"}
{"event":"guard_scan_retry","scanId":"abc123","provider":"aws","attempt":1,"reason":"temporary API timeout"}
{"event":"guard_run_scan_complete","scanId":"abc123","provider":"aws","durationMs":92211,"attempts":2,"timedOut":false,"memoryLimitExceeded":false,"exitCode":0,"resultCount":153}
```
