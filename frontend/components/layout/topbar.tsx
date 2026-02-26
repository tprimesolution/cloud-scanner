"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, Search, Building2, Play, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { triggerScan, getScannerStatus } from "@/services/api";

export function Topbar() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);

  const handleRunScan = async () => {
    if (scanning) return;
    setScanning(true);
    setScanStatus(null);
    try {
      const result = await triggerScan();
      if (result.triggered) {
        setScanStatus("Scan started. Polling...");
        const poll = setInterval(async () => {
          try {
            const s = await getScannerStatus();
            if (!s.scanInProgress) {
              clearInterval(poll);
              clearTimeout(timeoutId);
              setScanStatus("Complete.");
              setScanning(false);
              router.refresh();
              window.dispatchEvent(new CustomEvent("scan-complete"));
            }
          } catch {
            // ignore poll errors
          }
        }, 2000);
        let timeoutId: ReturnType<typeof setTimeout>;
        timeoutId = setTimeout(() => {
          clearInterval(poll);
          setScanning(false);
        }, 300000);
      } else {
        setScanStatus(result.message);
        setScanning(false);
      }
    } catch (e) {
      setScanStatus(e instanceof Error ? e.message : "Scan failed");
      setScanning(false);
    }
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border/60 bg-slate-950/70 px-4 backdrop-blur-md">
      <div className="flex flex-1 items-center gap-3">
        <Button
          size="sm"
          onClick={handleRunScan}
          disabled={scanning}
          className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/50 bg-sky-500/10 px-3 text-[11px] font-medium text-sky-300 hover:bg-sky-500/20"
        >
          {scanning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {scanning ? "Scanning..." : "Run Scan"}
        </Button>
        {scanStatus && (
          <span className="text-[11px] text-slate-400">{scanStatus}</span>
        )}
        <div className="relative hidden max-w-md flex-1 items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-950/80 px-2.5 py-1.5 text-xs text-slate-300 shadow-soft/30 md:flex">
          <Search className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
          <Input
            className="h-6 border-0 bg-transparent px-0 text-xs placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder="Search resources, findings, policies..."
          />
          <div className="ml-auto hidden items-center gap-1 rounded-md border border-slate-700/80 px-1.5 py-0.5 text-[10px] text-slate-400 md:flex">
            <span className="font-mono">⌘</span>
            <span>K</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="hidden items-center gap-1 rounded-lg border border-slate-800/80 bg-slate-950/60 px-2 text-[11px] text-slate-200 hover:bg-slate-900 md:inline-flex"
        >
          <Building2 className="h-3.5 w-3.5 text-sky-300" />
          <span>Acme Security</span>
          <ChevronDown className="h-3 w-3 text-slate-500" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full border border-slate-800/80 bg-slate-950/60 text-slate-300 hover:bg-slate-900"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </Button>

        <button className="inline-flex items-center gap-2 rounded-full border border-slate-800/80 bg-slate-950/70 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-slate-900">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-sky-500 to-indigo-400 text-[11px] font-semibold text-slate-950">
            PK
          </div>
          <span className="hidden sm:inline">pritam@acme.io</span>
          <ChevronDown className="h-3 w-3 text-slate-500" />
        </button>
      </div>
    </header>
  );
}
