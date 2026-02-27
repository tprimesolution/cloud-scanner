"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { GaugeCircle } from "lucide-react";
import { Pie, PieChart, ResponsiveContainer } from "recharts";

type Props = {
  score: number;
  coveragePercent?: number;
  loading?: boolean;
  lastEvaluated?: string | null;
  resourceCount?: number;
};

export function ComplianceScoreCard({
  score,
  coveragePercent,
  loading,
  lastEvaluated,
  resourceCount,
}: Props) {
  const clamped = Math.max(0, Math.min(score, 100));
  const data = [
    { name: "Compliant", value: clamped },
    { name: "Gap", value: 100 - clamped },
  ];

  const status =
    clamped >= 90 ? "Excellent" : clamped >= 75 ? "Healthy" : "At risk";

  const statusColor =
    clamped >= 90
      ? "text-emerald-400"
      : clamped >= 75
      ? "text-sky-300"
      : "text-amber-300";

  return (
    <Card className="h-full bg-gradient-to-br from-slate-950 via-slate-950/80 to-slate-900/80 border-slate-800 shadow-soft">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/80 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm text-slate-100">
          <GaugeCircle className="h-4 w-4 text-sky-300" />
          Overall Compliance
        </CardTitle>
        <span className={cn("text-[11px] font-medium", statusColor)}>
          {status}
        </span>
      </CardHeader>
      <CardContent className="flex items-center gap-4 pt-5">
        {loading ? (
          <div className="flex flex-1 items-center gap-4">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ) : (
          <>
            <div className="h-28 w-28">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    innerRadius={34}
                    outerRadius={54}
                    startAngle={90}
                    endAngle={-270}
                    stroke="none"
                    cornerRadius={8}
                  >
                    {/* colors applied via className on SVG container */}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-semibold text-slate-50">
                {clamped.toFixed(0)}%
              </div>
              <p className="text-xs text-slate-400">
                Benchmarked against CIS AWS, ISO 27001, and SOC 2 controls.
              </p>
              <p className="text-[11px] text-slate-500">
                Control coverage{" "}
                <span className="text-slate-300">{coveragePercent ?? 0}%</span>
              </p>
              <p className="text-[11px] text-slate-500">
                Last evaluated{" "}
                <span className="text-slate-300">
                  {lastEvaluated
                    ? new Date(lastEvaluated).toLocaleString()
                    : "Never"}
                </span>{" "}
                across{" "}
                <span className="text-slate-300">{resourceCount ?? 0} resources</span>.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

