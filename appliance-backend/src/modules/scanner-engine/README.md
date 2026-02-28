# Scanner Engine Module

Pluggable scanning engine that integrates Shield-branded rules and compliance mappings from upstream [Prowler](https://github.com/prowler-cloud/prowler).

## Architecture

- **Rule execution**: Invokes upstream engine (Python) as-is; no logic changes
- **Compliance mapping**: Parses JSON from `prowler/compliance/<provider>/`
- **Reporting**: Standardized JSON result format

## Folder Structure

```
scanner-engine/
├── interfaces/
│   ├── index.ts
│   ├── provider.interface.ts
│   ├── scan-filter.interface.ts
│   └── scan-result.interface.ts
├── loaders/
│   └── check-loader.service.ts      # Loads metadata from Shield checks
├── parsers/
│   └── compliance-parser.service.ts # Parses compliance JSON files
├── providers/
│   ├── base-provider.ts             # Base Shield engine runner
│   ├── aws-provider.ts
│   ├── azure-provider.ts
│   ├── gcp-provider.ts
│   ├── kubernetes-provider.ts
│   └── index.ts
├── services/
│   ├── scanner-engine.service.ts    # Orchestrates providers
│   └── sync.service.ts              # Syncs checks + compliance to DB
├── scanner-engine.controller.ts     # Scan + sync endpoints
├── scanner-engine-checks.controller.ts  # List checks, frameworks, mappings
├── scanner-engine.module.ts
└── README.md
```

## Database Schema

- **ProwlerCheck**: provider, service, checkName, severity, description, risk, remediation, metadata (Shield data source)
- **ComplianceFramework**: provider, name, framework, version, source
- **ComplianceMapping**: frameworkId, controlId, checkName

## REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/scanner-engine/scan | Run scan for one provider |
| POST | /api/scanner-engine/scan/multi | Run scans for multiple providers |
| GET | /api/scanner-engine/providers | List supported providers |
| POST | /api/scanner-engine/sync | Sync checks and compliance from Shield |
| GET | /api/scanner-engine/checks | List checks (filter: provider, service, severity) |
| GET | /api/scanner-engine/frameworks | List compliance frameworks |
| GET | /api/scanner-engine/mappings | List compliance mappings |

## Standardized Result Format

```json
{
  "provider": "aws",
  "service": "iam",
  "check_id": "iam_root_mfa_enabled",
  "resource_id": "...",
  "status": "PASS | FAIL | INFO",
  "severity": "critical | high | medium | low",
  "compliance": ["CIS-1.1", "NIST-AC-2"],
  "description": "...",
  "risk": "...",
  "remediation": "..."
}
```

## Setup

1. **Migration**: Run `npx prisma migrate dev` to create tables
2. **Sync**: Call `POST /api/scanner-engine/sync` to populate checks and compliance from installed Shield
3. **Scan**: Call `POST /api/scanner-engine/scan` with `{ "provider": "aws", "filter": { "compliance": "cis_1.5_aws" } }`

## Environment

- `SHIELD_PATH`: Override Shield installation path (fallback: `PROWLER_PATH`)
- `SHIELD_BIN`: Shield CLI binary (fallback: `PROWLER_BIN`, default: `prowler`)
