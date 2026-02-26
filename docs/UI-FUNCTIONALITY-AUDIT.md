# Phase 1: UI Functionality Audit

> **Objective:** Identify all non-functional UI actions, mock data, and missing integrations.
> **Updated:** All phases completed. Dashboard, Scanner, Findings, Assets, Compliance, Risks, Policies, Monitoring, Reports, Settings wired to real APIs.

---

## 1. Pages & Routes

| Route | Exists | Status |
|-------|--------|--------|
| `/` (Dashboard) | ✅ | Real API: metrics, compliance, severity, frameworks, findings, risk trend |
| `/login` | ✅ | Mock auth (no backend) |
| `/scanner` | ✅ | Real API: status, jobs, trigger scan |
| `/findings` | ✅ | Real API: list, filter, update status |
| `/assets` | ✅ | Real API: paginated assets |
| `/compliance` | ✅ | Real API: framework scores, compliance score |
| `/risks` | ✅ | Real API: findings by severity |
| `/policies` | ✅ | Real API: rules list |
| `/monitoring` | ✅ | Real API: scanner status, recent jobs |
| `/reports` | ✅ | Real API: export findings JSON |
| `/settings` | ✅ | Shows API config |

---

## 2. Dashboard Components — Real Data

| Component | File | Data Source |
|-----------|------|-------------|
| **ComplianceScoreCard** | `compliance-score-card.tsx` | `GET /dashboard/compliance-score` |
| **SummaryMetrics** | `summary-metrics.tsx` | `GET /dashboard/metrics` |
| **ViolationsSeverityChart** | `violations-severity-chart.tsx` | `GET /dashboard/findings-by-severity` |
| **FrameworkComplianceChart** | `framework-compliance-chart.tsx` | `GET /dashboard/framework-scores` |
| **RiskTrendChart** | `risk-trend-chart.tsx` | `GET /dashboard/risk-trend` |
| **RecentFindingsTable** | `recent-findings-table.tsx` | `GET /scanner/findings` |

---

## 3. Buttons — Non-Functional

| Location | Button | Intended Action | Current State |
|----------|--------|-----------------|---------------|
| **Dashboard** | "View all" (Recent Findings) | Navigate to findings page | No `onClick`/`href` |
| **RecentFindingsTable** | "View remediation" (per row) | Show remediation for finding | No handler |
| **Topbar** | Search input | Search resources/findings | No handler |
| **Topbar** | "Acme Security" dropdown | Account/tenant selector | No handler |
| **Topbar** | Bell icon | Notifications | No handler |
| **Topbar** | User dropdown | Profile/settings | No handler |
| **Login** | "Continue to dashboard" | Submit login | `setTimeout` fake — no API |
| **Login** | "Forgot password?" | Password reset | No handler |
| **Login** | "Sign up for access" | Registration | No handler |
| **Login** | "Sign in with Google" | OAuth | No handler |

---

## 4. Run Scan Button

**Implemented:** Run Scan button in Topbar and Scanner page. Triggers `POST /api/scanner/scan`, polls `GET /api/scanner/status`, dispatches `scan-complete` event for dashboard auto-refresh.

---

## 5. Forms — Non-Functional

| Form | Location | Submit Handler | Backend |
|------|----------|----------------|---------|
| Login | `/login` | `handleLogin` — `setTimeout` only | ❌ No auth API |

---

## 6. API Service Usage

| File | Uses `api.ts` | Endpoints Called |
|------|---------------|------------------|
| `services/api.ts` | N/A (defines client) | — |
| All components | ❌ **None** | No component imports or uses `api` |

---

## 7. Backend Endpoints Available

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/health` | Health check |
| GET | `/api/health/ready` | DB readiness |
| GET | `/api/health/live` | Liveness |
| GET | `/api/scanner/status` | Scan status, queue length |
| POST | `/api/scanner/scan` | Trigger scan |
| GET | `/api/scanner/findings` | List findings (paginated) |
| POST | `/api/scanner/findings/:id/status` | Update finding status |
| GET | `/api/scanner/jobs/:id` | Get scan job details |
| GET | `/api/assets` | List assets (paginated) |

---

## 8. Missing Backend Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/dashboard/metrics` | Total assets, violations, critical count, framework coverage |
| `GET /api/dashboard/compliance-score` | Overall compliance % |
| `GET /api/dashboard/findings-by-severity` | Aggregated counts for chart |
| `GET /api/dashboard/framework-scores` | Per-framework compliance % |
| `GET /api/dashboard/risk-trend` | Historical trend data (optional — can skip if no history) |

---

## 9. Summary of Work — Completed

### Phase 2 (Backend) ✅
- [x] `GET /api/dashboard/metrics`
- [x] `GET /api/dashboard/compliance-score`
- [x] `GET /api/dashboard/findings-by-severity`
- [x] `GET /api/dashboard/framework-scores`
- [x] `GET /api/dashboard/risk-trend`

### Phase 3 (Frontend Wiring) ✅
- [x] API service functions for all endpoints
- [x] Run Scan button in Topbar + Scanner page
- [x] Dashboard fetches real data
- [x] RecentFindingsTable → `GET /scanner/findings`
- [x] "View all" → `/findings`
- [x] All pages created and wired

### Phase 4 (Scan Execution) ✅
- [x] Run Scan → `POST /scanner/scan`
- [x] Poll `GET /scanner/status` for progress
- [x] `scan-complete` event → dashboard auto-refresh

### Phase 5 (Mock Data Removal) ✅
- [x] Loading states
- [x] Error handling
- [ ] Login: mock auth (no backend)

---

## 10. Recommended Scope (Minimal Viable)

For a **functional** app without auth or full multi-page support:

1. **Dashboard** — Fetch real data from scanner + assets APIs
2. **Run Scan** — Add button in Topbar or Dashboard, wire to `POST /scanner/scan`
3. **Findings** — Wire table to API, add "View all" → `/findings` page
4. **Assets** — Create `/assets` page, wire to `GET /assets`
5. **404 pages** — Create minimal placeholder pages for nav links, or hide unused nav items
