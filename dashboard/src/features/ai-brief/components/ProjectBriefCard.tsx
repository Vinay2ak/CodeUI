import React, { useEffect, useState } from 'react';
import { Info, AlertTriangle, CheckSquare } from 'lucide-react';
import { getBrief } from '../../../services/project/api';
import type { ConfirmedBrief } from '../types';

export interface ProjectBriefCardProps {
  projectId: string;
}

export const ProjectBriefCard: React.FC<ProjectBriefCardProps> = ({ projectId }) => {
  const [brief, setBrief] = useState<ConfirmedBrief | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    getBrief(projectId)
      .then((data) => {
        if (active) {
          setBrief(data);
        }
      })
      .catch(() => {
        // 404 or other errors mean no brief exists for this project
        if (active) {
          setBrief(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [projectId]);

  if (loading || !brief) {
    return null;
  }

  const formattedDate = brief.confirmedAt
    ? new Date(brief.confirmedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'recently';

  return (
    <div className="p-6 rounded-lg bg-surface border border-border space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold text-text">Developer brief</h2>
          <p className="text-xs text-text-muted">
            Confirmed by you on {formattedDate}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-surface-raised border border-border text-text-muted">
          <Info className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.5} />
          Advisory analysis
        </span>
      </div>

      {/* 1. Problem Summary */}
      <div className="space-y-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          1. Problem summary
        </h3>
        <p className="text-sm text-text leading-relaxed">
          {brief.problemSummary}
        </p>
      </div>

      {/* 2. Suspected Files */}
      {brief.suspectedFiles && brief.suspectedFiles.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            2. Suspected files ({brief.suspectedFiles.length})
          </h3>
          <div className="space-y-2">
            {brief.suspectedFiles.map((file) => {
              const lineRange =
                file.startLine !== null && file.endLine !== null
                  ? `:${file.startLine}-${file.endLine}`
                  : '';
              return (
                <div
                  key={file.path}
                  className="p-3 rounded bg-surface-raised border border-border space-y-1"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-mono text-xs text-text font-medium">
                      {file.path}{lineRange}
                    </span>
                    {file.verified === false && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface border border-warning/40 text-warning">
                        <AlertTriangle className="w-2.5 h-2.5" strokeWidth={1.5} />
                        Path not verified
                      </span>
                    )}
                  </div>
                  {file.reason && (
                    <p className="text-xs text-text-muted leading-normal">{file.reason}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Root Cause Hypothesis */}
      {brief.rootCauseHypothesis && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              3. Root cause hypothesis
            </h3>
            <span className="text-[10px] text-text-muted italic">Unconfirmed</span>
          </div>
          <p className="text-xs text-text leading-relaxed">
            {brief.rootCauseHypothesis}
          </p>
        </div>
      )}

      {/* 4. Step-by-Step Plan */}
      {brief.stepByStepPlan && brief.stepByStepPlan.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            4. Step-by-step plan ({brief.stepByStepPlan.length})
          </h3>
          <ol className="space-y-1.5 list-decimal list-inside text-xs text-text">
            {brief.stepByStepPlan.map((step) => (
              <li key={step.id} className="py-0.5 leading-relaxed">
                <span>{step.text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 5. Acceptance Criteria */}
      {brief.acceptanceCriteria && brief.acceptanceCriteria.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            5. Acceptance criteria ({brief.acceptanceCriteria.length})
          </h3>
          <p className="text-xs text-text-muted">These are checked when the developer submits.</p>
          <div className="space-y-2 pt-1">
            {brief.acceptanceCriteria.map((crit) => (
              <div
                key={crit.id}
                className="p-3 rounded bg-surface-raised border border-border flex items-start justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-2.5 flex-1">
                  <CheckSquare className="w-4 h-4 text-primary shrink-0 mt-0.5" strokeWidth={1.5} />
                  <span className="text-text leading-normal">{crit.text}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface border border-border text-text-muted">
                    {crit.source === 'ai' ? 'AI' : 'You'}
                  </span>
                  {crit.required && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface border border-border text-text-muted">
                      Required
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
