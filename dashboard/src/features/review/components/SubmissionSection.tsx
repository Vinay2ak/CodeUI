import React from 'react';
import { CurrentSubmission, AutomatedRun } from '../types';
import { shortSha } from '../format';
import { formatRelativeTime } from '../../../lib/format';
import { GitCommit, User, Calendar, GitPullRequest } from 'lucide-react';

interface SubmissionSectionProps {
  submission: CurrentSubmission;
  run: AutomatedRun | null;
}

export const SubmissionSection: React.FC<SubmissionSectionProps> = ({ submission, run }) => {
  const additions = run?.diff.totalAdditions ?? 0;
  const deletions = run?.diff.totalDeletions ?? 0;

  return (
    <section aria-labelledby="submission-heading" className="p-6 rounded-xl border border-border bg-surface space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <h2 id="submission-heading" className="text-base font-semibold text-text flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold">
            1
          </span>
          Submission
        </h2>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            {submission.developerName}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {formatRelativeTime(submission.submittedAt)}
          </span>
          <span className="flex items-center gap-1.5 font-mono">
            <GitCommit className="w-3.5 h-3.5" />
            {shortSha(submission.commitSha)}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-1">
            Summary
          </span>
          <p className="text-sm text-text whitespace-pre-wrap font-sans">
            {submission.summary || 'No summary provided.'}
          </p>
        </div>

        {submission.notes && (
          <div>
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-1">
              Developer Notes
            </span>
            <p className="text-sm text-text-muted whitespace-pre-wrap font-sans bg-surface-raised p-3 rounded-lg border border-border">
              {submission.notes}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
          <span className="text-text-muted flex items-center gap-1.5">
            <GitPullRequest className="w-3.5 h-3.5" />
            Changes in this submission:
          </span>
          <div className="flex items-center gap-2 font-mono tabular-nums">
            <span className="text-success font-semibold">+{additions}</span>
            <span className="text-danger font-semibold">-{deletions}</span>
          </div>
        </div>
      </div>
    </section>
  );
};
