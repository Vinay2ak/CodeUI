import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, AlertTriangle, RefreshCw } from 'lucide-react';
import { env } from '../../lib/env';
import { Button } from '../../components/ui/Button';
import { Select, type SelectOption } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  parseGrafanaUrl,
  buildPanelUrl,
  buildOpenUrl,
  type AppTheme,
  type TimeRange,
} from './grafanaUrl';
import { probeGrafana, isMixedContent, type GrafanaConnectionStatus } from './probe';
import { arrangePanels } from './layout';
import { loadAnalyticsPrefs, saveAnalyticsPrefs } from './prefs';
import {
  ANALYTICS_PANELS,
  SHOW_STAT_PANELS,
  ANALYTICS_VARIABLE,
} from './panels.config';
import { PanelCard } from './PanelCard';
import type { User } from '../../session/session';

const RANGE_OPTIONS: { id: TimeRange; label: string }[] = [
  { id: '24h', label: '24 hours' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
];

const SELECT_RANGE_OPTIONS: SelectOption[] = [
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

function getDocTheme(): AppTheme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export interface AnalyticsSectionProps {
  user?: User | null;
  ownerId?: string;
}

export const AnalyticsSection: React.FC<AnalyticsSectionProps> = ({
  user,
  ownerId,
}) => {
  // Resolve effective owner ID for personal filtering
  const effectiveOwnerId = useMemo(() => {
    if (ownerId !== undefined && ownerId !== null) {
      return ownerId.trim() || 'All';
    }
    if (user && user.id && user.id !== 'anonymous') {
      const role = (user.role || '').toLowerCase();
      if (role === 'admin') {
        return 'All';
      }
      return user.id;
    }
    return 'All';
  }, [ownerId, user]);

  // 1. App Theme Sync
  const [theme, setTheme] = useState<AppTheme>(getDocTheme);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const observer = new MutationObserver(() => {
      setTheme(getDocTheme());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  // 2. Preferences
  const [range, setRange] = useState<TimeRange>(() => loadAnalyticsPrefs().range);

  const handleRangeChange = (nextRange: TimeRange) => {
    setRange(nextRange);
    saveAnalyticsPrefs({ range: nextRange, refresh: 'off' });
  };

  // 3. Parse Grafana URL
  const parsed = useMemo(() => parseGrafanaUrl(env.grafanaUrl), []);

  const mixedBlocked = useMemo(() => {
    if (!parsed.ok || typeof window === 'undefined') return false;
    return isMixedContent(window.location.protocol, `${parsed.origin.split(':')[0]}:`);
  }, [parsed]);

  // 4. Probing State
  const [probeStatus, setProbeStatus] = useState<GrafanaConnectionStatus | null>(null);
  const [isProbing, setIsProbing] = useState<boolean>(true);

  const runProbe = useCallback(async () => {
    if (!parsed.ok || mixedBlocked) {
      setIsProbing(false);
      return;
    }
    setIsProbing(true);
    const status = await probeGrafana(parsed.origin);
    setProbeStatus(status);
    setIsProbing(false);
  }, [parsed, mixedBlocked]);

  useEffect(() => {
    runProbe();
  }, [runProbe]);

  // 5. Template Variables
  const templateVars = useMemo(() => {
    const vars: Record<string, string> = {};
    if (ANALYTICS_VARIABLE) {
      vars[ANALYTICS_VARIABLE.name] = effectiveOwnerId;
    }
    return vars;
  }, [effectiveOwnerId]);

  // 6. External Open URL
  const openUrl = useMemo(() => {
    if (!parsed.ok) return null;
    return buildOpenUrl(parsed, { range, ownerId: effectiveOwnerId, vars: templateVars });
  }, [parsed, range, effectiveOwnerId, templateVars]);

  // 7. Rows of Panels for Layout
  const panelRows = useMemo(() => {
    return arrangePanels(ANALYTICS_PANELS, { showStat: SHOW_STAT_PANELS });
  }, []);

  // Keyboard navigation for segmented control
  const radioGroupRef = useRef<HTMLDivElement>(null);
  const handleRadioKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (index + 1) % RANGE_OPTIONS.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (index - 1 + RANGE_OPTIONS.length) % RANGE_OPTIONS.length;
    }

    if (nextIndex !== -1) {
      const opt = RANGE_OPTIONS[nextIndex];
      handleRangeChange(opt.id);
      const buttons = radioGroupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      buttons?.[nextIndex]?.focus();
    }
  };

  const isConfigured = parsed.ok;
  const isControlsDisabled = !isConfigured || mixedBlocked;

  // In production, hide the section entirely unless a reachable HTTPS Grafana URL is configured.
  if (!import.meta.env.DEV && (!parsed.ok || mixedBlocked)) return null;

  return (
    <section id="analytics" aria-labelledby="analytics-heading" className="flex flex-col gap-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-baseline gap-2">
          <h2 id="analytics-heading" className="text-xl font-bold tracking-tight text-ink">
            Analytics
          </h2>
        </div>

        {/* Header Right: Time Range & Open in Grafana */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label id="time-range-label" className="text-xs font-medium text-muted shrink-0">
              Time range
            </label>

            {/* Mobile Select (< 640px) */}
            <div className="sm:hidden block w-28">
              <Select
                value={range}
                onChange={(val) => handleRangeChange(val as TimeRange)}
                options={SELECT_RANGE_OPTIONS}
                disabled={isControlsDisabled}
                size="sm"
                aria-labelledby="time-range-label"
              />
            </div>

            {/* Segmented Control (>= 640px) */}
            <div
              ref={radioGroupRef}
              role="radiogroup"
              aria-labelledby="time-range-label"
              className={`hidden sm:inline-flex rounded-full border border-border bg-card p-1 ${
                isControlsDisabled ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              {RANGE_OPTIONS.map((opt, idx) => {
                const isSelected = range === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    disabled={isControlsDisabled}
                    onClick={() => handleRangeChange(opt.id)}
                    onKeyDown={(e) => handleRadioKeyDown(e, idx)}
                    className={`relative px-3.5 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      isSelected
                        ? 'text-primary-foreground font-semibold'
                        : 'text-muted hover:text-foreground'
                    }`}
                  >
                    {isSelected && (
                      <motion.span
                        layoutId="analytics-range-pill"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        className="absolute inset-0 rounded-full bg-primary shadow-sm"
                      />
                    )}
                    <span className="relative z-10">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Open in Grafana Link */}
          {openUrl ? (
            <a
              href={openUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open in Grafana (opens in a new tab)"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-ink hover:text-primary hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-1.5 py-0.5"
            >
              <span>Open in Grafana</span>
              <ExternalLink className="w-3.5 h-3.5 stroke-[1.5]" />
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted opacity-50 px-1.5 py-0.5">
              <span>Open in Grafana</span>
              <ExternalLink className="w-3.5 h-3.5 stroke-[1.5]" />
            </span>
          )}
        </div>
      </div>

      {/* State 1: Not Configured */}
      {!parsed.ok && (
        <div className="rounded-2xl border border-line bg-surface p-8 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-raised flex items-center justify-center text-muted mb-3">
            <AlertTriangle className="w-6 h-6 stroke-[1.5]" />
          </div>
          <h3 className="text-base font-bold text-ink mb-1.5">
            Analytics is not configured
          </h3>
          <p className="text-xs text-muted max-w-lg leading-relaxed">
            Set <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-raised border border-line text-ink">VITE_GRAFANA_URL</code> in this app's <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-raised border border-line text-ink">.env</code> file to the Grafana dashboard URL from the backend team, then restart the dev server.
          </p>
        </div>
      )}

      {/* State 2: Mixed Content */}
      {parsed.ok && mixedBlocked && (
        <div className="rounded-2xl border border-line bg-surface p-8 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-danger-bg text-danger flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6 stroke-[1.5]" />
          </div>
          <h3 className="text-base font-bold text-ink mb-1.5">
            The browser blocks this embed
          </h3>
          <p className="text-xs text-muted max-w-lg leading-relaxed">
            This app is served over HTTPS but Grafana uses HTTP. Use an HTTPS Grafana URL.
          </p>
        </div>
      )}

      {/* State 3: Checking Skeleton Grid */}
      {parsed.ok && !mixedBlocked && isProbing && (
        <div aria-live="polite" className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-xs text-muted">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Checking Grafana…</span>
          </div>
          <div className="flex flex-col gap-4">
            {panelRows.map((row, rowIdx) => {
              const maxRowHeight = Math.max(...row.map((p) => p.height));
              return (
                <div key={rowIdx} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4">
                  {row.map((panel, pIdx) => {
                    const xlSpanClass =
                      panel.span === 12
                        ? 'xl:col-span-12'
                        : panel.span === 8
                        ? 'xl:col-span-8'
                        : panel.span === 6
                        ? 'xl:col-span-6'
                        : panel.span === 4
                        ? 'xl:col-span-4'
                        : 'xl:col-span-12';
                    const mdSpanClass = panel.span > 6 ? 'md:col-span-2' : 'md:col-span-1';

                    return (
                      <div
                        key={pIdx}
                        style={{ height: `${maxRowHeight}px` }}
                        className={`rounded-2xl border border-line bg-surface p-4 shadow-sm flex flex-col gap-3 ${mdSpanClass} ${xlSpanClass}`}
                      >
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="flex-1 w-full" />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* State 4: Unreachable */}
      {parsed.ok && !mixedBlocked && !isProbing && probeStatus === 'unreachable' && (
        <div className="rounded-2xl border border-line bg-surface p-8 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-danger-bg text-danger flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6 stroke-[1.5]" />
          </div>
          <h3 className="text-base font-bold text-ink mb-1.5">
            Can't reach Grafana
          </h3>
          <p className="text-xs text-muted max-w-lg leading-relaxed mb-4">
            This device can't connect to {parsed.host ? <span className="font-mono text-ink">{parsed.host}</span> : 'Grafana'}. Check that Grafana is running and that you are on the same network.
          </p>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={runProbe}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Try again
            </Button>
            {openUrl && (
              <a
                href={openUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center text-xs font-medium px-3.5 py-1.5 rounded-lg border border-line bg-raised text-ink hover:bg-canvas transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Open in Grafana
              </a>
            )}
          </div>
        </div>
      )}

      {/* State 5: Ready Grid of Individual Panels (Matches Picture 1!) */}
      {parsed.ok && !mixedBlocked && !isProbing && probeStatus === 'reachable' && (
        <div className="flex flex-col gap-4">
          {panelRows.map((row, rowIdx) => {
            const maxRowHeight = Math.max(...row.map((p) => p.height));
            return (
              <div key={rowIdx} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4">
                {row.map((panel) => {
                  const xlSpanClass =
                    panel.span === 12
                      ? 'xl:col-span-12'
                      : panel.span === 8
                      ? 'xl:col-span-8'
                      : panel.span === 6
                      ? 'xl:col-span-6'
                      : panel.span === 4
                      ? 'xl:col-span-4'
                      : 'xl:col-span-12';
                  const mdSpanClass = panel.span > 6 ? 'md:col-span-2' : 'md:col-span-1';

                  const embedUrl = buildPanelUrl(parsed, {
                    panelId: panel.id,
                    range,
                    refresh: '1m',
                    theme,
                    ownerId: effectiveOwnerId,
                    vars: templateVars,
                  });

                  return (
                    <div key={panel.id ?? panel.title} className={`${mdSpanClass} ${xlSpanClass}`}>
                      <PanelCard
                        panel={panel}
                        height={maxRowHeight}
                        embedUrl={embedUrl}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default AnalyticsSection;
