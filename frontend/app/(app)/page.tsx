import { DashboardClient } from "@/components/Dashboard/dashboard-client";

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold tracking-tight text-slate-50">
          Global Compliance Overview
        </h1>
        <p className="text-xs text-slate-400">
          High-level posture across all connected AWS accounts and frameworks.
        </p>
      </div>

      <DashboardClient />
    </div>
  );
}
