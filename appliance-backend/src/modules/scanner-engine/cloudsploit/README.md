# Guard Scanner Engine

Integrates upstream [CloudSploit](https://github.com/aquasecurity/cloudsploit) security rules under the Guard brand. All plugins from AWS, Azure, GCP, and OCI are loaded and executed as-is.

## Architecture

- **Rule loader**: Dynamically loads plugins from `cloudsploit/exports.js`
- **Executor**: Runs Guard via subprocess (preserves original upstream execution flow)
- **Collectors**: Upstream CloudSploit collectors run automatically per provider
- **Result normalizer**: Converts output to standardized JSON format

## Folder Structure

```
cloudsploit/
├── interfaces/
│   └── cloudsploit-scan.interface.ts
├── loaders/
│   └── rule-loader.service.ts       # Dynamic rule loading from exports.js
├── config/
│   └── config-generator.service.ts  # Credential config for non-AWS
├── executor/
│   └── cloudsploit-executor.service.ts  # Subprocess runner
├── normalizers/
│   └── result-normalizer.service.ts
├── services/
│   └── cloudsploit-scan.service.ts
├── cloudsploit-scan.controller.ts
├── cloudsploit.module.ts
└── README.md
```

## REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/guard/scan/start | Start scan (async, returns scanId) |
| GET | /api/guard/scan/status/:scanId | Get scan status |
| GET | /api/guard/scan/results/:scanId | Get scan results |
| POST | /api/guard/rules/sync | Sync rules from Guard to DB |
| GET | /api/guard/rules | List all loaded rules |

## Standardized Output Format

```json
{
  "provider": "aws",
  "service": "s3",
  "rule_id": "bucketAllUsersAcl",
  "status": "PASS | FAIL | INFO",
  "severity": "critical | high | medium | low",
  "description": "...",
  "recommendation": "...",
  "resource": "...",
  "region": "..."
}
```

## Setup

1. **Guard upstream source**: Clone CloudSploit to `GUARD_DIR` (default `/opt/guard-core`):
   ```bash
   git clone --depth 1 https://github.com/aquasecurity/cloudsploit.git /opt/guard-core
   cd /opt/guard-core && npm install --omit=dev
   ```

2. **Database**: Run `npx prisma migrate dev` for Guard tables (`CloudSploitRule`, `CloudSploitScan`, `CloudSploitScanResult`).

3. **Sync rules**: `POST /api/guard/rules/sync`

4. **Start scan**: `POST /api/guard/scan/start` with body:
   ```json
   {
     "provider": "aws",
     "region": "us-east-1",
     "compliance": "pci",
     "services": ["S3"]
   }
   ```

## Environment

- `GUARD_DIR`: Path to upstream CloudSploit repo (default: `/opt/guard-core`)
