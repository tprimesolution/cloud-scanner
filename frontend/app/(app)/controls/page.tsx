"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getEnterpriseFrameworks,
  getFrameworkCriteria,
  getCriteriaControls,
  getControlChecks,
  type CriteriaControlItem,
} from "@/services/api";

export default function ControlsPage() {
  const [controls, setControls] = useState<CriteriaControlItem[]>([]);
  const [selectedControl, setSelectedControl] = useState<string | null>(null);
  const [checks, setChecks] = useState<{ check_id: string; status: string }[]>([]);

  useEffect(() => {
    const load = async () => {
      const frameworks = await getEnterpriseFrameworks();
      const all: CriteriaControlItem[] = [];
      for (const fw of frameworks) {
        const criteria = await getFrameworkCriteria(fw.id);
        for (const c of criteria.slice(0, 5)) {
          const rows = await getCriteriaControls(c.criteria_id);
          all.push(...rows);
        }
      }
      const unique = new Map<string, CriteriaControlItem>();
      for (const c of all) unique.set(c.control_id, c);
      setControls(Array.from(unique.values()));
    };
    load().catch(console.error);
  }, []);

  const viewChecks = async (controlId: string) => {
    setSelectedControl(controlId);
    const data = await getControlChecks(controlId);
    setChecks(data.checks);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-50">Controls Readiness</h1>
        <p className="text-xs text-slate-400">Monitoring status and automated checks per control.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="border border-slate-800/80 bg-slate-950/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-100">Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {controls.map((c) => (
              <div key={c.control_id} className="rounded border border-slate-800/80 bg-slate-900/40 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-100">{c.name}</p>
                    <p className="text-slate-400">{c.domain || "General"} {c.owner ? `• ${c.owner}` : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-100">{c.readiness_percent}%</p>
                    <p className="text-[11px] text-slate-500">{c.status}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-slate-400">{c.automated_checks} checks</p>
                  <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => viewChecks(c.control_id)}>
                    View Checks
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border border-slate-800/80 bg-slate-950/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-100">Automated Checks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {!selectedControl ? (
              <p className="text-slate-500">Select a control to inspect mapped checks.</p>
            ) : checks.length === 0 ? (
              <p className="text-slate-500">No mapped checks found for this control.</p>
            ) : (
              checks.map((c) => (
                <div key={c.check_id} className="rounded border border-slate-800/80 bg-slate-900/40 p-2">
                  <p className="font-mono text-[11px] text-slate-200">{c.check_id}</p>
                  <p className="text-slate-400">{c.status}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
