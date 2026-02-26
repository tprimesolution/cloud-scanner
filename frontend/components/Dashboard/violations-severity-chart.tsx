"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pie, PieChart, ResponsiveContainer, Cell } from "recharts";

type Props = {
  data: { name: string; value: number; color: string }[];
  loading?: boolean;
};

const defaultData = [
  { name: "Critical", value: 0, color: "#f97373" },
  { name: "High", value: 0, color: "#fb923c" },
  { name: "Medium", value: 0, color: "#eab308" },
  { name: "Low", value: 0, color: "#22c55e" },
];

export function ViolationsSeverityChart({ data, loading }: Props) {
  const chartData = data?.length ? data : defaultData;

  return (
    <Card className="h-full border border-slate-800/80 bg-slate-950/80 shadow-soft/40">
      <CardHeader className="border-b border-slate-800/80 pb-3">
        <CardTitle className="text-sm text-slate-100">
          Violations by Severity
        </CardTitle>
      </CardHeader>
      <CardContent className="flex h-64 items-center justify-between gap-4 pt-4">
        {loading ? (
          <div className="flex h-full w-full items-center justify-center text-slate-400 text-sm">
            Loading...
          </div>
        ) : (
          <>
            <div className="h-full flex-1">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={3}
                    cornerRadius={6}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-32 space-y-2 text-[11px] text-slate-300">
              {chartData.map((d) => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: d.color }}
                    />
                    <span>{d.name}</span>
                  </div>
                  <span className="text-slate-400">{d.value}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
