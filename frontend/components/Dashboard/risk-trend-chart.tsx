"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

type Props = {
  data?: { week: string; score: number; date: string }[];
  loading?: boolean;
};

export function RiskTrendChart({ data, loading }: Props) {
  const chartData = data?.length ? data : [];
  return (
    <Card className="h-full border border-slate-800/80 bg-slate-950/80 shadow-soft/40">
      <CardHeader className="border-b border-slate-800/80 pb-3">
        <CardTitle className="text-sm text-slate-100">
          Risk & Compliance Trend
        </CardTitle>
      </CardHeader>
      <CardContent className="h-64 pt-4">
        {loading ? (
          <div className="flex h-full items-center justify-center text-slate-400 text-sm">
            Loading...
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-400 text-sm">
            No scan history yet. Run scans to see trend.
          </div>
        ) : (
        <ResponsiveContainer>
          <LineChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1e293b"
              vertical={false}
            />
            <XAxis
              dataKey="week"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#9ca3af", fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#6b7280", fontSize: 10 }}
              domain={[60, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: "#020617",
                border: "1px solid #1e293b",
                fontSize: 11,
              }}
              labelStyle={{ color: "#e5e7eb" }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#38bdf8"
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 1, stroke: "#0f172a", fill: "#38bdf8" }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

