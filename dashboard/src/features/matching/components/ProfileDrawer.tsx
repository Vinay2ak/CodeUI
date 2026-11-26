import React, { useEffect, useState } from 'react';
import {
  X,
  ShieldCheck,
  Star,
  Clock,
  Github,
  Globe,
  CheckCircle2,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { getFreelancer } from '../../../services/talent/api';
import type { FreelancerProfile } from '../../../services/talent/types';
import { Button } from '../../../components/ui/button';

interface ProfileDrawerProps {
  freelancerId: string | null;
  isOpen: boolean;
  onClose: () => void;
  isShortlisted?: boolean;
  onToggleShortlist?: (id: string) => void;
}

export const ProfileDrawer: React.FC<ProfileDrawerProps> = ({
  freelancerId,
  isOpen,
  onClose,
  isShortlisted,
  onToggleShortlist,
}) => {
  const [profile, setProfile] = useState<FreelancerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !freelancerId) {
      setProfile(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    getFreelancer(freelancerId)
      .then((data: FreelancerProfile) => {
        if (active) setProfile(data);
      })
      .catch((err: any) => {
        if (active) setError(err.detail || err.message || 'Failed to load profile');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, freelancerId]);

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

  if (!isOpen) return null;

  const initials = profile?.displayName
    ? profile.displayName
        .split(' ')
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'DV';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-drawer-title"
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-xl bg-surface border-l border-border shadow-2xl flex flex-col h-full z-10 overflow-hidden text-text">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-raised/40">
          <div className="flex items-center gap-2">
            <h2 id="profile-drawer-title" className="text-base font-bold text-text">
              Developer Profile
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile drawer"
            className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-raised cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="space-y-4 py-8 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-surface-raised" />
                <div className="space-y-2 flex-1">
                  <div className="h-5 bg-surface-raised rounded w-1/3" />
                  <div className="h-4 bg-surface-raised rounded w-2/3" />
                </div>
              </div>
              <div className="h-24 bg-surface-raised rounded" />
              <div className="h-32 bg-surface-raised rounded" />
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl border border-danger/40 bg-danger/10 text-danger text-center space-y-2 my-8">
              <AlertTriangle className="w-6 h-6 mx-auto" />
              <p className="text-sm font-semibold">{error}</p>
              <Button variant="outline" size="sm" onClick={() => freelancerId && getFreelancer(freelancerId)}>
                Retry
              </Button>
            </div>
          )}

          {profile && !loading && (
            <>
              {/* Profile Card Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-linear-to-br from-primary/80 to-primary flex items-center justify-center text-on-primary font-bold text-xl shrink-0 shadow-md">
                    {initials}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-text">{profile.displayName}</h3>
                      {profile.githubVerified && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success bg-success/10 border border-success/30 px-2 py-0.5 rounded-full">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          GitHub Verified
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted leading-relaxed">{profile.headline}</p>
                    <div className="flex items-center gap-3 pt-1 text-xs text-text-muted">
                      <span className="px-2 py-0.5 rounded bg-surface-raised border border-border font-medium">
                        {profile.experience.replace('_', ' ')}
                      </span>
                      {profile.memberSince && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Joined {new Date(profile.memberSince).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {onToggleShortlist && (
                  <Button
                    variant={isShortlisted ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => onToggleShortlist(profile.id)}
                    className="shrink-0"
                  >
                    <Star className={`w-3.5 h-3.5 mr-1.5 ${isShortlisted ? 'fill-current' : ''}`} />
                    {isShortlisted ? 'Shortlisted' : 'Shortlist'}
                  </Button>
                )}
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-surface-raised/40 border border-border text-center">
                <div>
                  <div className="text-base font-bold text-text flex items-center justify-center gap-1">
                    <Star className="w-4 h-4 text-warning fill-warning" />
                    {profile.rating ? profile.rating.toFixed(1) : 'New'}
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5">Rating</div>
                </div>
                <div>
                  <div className="text-base font-bold text-text flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    {profile.verifiedWorkCount}
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5">Verified Fixes</div>
                </div>
                <div>
                  <div className="text-base font-bold text-on-money bg-money rounded px-1.5 py-0.5 inline-block">
                    ₹{profile.minBudget.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5">Min. Budget</div>
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  About Developer
                </h4>
                <p className="text-sm text-text leading-relaxed whitespace-pre-line bg-surface-raised/20 p-3.5 rounded-lg border border-border">
                  {profile.bio}
                </p>
              </div>

              {/* Availability & Links */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Availability & Verification Links
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface border border-border">
                    <Clock className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <div className="text-[10px] text-text-muted">Current status</div>
                      <div className="font-semibold text-text">{profile.availability.replace('_', ' ')}</div>
                    </div>
                  </div>

                  {profile.githubUsername && (
                    <a
                      href={`https://github.com/${profile.githubUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-surface border border-border hover:border-primary transition-colors text-text"
                    >
                      <Github className="w-4 h-4 text-text shrink-0" />
                      <div className="truncate">
                        <div className="text-[10px] text-text-muted">GitHub profile</div>
                        <div className="font-semibold text-primary truncate">@{profile.githubUsername}</div>
                      </div>
                    </a>
                  )}

                  {profile.portfolioUrl && (
                    <a
                      href={profile.portfolioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-surface border border-border hover:border-primary transition-colors text-text"
                    >
                      <Globe className="w-4 h-4 text-text shrink-0" />
                      <div className="truncate">
                        <div className="text-[10px] text-text-muted">Portfolio</div>
                        <div className="font-semibold text-primary truncate">{profile.portfolioUrl}</div>
                      </div>
                    </a>
                  )}
                </div>
              </div>

              {/* Supported Stacks */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Supported Stacks
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {profile.supportedStacks.map((st) => (
                    <span
                      key={st}
                      className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                    >
                      {st.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>

              {/* Debugging Specialties */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Debugging Specialties
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {profile.debuggingSpecialties.map((sp) => (
                    <span
                      key={sp}
                      className="px-2.5 py-1 rounded-md text-xs font-medium bg-surface-raised border border-border text-text"
                    >
                      {sp.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>

              {/* Specific Skills */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Verified Skills & Libraries
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {profile.skills.map((sk) => (
                    <span
                      key={sk}
                      className="px-2 py-0.5 rounded text-xs bg-surface border border-border text-text-muted"
                    >
                      {sk}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
