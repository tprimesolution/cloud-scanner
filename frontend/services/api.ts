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
  }>("/dashboard/metrics");
  return data;
}

export async function getComplianceScore() {
  const { data } = await api.get<{
    score: number;
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
  const { data } = await api.get<{ name: string; score: number }[]>(
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
