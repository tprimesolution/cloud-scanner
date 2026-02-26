"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getFindings } from "@/services/api";

export default function ReportsPage() {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await getFindings({ limit: 1000 });
      const blob = new Blob(
        [JSON.stringify(res.items, null, 2)],
        { type: "application/json" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `findings-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-50">
          Reports
        </h1>
        <p className="text-xs text-slate-400">
          Export findings and compliance data.
        </p>
      </div>

      <Card className="border border-slate-800/80 bg-slate-950/80">
        <CardHeader className="border-b border-slate-800/80 pb-3">
          <CardTitle className="text-sm text-slate-100">
            Export Findings
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="text-sm text-slate-300 mb-4">
            Download findings as JSON (up to 1000 records).
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? "Exporting..." : "Export JSON"}
          </Button>
        </CardContent>
      </Card>

      <Link href="/findings">
        <Button variant="outline" size="sm">
          View Findings
        </Button>
      </Link>
    </div>
  );
}
