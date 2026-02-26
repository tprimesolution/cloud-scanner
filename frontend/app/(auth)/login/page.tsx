"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ShieldCheck, ArrowRight, Lock, Mail, Sparkles } from "lucide-react";
import { useState } from "react";

const customers = ["Acme Corp", "Globex", "Infrasec", "Skyline", "Vertex"];

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      window.location.href = "/";
    }, 800);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
      {/* Left panel */}
      <div className="relative flex flex-1 items-center justify-center px-6 py-10 sm:px-10 lg:px-16">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 opacity-80" />
        <div className="relative z-10 flex w-full max-w-md flex-col space-y-8">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-slate-50 shadow-md">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-slate-900">
                Nimbus Guard
              </span>
              <span className="text-xs text-slate-500">
                Cloud Compliance Platform
              </span>
            </div>
          </div>

          {/* Copy */}
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Welcome back
            </h1>
            <p className="text-sm text-muted-foreground">
              Sign in to review your cloud posture, track compliance drift, and
              prioritize risk across all environments.
            </p>
          </div>

          {/* Auth form */}
          <Card className="border-border/70 bg-card/80 shadow-xl backdrop-blur-sm">
            <CardContent className="space-y-5 pt-6">
              <form className="space-y-4" onSubmit={handleLogin}>
                <div className="space-y-2">
                  <Label htmlFor="email">Work email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      className="pl-9"
                      placeholder="you@company.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      className="pl-9"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:text-primary/90"
                  >
                    Forgot password?
                  </button>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Sign up for access
                  </button>
                </div>

                <Button
                  type="submit"
                  className="mt-1 w-full"
                  disabled={loading}
                >
                  {loading ? "Signing you in..." : "Continue to dashboard"}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-dashed border-border/80" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-card px-2 text-[10px] font-medium tracking-wide text-muted-foreground">
                    or continue with
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="flex w-full items-center justify-center space-x-2"
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-white">
                  <span className="text-[10px] font-semibold text-slate-900">
                    G
                  </span>
                </span>
                <span className="text-xs font-medium text-slate-800">
                  Sign in with Google Workspace
                </span>
              </Button>

              <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
                By continuing, you agree to the{" "}
                <a
                  href="#"
                  className="font-medium text-primary hover:text-primary/90"
                >
                  Terms
                </a>{" "}
                and{" "}
                <a
                  href="#"
                  className="font-medium text-primary hover:text-primary/90"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </CardContent>
          </Card>

          {/* Bottom legal for mobile */}
          <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground lg:hidden">
            <span>© {new Date().getFullYear()} Nimbus Guard</span>
            <span>Security-first by design</span>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div
        className={cn(
          "relative hidden w-full flex-1 items-center justify-center overflow-hidden lg:flex",
          "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_55%),radial-gradient(circle_at_bottom,rgba(129,140,248,0.18),transparent_55%)]" />

        <div className="relative z-10 flex h-full w-full flex-col justify-between px-12 py-10 text-slate-100">
          {/* Top logo + tagline */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100/10 backdrop-blur">
                <ShieldCheck className="h-5 w-5 text-sky-300" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-tight">
                  Nimbus Guard
                </span>
                <span className="text-[11px] text-slate-400">
                  Enterprise cloud compliance platform
                </span>
              </div>
            </div>

            <div className="inline-flex items-center space-x-2 rounded-full border border-slate-700/80 bg-slate-900/60 px-3 py-1 text-[11px] text-slate-300 shadow-soft">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>Trusted by modern security teams</span>
            </div>
          </div>

          {/* Center content */}
          <div className="mt-10 space-y-8">
            <div className="space-y-3">
              <h2 className="max-w-xl text-3xl font-semibold tracking-tight">
                See your{" "}
                <span className="bg-gradient-to-r from-sky-400 via-indigo-300 to-emerald-300 bg-clip-text text-transparent">
                  cloud risk surface
                </span>{" "}
                in one place.
              </h2>
              <p className="max-w-md text-sm text-slate-300">
                Continuous discovery, benchmark-backed controls, and prioritized
                remediation paths for AWS environments at scale.
              </p>
            </div>

            <div className="grid max-w-xl grid-cols-2 gap-4 text-xs">
              <div className="rounded-xl border border-slate-700/70 bg-slate-900/80 p-4 shadow-soft/40 backdrop-blur">
                <p className="text-[11px] font-medium text-slate-300">
                  Real-time posture
                </p>
                <p className="mt-2 text-2xl font-semibold text-sky-300">94%</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Average compliant controls across connected AWS accounts.
                </p>
              </div>
              <div className="rounded-xl border border-slate-700/70 bg-slate-900/80 p-4 shadow-soft/40 backdrop-blur">
                <p className="text-[11px] font-medium text-slate-300">
                  Time to signal
                </p>
                <p className="mt-2 text-2xl font-semibold text-emerald-300">
                  &lt; 5 min
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  From misconfiguration detection to surfaced remediation.
                </p>
              </div>
            </div>
          </div>

          {/* Customer logos / trust badges */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
              <span className="rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-1">
                SOC 2 Ready
              </span>
              <span className="rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-1">
                CIS AWS Benchmarks
              </span>
              <span className="rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-1">
                ISO 27001 Aligned
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
              <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Teams who trust Nimbus
              </span>
              <div className="flex flex-wrap gap-3 opacity-90">
                {customers.map((name) => (
                  <div
                    key={name}
                    className="flex items-center space-x-1 rounded-lg bg-slate-900/70 px-3 py-1.5 text-[11px] text-slate-200 ring-1 ring-slate-800/80"
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span>{name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-[11px] text-slate-500">
              © {new Date().getFullYear()} Nimbus Guard, Inc. All rights
              reserved.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

