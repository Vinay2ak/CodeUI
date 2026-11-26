import React from 'react';
import { DecisionGuardResult } from '../decisionGuard';
import { Button } from '../../../components/ui/button';
import { formatInr } from '../format';
import { Check, Edit3 } from 'lucide-react';

interface DecisionBarProps {
  guard: DecisionGuardResult;
  amount: number;
  onRequestChanges: () => void;
  onApprove: () => void;
}

export const DecisionBar: React.FC<DecisionBarProps> = ({
  guard,
  amount,
  onRequestChanges,
  onApprove,
}) => {
  return (
    <div
      aria-label="Submission Decision"
      className="p-4 rounded-xl border border-border bg-surface lg:sticky lg:bottom-4 z-20 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4"
    >
      <div className="text-xs text-text-muted flex-1">
        {guard.reasons.length > 0 ? (
          <div className="space-y-0.5">
            {guard.reasons.map((r, i) => (
              <p key={i} className="text-danger font-medium">
                {r}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-text-muted">
            Carefully verify tests and evidence above before authorizing irreversible escrow disbursement.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 w-full sm:w-auto justify-end shrink-0">
        <Button
          type="button"
          variant="outline"
          onClick={onRequestChanges}
          disabled={!guard.canRequestChanges}
          className="w-full sm:w-auto"
        >
          <Edit3 className="w-4 h-4 mr-1.5" />
          Request changes
        </Button>

        <Button
          type="button"
          variant="primary"
          onClick={onApprove}
          disabled={!guard.canApprove}
          className="w-full sm:w-auto"
        >
          <Check className="w-4 h-4 mr-1.5" />
          <span>Approve and release </span>
          <span className="font-mono tabular-nums text-on-primary ml-1 font-bold">
            {formatInr(amount)}
          </span>
        </Button>
      </div>
    </div>
  );
};
