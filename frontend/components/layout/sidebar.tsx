"use client";

import {
  LayoutDashboard,
  Server,
  ShieldCheck,
  AlertTriangle,
  ScrollText,
  Activity,
  FileBarChart,
  Settings,
  Search,
  Bug,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Scanner", href: "/scanner", icon: Search },
  { label: "Findings", href: "/findings", icon: Bug },
  { label: "Assets", href: "/assets", icon: Server },
  { label: "Compliance", href: "/compliance", icon: ShieldCheck },
  { label: "Frameworks", href: "/frameworks", icon: ShieldCheck },
  { label: "Controls", href: "/controls", icon: ShieldCheck },
  { label: "Risks", href: "/risks", icon: AlertTriangle },
  { label: "Policies", href: "/policies", icon: ScrollText },
  { label: "Monitoring", href: "/monitoring", icon: Activity },
  { label: "Reports", href: "/reports", icon: FileBarChart },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border/60 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),transparent_55%),radial-gradient(circle_at_bottom,_rgba(129,140,248,0.08),transparent_55%)] bg-slate-950/95 text-slate-100">
      <div className="flex h-14 items-center gap-2 border-b border-border/60 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100/5 text-sky-300">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight">
            Nimbus Guard
          </span>
          <span className="text-[11px] text-slate-400">Cloud compliance</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-4 text-sm">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : (pathname ?? "").startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                active
                  ? "bg-slate-900/80 text-slate-50 shadow-soft/40"
                  : "text-slate-400 hover:bg-slate-900/40 hover:text-slate-100"
              )}
            >
              <Icon className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-sky-300" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

