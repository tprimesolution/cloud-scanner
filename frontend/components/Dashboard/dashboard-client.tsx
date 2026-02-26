"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComplianceScoreCard } from "@/components/Dashboard/compliance-score-card";
import { SummaryMetrics } from "@/components/Dashboard/summary-metrics";
import { ViolationsSeverityChart } from "@/components/Dashboard/violations-severity-chart";
import { FrameworkComplianceChart } from "@/components/Dashboard/framework-compliance-chart";
import { RiskTrendChart } from "@/components/Dashboard/risk-trend-chart";
import { RecentFindingsTable } from "@/components/Dashboard/recent-findings-table";
import {
  getDashboardMetrics,
  getComplianceScore,
  getFindingsBySeverity,
  getFrameworkScores,
  getFindings,
  getRiskTrend,
} from "@/services/api";

export function DashboardClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<{
    totalAssets: number;
    activeViolations: number;
    criticalRisks: number;
    frameworkCoverage: string;
  } | null>(null);
  const [compliance, setCompliance] = useState<{
    score: number;
    lastEvaluated: string | null;
    resourceCount: number;
  } | null>(null);
  const [severityData, setSeverityData] = useState<
    { name: string; value: number; color: string }[]
  >([]);
  const [frameworkData, setFrameworkData] = useState<
    { name: string; score: number }[]
  >([]);
  const [findings, setFindings] = useState<{ items: unknown[]; total: number }>({
    items: [],
    total: 0,
  });
  const [riskTrendData, setRiskTrendData] = useState<
    { week: string; score: number; date: string }[]
  >([]);

  const refresh = async () => {
    setLoading(true);
    try {
      setError(null);
        const [m, c, s, f, find, trend] = await Promise.all([
          getDashboardMetrics(),
          getComplianceScore(),
          getFindingsBySeverity(),
          getFrameworkScores(),
          getFindings({ limit: 10, offset: 0 }),
          getRiskTrend(),
        ]);
        setMetrics(m);
        setCompliance(c);
        setSeverityData(s);
        setFrameworkData(f);
        setFindings(find);
        setRiskTrendData(trend);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const onScanComplete = () => refresh();
    window.addEventListener("scan-complete", onScanComplete);
    return () => window.removeEventListener("scan-complete", onScanComplete);
  }, []);

  if (loading && !metrics) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-sm text-slate-400">Loading dashboard...</div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-200">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={loading}
          className="text-[11px] text-slate-400 hover:text-slate-200"
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)]">
        <ComplianceScoreCard
          score={compliance?.score ?? 100}
          loading={loading}
          lastEvaluated={compliance?.lastEvaluated}
          resourceCount={compliance?.resourceCount ?? 0}
        />
        <SummaryMetrics metrics={metrics} loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)]">
        <ViolationsSeverityChart data={severityData} loading={loading} />
        <FrameworkComplianceChart data={frameworkData} loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)]">
        <RecentFindingsTable
          findings={findings.items}
          total={findings.total}
          onRefresh={refresh}
        />
        <RiskTrendChart data={riskTrendData} loading={loading} />
      </div>
    </div>
  );
}
