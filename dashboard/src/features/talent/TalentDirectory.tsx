import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  Users,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { DeveloperProfile, TalentFilterCategory } from './types';
import { fetchHybridTalent } from './talentData';
import { DeveloperCard } from './DeveloperCard';
import { DeveloperProfileDrawer } from './DeveloperProfileDrawer';
import { Button } from '../../components/ui/button';

interface TalentDirectoryProps {
  onSelectDeveloperForProject: (dev: DeveloperProfile) => void;
  onPostOpenProject: () => void;
}

export const TalentDirectory: React.FC<TalentDirectoryProps> = ({
  onSelectDeveloperForProject,
  onPostOpenProject,
}) => {
  const [developers, setDevelopers] = useState<DeveloperProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<TalentFilterCategory>('all');
  const [selectedProfile, setSelectedProfile] = useState<DeveloperProfile | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const loadTalent = async () => {
    setIsLoading(true);
    try {
      const data = await fetchHybridTalent();
      setDevelopers(data);
    } catch {
      // Handled in fetchHybridTalent
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTalent();
  }, []);

  // Filter & Search logic
  const filteredDevelopers = useMemo(() => {
    return developers.filter((dev) => {
      // Category / condition filters
      if (activeFilter === 'available' && dev.availability !== 'available') {
        return false;
      }
      if (activeFilter === 'backend' && dev.category !== 'backend' && dev.category !== 'fullstack') {
        return false;
      }
      if (activeFilter === 'frontend' && dev.category !== 'frontend' && dev.category !== 'fullstack') {
        return false;
      }
      if (activeFilter === 'security' && dev.category !== 'security') {
        return false;
      }
      if (activeFilter === 'high_pass_rate' && dev.passRate < 98) {
        return false;
      }

      // Search query across name, skills, headline, bio, past fixes
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = dev.name.toLowerCase().includes(query);
        const matchesHeadline = dev.roleHeadline.toLowerCase().includes(query);
        const matchesBio = dev.bio.toLowerCase().includes(query);
        const matchesSkills = dev.skills.some((s) => s.toLowerCase().includes(query));
        const matchesFixes = dev.pastFixes.some(
          (f) =>
            f.projectTitle.toLowerCase().includes(query) ||
            f.tags.some((t) => t.toLowerCase().includes(query))
        );
        return matchesName || matchesHeadline || matchesBio || matchesSkills || matchesFixes;
      }

      return true;
    });
  }, [developers, activeFilter, searchQuery]);

  const handleViewProfile = (dev: DeveloperProfile) => {
    setSelectedProfile(dev);
    setIsDrawerOpen(true);
  };

  const handlePostProjectForDev = (dev: DeveloperProfile) => {
    onSelectDeveloperForProject(dev);
  };

  const filterTabs: { id: TalentFilterCategory; label: string; count?: number }[] = [
    { id: 'all', label: 'All Vetted Devs', count: developers.length },
    {
      id: 'available',
      label: 'Available Now',
      count: developers.filter((d) => d.availability === 'available').length,
    },
    {
      id: 'backend',
      label: 'Backend & APIs',
      count: developers.filter((d) => d.category === 'backend' || d.category === 'fullstack').length,
    },
    {
      id: 'frontend',
      label: 'Frontend & UI',
      count: developers.filter((d) => d.category === 'frontend' || d.category === 'fullstack').length,
    },
    {
      id: 'security',
      label: 'Payments & Security',
      count: developers.filter((d) => d.category === 'security').length,
    },
    {
      id: 'high_pass_rate',
      label: '95%+ Test Pass Rate',
      count: developers.filter((d) => d.passRate >= 98).length,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Pre-Post Step 1 Hero & Direct Open CTA Banner */}
      <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-r from-surface-raised via-surface to-surface-raised/90 p-6 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/30">
              <Sparkles className="w-3.5 h-3.5" />
              Step 1: Choose Talent or Post Open Bounty
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
              Discover Vetted Freelancers & Developers
            </h2>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
              Every specialist is pre-verified with automated Repo Doctor test harnesses, verified GitHub history, and isolated Docker reproduction suites. Pick a developer directly or post an open project.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto flex-shrink-0">
            <Button
              variant="primary"
              size="md"
              onClick={onPostOpenProject}
              className="font-semibold shadow-md whitespace-nowrap"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Post Open Project Directly
            </Button>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search by name, skill, bug type (e.g. FastAPI, React, Payment Webhook)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-surface border border-border text-xs sm:text-sm text-text placeholder:text-text-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted hover:text-text cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Refresh & Results summary */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted font-medium">
            Showing <strong className="text-text">{filteredDevelopers.length}</strong> vetted talent
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={loadTalent}
            disabled={isLoading}
            className="text-xs"
            title="Refresh Talent Directory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <Filter className="w-3.5 h-3.5 text-text-muted flex-shrink-0 mr-1 hidden sm:inline" />
        {filterTabs.map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
                isActive
                  ? 'bg-primary text-on-primary border-primary shadow-xs'
                  : 'bg-surface text-text-muted border-border hover:border-primary/50 hover:text-text'
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-raised text-text-muted'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Developer Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-surface border border-border rounded-xl p-5 h-64 animate-pulse flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-surface-raised" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 bg-surface-raised rounded w-1/2" />
                    <div className="h-3 bg-surface-raised rounded w-3/4" />
                  </div>
                </div>
                <div className="h-3 bg-surface-raised rounded w-full" />
                <div className="h-10 bg-surface-raised rounded" />
              </div>
              <div className="h-8 bg-surface-raised rounded" />
            </div>
          ))}
        </div>
      ) : filteredDevelopers.length === 0 ? (
        <div className="py-16 text-center bg-surface border border-border rounded-xl p-8 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-surface-raised flex items-center justify-center text-text-muted">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-text">No developers match your current filters</h3>
          <p className="text-xs text-text-muted max-w-sm">
            Try adjusting your search query or filter tags to discover more vetted CodeBridge talent.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setActiveFilter('all');
            }}
            className="mt-2 text-xs"
          >
            Reset Filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDevelopers.map((dev) => (
            <DeveloperCard
              key={dev.id}
              developer={dev}
              onViewProfile={handleViewProfile}
              onPostProject={handlePostProjectForDev}
            />
          ))}
        </div>
      )}

      {/* Slide-over Profile Drawer */}
      <DeveloperProfileDrawer
        developer={selectedProfile}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onPostProject={handlePostProjectForDev}
      />
    </div>
  );
};
