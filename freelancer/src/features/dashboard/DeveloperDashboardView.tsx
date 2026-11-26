import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Award,
  Layers,
  ShieldCheck,
  CreditCard,
  ArrowRight,
  Check,
  Clock,
  Radio,
  Server,
  FileCheck,
  ChevronRight,
  Lock,
} from "lucide-react";
import { profileApi } from "../../services/profile/api";
import { projectApi } from "../../services/project/api";
import type { PortfolioSummary } from "../../services/profile/types";
import type { ProjectScope } from "../../services/project/types";
import type { User } from "../../session/session";
import { formatCurrencyINR } from "../../lib/format";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AnalyticsSection } from "../analytics/AnalyticsSection";

interface DeveloperDashboardViewProps {
  user: User;
  onNavigateToRadar: () => void;
  onNavigateToWorkspace: (projectId: string) => void;
  onNavigateToProfile: () => void;
}

export const DeveloperDashboardView: React.FC<DeveloperDashboardViewProps> = ({
  user,
  onNavigateToRadar,
  onNavigateToWorkspace,
  onNavigateToProfile,
}) => {
  const [paymentsOpen, setPaymentsOpen] = useState(false);

  const { data: portfolio } = useQuery<PortfolioSummary>({
    queryKey: ["profile", "verified-work"],
    queryFn: () => profileApi.getVerifiedWork(),
    staleTime: 30_000,
  });

  const { data: projects = [] } = useQuery<ProjectScope[]>({
    queryKey: ["projects", "realtime-list"],
    queryFn: () => projectApi.getProjects(),
    staleTime: 30_000,
  });

  const { data: userSkills = [] } = useQuery<string[]>({
    queryKey: ["freelancer", "skills"],
    queryFn: () => profileApi.getFreelancerSkills(),
    staleTime: 60_000,
  });

  const verifiedProjectsCount = portfolio?.verifiedProjectsCount ?? 0;
  const releasedEarnings = portfolio?.escrowEarningsReleased ?? 0;
  const releasedRecords = portfolio?.records ?? [];
  const testPassRate = portfolio?.testPassRate ?? 100;
  const skillsProvenCount = portfolio?.skillsProvenCount ?? Math.max(userSkills.length, 6);

  const inProgressProjects = projects.filter((p) => p.projectState === "in_progress");
  const openProjects = projects.filter(
    (p) => p.projectState !== "in_progress" && p.projectState !== "completed"
  );
  const totalInEscrow = inProgressProjects.reduce((sum, p) => sum + (p.budget || 0), 0);
  const totalOpenEscrow = openProjects.reduce((sum, p) => sum + (p.budget || 0), 0);

  return (
    <div className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 lg:p-8 text-foreground">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Clean Page Header (no filler welcome banner) */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-border">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Overview
            </h1>
            <p className="text-sm text-muted max-w-2xl leading-relaxed">
              Escrow payouts, verified milestone deliverables, test-gate pass rates, and active scopes for{" "}
              <span className="font-medium text-foreground">{user.displayName}</span>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              onClick={onNavigateToProfile}
              className="rounded-xl text-xs font-medium justify-center border-border bg-card hover:bg-raised"
            >
              <span>View profile</span>
              <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
            </Button>
            <Button
              variant="primary"
              onClick={onNavigateToRadar}
              className="rounded-xl text-xs font-semibold justify-center"
            >
              <Radio className="h-4 w-4 mr-1.5" aria-hidden="true" />
              <span>Browse tasks</span>
            </Button>
          </div>
        </div>

        {/* Performance & Escrow Metrics Section */}
        <section id="performance-metrics" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary dark:text-accent" aria-hidden="true" />
              <span>Performance and escrow metrics</span>
            </h2>
            <span className="text-xs text-muted">Live platform data</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {/* Card 1: Released Escrow Payouts (Clickable) */}
            <Card
              role="button"
              tabIndex={0}
              onClick={() => setPaymentsOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setPaymentsOpen(true);
                }
              }}
              aria-label="Open payment and escrow details"
              className="rounded-2xl border-border bg-card shadow-sm flex flex-col justify-between cursor-pointer hover:border-success/60 hover:shadow-md transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-xs font-medium text-muted">
                  Total payment released
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-success-bg text-success border border-success-border">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                  <span>Cleared</span>
                </span>
              </CardHeader>
              <CardContent className="space-y-1.5 pb-4">
                <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-success">
                  {formatCurrencyINR(releasedEarnings)}
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Direct escrow payouts released to your linked bank account.
                </p>
              </CardContent>
              <CardFooter className="pt-3 border-t border-border/70 flex items-center justify-between text-xs text-muted">
                <span className="flex items-center gap-1.5 text-success">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Escrow protected</span>
                </span>
                <span className="text-primary dark:text-accent font-semibold inline-flex items-center gap-1 group-hover:underline">
                  <span>View payments</span>
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </span>
              </CardFooter>
            </Card>

            {/* Card 2: Projects Solved */}
            <Card className="rounded-2xl border-border bg-card shadow-sm flex flex-col justify-between">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-xs font-medium text-muted">
                  Projects solved
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-info-bg text-primary dark:text-accent border border-info-border">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary dark:bg-accent" aria-hidden="true" />
                  <span>Verified</span>
                </span>
              </CardHeader>
              <CardContent className="space-y-1.5 pb-4">
                <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-foreground flex items-center gap-2">
                  <span>{verifiedProjectsCount}</span>
                  <CheckCircle2 className="h-5 w-5 text-primary dark:text-accent" aria-hidden="true" />
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Client scopes solved and verified with automated test gates.
                </p>
              </CardContent>
              <CardFooter className="pt-3 border-t border-border/70 flex items-center justify-between text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <FileCheck className="h-3.5 w-3.5 text-primary dark:text-accent" aria-hidden="true" />
                  <span>Signed verification</span>
                </span>
                <span>Production tested</span>
              </CardFooter>
            </Card>

            {/* Card 3: Test-Gate Pass Rate */}
            <Card className="rounded-2xl border-border bg-card shadow-sm flex flex-col justify-between">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-xs font-medium text-muted">
                  Test-gate pass rate
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-success-bg text-success border border-success-border">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                  <span>Passing</span>
                </span>
              </CardHeader>
              <CardContent className="space-y-1.5 pb-4">
                <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-foreground flex items-center gap-2">
                  <span>{testPassRate}%</span>
                  <Award className="h-5 w-5 text-primary dark:text-accent" aria-hidden="true" />
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Deterministic regression and idempotency pass rate across submissions.
                </p>
              </CardContent>
              <CardFooter className="pt-3 border-t border-border/70 flex items-center justify-between text-xs text-muted">
                <span className="flex items-center gap-1.5 text-success">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Zero regressions</span>
                </span>
                <span>Automated checks</span>
              </CardFooter>
            </Card>

            {/* Card 4: Skills Proven */}
            <Card className="rounded-2xl border-border bg-card shadow-sm flex flex-col justify-between">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-xs font-medium text-muted">
                  Skills proven
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-warning-bg text-warning border border-warning-border">
                  <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />
                  <span>Verified stack</span>
                </span>
              </CardHeader>
              <CardContent className="space-y-1.5 pb-4">
                <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-foreground flex items-center gap-2">
                  <span>{skillsProvenCount}</span>
                  <Layers className="h-5 w-5 text-warning" aria-hidden="true" />
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Frameworks and languages proven inside delivered repositories.
                </p>
              </CardContent>
              <CardFooter className="pt-3 border-t border-border/70 flex items-center justify-between text-xs text-muted">
                <span>Python, FastAPI, React</span>
                <span>Verified in code</span>
              </CardFooter>
            </Card>

            {/* Card 5: Active In-Progress Tasks */}
            <Card className="rounded-2xl border-border bg-card shadow-sm flex flex-col justify-between">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-xs font-medium text-muted">
                  Active in-progress tasks
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-info-bg text-primary dark:text-accent border border-info-border">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary dark:bg-accent" aria-hidden="true" />
                  <span>Workspace</span>
                </span>
              </CardHeader>
              <CardContent className="space-y-1.5 pb-4">
                <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-foreground flex items-center gap-2">
                  <span>{inProgressProjects.length}</span>
                  <Server className="h-5 w-5 text-primary dark:text-accent" aria-hidden="true" />
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  {inProgressProjects.length > 0 ? (
                    <>
                      <span className="font-mono tabular-nums font-medium text-foreground">
                        {formatCurrencyINR(totalInEscrow)}
                      </span>{" "}
                      currently held in escrow awaiting test verification.
                    </>
                  ) : (
                    "No tasks currently in progress. Accept an open task to begin."
                  )}
                </p>
              </CardContent>
              <CardFooter className="pt-3 border-t border-border/70 flex items-center justify-between text-xs text-muted">
                <span>{inProgressProjects.length > 0 ? "Ready to launch" : "Available"}</span>
                {inProgressProjects[0] && (
                  <button
                    type="button"
                    onClick={() => onNavigateToWorkspace(inProgressProjects[0].id)}
                    className="text-primary dark:text-accent font-semibold hover:underline flex items-center gap-1"
                  >
                    <span>Launch</span>
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </button>
                )}
              </CardFooter>
            </Card>

            {/* Card 6: Tasks in Radar */}
            <Card className="rounded-2xl border-border bg-card shadow-sm flex flex-col justify-between">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-xs font-medium text-muted">
                  Tasks in radar
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-raised border border-border text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted" aria-hidden="true" />
                  <span>Available</span>
                </span>
              </CardHeader>
              <CardContent className="space-y-1.5 pb-4">
                <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-foreground flex items-center gap-2">
                  <span>{openProjects.length}</span>
                  <Radio className="h-5 w-5 text-primary dark:text-accent" aria-hidden="true" />
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Open client scopes with funds held in escrow ready to accept.
                </p>
              </CardContent>
              <CardFooter className="pt-3 border-t border-border/70 flex items-center justify-between text-xs text-muted">
                <span>Escrow funded</span>
                <button
                  type="button"
                  onClick={onNavigateToRadar}
                  className="text-primary dark:text-accent font-semibold hover:underline flex items-center gap-1"
                >
                  <span>Explore</span>
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </button>
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* Live Grafana Telemetry & Personal Analytics */}
        <div className="pt-2">
          <AnalyticsSection user={user} />
        </div>
      </div>

      {/* PAYMENTS & ESCROW DETAILS SHEET */}
      <Sheet open={paymentsOpen} onOpenChange={setPaymentsOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl lg:max-w-2xl overflow-y-auto overflow-x-hidden bg-card border-l border-border p-6 sm:p-8 space-y-6"
        >
          <SheetHeader className="space-y-1 pb-4 border-b border-border pr-8">
            <SheetTitle className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary dark:text-accent" aria-hidden="true" />
              <span>Payments &amp; escrow ledger</span>
            </SheetTitle>
            <SheetDescription className="text-xs text-muted">
              Complete escrow payouts, active holds, and settlement status for {user.displayName}.
            </SheetDescription>
          </SheetHeader>

          {/* Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl border border-border bg-background space-y-1">
              <span className="text-xs text-muted block">Total released</span>
              <span className="text-xl font-bold font-mono tabular-nums text-success block">
                {formatCurrencyINR(releasedEarnings)}
              </span>
              <span className="text-[11px] text-muted block">
                {releasedRecords.length} settled payout{releasedRecords.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-background space-y-1">
              <span className="text-xs text-muted block">Held in escrow</span>
              <span className="text-xl font-bold font-mono tabular-nums text-foreground block">
                {formatCurrencyINR(totalInEscrow)}
              </span>
              <span className="text-[11px] text-muted block">
                {inProgressProjects.length} active scope{inProgressProjects.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-background space-y-1">
              <span className="text-xs text-muted block">Open funded scopes</span>
              <span className="text-xl font-bold font-mono tabular-nums text-foreground block">
                {formatCurrencyINR(totalOpenEscrow)}
              </span>
              <span className="text-[11px] text-muted block">
                {openProjects.length} available task{openProjects.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          {/* Released Payouts History */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                <span>Released payouts</span>
              </h3>
              <span className="text-xs text-muted font-mono tabular-nums">
                {releasedRecords.length} record{releasedRecords.length === 1 ? "" : "s"}
              </span>
            </div>

            {releasedRecords.length === 0 ? (
              <div className="p-5 rounded-2xl border border-border bg-background text-xs text-muted leading-relaxed">
                No payouts released yet. Once you complete an active scope and pass test verification, escrow funds are released here automatically.
              </div>
            ) : (
              <div className="space-y-2.5">
                {releasedRecords.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 rounded-2xl border border-border bg-background flex items-start justify-between gap-4 min-w-0"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="text-sm font-semibold text-foreground break-words [overflow-wrap:anywhere]">
                        {rec.projectTitle}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted font-mono">
                        <span>{rec.id}</span>
                        <span>·</span>
                        <span>
                          {new Date(rec.completedAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 space-y-1">
                      <div className="text-sm font-bold font-mono tabular-nums text-success">
                        +{formatCurrencyINR(rec.payoutAmount)}
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-success-bg text-success border border-success-border">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                        Released
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Active Escrow Holds */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-warning" aria-hidden="true" />
                <span>Active escrow holds</span>
              </h3>
              <span className="text-xs text-muted font-mono tabular-nums">
                {inProgressProjects.length} active
              </span>
            </div>

            {inProgressProjects.length === 0 ? (
              <div className="p-5 rounded-2xl border border-border bg-background flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-muted">
                  No active escrow holds right now. Accept an open scope to lock funds for your workspace.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setPaymentsOpen(false);
                    onNavigateToRadar();
                  }}
                  className="shrink-0 rounded-xl text-xs"
                >
                  Browse tasks
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {inProgressProjects.map((proj) => (
                  <div
                    key={proj.id}
                    className="p-4 rounded-2xl border border-border bg-background flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="text-sm font-semibold text-foreground break-words [overflow-wrap:anywhere]">
                        {proj.title}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                        <span className="font-mono">{proj.id}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 text-warning font-medium">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          Escrow {proj.escrowState.replace("_", " ")}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <div className="text-sm font-bold font-mono tabular-nums text-foreground">
                        {formatCurrencyINR(proj.budget)}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setPaymentsOpen(false);
                          onNavigateToWorkspace(proj.id);
                        }}
                        className="rounded-xl text-xs"
                      >
                        <span>Workspace</span>
                        <ArrowRight className="h-3 w-3 ml-1" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Settlement & Payout Rail Info */}
          <section className="p-4 rounded-2xl border border-border bg-background space-y-2.5 text-xs">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
              <span>Escrow &amp; payout rail</span>
            </div>
            <div className="flex items-center justify-between text-muted">
              <span>Settlement rail</span>
              <span className="font-medium text-foreground">Razorpay Route (Linked account)</span>
            </div>
            <div className="flex items-center justify-between text-muted">
              <span>Release trigger</span>
              <span className="font-medium text-foreground">Test-gate pass + owner approval</span>
            </div>
            <div className="flex items-center justify-between text-muted">
              <span>Settlement currency</span>
              <span className="font-mono font-medium text-foreground">INR (₹)</span>
            </div>
          </section>
        </SheetContent>
      </Sheet>
    </div>
  );
};
