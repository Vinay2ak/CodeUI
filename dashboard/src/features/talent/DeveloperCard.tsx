import React from 'react';
import {
  ShieldCheck,
  Zap,
  Clock,
  DollarSign,
  ArrowRight,
  Code2,
  CheckCircle2,
} from 'lucide-react';
import { DeveloperProfile } from './types';
import { Button } from '../../components/ui/button';

interface DeveloperCardProps {
  developer: DeveloperProfile;
  onViewProfile: (dev: DeveloperProfile) => void;
  onPostProject: (dev: DeveloperProfile) => void;
}

export const DeveloperCard: React.FC<DeveloperCardProps> = ({
  developer,
  onViewProfile,
  onPostProject,
}) => {
  const isAvailable = developer.availability === 'available';

  // Compute initials
  const initials = developer.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="group relative bg-surface border border-border rounded-xl p-5 flex flex-col justify-between transition-all duration-200 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5">
      {/* Top Banner: Avatar, Name, Headline & Availability */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            {/* Avatar Circle */}
            <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-surface-raised border border-primary/40 flex items-center justify-center text-primary font-bold text-base shadow-inner">
              {initials}
              {/* Online Indicator */}
              <span
                className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-surface ${
                  isAvailable ? 'bg-success' : 'bg-warning'
                }`}
                title={isAvailable ? 'Available Now' : 'In Active Sprint'}
              />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-bold text-text group-hover:text-primary transition-colors">
                  {developer.name}
                </h3>
                {developer.isVerified && (
                  <span title="Verified CodeBridge Talent">
                    <ShieldCheck className="w-4 h-4 text-primary fill-primary/15" />
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted line-clamp-1">{developer.roleHeadline}</p>
            </div>
          </div>

          {/* Availability Pill */}
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
              isAvailable
                ? 'bg-success/10 text-success border-success/30'
                : 'bg-warning/10 text-warning border-warning/30'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isAvailable ? 'bg-success animate-pulse' : 'bg-warning'
              }`}
            />
            {isAvailable ? 'Available Now' : 'In Sprint'}
          </span>
        </div>

        {/* Bio summary */}
        <p className="text-xs text-text-muted leading-relaxed line-clamp-2 mb-4">
          {developer.bio}
        </p>

        {/* Core Metrics Grid */}
        <div className="grid grid-cols-4 gap-2 p-2.5 rounded-lg bg-surface-raised/50 border border-border/70 mb-4 text-center">
          <div className="flex flex-col">
            <span className="text-[10px] text-text-muted font-medium uppercase tracking-wider flex items-center justify-center gap-0.5">
              <CheckCircle2 className="w-3 h-3 text-success" />
              Pass
            </span>
            <span className="text-sm font-bold text-success">{developer.passRate}%</span>
          </div>

          <div className="flex flex-col border-l border-border/60">
            <span className="text-[10px] text-text-muted font-medium uppercase tracking-wider flex items-center justify-center gap-0.5">
              <Zap className="w-3 h-3 text-primary" />
              Fixes
            </span>
            <span className="text-sm font-bold text-text">{developer.completedFixes}</span>
          </div>

          <div className="flex flex-col border-l border-border/60">
            <span className="text-[10px] text-text-muted font-medium uppercase tracking-wider flex items-center justify-center gap-0.5">
              <Clock className="w-3 h-3 text-cream" />
              Avg Time
            </span>
            <span className="text-xs font-semibold text-text mt-0.5">{developer.turnaroundTime}</span>
          </div>

          <div className="flex flex-col border-l border-border/60">
            <span className="text-[10px] text-text-muted font-medium uppercase tracking-wider flex items-center justify-center gap-0.5">
              <DollarSign className="w-3 h-3 text-money" />
              Rate
            </span>
            <span className="text-xs font-semibold text-money mt-0.5 truncate px-0.5">
              {developer.typicalRate.split('•')[0].trim()}
            </span>
          </div>
        </div>

        {/* Tech Stack Chips */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {developer.skills.slice(0, 5).map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface-raised border border-border text-text hover:border-primary/40 transition-colors"
            >
              {skill}
            </span>
          ))}
          {developer.skills.length > 5 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-medium text-text-muted">
              +{developer.skills.length - 5}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-3 border-t border-border">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onViewProfile(developer)}
          className="flex-1 text-xs justify-center font-medium"
        >
          <Code2 className="w-3.5 h-3.5 mr-1" />
          View Profile
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onPostProject(developer)}
          className="flex-1 text-xs justify-center font-semibold shadow-xs"
        >
          <span>Post for {developer.name.split(' ')[0]}</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
};
