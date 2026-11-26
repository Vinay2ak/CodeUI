import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  X,
  Filter,
  Loader2,
  Users,
} from 'lucide-react';
import { getProject, addShortlist, removeShortlist } from '../../services/project/api';
import { getMatches } from '../../services/talent/api';
import type { ProjectDetail } from '../../services/project/types';
import type { Match } from '../../services/talent/types';
import { applyFilters, sortMatches, type FilterState, type SortOption } from './filterSort';
import { nextPollDelay, MAX_POLLS } from './polling';
import { ProjectSummaryCard } from './components/ProjectSummaryCard';
import { MatchCard } from './components/MatchCard';
import { ProfileDrawer } from './components/ProfileDrawer';
import { HowWeRankPopover } from './components/HowWeRankPopover';
import { ProjectBriefCard } from '../ai-brief/components/ProjectBriefCard';
import { Button } from '../../components/ui/button';
import { Select, type SelectOption } from '../../components/ui/Select/index';

const SORT_OPTIONS: SelectOption[] = [
  { value: 'best', label: 'Best match' },
  { value: 'price', label: 'Price: low to high' },
  { value: 'availability', label: 'Availability', tone: 'success' },
];

export const ProjectMatchesPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [projectError, setProjectError] = useState<{ status: number; message: string } | null>(null);

  const [matches, setMatches] = useState<Match[]>([]);
  const [matchesStatus, setMatchesStatus] = useState<'computing' | 'ready' | 'failed'>('computing');
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [matchesError, setMatchesError] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<SortOption>('best');
  const [filters, setFilters] = useState<FilterState>({
    fitsBudget: false,
    availableNow: false,
    githubVerified: false,
    shortlistedOnly: false,
  });

  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const pollCountRef = useRef(0);
  const pollTimerRef = useRef<number | null>(null);

  const justPosted = !!(location.state as any)?.justPosted;

  // 1. Fetch Project Details
  const fetchProjectData = useCallback(async () => {
    if (!projectId) return;
    setProjectLoading(true);
    setProjectError(null);
    try {
      const data = await getProject(projectId);
      setProject(data);
    } catch (err: any) {
      setProjectError({
        status: err.status || 500,
        message: err.detail || err.message || 'Failed to load project details',
      });
    } finally {
      setProjectLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchProjectData();
  }, [fetchProjectData]);

  // 2. Fetch Talent Matches (Independently, with polling support)
  const pollMatches = useCallback(
    async (manualReset = false) => {
      if (!projectId) return;
      if (manualReset) {
        pollCountRef.current = 0;
        setMatchesLoading(true);
      }
      setMatchesError(null);

      try {
        const res = await getMatches(projectId);
        setMatchesStatus(res.status);

        if (res.status === 'ready') {
          setMatches(res.items);
          setMatchesLoading(false);
        } else if (res.status === 'computing') {
          pollCountRef.current += 1;
          if (pollCountRef.current >= MAX_POLLS) {
            setMatchesStatus('failed');
            setMatchesError('Matching calculation timed out. Please click retry.');
            setMatchesLoading(false);
          } else {
            const delay = nextPollDelay(pollCountRef.current);
            pollTimerRef.current = window.setTimeout(() => {
              void pollMatches();
            }, delay);
          }
        } else {
          // failed
          setMatchesStatus('failed');
          setMatchesError('Matching service returned an error. Please retry.');
          setMatchesLoading(false);
        }
      } catch (err: any) {
        setMatchesStatus('failed');
        setMatchesError(err.detail || err.message || 'Talent service is currently unavailable.');
        setMatchesLoading(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    void pollMatches(true);
    return () => {
      if (pollTimerRef.current !== null) {
        window.clearTimeout(pollTimerRef.current);
      }
    };
  }, [pollMatches]);

  // 3. Shortlist Toggle
  const handleToggleShortlist = async (freelancerId: string) => {
    if (!projectId) return;

    const targetMatch = matches.find((m) => m.freelancer.id === freelancerId);
    if (!targetMatch) return;

    const nextState = !targetMatch.shortlisted;

    // Optimistic update
    setMatches((prev) =>
      prev.map((m) =>
        m.freelancer.id === freelancerId ? { ...m, shortlisted: nextState } : m
      )
    );

    try {
      if (nextState) {
        await addShortlist(projectId, freelancerId);
      } else {
        await removeShortlist(projectId, freelancerId);
      }
    } catch {
      // Revert on error
      setMatches((prev) =>
        prev.map((m) =>
          m.freelancer.id === freelancerId ? { ...m, shortlisted: !nextState } : m
        )
      );
    }
  };

  const filteredMatches = applyFilters(matches, filters);
  const sortedMatches = sortMatches(filteredMatches, sortBy);

  const resetFilters = () => {
    setFilters({
      fitsBudget: false,
      availableNow: false,
      githubVerified: false,
      shortlistedOnly: false,
    });
  };

  const toggleFilter = (key: keyof FilterState) => {
    setFilters((prev: FilterState) => ({ ...prev, [key]: !prev[key] }));
  };

  // Error screen for project itself
  if (projectError) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-text">
          {projectError.status === 404
            ? 'Project Not Found'
            : projectError.status === 403
            ? 'Access Denied'
            : 'Error Loading Project'}
        </h1>
        <p className="text-sm text-text-muted max-w-md mx-auto">{projectError.message}</p>
        <div className="pt-2">
          <Button variant="primary" onClick={() => navigate('/owner')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Top Bar Navigation */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/owner')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text mb-3 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Projects
        </button>

        {/* Just Posted Success Banner */}
        {justPosted && !bannerDismissed && (
          <div
            role="status"
            className="p-4 rounded-xl border border-success/40 bg-success/10 text-text flex items-center justify-between gap-3 mb-6 animate-in fade-in duration-200"
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-success shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-text">Project posted successfully!</h4>
                <p className="text-xs text-text-muted">
                  Your project has been recorded. Our matching engine is ranking the most qualified developers below.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              className="p-1.5 text-text-muted hover:text-text rounded-md"
              aria-label="Dismiss message"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Section 1: Project Summary */}
      {projectLoading ? (
        <div className="p-6 rounded-xl border border-border bg-surface animate-pulse space-y-4">
          <div className="h-6 bg-surface-raised rounded w-1/3" />
          <div className="h-4 bg-surface-raised rounded w-2/3" />
          <div className="h-10 bg-surface-raised rounded" />
        </div>
      ) : project ? (
        <>
          <ProjectSummaryCard project={project} />
          {project.status === 'in_review' && (
            <div className="p-6 rounded-xl border border-primary/30 bg-primary/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                  <h3 className="text-base font-bold text-text">Submission ready for review</h3>
                </div>
                <p className="text-xs text-text-muted max-w-xl">
                  The developer has submitted their work and automated tests are complete. Review code changes, test logs, and advisory AI scorecard to approve or request changes.
                </p>
              </div>
              <Link to={`/owner/projects/${project.id}/review`} className="shrink-0">
                <Button variant="primary" size="md">
                  Review submission
                </Button>
              </Link>
            </div>
          )}
          <ProjectBriefCard projectId={project.id} />
        </>
      ) : null}

      {/* Section 2: Matches Section */}
      <section className="space-y-4 pt-2">
        {/* Matches Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-text">
              Recommended Developers{' '}
              <span className="text-sm font-normal text-text-muted">
                ({matches.length > 0 ? sortedMatches.length : 0})
              </span>
            </h2>
            <HowWeRankPopover />
          </div>

          {/* Sort & Refresh */}
          <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
            <div className="flex items-center gap-2 text-xs">
              <label id="sort-select-label" className="text-text-muted font-medium">
                Sort by:
              </label>
              <div className="w-44">
                <Select
                  id="sort-select"
                  value={sortBy}
                  onChange={(val) => setSortBy(val as SortOption)}
                  options={SORT_OPTIONS}
                  size="sm"
                  aria-labelledby="sort-select-label"
                />
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => pollMatches(true)}
              disabled={matchesLoading}
              title="Refresh recommendations"
              className="text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${matchesLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-text-muted font-medium flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3" /> Filters:
          </span>

          <FilterPill
            label="Fits budget"
            active={Boolean(filters.fitsBudget)}
            onClick={() => toggleFilter('fitsBudget')}
          />
          <FilterPill
            label="Available now"
            active={Boolean(filters.availableNow)}
            onClick={() => toggleFilter('availableNow')}
          />
          <FilterPill
            label="GitHub verified"
            active={Boolean(filters.githubVerified)}
            onClick={() => toggleFilter('githubVerified')}
          />
          <FilterPill
            label="Shortlisted only"
            active={Boolean(filters.shortlistedOnly)}
            onClick={() => toggleFilter('shortlistedOnly')}
          />

          {Object.values(filters).some(Boolean) && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-primary hover:underline ml-2 cursor-pointer"
            >
              Reset all
            </button>
          )}
        </div>

        {/* Matches Content Area */}
        {matchesLoading || matchesStatus === 'computing' ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-text">
                  Analyzing repository & calculating match scores...
                </h4>
                <p className="text-xs text-text-muted">
                  Evaluating developer tech stacks, debugging specialties, past test pass history, and availability.
                </p>
              </div>
            </div>

            {/* Skeletons */}
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="p-5 rounded-xl border border-border bg-surface animate-pulse space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-surface-raised" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-surface-raised rounded w-1/4" />
                    <div className="h-3 bg-surface-raised rounded w-1/2" />
                  </div>
                </div>
                <div className="h-10 bg-surface-raised rounded" />
              </div>
            ))}
          </div>
        ) : matchesError ? (
          /* Talent Service Error / Timeout Card */
          <div className="p-6 rounded-xl border border-danger/40 bg-danger/10 text-center space-y-3">
            <AlertTriangle className="w-7 h-7 text-danger mx-auto" />
            <h3 className="text-base font-bold text-danger">
              Could not load recommended developers
            </h3>
            <p className="text-xs text-text-muted max-w-md mx-auto">{matchesError}</p>
            <div className="pt-2">
              <Button variant="primary" size="sm" onClick={() => pollMatches(true)}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Retry matching
              </Button>
            </div>
          </div>
        ) : sortedMatches.length === 0 ? (
          /* Empty state */
          <div className="p-10 rounded-xl border border-border bg-surface text-center space-y-3">
            <Users className="w-8 h-8 text-text-muted mx-auto" />
            <h3 className="text-base font-semibold text-text">No developers match your filters</h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              Try turning off some filters like "Fits budget" or "Shortlisted only" to view more qualified candidates.
            </p>
            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Clear filters
              </Button>
            </div>
          </div>
        ) : (
          /* Matches List */
          <div className="space-y-4">
            {sortedMatches.map((m) => (
              <MatchCard
                key={m.freelancer.id}
                match={m}
                onViewProfile={(id) => setDrawerId(id)}
                onToggleShortlist={handleToggleShortlist}
              />
            ))}
          </div>
        )}
      </section>

      {/* Slide-over Profile Drawer */}
      <ProfileDrawer
        freelancerId={drawerId}
        isOpen={!!drawerId}
        onClose={() => setDrawerId(null)}
        isShortlisted={
          drawerId ? matches.find((m) => m.freelancer.id === drawerId)?.shortlisted : false
        }
        onToggleShortlist={handleToggleShortlist}
      />
    </div>
  );
};

const FilterPill: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
      active
        ? 'bg-primary text-on-primary border-primary shadow-xs'
        : 'bg-surface text-text-muted border-border hover:text-text hover:bg-surface-raised'
    }`}
    aria-pressed={active}
  >
    {label}
  </button>
);

export default ProjectMatchesPage;
