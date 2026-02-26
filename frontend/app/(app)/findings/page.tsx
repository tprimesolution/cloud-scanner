"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getFindings, updateFindingStatus, type Finding } from "@/services/api";
import { cn } from "@/lib/utils";

function SeverityPill({ value }: { value: string }) {
  const cap = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium";
  const styles: Record<string, string> = {
    critical: "bg-red-500/15 text-red-300 border border-red-500/40",
    high: "bg-orange-500/15 text-orange-300 border border-orange-500/40",
    medium: "bg-amber-500/15 text-amber-300 border border-amber-500/40",
    low: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40",
  };
  return <span className={cn(base, styles[value.toLowerCase()] ?? "bg-slate-500/15")}>{cap}</span>;
}

export default function FindingsPage() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const fetchFindings = async () => {
    setLoading(true);
    try {
      const res = await getFindings({
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
        limit,
        offset,
      });
      setFindings(res.items);
      setTotal(res.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFindings();
  }, [statusFilter, severityFilter, offset]);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateFindingStatus(id, status);
      fetchFindings();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-50">
          Findings
        </h1>
        <p className="text-xs text-slate-400">
          Security and compliance findings from scans.
        </p>
      </div>

      <Card className="border border-slate-800/80 bg-slate-950/80">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/80 pb-3">
          <CardTitle className="text-sm text-slate-100">All Findings</CardTitle>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setOffset(0);
              }}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200"
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
              <option value="suppressed">Suppressed</option>
            </select>
            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setOffset(0);
              }}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200"
            >
              <option value="">All severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="pt-3">
          {loading ? (
            <div className="py-8 text-center text-slate-400">Loading...</div>
          ) : findings.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              No findings. Run a scan to discover issues.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-800 text-xs">
                  <thead className="bg-slate-950/60 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                    <tr>
                      <th className="px-4 py-2 text-left">Resource</th>
                      <th className="px-4 py-2 text-left">Issue</th>
                      <th className="px-4 py-2 text-left">Severity</th>
                      <th className="px-4 py-2 text-left">Framework</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {findings.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-900/70">
                        <td className="max-w-[180px] truncate px-4 py-2 text-slate-100">
                          {f.resourceId}
                        </td>
                        <td className="px-4 py-2 text-slate-200">{f.message}</td>
                        <td className="px-4 py-2">
                          <SeverityPill value={f.severity} />
                        </td>
                        <td className="px-4 py-2 text-slate-300">
                          {f.controlIds?.[0] ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-slate-400">{f.status}</td>
                        <td className="px-4 py-2 text-right">
                          {f.status === "open" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px]"
                              onClick={() => handleStatusChange(f.id, "acknowledged")}
                            >
                              Acknowledge
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={offset === 0}
                    onClick={() => setOffset((o) => Math.max(0, o - limit))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={offset + limit >= total}
                    onClick={() => setOffset((o) => o + limit)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
