## CloudSploit Hardened Execution Configuration

CloudSploit remains subprocess-based (`node index.js`) and is not embedded.

### Environment variables

- `CLOUDSPLOIT_MAX_CONCURRENT_SCANS`  
  Maximum concurrently running CloudSploit subprocess scans.

- `CLOUDSPLOIT_SCAN_TIMEOUT`  
  Global scan timeout in seconds.

- `CLOUDSPLOIT_SCAN_TIMEOUT_<PROVIDER>`  
  Optional per-provider timeout override in seconds.  
  Example: `CLOUDSPLOIT_SCAN_TIMEOUT_AWS=1200`

- `CLOUDSPLOIT_MEMORY_LIMIT`  
  Per-subprocess memory limit in MB. If exceeded, process is terminated.

- `CLOUDSPLOIT_RETRY_COUNT`  
  Retry count for transient failures (timeout/throttling/network errors).

### Runtime protections

- Bounded queue prevents unbounded subprocess spawning.
- Per-scan timeout enforcement with safe subprocess termination.
- Memory watchdog checks subprocess RSS and kills runaway processes.
- Retry policy applies only to transient execution failures.
- Output JSON is validated before normalization and persistence.

### Metrics endpoint

`GET /cloudsploit/metrics`

Includes:
- running scans
- queued scans
- max concurrent scans
- average scan duration
- failure rate
- last/peak subprocess memory

### Structured log examples

```json
{"event":"cloudsploit_scan_start","scanId":"abc123","provider":"aws","attempt":1,"startedAt":"2026-02-27T10:01:03.101Z"}
{"event":"cloudsploit_memory_limit_exceeded","scanId":"abc123","provider":"aws","pid":54321,"rssKb":1054336,"memoryLimitKb":1048576}
{"event":"cloudsploit_scan_end","scanId":"abc123","provider":"aws","attempt":1,"exitCode":null,"timedOut":false,"memoryLimitExceeded":true,"durationMs":45203,"endedAt":"2026-02-27T10:01:48.304Z"}
{"event":"cloudsploit_scan_retry","scanId":"abc123","provider":"aws","attempt":1,"reason":"temporary API timeout"}
{"event":"cloudsploit_run_scan_complete","scanId":"abc123","provider":"aws","durationMs":92211,"attempts":2,"timedOut":false,"memoryLimitExceeded":false,"exitCode":0,"resultCount":153}
```
