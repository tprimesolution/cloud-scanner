"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEnterpriseFrameworks, type EnterpriseFramework } from "@/services/api";

function Ring({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const color = v >= 80 ? "#34d399" : v >= 50 ? "#f59e0b" : "#f87171";
  return (
    <div
      className="h-14 w-14 rounded-full"
      style={{
        background: `conic-gradient(${color} ${v * 3.6}deg, rgba(51,65,85,0.55) 0deg)`,
      }}
    >
      <div className="m-[5px] flex h-[46px] w-[46px] items-center justify-center rounded-full bg-slate-950 text-[11px] text-slate-200">
        {v}%
      </div>
    </div>
  );
}

export default function FrameworksPage() {
  const [items, setItems] = useState<EnterpriseFramework[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEnterpriseFrameworks()
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-50">Framework Coverage</h1>
        <p className="text-xs text-slate-400">
          Enterprise readiness across frameworks, controls, and automated checks.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {loading ? (
          <Card className="border border-slate-800/80 bg-slate-950/80">
            <CardContent className="text-sm text-slate-400">Loading frameworks...</CardContent>
          </Card>
        ) : (
          items.map((f) => (
            <Link href={`/frameworks/${f.id}`} key={f.id}>
              <Card className="border border-slate-800/80 bg-slate-950/80 hover:border-sky-500/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-slate-100">{f.name}</CardTitle>
                  <p className="text-[11px] text-slate-400">
                    {f.version || "vN/A"}{f.category ? ` • ${f.category}` : ""}
                  </p>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-4 pt-1">
                  <Ring value={f.framework_readiness_percent} />
                  <div className="space-y-1 text-[11px] text-slate-300">
                    <p>Controls setup: {f.controls_setup_count}</p>
                    <p>Automated checks: {f.automated_checks_count}</p>
                    <p>
                      Scope: {f.criteria_in_scope} in / {f.criteria_out_of_scope} out
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
