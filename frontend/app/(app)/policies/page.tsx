"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRules } from "@/services/api";
import { cn } from "@/lib/utils";

export default function PoliciesPage() {
  const [rules, setRules] = useState<
    { id: string; code: string; name: string; description?: string; resourceType: string; severity: string; controlIds: string[] }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRules()
      .then(setRules)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const severityColors: Record<string, string> = {
    critical: "bg-red-500/15 text-red-300",
    high: "bg-orange-500/15 text-orange-300",
    medium: "bg-amber-500/15 text-amber-300",
    low: "bg-emerald-500/15 text-emerald-300",
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-50">
          Policies
        </h1>
        <p className="text-xs text-slate-400">
          Compliance rules evaluated during scans.
        </p>
      </div>

      <Card className="border border-slate-800/80 bg-slate-950/80">
        <CardHeader className="border-b border-slate-800/80 pb-3">
          <CardTitle className="text-sm text-slate-100">
            Active Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          {loading ? (
            <p className="py-6 text-center text-slate-400">Loading...</p>
          ) : rules.length === 0 ? (
            <p className="py-6 text-center text-slate-400">
              No rules yet. Run a scan to auto-create rules from plugins.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-xs">
                <thead className="bg-slate-950/60 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  <tr>
                    <th className="px-4 py-2 text-left">Code</th>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Resource Type</th>
                    <th className="px-4 py-2 text-left">Severity</th>
                    <th className="px-4 py-2 text-left">Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {rules.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-900/70">
                      <td className="px-4 py-2 font-mono text-sky-300">{r.code}</td>
                      <td className="px-4 py-2 text-slate-200">{r.name}</td>
                      <td className="px-4 py-2 text-slate-300">{r.resourceType}</td>
                      <td className="px-4 py-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px]",
                            severityColors[r.severity] ?? "bg-slate-500/15"
                          )}
                        >
                          {r.severity}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-400">
                        {r.controlIds?.join(", ") ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
