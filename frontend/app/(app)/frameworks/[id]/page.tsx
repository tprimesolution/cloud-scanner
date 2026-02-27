"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getFrameworkSummary,
  getFrameworkCriteria,
  getCriteriaControls,
  updateCriteriaScope,
  type FrameworkSummary,
  type FrameworkCriteriaItem,
  type CriteriaControlItem,
} from "@/services/api";

export default function FrameworkDetailPage() {
  const params = useParams<{ id: string }>();
  const frameworkId = useMemo(() => String(params?.id || ""), [params]);
  const [summary, setSummary] = useState<FrameworkSummary | null>(null);
  const [criteria, setCriteria] = useState<FrameworkCriteriaItem[]>([]);
  const [selectedCriteria, setSelectedCriteria] = useState<string | null>(null);
  const [controls, setControls] = useState<CriteriaControlItem[]>([]);

  const refresh = async () => {
    if (!frameworkId) return;
    const [s, c] = await Promise.all([
      getFrameworkSummary(frameworkId),
      getFrameworkCriteria(frameworkId),
    ]);
    setSummary(s);
    setCriteria(c);
    if (!selectedCriteria && c.length > 0) {
      setSelectedCriteria(c[0].criteria_id);
    }
  };

  useEffect(() => {
    refresh().catch(console.error);
  }, [frameworkId]);

  useEffect(() => {
    if (!selectedCriteria) return;
    getCriteriaControls(selectedCriteria).then(setControls).catch(console.error);
  }, [selectedCriteria]);

  const toggleScope = async (criteriaId: string, scope: "IN_SCOPE" | "OUT_OF_SCOPE") => {
    await updateCriteriaScope(criteriaId, scope === "IN_SCOPE" ? "OUT_OF_SCOPE" : "IN_SCOPE");
    await refresh();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-50">{summary?.framework_name || "Framework"}</h1>
        <p className="text-xs text-slate-400">Areas, criteria, control coverage and readiness.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <Card className="border border-slate-800/80 bg-slate-950/80 md:col-span-5">
          <CardContent className="grid grid-cols-2 gap-3 py-4 md:grid-cols-5">
            <div className="text-xs text-slate-300">Areas: <span className="text-slate-50">{summary?.areas ?? 0}</span></div>
            <div className="text-xs text-slate-300">Criteria: <span className="text-slate-50">{summary?.criteria ?? 0}</span></div>
            <div className="text-xs text-slate-300">Controls: <span className="text-slate-50">{summary?.controls ?? 0}</span></div>
            <div className="text-xs text-slate-300">Checks: <span className="text-slate-50">{summary?.automated_checks ?? 0}</span></div>
            <div className="text-xs text-slate-300">Readiness: <span className="text-emerald-400">{summary?.framework_readiness_percent ?? 0}%</span></div>
          </CardContent>
        </Card>

        <Card className="border border-slate-800/80 bg-slate-950/80 md:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-100">Criteria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {criteria.map((c) => (
              <div
                key={c.criteria_id}
                className={`rounded border p-2 ${selectedCriteria === c.criteria_id ? "border-sky-500/60 bg-slate-900/80" : "border-slate-800/80 bg-slate-900/40"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    className="text-left"
                    onClick={() => setSelectedCriteria(c.criteria_id)}
                  >
                    <p className="font-medium text-slate-100">{c.criteria_code}</p>
                    <p className="text-slate-400">{c.description || "-"}</p>
                  </button>
                  <div className="text-right">
                    <p className="text-slate-200">{c.readiness_percent}%</p>
                    <p className="text-[11px] text-slate-500">{c.mapped_controls} controls</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Scope: {c.scope}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px]"
                    onClick={() => toggleScope(c.criteria_id, c.scope)}
                  >
                    Toggle Scope
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border border-slate-800/80 bg-slate-950/80 md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-100">Criteria Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {controls.length === 0 ? (
              <p className="text-slate-500">Select a criteria to view controls.</p>
            ) : (
              controls.map((c) => (
                <div key={c.control_id} className="rounded border border-slate-800/80 bg-slate-900/40 p-2">
                  <p className="font-medium text-slate-100">{c.name}</p>
                  <p className="text-slate-400">{c.domain || "General"} {c.owner ? `• ${c.owner}` : ""}</p>
                  <p className="mt-1 text-slate-300">
                    {c.readiness_percent}% • {c.status} • {c.automated_checks} checks
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
