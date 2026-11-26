import React, { useState, useEffect } from 'react';
import { PanelSpec } from './panels.config';
import { Skeleton } from '../../components/ui/skeleton';

export interface PanelCardProps {
  panel: PanelSpec;
  height: number;
  embedUrl: string | null;
}

export const PanelCard: React.FC<PanelCardProps> = ({
  panel,
  height,
  embedUrl,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);

  // Reset loading state if embed URL changes (e.g. range or theme change)
  useEffect(() => {
    setIsLoaded(false);
    setIsTimedOut(false);

    const timer = setTimeout(() => {
      setIsTimedOut(true);
    }, 15000);

    return () => clearTimeout(timer);
  }, [embedUrl]);

  if (panel.id === null) {
    if (import.meta.env.DEV) {
      return (
        <div
          style={{ height: `${height}px` }}
          className="rounded-2xl border border-dashed border-border bg-card p-4 flex flex-col items-center justify-center text-center shadow-sm"
        >
          <span className="text-xs font-medium text-text-muted">
            Panel id missing: {panel.title}
          </span>
        </div>
      );
    }
    return null;
  }

  return (
    <div
      style={{ height: `${height}px` }}
      className="relative rounded-2xl border border-border bg-card overflow-hidden shadow-sm flex flex-col"
    >
      {/* Loading Skeleton Overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 z-10 bg-surface flex flex-col items-center justify-center p-4">
          <div className="w-full h-full flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="flex-1 w-full" />
          </div>
          {isTimedOut && (
            <div className="absolute bottom-3 left-4 text-xs text-text-muted bg-surface-raised/80 px-2 py-0.5 rounded border border-border">
              Still loading…
            </div>
          )}
        </div>
      )}

      {embedUrl && (
        <iframe
          src={embedUrl}
          title={`${panel.title} (Grafana)`}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin"
          referrerPolicy="no-referrer"
          onLoad={() => setIsLoaded(true)}
          className={`w-full h-full border-0 transition-opacity duration-150 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  );
};
