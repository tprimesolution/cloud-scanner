"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Finding } from "@/services/api";

type Props = {
  findings: unknown[];
  total: number;
  onRefresh?: () => void;
};

function SeverityPill({ value }: { value: string }) {
  const cap = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium";
  const styles: Record<string, string> = {
    critical: "bg-red-500/15 text-red-300 border border-red-500/40",
    high: "bg-orange-500/15 text-orange-300 border border-orange-500/40",
    medium: "bg-amber-500/15 text-amber-300 border border-amber-500/40",
    low: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40",
    informational: "bg-slate-500/15 text-slate-300 border border-slate-500/40",
  };
  const style = styles[value.toLowerCase()] ?? styles.medium;
  return <span className={cn(base, style)}>{cap}</span>;
}

function formatTimeAgo(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hr ago`;
  return `${Math.floor(sec / 86400)} days ago`;
}

export function RecentFindingsTable({ findings, total, onRefresh }: Props) {
  const rows = (findings as Finding[]) ?? [];

  return (
    <Card className="h-full border border-slate-800/80 bg-slate-950/80 shadow-soft/40">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/80 pb-3">
        <CardTitle className="text-sm text-slate-100">
          Recent Findings
        </CardTitle>
        <Link href="/findings">
          <Button
            variant="ghost"
            size="sm"
            className="text-[11px] text-sky-300 hover:text-sky-200"
          >
            View all
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="overflow-hidden rounded-lg border border-slate-800/80">
          <table className="min-w-full divide-y divide-slate-800 text-xs">
            <thead className="bg-slate-950/60 text-[11px] uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Resource</th>
                <th className="px-4 py-2 text-left font-medium">Issue</th>
                <th className="px-4 py-2 text-left font-medium">Severity</th>
                <th className="px-4 py-2 text-left font-medium">Framework</th>
                <th className="px-4 py-2 text-left font-medium">Last detected</th>
                <th className="px-4 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-950/40">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">
                    No findings yet. Run a scan to discover issues.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "hover:bg-slate-900/70",
                      idx % 2 === 1 && "bg-slate-950/60"
                    )}
                  >
                    <td className="max-w-[160px] truncate px-4 py-2 text-[11px] text-slate-100">
                      {row.resourceId}
                    </td>
                    <td className="px-4 py-2 text-[11px] text-slate-200">
                      {row.message}
                    </td>
                    <td className="px-4 py-2">
                      <SeverityPill value={row.severity} />
                    </td>
                    <td className="px-4 py-2 text-[11px] text-slate-300">
                      {row.controlIds?.[0] ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-[11px] text-slate-400">
                      {formatTimeAgo(row.lastSeenAt)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className="text-[11px] text-sky-300">
                        {row.rule?.name ?? "See rule"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
