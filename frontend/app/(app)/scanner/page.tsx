"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getScannerStatus,
  triggerScan,
  getScanJobs,
} from "@/services/api";
import { Play, Loader2, RefreshCw } from "lucide-react";

export default function ScannerPage() {
  const [status, setStatus] = useState<{
    ready: boolean;
    scanInProgress: boolean;
    queueLength: number;
  } | null>(null);
  const [jobs, setJobs] = useState<unknown[]>([]);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [s, j] = await Promise.all([
        getScannerStatus(),
        getScanJobs(15),
      ]);
      setStatus(s);
      setJobs(j);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, []);

  const handleRunScan = async () => {
    if (scanning || status?.scanInProgress) return;
    setScanning(true);
    setMessage(null);
    try {
      const result = await triggerScan();
      setMessage(result.triggered ? "Scan started." : result.message);
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold tracking-tight text-slate-50">
          Scanner
        </h1>
        <p className="text-xs text-slate-400">
          Run security scans and view scan history.
        </p>
      </div>

      <Card className="border border-slate-800/80 bg-slate-950/80">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/80 pb-3">
          <CardTitle className="text-sm text-slate-100">Scan Status</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              className="text-[11px]"
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={handleRunScan}
              disabled={scanning || status?.scanInProgress === true}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/50 bg-sky-500/10 px-3 text-[11px] font-medium text-sky-300 hover:bg-sky-500/20"
            >
              {(scanning || status?.scanInProgress) ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              {scanning || status?.scanInProgress ? "Scanning..." : "Run Scan"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-3 space-y-2">
          {message && (
            <p className="text-[11px] text-slate-400">{message}</p>
          )}
          <div className="flex gap-4 text-[11px]">
            <span>
              Status:{" "}
              <span className={status?.scanInProgress ? "text-amber-300" : "text-emerald-300"}>
                {status?.scanInProgress ? "Scan in progress" : "Ready"}
              </span>
            </span>
            <span>Queue: {status?.queueLength ?? 0}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-800/80 bg-slate-950/80">
        <CardHeader className="border-b border-slate-800/80 pb-3">
          <CardTitle className="text-sm text-slate-100">Recent Scan Jobs</CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          {jobs.length === 0 ? (
            <p className="py-6 text-center text-slate-400 text-sm">
              No scan jobs yet. Run a scan to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-xs">
                <thead className="bg-slate-950/60 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  <tr>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Resources</th>
                    <th className="px-4 py-2 text-left">Findings</th>
                    <th className="px-4 py-2 text-left">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {(jobs as { type: string; status: string; resourceCount: number; findingCount: number; completedAt: string | null }[]).map((j) => (
                    <tr key={(j as { id?: string }).id} className="hover:bg-slate-900/70">
                      <td className="px-4 py-2 text-slate-200">{j.type}</td>
                      <td className="px-4 py-2">
                        <span
                          className={
                            j.status === "completed"
                              ? "text-emerald-300"
                              : j.status === "failed"
                              ? "text-red-300"
                              : "text-amber-300"
                          }
                        >
                          {j.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-300">{j.resourceCount}</td>
                      <td className="px-4 py-2 text-slate-300">{j.findingCount}</td>
                      <td className="px-4 py-2 text-slate-400">
                        {j.completedAt
                          ? new Date(j.completedAt).toLocaleString()
                          : "—"}
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
