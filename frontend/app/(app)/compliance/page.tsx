"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getFrameworks,
  getCategories,
  getFrameworkFindings,
  getCategoryFindings,
  getComplianceScore,
  type Framework,
  type Category,
  type Finding,
} from "@/services/api";
import { ChevronDown, ChevronRight, Shield, FolderOpen } from "lucide-react";

type ViewMode = "frameworks" | "categories";

export default function CompliancePage() {
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [compliance, setCompliance] = useState<{
    score: number;
    lastEvaluated: string | null;
    resourceCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("frameworks");
  const [expandedFramework, setExpandedFramework] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [frameworkFindings, setFrameworkFindings] = useState<Finding[]>([]);
  const [categoryFindings, setCategoryFindings] = useState<Finding[]>([]);

  useEffect(() => {
    Promise.all([getFrameworks(), getCategories(), getComplianceScore()])
      .then(([f, c, comp]) => {
        setFrameworks(f);
        setCategories(c);
        setCompliance(comp);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const loadFrameworkFindings = (frameworkId: string) => {
    if (expandedFramework === frameworkId) {
      setExpandedFramework(null);
      setFrameworkFindings([]);
      return;
    }
    setExpandedFramework(frameworkId);
    getFrameworkFindings(frameworkId, { limit: 20 })
      .then((r) => setFrameworkFindings(r.items))
      .catch(console.error);
  };

  const loadCategoryFindings = (categoryId: string) => {
    if (expandedCategory === categoryId) {
      setExpandedCategory(null);
      setCategoryFindings([]);
      return;
    }
    setExpandedCategory(categoryId);
    getCategoryFindings(categoryId, { limit: 20 })
      .then((r) => setCategoryFindings(r.items))
      .catch(console.error);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-50">
          Compliance
        </h1>
        <p className="text-xs text-slate-400">
          {loading ? "Loading..." : `${frameworks.length} frameworks & ${categories.length} categories`} — framework-specific and category views.
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
            <CardTitle className="text-sm text-slate-100">View by</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 flex gap-2">
            <Button
              variant={viewMode === "frameworks" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("frameworks")}
              className="text-xs"
            >
              <Shield className="mr-1.5 h-3.5 w-3.5" />
              {frameworks.length} Frameworks
            </Button>
            <Button
              variant={viewMode === "categories" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("categories")}
              className="text-xs"
            >
              <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
              {categories.length} Categories
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-800/80 bg-slate-950/80">
        <CardHeader className="border-b border-slate-800/80 pb-3">
          <CardTitle className="text-sm text-slate-100">
            {viewMode === "frameworks"
              ? "Compliance Frameworks"
              : "Categories"}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <p className="text-slate-400">Loading...</p>
          ) : viewMode === "frameworks" ? (
            frameworks.length === 0 ? (
              <p className="text-slate-400 text-sm py-4">No frameworks available.</p>
            ) : (
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {frameworks.map((f) => (
                <div key={f.frameworkId} className="border-b border-slate-800/50 last:border-0">
                  <button
                    onClick={() => loadFrameworkFindings(f.frameworkId)}
                    className="w-full flex items-center justify-between py-2 px-2 rounded hover:bg-slate-800/50 text-left text-sm"
                  >
                    <span className="flex items-center gap-2">
                      {expandedFramework === f.frameworkId ? (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      )}
                      <span className="text-slate-200">{f.name}</span>
                      {f.findingCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                          {f.findingCount}
                        </span>
                      )}
                    </span>
                    <span
                      className={
                        f.score >= 80
                          ? "text-emerald-400 font-medium"
                          : "text-amber-400 font-medium"
                      }
                    >
                      {f.score}%
                    </span>
                  </button>
                  {expandedFramework === f.frameworkId &&
                    frameworkFindings.length > 0 && (
                      <div className="pl-6 pb-3 space-y-1.5 text-xs">
                        {frameworkFindings.map((fi) => (
                          <div
                            key={fi.id}
                            className="py-1.5 px-2 rounded bg-slate-900/60 border border-slate-800/50"
                          >
                            <span className="text-amber-400 font-medium">
                              {fi.ruleCode}
                            </span>
                            <span className="text-slate-400 mx-1">—</span>
                            <span className="text-slate-300 truncate">
                              {fi.message}
                            </span>
                            <span className="text-slate-500 ml-1">
                              ({fi.resourceId})
                            </span>
                          </div>
                        ))}
                        <Link href={`/findings?framework=${f.frameworkId}`}>
                          <Button variant="ghost" size="sm" className="text-[10px] h-6">
                            View all →
                          </Button>
                        </Link>
                      </div>
                    )}
                </div>
              ))}
            </div>
            )
          ) : (
            categories.length === 0 ? (
              <p className="text-slate-400 text-sm py-4">No categories available.</p>
            ) : (
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {categories.map((c) => (
                <div key={c.categoryId} className="border-b border-slate-800/50 last:border-0">
                  <button
                    onClick={() => loadCategoryFindings(c.categoryId)}
                    className="w-full flex items-center justify-between py-2 px-2 rounded hover:bg-slate-800/50 text-left text-sm"
                  >
                    <span className="flex items-center gap-2">
                      {expandedCategory === c.categoryId ? (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      )}
                      <span className="text-slate-200">{c.name}</span>
                      {c.findingCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                          {c.findingCount}
                        </span>
                      )}
                    </span>
                  </button>
                  {expandedCategory === c.categoryId &&
                    categoryFindings.length > 0 && (
                      <div className="pl-6 pb-3 space-y-1.5 text-xs">
                        {categoryFindings.map((fi) => (
                          <div
                            key={fi.id}
                            className="py-1.5 px-2 rounded bg-slate-900/60 border border-slate-800/50"
                          >
                            <span className="text-amber-400 font-medium">
                              {fi.ruleCode}
                            </span>
                            <span className="text-slate-400 mx-1">—</span>
                            <span className="text-slate-300 truncate">
                              {fi.message}
                            </span>
                            <span className="text-slate-500 ml-1">
                              ({fi.resourceId})
                            </span>
                          </div>
                        ))}
                        <Link href={`/findings?category=${c.categoryId}`}>
                          <Button variant="ghost" size="sm" className="text-[10px] h-6">
                            View all →
                          </Button>
                        </Link>
                      </div>
                    )}
                </div>
              ))}
            </div>
            )
          )}
        </CardContent>
      </Card>

      <Link href="/findings">
        <Button variant="outline" size="sm">
          View All Findings
        </Button>
      </Link>
    </div>
  );
}
