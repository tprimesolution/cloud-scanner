"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAssets, type Asset } from "@/services/api";

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    getAssets({ page, pageSize })
      .then((res) => {
        setAssets(res.items);
        setTotal(res.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-50">
          Assets
        </h1>
        <p className="text-xs text-slate-400">
          Discovered cloud resources and inventory.
        </p>
      </div>

      <Card className="border border-slate-800/80 bg-slate-950/80">
        <CardHeader className="border-b border-slate-800/80 pb-3">
          <CardTitle className="text-sm text-slate-100">Asset Inventory</CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          {loading ? (
            <div className="py-8 text-center text-slate-400">Loading...</div>
          ) : assets.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              No assets. Run a scan to discover resources.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-800 text-xs">
                  <thead className="bg-slate-950/60 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                    <tr>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-left">Risk Level</th>
                      <th className="px-4 py-2 text-left">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {assets.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-900/70">
                        <td className="px-4 py-2 text-slate-100">{a.name}</td>
                        <td className="px-4 py-2 text-slate-300">{a.type}</td>
                        <td className="px-4 py-2">
                          <span
                            className={
                              a.riskLevel === "high" || a.riskLevel === "critical"
                                ? "text-amber-300"
                                : "text-slate-400"
                            }
                          >
                            {a.riskLevel}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate-400">
                          {new Date(a.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  Showing {(page - 1) * pageSize + 1}–
                  {Math.min(page * pageSize, total)} of {total}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page * pageSize >= total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
