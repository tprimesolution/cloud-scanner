"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080/api";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-50">
          Settings
        </h1>
        <p className="text-xs text-slate-400">
          Application configuration.
        </p>
      </div>

      <Card className="border border-slate-800/80 bg-slate-950/80">
        <CardHeader className="border-b border-slate-800/80 pb-3">
          <CardTitle className="text-sm text-slate-100">
            API Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-2">
          <div>
            <label className="text-[11px] text-slate-400">API Base URL</label>
            <p className="font-mono text-sm text-sky-300">{apiBase}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Set <code className="rounded bg-slate-800 px-1">NEXT_PUBLIC_API_BASE_URL</code> to
              change.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
