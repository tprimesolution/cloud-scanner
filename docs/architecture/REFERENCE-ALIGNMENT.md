# Reference Alignment: CloudSploit & Prowler

This document maps our unified security scanning platform to patterns from [CloudSploit](https://github.com/aquasecurity/cloudsploit) and [Prowler](https://github.com/prowler-cloud/prowler).

---

## CloudSploit (Aqua Security)

**Architecture:** Two-phase (Collection → Scanning)  
**Stack:** Node.js, collectors per cloud, plugin-based rules  
**~3.7k stars | 736 forks**

### Key Patterns We Adopted

| CloudSploit Concept | Our Implementation |
|--------------------|-------------------|
| **Collectors** | `ResourceCollectionService` + fetchers (S3, IAM, SG, RDS, EBS, CloudTrail) |
| **Collection phase** | `collectResources()` — fetches metadata before scanning |
| **Plugin-based rules** | `IRulePlugin` interface + `PluginLoaderService` |
| **Result codes** | Severity: `critical` \| `high` \| `medium` \| `low` \| `informational` |
| **Compliance mapping** | `ComplianceMappingService` — CIS, SOC2, HIPAA, PCI, ISO 27001 |
| **Suppressions** | `Finding.status = "suppressed"` + rule filtering |
| **Single plugin run** | `--plugin` → our `resourceType` filter in `PluginLoaderService` |

### CloudSploit Plugin Contract (Reference)

```javascript
// CloudSploit plugin exports
{
  title, category, description, more_info, link,
  recommended_action,
  apis: ['IAM:listGroups', 'IAM:getGroup'],
  compliance: { hipaa: '...', cis: '...', pci: '...' },
  run: (collection, settings, callback) => { ... }
}
```

### Our Plugin Contract

```typescript
interface IRulePlugin {
  code: string;
  name: string;
  resourceType: string;
  severity: Severity;
  controlIds: string[];
  remediation: string;
  evaluate(resource: NormalizedResource): RuleResult;
}
```

### CloudSploit Collection Model

- **calls**: Initial API calls (e.g. `listBuckets`, `listUsers`)
- **postcalls**: Dependent calls (e.g. `getBucketPublicAccessBlock` per bucket)
- **reliesOnService / reliesOnCall**: Declarative dependency chain

Our fetchers encapsulate both in a single `fetch()` generator per resource type.

---

## Prowler

**Architecture:** Open Cloud Security platform  
**Stack:** Python, Django API, Next.js UI, Celery workers  
**~13k stars | 2k forks**

### Key Patterns We Adopted

| Prowler Concept | Our Implementation |
|-----------------|-------------------|
| **Multi-cloud checks** | AWS-first; fetchers designed for extension (Azure, GCP) |
| **Compliance frameworks** | CIS, NIST, PCI-DSS, HIPAA, SOC2, ISO 27001 |
| **Self-hosted / VM** | Docker Compose, single-process NestJS, <500MB target |
| **Scheduled scans** | `SchedulerService` — daily full, hourly incremental |
| **Findings storage** | `Finding` model with deduplication, lifecycle |
| **Health checks** | `/health`, `/health/ready`, `/health/live` |

### Prowler App Components

- **Prowler UI** (Next.js) — scan execution, results visualization
- **Prowler API** (Django REST) — runs scans, stores results
- **Prowler SDK** — Python SDK for CLI integration
- **MCP Server** — AI assistant integration

Our platform: NestJS modular monolith (no separate API/worker processes for VM deployment).

### Prowler CLI vs Our API

| Prowler CLI | Our API |
|-------------|---------|
| `prowler` | `POST /api/scanner/scan` |
| `--list-checks` | `GET /api/scanner/status` + rule plugins |
| `--compliance cis` | Rule `controlIds` + `ComplianceMappingService` |
| Output: JSON, CSV, JUnit | `GET /api/scanner/findings` (paginated) |

---

## Alignment Summary

| Aspect | CloudSploit | Prowler | Our Platform |
|--------|-------------|---------|--------------|
| Collection | Declarative collectors | Provider-specific | Fetchers per resource type |
| Rules | Plugin per check | Check per service | `IRulePlugin` per rule |
| Compliance | `--compliance` filter | Framework mapping | `controlIds` + mapping service |
| Output | Console, JSON, CSV, JUnit | API, UI, CLI | REST API, findings DB |
| Deployment | CLI, Docker | App (Docker Compose) | AMI/VM, Docker Compose |
| Multi-cloud | AWS, Azure, GCP, OCI, GitHub | AWS, Azure, GCP, K8s, etc. | AWS (extensible) |

---

## Possible Enhancements (Inspired by References)

1. **Postcalls / dependent fetches** — CloudSploit’s `reliesOnService` for chained API calls (e.g. list buckets → get bucket policy per bucket).
2. **Suppression format** — CloudSploit: `pluginId:region:resourceId` regex; we could add `GET/POST /scanner/suppressions`.
3. **Export formats** — Add CSV, JUnit XML for CI/CD (like both references).
4. **Remediation actions** — CloudSploit’s `--remediate`; we have `remediation` text, could add automated remediation.
5. **Collection caching** — CloudSploit’s `cache` helper; we persist to `CollectedResource` for historical comparison.
