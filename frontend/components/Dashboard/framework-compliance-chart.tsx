"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

type Props = {
  data: { name: string; score: number }[];
  loading?: boolean;
};

const defaultData = [
  { name: "CIS AWS", score: 0 },
  { name: "ISO 27001", score: 0 },
  { name: "SOC 2", score: 0 },
];

export function FrameworkComplianceChart({ data, loading }: Props) {
  const chartData = data?.length ? data : defaultData;

  return (
    <Card className="h-full border border-slate-800/80 bg-slate-950/80 shadow-soft/40">
      <CardHeader className="border-b border-slate-800/80 pb-3">
        <CardTitle className="text-sm text-slate-100">
          Compliance by Framework
        </CardTitle>
      </CardHeader>
      <CardContent className="h-64 pt-4">
        {loading ? (
          <div className="flex h-full items-center justify-center text-slate-400 text-sm">
            Loading...
          </div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={chartData} barSize={28}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1e293b"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#9ca3af", fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#6b7280", fontSize: 10 }}
                tickFormatter={(v) => `${v}%`}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  background: "#020617",
                  border: "1px solid #1e293b",
                  fontSize: 11,
                }}
                labelStyle={{ color: "#e5e7eb" }}
              />
              <Bar
                dataKey="score"
                radius={[6, 6, 0, 0]}
                fill="url(#frameworkGradient)"
              />
              <defs>
                <linearGradient
                  id="frameworkGradient"
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
