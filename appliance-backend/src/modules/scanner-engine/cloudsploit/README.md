# CloudSploit Scanner Engine

Integrates [CloudSploit](https://github.com/aquasecurity/cloudsploit) security rules into the application. All plugins from AWS, Azure, GCP, and OCI are loaded and executed as-is.

## Architecture

- **Rule loader**: Dynamically loads plugins from `cloudsploit/exports.js`
- **Executor**: Runs CloudSploit via subprocess (preserves original execution flow)
- **Collectors**: CloudSploit's built-in collectors run automatically per provider
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
| POST | /api/cloudsploit/scan/start | Start scan (async, returns scanId) |
| GET | /api/cloudsploit/scan/status/:scanId | Get scan status |
| GET | /api/cloudsploit/scan/results/:scanId | Get scan results |
| POST | /api/cloudsploit/rules/sync | Sync rules from CloudSploit to DB |
| GET | /api/cloudsploit/rules | List all loaded rules |

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

1. **CloudSploit**: Clone to `CLOUDSPLOIT_DIR` (default `/opt/cloudsploit`):
   ```bash
   git clone --depth 1 https://github.com/aquasecurity/cloudsploit.git /opt/cloudsploit
   cd /opt/cloudsploit && npm install --omit=dev
   ```

2. **Database**: Run `npx prisma migrate dev` for CloudSploitRule, CloudSploitScan, CloudSploitScanResult tables

3. **Sync rules**: `POST /api/cloudsploit/rules/sync`

4. **Start scan**: `POST /api/cloudsploit/scan/start` with body:
   ```json
   {
     "provider": "aws",
     "region": "us-east-1",
     "compliance": "pci",
     "services": ["S3"]
   }
   ```

## Environment

- `CLOUDSPLOIT_DIR`: Path to CloudSploit repo (default: `/opt/cloudsploit`)
