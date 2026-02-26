"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getScannerStatus, getScanJobs } from "@/services/api";

export default function MonitoringPage() {
  const [status, setStatus] = useState<{
    ready: boolean;
    scanInProgress: boolean;
    queueLength: number;
  } | null>(null);
  const [recentJobs, setRecentJobs] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const refresh = async () => {
      try {
        const [s, j] = await Promise.all([
          getScannerStatus(),
          getScanJobs(5),
        ]);
        setStatus(s);
        setRecentJobs(j);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    refresh();
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-50">
          Monitoring
        </h1>
        <p className="text-xs text-slate-400">
          Scan status and recent activity. Scheduler runs daily full scans and
          hourly incremental scans when enabled.
        </p>
      </div>

      <Card className="border border-slate-800/80 bg-slate-950/80">
        <CardHeader className="border-b border-slate-800/80 pb-3">
          <CardTitle className="text-sm text-slate-100">
            Scanner Status
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <p className="text-slate-400">Loading...</p>
          ) : (
            <div className="flex gap-4 text-sm">
              <span>
                Status:{" "}
                <span
                  className={
                    status?.scanInProgress ? "text-amber-300" : "text-emerald-300"
                  }
                >
                  {status?.scanInProgress ? "Scan in progress" : "Ready"}
                </span>
              </span>
              <span>Queue: {status?.queueLength ?? 0}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-slate-800/80 bg-slate-950/80">
        <CardHeader className="border-b border-slate-800/80 pb-3">
          <CardTitle className="text-sm text-slate-100">
            Recent Scans
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          {loading ? (
            <p className="text-slate-400">Loading...</p>
          ) : recentJobs.length === 0 ? (
            <p className="text-slate-400">No scans yet.</p>
          ) : (
            <ul className="space-y-2">
              {(recentJobs as { id: string; type: string; status: string; completedAt: string | null }[]).map((j) => (
                <li
                  key={j.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-300">{j.type}</span>
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
                  <span className="text-slate-400 text-[11px]">
                    {j.completedAt
                      ? new Date(j.completedAt).toLocaleString()
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Link href="/scanner">
        <Button variant="outline" size="sm">
          Go to Scanner
        </Button>
      </Link>
    </div>
  );
}
