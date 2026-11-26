import React, { useState } from 'react';
import {
  Info,
  AlertTriangle,
  Trash2,
  Edit2,
  Check,
  X,
  Plus,
  RefreshCw,
  Send,
  Loader2,
} from 'lucide-react';
import type {
  AiDeveloperBrief,
  ProjectSnapshot,
  AcceptanceCriterion,
} from '../types';
import {
  updateCriterion,
  removeCriterion,
  addCriterion,
  setRequired,
  removeStep,
  removeFile,
  validateBrief,
} from '../briefEdit';
import { Button } from '../../../components/ui/button';

export interface BriefComparisonProps {
  brief: AiDeveloperBrief;
  snapshot: ProjectSnapshot;
  currentFormValues: Partial<ProjectSnapshot>;
  isStale: boolean;
  canRescan: boolean;
  isPublishing: boolean;
  publishError?: string | null;
  onUpdateBrief: (brief: AiDeveloperBrief) => void;
  onRescan: () => void;
  onPublish: () => void;
  onDiscard: () => void;
}

export const BriefComparison: React.FC<BriefComparisonProps> = ({
  brief,
  snapshot,
  currentFormValues,
  isStale,
  canRescan,
  isPublishing,
  publishError,
  onUpdateBrief,
  onRescan,
  onPublish,
  onDiscard,
}) => {
  const [editingCritId, setEditingCritId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [newCritText, setNewCritText] = useState('');

  // Validate brief
  const validation = validateBrief(brief);

  // Field change detection for stale snapshot chips
  const titleChanged = currentFormValues.title !== undefined && currentFormValues.title !== snapshot.title;
  const descChanged = currentFormValues.description !== undefined && currentFormValues.description !== snapshot.description;
  const stacksChanged =
    currentFormValues.stacks !== undefined &&
    JSON.stringify(currentFormValues.stacks.slice().sort()) !== JSON.stringify(snapshot.stacks.slice().sort());
  const specialtiesChanged =
    currentFormValues.specialties !== undefined &&
    JSON.stringify((currentFormValues.specialties || []).slice().sort()) !==
      JSON.stringify((snapshot.specialties || []).slice().sort());

  const handleStartEdit = (crit: AcceptanceCriterion) => {
    setEditingCritId(crit.id);
    setEditText(crit.text);
  };

  const handleSaveEdit = (id: string) => {
    if (editText.trim().length > 0) {
      onUpdateBrief(updateCriterion(brief, id, editText));
    }
    setEditingCritId(null);
  };

  const handleCancelEdit = () => {
    setEditingCritId(null);
    setEditText('');
  };

  const handleAddCriterion = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (newCritText.trim().length >= 5) {
        onUpdateBrief(addCriterion(brief, newCritText));
        setNewCritText('');
      }
    }
  };

  const getPublishDisabledReason = (): string | null => {
    if (isPublishing) return 'Publishing…';
    if (isStale) return 'Re-scan repository before publishing.';
    if (!validation.valid) {
      return validation.errors[0] || 'Brief has validation errors.';
    }
    return null;
  };

  const publishDisabledReason = getPublishDisabledReason();

  return (
    <div className="space-y-6 pt-4 border-t border-border">
      {/* Stale Warning Banner */}
      {isStale && (
        <div className="p-3.5 rounded-lg bg-surface border border-warning/50 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" strokeWidth={1.5} />
          <div className="text-sm">
            <div className="font-semibold text-text">Your project details changed after this brief was generated.</div>
            <p className="text-xs text-text-muted mt-0.5">
              Re-scan the repository to refresh it.
            </p>
          </div>
        </div>
      )}

      {/* Publish Error Banner */}
      {publishError && (
        <div className="p-3.5 rounded-lg bg-surface border border-danger/50 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" strokeWidth={1.5} />
          <div className="text-sm">
            <div className="font-semibold text-danger">Publishing failed</div>
            <p className="text-xs text-text-muted mt-0.5">{publishError}</p>
          </div>
        </div>
      )}

      {/* Two-Column Responsive Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN: Your Project (Source of truth) */}
        <div className="p-5 rounded-lg bg-surface border border-border space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="text-sm font-semibold text-text">Your project</div>
            <span className="text-xs text-text-muted font-medium">Source of truth</span>
          </div>

          {/* Title */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Title</span>
              {titleChanged && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-raised border border-border text-text-muted">
                  Changed
                </span>
              )}
            </div>
            <div className="text-sm font-medium text-text">{snapshot.title}</div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Description</span>
              {descChanged && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-raised border border-border text-text-muted">
                  Changed
                </span>
              )}
            </div>
            <div className="text-xs text-text whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto pr-1">
              {snapshot.description}
            </div>
          </div>

          {/* Stacks & Specialties */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Tech Stack & Specialties</span>
              {(stacksChanged || specialtiesChanged) && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-raised border border-border text-text-muted">
                  Changed
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {snapshot.stacks.map((stack) => (
                <span
                  key={stack}
                  className="px-2 py-0.5 rounded text-xs bg-surface-raised border border-border text-text font-mono"
                >
                  {stack}
                </span>
              ))}
              {snapshot.specialties.map((spec) => (
                <span
                  key={spec}
                  className="px-2 py-0.5 rounded text-xs bg-surface-raised border border-border text-text-muted"
                >
                  {spec}
                </span>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div className="space-y-1">
            <span className="text-xs text-text-muted">Budget</span>
            <div className="text-base font-semibold text-money tabular-nums">
              ₹{snapshot.budget.toLocaleString('en-IN')}
            </div>
          </div>

          {/* Repo & Commit */}
          <div className="space-y-1 pt-2 border-t border-border">
            <span className="text-xs text-text-muted">Repository</span>
            <div className="text-xs font-mono text-text flex items-center gap-2">
              <span>{snapshot.repoFullName}</span>
              <span>&bull;</span>
              <span>commit: {snapshot.headCommitSha.substring(0, 7)}</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Developer Brief (Advisory analysis) */}
        <div className="p-5 rounded-lg bg-surface border border-border space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="text-sm font-semibold text-text">Developer brief</div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-surface-raised border border-border text-text-muted">
              <Info className="w-3 h-3 text-text-muted" strokeWidth={1.5} />
              Advisory analysis
            </span>
          </div>

          <p className="text-xs text-text-muted">
            Generated from commit <span className="font-mono text-text">{brief.repoCommitSha.substring(0, 7)}</span>. Review and edit before publishing.
          </p>

          {/* Section 1: Problem Summary */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              1. Problem summary
            </h3>
            <p className="text-xs text-text leading-relaxed">
              {brief.problemSummary}
            </p>
          </div>

          {/* Section 2: Suspected Files */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                2. Suspected files ({brief.suspectedFiles.length})
              </h3>
            </div>
            {brief.suspectedFiles.length === 0 ? (
              <p className="text-xs text-text-muted italic">No files flagged</p>
            ) : (
              <div className="space-y-2">
                {brief.suspectedFiles.map((file) => {
                  const lineRange =
                    file.startLine !== null && file.endLine !== null
                      ? `:${file.startLine}-${file.endLine}`
                      : '';
                  return (
                    <div
                      key={file.path}
                      className="p-2.5 rounded bg-surface-raised border border-border space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
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
                        <button
                          type="button"
                          onClick={() => onUpdateBrief(removeFile(brief, file.path))}
                          className="text-text-muted hover:text-danger p-1 rounded transition-colors"
                          title={`Remove ${file.path} from the brief`}
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                          <span className="sr-only">Remove {file.path} from the brief</span>
                        </button>
                      </div>
                      {file.reason && (
                        <p className="text-xs text-text-muted leading-normal">{file.reason}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 3: Root Cause Hypothesis */}
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

          {/* Section 4: Step-by-Step Plan */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              4. Step-by-step plan ({brief.stepByStepPlan.length})
            </h3>
            <ol className="space-y-1.5 list-decimal list-inside text-xs text-text">
              {brief.stepByStepPlan.map((step) => (
                <li key={step.id} className="flex items-start justify-between gap-2 pl-1 py-0.5">
                  <span className="flex-1 leading-relaxed">{step.text}</span>
                  <button
                    type="button"
                    onClick={() => onUpdateBrief(removeStep(brief, step.id))}
                    className="text-text-muted hover:text-danger p-0.5 rounded transition-colors shrink-0"
                    title={`Remove step from plan`}
                  >
                    <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                    <span className="sr-only">Remove step</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>

          {/* Section 5: Acceptance Criteria */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                5. Acceptance criteria ({brief.acceptanceCriteria.length} of 12)
              </h3>
            </div>
            <p className="text-xs text-text-muted">These are checked when the developer submits.</p>

            {/* Validation errors */}
            {!validation.valid && (
              <div className="space-y-1 py-1">
                {validation.errors.map((err, i) => (
                  <p key={i} className="text-xs text-danger font-medium flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                    <span>{err}</span>
                  </p>
                ))}
              </div>
            )}

            {/* Criteria List */}
            <div className="space-y-2">
              {brief.acceptanceCriteria.map((crit) => {
                const isEditing = editingCritId === crit.id;

                return (
                  <div
                    key={crit.id}
                    className="p-2.5 rounded bg-surface-raised border border-border space-y-1.5"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveEdit(crit.id);
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                          autoFocus
                          className="flex-1 px-2.5 py-1 text-xs rounded bg-surface border border-primary text-text focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(crit.id)}
                          className="p-1 rounded text-success hover:bg-surface"
                          title="Save"
                        >
                          <Check className="w-3.5 h-3.5" strokeWidth={1.5} />
                          <span className="sr-only">Save</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="p-1 rounded text-text-muted hover:bg-surface"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                          <span className="sr-only">Cancel</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs text-text leading-normal flex-1">
                          {crit.text}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface border border-border text-text-muted">
                            {crit.source === 'ai' ? 'AI' : 'You'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(crit)}
                            className="text-text-muted hover:text-text p-1 rounded"
                            title="Edit criterion"
                          >
                            <Edit2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                            <span className="sr-only">Edit criterion</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateBrief(removeCriterion(brief, crit.id))}
                            className="text-text-muted hover:text-danger p-1 rounded"
                            title="Remove criterion"
                          >
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                            <span className="sr-only">Remove criterion</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-0.5">
                      <label className="flex items-center gap-1.5 text-[11px] text-text-muted cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={crit.required}
                          onChange={(e) => onUpdateBrief(setRequired(brief, crit.id, e.target.checked))}
                          className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-0"
                        />
                        <span>Required</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Criterion Input */}
            {brief.acceptanceCriteria.length < 12 && (
              <div className="pt-1">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Add acceptance criterion (Press Enter)..."
                      value={newCritText}
                      onChange={(e) => setNewCritText(e.target.value)}
                      onKeyDown={handleAddCriterion}
                      className="w-full pl-7 pr-3 py-1.5 text-xs rounded bg-surface border border-border text-text placeholder:text-text-muted/60 focus:outline-none focus:border-primary"
                    />
                    <Plus className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2" strokeWidth={1.5} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onRescan}
            disabled={!canRescan || isPublishing}
          >
            <RefreshCw className="w-4 h-4 mr-2 text-primary" strokeWidth={1.5} />
            Re-scan repo
          </Button>

          <Button
            type="button"
            variant="primary"
            onClick={onPublish}
            disabled={Boolean(publishDisabledReason)}
          >
            {isPublishing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" strokeWidth={1.5} />
                Publishing to developers…
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" strokeWidth={1.5} />
                Confirm &amp; publish to developers
              </>
            )}
          </Button>

          {publishDisabledReason && !isPublishing && (
            <span className="text-xs text-text-muted">{publishDisabledReason}</span>
          )}
        </div>

        <button
          type="button"
          onClick={onDiscard}
          disabled={isPublishing}
          className="text-xs text-text-muted hover:text-danger transition-colors underline"
        >
          Discard brief
        </button>
      </div>
    </div>
  );
};
