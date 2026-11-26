import React, { useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Clock,
  DollarSign,
  Github,
  GitPullRequest,
  Check,
  Star,
  ExternalLink,
  Plus,
} from 'lucide-react';
import { DeveloperProfile } from './types';
import { Button } from '../../components/ui/button';

interface DeveloperProfileDrawerProps {
  developer: DeveloperProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onPostProject: (dev: DeveloperProfile) => void;
}

export const DeveloperProfileDrawer: React.FC<DeveloperProfileDrawerProps> = ({
  developer,
  isOpen,
  onClose,
  onPostProject,
}) => {
  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !developer) return null;

  const isAvailable = developer.availability === 'available';
  const initials = developer.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="developer-drawer-title"
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-surface border-l border-border shadow-2xl flex flex-col text-text animate-in slide-in-from-right duration-250 ease-out">
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-5 border-b border-border bg-surface-raised/40">
            <div className="flex items-center gap-4">
              <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-primary/30 to-surface-raised border border-primary/50 flex items-center justify-center text-primary font-bold text-lg shadow-md">
                {initials}
                <span
                  className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-surface ${
                    isAvailable ? 'bg-success' : 'bg-warning'
                  }`}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="developer-drawer-title" className="text-lg font-bold text-text">
                    {developer.name}
                  </h2>
                  {developer.isVerified && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/30">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Verified Specialist
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted mt-0.5">{developer.roleHeadline}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <Github className="w-3.5 h-3.5 text-text" />
                    @{developer.github.handle}
                  </span>
                  <span>•</span>
                  <span className="text-success font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {developer.passRate}% Automated Test Pass Rate
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close profile drawer"
              className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-primary cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 divide-y divide-border/60">
            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-surface-raised/40 border border-border flex flex-col">
                <span className="text-[11px] text-text-muted flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  Pass Rate
                </span>
                <span className="text-xl font-bold text-success mt-1">{developer.passRate}%</span>
                <span className="text-[10px] text-text-muted">Repo Doctor Verified</span>
              </div>

              <div className="p-3 rounded-lg bg-surface-raised/40 border border-border flex flex-col">
                <span className="text-[11px] text-text-muted flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-primary" />
                  Verified Fixes
                </span>
                <span className="text-xl font-bold text-text mt-1">{developer.completedFixes}</span>
                <span className="text-[10px] text-text-muted">CodeBridge Deliveries</span>
              </div>

              <div className="p-3 rounded-lg bg-surface-raised/40 border border-border flex flex-col">
                <span className="text-[11px] text-text-muted flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-cream" />
                  Turnaround
                </span>
                <span className="text-xl font-bold text-cream mt-1">{developer.turnaroundTime}</span>
                <span className="text-[10px] text-text-muted">Avg PR Completion</span>
              </div>

              <div className="p-3 rounded-lg bg-surface-raised/40 border border-border flex flex-col">
                <span className="text-[11px] text-text-muted flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-money" />
                  Typical Rate
                </span>
                <span className="text-sm font-bold text-money mt-1 truncate">
                  {developer.typicalRate.split('•')[0].trim()}
                </span>
                <span className="text-[10px] text-text-muted">Escrow Guaranteed</span>
              </div>
            </div>

            {/* Bio & Skills */}
            <div className="pt-5 space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                  Engineering Profile & Background
                </h4>
                <p className="text-sm text-text leading-relaxed bg-surface-raised/20 p-3.5 rounded-lg border border-border/50">
                  {developer.bio}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                  Verified Tech Stack & Core Competencies
                </h4>
                <div className="flex flex-wrap gap-2">
                  {developer.skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-surface-raised border border-border text-text"
                    >
                      <Check className="w-3 h-3 text-primary" />
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Repo Doctor & Automated Test Harness Section */}
            <div className="pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Repo Doctor Code Quality & Test Harness
                </h4>
                <span className="text-xs font-bold text-primary">
                  {developer.github.repoDoctorScore}/100 Score
                </span>
              </div>

              <div className="p-4 rounded-lg bg-surface-raised/40 border border-border space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">Test Suites Passed:</span>
                  <span className="font-semibold text-text">
                    {developer.testHistory.passedSuites} / {developer.testHistory.totalSuitesRun} suites ({developer.passRate}%)
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-surface border border-border/80 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-success rounded-full"
                    style={{ width: `${developer.passRate}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">PR Acceptance Rate:</span>
                    <span className="font-semibold text-success">{developer.github.prAcceptanceRate}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Avg Test Run Time:</span>
                    <span className="font-semibold text-text">{developer.testHistory.avgExecutionTimeMs} ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Commits This Month:</span>
                    <span className="font-semibold text-text">{developer.github.commitsThisMonth} commits</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Docker Harness Ready:</span>
                    <span className="font-semibold text-success flex items-center gap-1">
                      <Check className="w-3 h-3" /> Yes
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Verified Past Fixes */}
            <div className="pt-5 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <GitPullRequest className="w-4 h-4 text-cream" />
                Verified Past CodeBridge Deliveries ({developer.pastFixes.length})
              </h4>

              <div className="space-y-3">
                {developer.pastFixes.map((fix) => (
                  <div
                    key={fix.id}
                    className="p-3.5 rounded-lg bg-surface-raised/30 border border-border hover:border-primary/40 transition-colors space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h5 className="text-sm font-semibold text-text">{fix.projectTitle}</h5>
                        <span className="font-mono text-xs text-primary flex items-center gap-1 mt-0.5">
                          <ExternalLink className="w-3 h-3" />
                          {fix.repo}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-money">${fix.bounty}</span>
                        <div className="flex items-center gap-0.5 text-xs text-warning mt-0.5 justify-end">
                          <Star className="w-3 h-3 fill-warning" />
                          <span className="text-[11px] font-semibold">{fix.reviewScore.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-text-muted leading-relaxed">{fix.description}</p>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex flex-wrap gap-1">
                        {fix.tags.map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface border border-border/80 text-text-muted"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      <span className="text-[10px] text-text-muted font-medium">{fix.completedAt}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sticky Drawer Footer CTA */}
          <div className="flex items-center justify-between p-4 px-6 border-t border-border bg-surface-raised/50">
            <div>
              <span className="text-xs text-text-muted block">Direct Milestone Invitation</span>
              <span className="text-sm font-bold text-money">
                Typical Fix Budget: ~${developer.suggestedBudget}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="md" onClick={onClose}>
                Close
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  onPostProject(developer);
                  onClose();
                }}
                className="font-semibold shadow-md"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Post Project for {developer.name.split(' ')[0]}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
