"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getFindingsBySeverity, getFindings } from "@/services/api";

export default function RisksPage() {
  const [severityData, setSeverityData] = useState<
    { name: string; value: number; color: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getFindingsBySeverity(), getFindings({ limit: 5, severity: "critical" })])
      .then(([s]) => {
        setSeverityData(s);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const total = severityData.reduce((a, b) => a + b.value, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-50">
          Risks
        </h1>
        <p className="text-xs text-slate-400">
          Risk metrics and findings by severity.
        </p>
      </div>

      <Card className="border border-slate-800/80 bg-slate-950/80">
        <CardHeader className="border-b border-slate-800/80 pb-3">
          <CardTitle className="text-sm text-slate-100">
            Open Findings by Severity
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <p className="text-slate-400">Loading...</p>
          ) : (
            <div className="space-y-3">
              {severityData.map((s) => (
                <div key={s.name} className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="flex-1 text-slate-300">{s.name}</span>
                  <span className="font-medium text-slate-50">{s.value}</span>
                </div>
              ))}
              <p className="pt-2 text-[11px] text-slate-400">
                Total open findings: {total}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Link href="/findings">
        <Button variant="outline" size="sm">
          View All Findings
        </Button>
      </Link>
    </div>
  );
}
