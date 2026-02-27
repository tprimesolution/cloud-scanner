import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080/api",
});

// --- Scanner ---
export async function getScannerStatus() {
  const { data } = await api.get<{
    ready: boolean;
    scanInProgress: boolean;
    queueLength: number;
    lastJob?: { status: string; errorMessage?: string | null };
  }>("/scanner/status");
  return data;
}

export async function triggerScan() {
  const { data } = await api.post<{
    triggered: boolean;
    jobId?: string;
    message: string;
  }>("/scanner/scan");
  return data;
}

export async function getScanJob(id: string) {
  const { data } = await api.get(`/scanner/jobs/${id}`);
  return data;
}

export async function getFindings(params?: {
  status?: string;
  severity?: string;
  framework?: string;
  category?: string;
  limit?: number;
  offset?: number;
}) {
  const { data } = await api.get<{ items: Finding[]; total: number }>(
    "/scanner/findings",
    { params }
  );
  return data;
}

export async function updateFindingStatus(id: string, status: string) {
  await api.post(`/scanner/findings/${id}/status`, { status });
}

export interface Finding {
  id: string;
  resourceId: string;
  resourceType: string;
  ruleCode: string;
  severity: string;
  message: string;
  status: string;
  controlIds: string[];
  lastSeenAt: string;
  rule?: { name: string; description?: string };
}

// --- Dashboard ---
export async function getDashboardMetrics() {
  const { data } = await api.get<{
    totalAssets: number;
    activeViolations: number;
    criticalRisks: number;
    frameworkCoverage: string;
    complianceCoverage?: {
      compliancePercent: number;
      coveragePercent: number;
      passed: number;
      failed: number;
      notEvaluated: number;
      notApplicable: number;
    } | null;
  }>("/dashboard/metrics");
  return data;
}

export async function getComplianceScore() {
  const { data } = await api.get<{
    score: number;
    coveragePercent?: number;
    passed?: number;
    failed?: number;
    notEvaluated?: number;
    notApplicable?: number;
    lastEvaluated: string | null;
    resourceCount: number;
  }>("/dashboard/compliance-score");
  return data;
}

export async function getFindingsBySeverity() {
  const { data } = await api.get<
    { name: string; value: number; color: string }[]
  >("/dashboard/findings-by-severity");
  return data;
}

export async function getFrameworkScores() {
  const { data } = await api.get<
    {
      name: string;
      score: number;
      coveragePercent?: number;
      passed?: number;
      failed?: number;
      notEvaluated?: number;
      notApplicable?: number;
    }[]
  >(
    "/dashboard/framework-scores"
  );
  return data;
}

export async function getRiskTrend() {
  const { data } = await api.get<{ week: string; score: number; date: string }[]>(
    "/dashboard/risk-trend"
  );
  return data;
}

export async function getScanJobs(limit?: number) {
  const { data } = await api.get(`/scanner/jobs`, {
    params: limit ? { limit } : undefined,
  });
  return data;
}

export async function getRules() {
  const { data } = await api.get<
    { id: string; code: string; name: string; description?: string; resourceType: string; severity: string; controlIds: string[] }[]
  >("/rules");
  return data;
}

// --- Compliance Frameworks (41) & Categories (17) ---
export interface Framework {
  frameworkId: string;
  name: string;
  description: string;
  findingCount: number;
  score: number;
  status: string;
}

export async function getFrameworks() {
  const { data } = await api.get<Framework[]>("/compliance/frameworks");
  return data;
}

export async function getFrameworkFindings(
  frameworkId: string,
  params?: { limit?: number; offset?: number }
) {
  const { data } = await api.get<{
    items: Finding[];
    total: number;
    frameworkId: string;
  }>(`/compliance/frameworks/${frameworkId}/findings`, { params });
  return data;
}

export interface Category {
  categoryId: string;
  name: string;
  description: string;
  findingCount: number;
}

// --- Enterprise Framework Coverage ---
export interface EnterpriseFramework {
  id: string;
  name: string;
  version?: string | null;
  category?: string | null;
  region?: string | null;
  framework_readiness_percent: number;
  criteria_in_scope: number;
  criteria_out_of_scope: number;
  controls_setup_count: number;
  automated_checks_count: number;
}

export interface FrameworkSummary {
  framework_id: string;
  framework_name: string;
  areas: number;
  criteria: number;
  controls: number;
  automated_checks: number;
  framework_readiness_percent: number;
  scan_id: string | null;
}

export interface FrameworkCriteriaItem {
  criteria_id: string;
  criteria_code: string;
  description?: string | null;
  scope: "IN_SCOPE" | "OUT_OF_SCOPE";
  mapped_controls: number;
  automated_checks: number;
  readiness_percent: number;
  ready_controls: number;
  total_controls: number;
}

export interface CriteriaControlItem {
  control_id: string;
  name: string;
  domain?: string | null;
  owner?: string | null;
  automated_checks: number;
  readiness_percent: number;
  status: "READY" | "PARTIAL" | "NOT_READY";
}

export async function getEnterpriseFrameworks() {
  const { data } = await api.get<EnterpriseFramework[]>("/frameworks");
  return data;
}

export async function getFrameworkSummary(frameworkId: string) {
  const { data } = await api.get<FrameworkSummary>(`/frameworks/${frameworkId}/summary`);
  return data;
}

export async function getFrameworkCriteria(frameworkId: string) {
  const { data } = await api.get<FrameworkCriteriaItem[]>(`/frameworks/${frameworkId}/criteria`);
  return data;
}

export async function updateCriteriaScope(criteriaId: string, scope: "IN_SCOPE" | "OUT_OF_SCOPE") {
  const { data } = await api.post<{ id: string; code: string; scopeStatus: "IN_SCOPE" | "OUT_OF_SCOPE" }>(
    `/criteria/${criteriaId}/scope`,
    { scope }
  );
  return data;
}

export async function getCriteriaControls(criteriaId: string) {
  const { data } = await api.get<CriteriaControlItem[]>(`/criteria/${criteriaId}/controls`);
  return data;
}

export async function getControlChecks(controlId: string) {
  const { data } = await api.get<{
    control_id: string;
    scan_id: string | null;
    checks: { check_id: string; status: "PASS" | "FAIL" | "INFO" | "NOT_EVALUATED" }[];
  }>(`/controls/${controlId}/checks`);
  return data;
}

export async function getCategories() {
  const { data } = await api.get<Category[]>("/compliance/categories");
  return data;
}

export async function getCategoryFindings(
  categoryId: string,
  params?: { limit?: number; offset?: number }
) {
  const { data } = await api.get<{
    items: Finding[];
    total: number;
    categoryId: string;
  }>(`/compliance/categories/${categoryId}/findings`, { params });
  return data;
}

// --- Assets ---
export async function getAssets(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get<{
    items: Asset[];
    page: number;
    pageSize: number;
    total: number;
  }>("/assets", { params });
  return data;
}

export interface Asset {
  id: string;
  name: string;
  type: string;
  riskLevel: string;
  createdAt: string;
}

export default api;
