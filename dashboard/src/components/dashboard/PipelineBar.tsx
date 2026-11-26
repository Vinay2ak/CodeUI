import React from 'react';
import { formatMoney } from '../../lib/format';
import { StatusChip } from './StatusChip';

export interface PipelineBarProps {
  authorized: number;
  held: number;
  pendingRelease: number;
  released: number;
  className?: string;
}

export const PipelineBar: React.FC<PipelineBarProps> = ({
  authorized,
  held,
  pendingRelease,
  released,
  className = '',
}) => {
  const total = authorized + held + pendingRelease + released;

  const pct = (val: number) => {
    if (total === 0) return 0;
    return Math.max(0, (val / total) * 100);
  };

  const pAuthorized = pct(authorized);
  const pHeld = pct(held);
  const pPending = pct(pendingRelease);
  const pReleased = pct(released);

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="w-full h-3.5 rounded-full bg-secondary border border-border overflow-hidden flex">
        {pAuthorized > 0 && (
          <div
            style={{ width: `${pAuthorized}%` }}
            className="bg-muted-foreground/40 transition-all duration-300"
            title={`Authorized: ${formatMoney(authorized)} (${pAuthorized.toFixed(1)}%)`}
          />
        )}
        {pHeld > 0 && (
          <div
            style={{ width: `${pHeld}%` }}
            className="bg-money transition-all duration-300"
            title={`Held: ${formatMoney(held)} (${pHeld.toFixed(1)}%)`}
          />
        )}
        {pPending > 0 && (
          <div
            style={{ width: `${pPending}%` }}
            className="bg-money/70 transition-all duration-300"
            title={`Release pending: ${formatMoney(pendingRelease)} (${pPending.toFixed(1)}%)`}
          />
        )}
        {pReleased > 0 && (
          <div
            style={{ width: `${pReleased}%` }}
            className="bg-success transition-all duration-300"
            title={`Released: ${formatMoney(released)} (${pReleased.toFixed(1)}%)`}
          />
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
        <div className="flex flex-col gap-2 p-3 rounded-xl bg-secondary/45 border border-border">
          <StatusChip category="payment" status="authorized" size="sm" />
          <span className="text-sm font-semibold text-foreground font-mono tabular-nums">
            {formatMoney(authorized)}
          </span>
        </div>

        <div className="flex flex-col gap-2 p-3 rounded-xl bg-secondary/45 border border-border">
          <StatusChip category="payment" status="held" size="sm" />
          <span className="text-sm font-semibold text-money font-mono tabular-nums">
            {formatMoney(held)}
          </span>
        </div>

        <div className="flex flex-col gap-2 p-3 rounded-xl bg-secondary/45 border border-border">
          <StatusChip category="payment" status="release_pending" size="sm" />
          <span className="text-sm font-semibold text-money font-mono tabular-nums">
            {formatMoney(pendingRelease)}
          </span>
        </div>

        <div className="flex flex-col gap-2 p-3 rounded-xl bg-secondary/45 border border-border">
          <StatusChip category="payment" status="released" size="sm" />
          <span className="text-sm font-semibold text-success font-mono tabular-nums">
            {formatMoney(released)}
          </span>
        </div>
      </div>
    </div>
  );
};
