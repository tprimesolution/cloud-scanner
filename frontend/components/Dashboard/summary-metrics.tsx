"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Layers,
  AlertTriangle,
  Shield,
  CheckCircle2,
} from "lucide-react";

type Metric = {
  label: string;
  value: string;
  delta?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "neutral" | "risk" | "positive";
};

const toneClasses: Record<Metric["tone"], string> = {
  neutral: "bg-slate-900/80 border-slate-800/80",
  risk: "bg-amber-950/60 border-amber-500/20",
  positive: "bg-emerald-950/40 border-emerald-500/25",
};

type Props = {
  metrics?: {
    totalAssets: number;
    activeViolations: number;
    criticalRisks: number;
    frameworkCoverage: string;
  } | null;
  loading?: boolean;
};

export function SummaryMetrics({ metrics, loading }: Props) {
  const m: Metric[] = [
    {
      label: "Total Assets",
      value: loading ? "—" : String(metrics?.totalAssets ?? 0),
      delta: undefined,
      icon: Layers,
      tone: "neutral",
    },
    {
      label: "Active Violations",
      value: loading ? "—" : String(metrics?.activeViolations ?? 0),
      delta: undefined,
      icon: AlertTriangle,
      tone: "risk",
    },
    {
      label: "Critical Risks",
      value: loading ? "—" : String(metrics?.criticalRisks ?? 0),
      delta: undefined,
      icon: Shield,
      tone: "risk",
    },
    {
      label: "Framework Coverage",
      value: loading ? "—" : metrics?.frameworkCoverage ?? "0%",
      delta: "CIS, ISO, SOC2",
      icon: CheckCircle2,
      tone: "positive",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {m.map((metric) => {
        const Icon = metric.icon;
        return (
          <Card
            key={metric.label}
            className={cn(
              "h-full border px-4 py-3 shadow-soft/40 backdrop-blur-sm",
              toneClasses[metric.tone]
            )}
          >
            <CardContent className="flex items-center justify-between space-x-3 px-0 py-0">
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                  {metric.label}
                </p>
                <p className="text-xl font-semibold text-slate-50">
                  {metric.value}
                </p>
                {metric.delta && (
                  <p className="text-[11px] text-slate-400">{metric.delta}</p>
                )}
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900/80 text-sky-300 shadow-soft/40">
                <Icon className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
