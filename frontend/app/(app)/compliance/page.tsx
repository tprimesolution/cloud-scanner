"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getFrameworkScores, getComplianceScore } from "@/services/api";

export default function CompliancePage() {
  const [frameworkScores, setFrameworkScores] = useState<
    { name: string; score: number }[]
  >([]);
  const [compliance, setCompliance] = useState<{
    score: number;
    lastEvaluated: string | null;
    resourceCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getFrameworkScores(), getComplianceScore()])
      .then(([f, c]) => {
        setFrameworkScores(f);
        setCompliance(c);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-50">
          Compliance
        </h1>
        <p className="text-xs text-slate-400">
          Framework compliance scores and control coverage.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border border-slate-800/80 bg-slate-950/80">
          <CardHeader className="border-b border-slate-800/80 pb-3">
            <CardTitle className="text-sm text-slate-100">
              Overall Score
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <p className="text-slate-400">Loading...</p>
            ) : (
              <div className="text-3xl font-semibold text-slate-50">
                {compliance?.score ?? 0}%
              </div>
            )}
            <p className="mt-2 text-[11px] text-slate-400">
              Last evaluated:{" "}
              {compliance?.lastEvaluated
                ? new Date(compliance.lastEvaluated).toLocaleString()
                : "Never"}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-slate-800/80 bg-slate-950/80">
          <CardHeader className="border-b border-slate-800/80 pb-3">
            <CardTitle className="text-sm text-slate-100">
              By Framework
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2">
            {loading ? (
              <p className="text-slate-400">Loading...</p>
            ) : (
              frameworkScores.map((f) => (
                <div
                  key={f.name}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-300">{f.name}</span>
                  <span className="font-medium text-slate-50">{f.score}%</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Link href="/findings">
        <Button variant="outline" size="sm">
          View Findings
        </Button>
      </Link>
    </div>
  );
}
