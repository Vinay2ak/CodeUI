import React, { useState } from 'react';
import {
  CircleCheck,
  TriangleAlert,
  ShieldCheck,
  Star,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import type { Match } from '../../../services/talent/types';
import { Button } from '../../../components/ui/button';

interface MatchCardProps {
  match: Match;
  onViewProfile: (freelancerId: string) => void;
  onToggleShortlist: (freelancerId: string) => void;
}

const LABEL_STYLES = {
  excellent: 'text-success bg-success/10 border-success/30',
  strong: 'text-primary bg-primary/10 border-primary/30',
  good: 'text-info bg-info/10 border-info/30',
  partial: 'text-text-muted bg-surface-raised border-border',
};

const BAR_STYLES = {
  excellent: 'bg-success',
  strong: 'bg-primary',
  good: 'bg-info',
  partial: 'bg-text-muted',
};

export const MatchCard: React.FC<MatchCardProps> = ({
  match,
  onViewProfile,
  onToggleShortlist,
}) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { freelancer, score, label, breakdown, reasons, warnings, shortlisted } = match;

  const initials = freelancer.displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const isAvailableNow = freelancer.availability === 'IMMEDIATE';

  return (
    <div
      className={`rounded-xl border transition-all bg-surface p-5 shadow-xs space-y-4 ${
        shortlisted
          ? 'border-primary/60 ring-1 ring-primary/40'
          : 'border-border hover:border-text-muted/40'
      }`}
    >
      {/* Top Row: Developer Info + Score Bar */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        {/* Left: Avatar & Info */}
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-full bg-linear-to-br from-primary/80 to-primary flex items-center justify-center text-on-primary font-bold text-base shrink-0 shadow-xs">
            {initials}
          </div>

          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-text truncate">
                {freelancer.displayName}
              </h3>
              {freelancer.githubVerified && (
                <span
                  title="GitHub Verified Developer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-success bg-success/10 border border-success/30 px-1.5 py-0.5 rounded-full shrink-0"
                >
                  <ShieldCheck className="w-3 h-3" />
                  Verified
                </span>
              )}
              <span className="text-[11px] font-medium text-text-muted px-2 py-0.5 rounded bg-surface-raised border border-border shrink-0">
                {freelancer.experience.replace('_', ' ')}
              </span>
            </div>

            <p className="text-xs text-text-muted line-clamp-1">{freelancer.headline}</p>

            <div className="flex items-center gap-3 pt-0.5 text-xs text-text-muted flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span className={isAvailableNow ? 'font-semibold text-success' : ''}>
                  {freelancer.availability.replace('_', ' ')}
                </span>
              </span>

              {freelancer.verifiedWorkCount > 0 && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  {freelancer.verifiedWorkCount} fixes
                </span>
              )}

              {freelancer.rating && (
                <span className="flex items-center gap-1 text-text font-medium">
                  <Star className="w-3.5 h-3.5 text-warning fill-warning" />
                  {freelancer.rating.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Match Score & Min Budget */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0">
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <span
                className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${LABEL_STYLES[label]}`}
              >
                {label} match
              </span>
              <span className="text-xl font-bold font-mono text-text">{score}%</span>
            </div>

            {/* Score progress bar */}
            <div className="w-28 h-1.5 bg-surface-raised rounded-full mt-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${BAR_STYLES[label]}`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>

          <div className="text-right pt-1">
            <span className="text-[10px] text-text-muted block">Min. rate</span>
            <span className="text-xs font-bold font-mono text-on-money bg-money px-2 py-0.5 rounded inline-block">
              ₹{freelancer.minBudget.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* Middle: Reasons & Warnings */}
      <div className="space-y-2 pt-2 border-t border-border">
        {/* Reasons */}
        {reasons.length > 0 && (
          <ul className="space-y-1">
            {reasons.map((reason) => (
              <li
                key={reason}
                className="flex items-center gap-2 text-xs text-text leading-tight"
              >
                <CircleCheck className="w-3.5 h-3.5 text-success shrink-0" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <ul className="space-y-1 pt-1">
            {warnings.map((warning) => (
              <li
                key={warning}
                className="flex items-center gap-2 text-xs text-warning leading-tight"
              >
                <TriangleAlert className="w-3.5 h-3.5 text-warning shrink-0" />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Skills & Stacks Chips */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {freelancer.supportedStacks.map((st) => (
          <span
            key={st}
            className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20"
          >
            {st.replace('_', ' ')}
          </span>
        ))}
        {freelancer.debuggingSpecialties.slice(0, 2).map((sp) => (
          <span
            key={sp}
            className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface-raised border border-border text-text"
          >
            {sp.replace('_', ' ')}
          </span>
        ))}
      </div>

      {/* Expandable Score Details */}
      <div className="border-t border-border pt-2.5">
        <button
          type="button"
          onClick={() => setDetailsOpen((prev) => !prev)}
          className="flex items-center justify-between w-full text-xs text-text-muted hover:text-text transition-colors cursor-pointer"
          aria-expanded={detailsOpen}
        >
          <span>Score details & algorithm breakdown</span>
          {detailsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {detailsOpen && (
          <div className="mt-3 p-3.5 rounded-lg bg-surface-raised/40 border border-border space-y-2.5 text-xs animate-in fade-in duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <BreakdownMeter label="Stack Match" points={breakdown.stack.points} max={breakdown.stack.max} />
              <BreakdownMeter label="Specialty Match" points={breakdown.specialty.points} max={breakdown.specialty.max} />
              <BreakdownMeter label="Specific Skills" points={breakdown.skills.points} max={breakdown.skills.max} />
              <BreakdownMeter label="Budget Match" points={breakdown.budget.points} max={breakdown.budget.max} />
              <BreakdownMeter label="Availability" points={breakdown.availability.points} max={breakdown.availability.max} />
              <BreakdownMeter label="Experience Scope" points={breakdown.experience.points} max={breakdown.experience.max} />
              <BreakdownMeter label="Trust & Verification" points={breakdown.trust.points} max={breakdown.trust.max} />
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onToggleShortlist(freelancer.id)}
          className="text-xs"
        >
          <Star className={`w-3.5 h-3.5 mr-1.5 ${shortlisted ? 'text-warning fill-warning' : ''}`} />
          {shortlisted ? 'Shortlisted' : 'Shortlist'}
        </Button>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => onViewProfile(freelancer.id)}
          className="text-xs"
        >
          <Eye className="w-3.5 h-3.5 mr-1.5" />
          View full profile
        </Button>
      </div>
    </div>
  );
};

const BreakdownMeter: React.FC<{ label: string; points: number; max: number }> = ({
  label,
  points,
  max,
}) => {
  const percent = max > 0 ? Math.round((points / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-text-muted">{label}</span>
        <span className="font-mono font-medium text-text">
          {points}/{max}
        </span>
      </div>
      <div className="w-full h-1 bg-surface rounded-full overflow-hidden border border-border">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
