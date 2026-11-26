import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
} from "lucide-react";
import { submissionApi } from "../../services/submission/api";
import { workspaceApi } from "../../services/workspace/api";
import { paymentApi } from "../../services/payment/api";
import { computeGate } from "./gate";
import { eventStore } from "../../realtime/store";
import { Button } from "../../components/ui/Button";
import { Chip } from "../../components/ui/Chip";
import { Alert } from "../../components/ui/Alert";
import { formatCurrencyINR } from "../../lib/format";
import { ApiError } from "../../lib/errors";
import { aiFeature } from "../../lib/features";
import { BeforeYouSubmitCard } from "./BeforeYouSubmitCard";

interface SubmissionPanelProps {
  taskId: string;
  workspaceStatus: string;
  changedCount: number;
  isStale: boolean;
  hasUnsavedChanges?: boolean;
  onSaveAll?: () => Promise<void>;
  onOpenFile?: (path: string) => void;
  files?: { path: string }[];
  lastSavedAt?: number | null;
  changedPaths?: string[];
}

export const SubmissionPanel: React.FC<SubmissionPanelProps> = ({
  taskId,
  workspaceStatus,
  changedCount,
  isStale,
  hasUnsavedChanges = false,
  onSaveAll,
  onOpenFile,
  files = [],
  lastSavedAt = null,
  changedPaths = [],
}) => {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");

  // 1. Current Submission state
  const {
    data: subData,
    isLoading: subLoading,
    error: subError,
    refetch: refetchSub,
  } = useQuery({
    queryKey: ["submission", "current", taskId],
    queryFn: () => submissionApi.getCurrentSubmission(taskId),
    enabled: Boolean(taskId),
  });

  // 2. Task Details for required tests
  const { data: taskData } = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => workspaceApi.getTask(taskId),
    enabled: Boolean(taskId),
  });

  // 3. Payment details for reward amount
  const { data: paymentData } = useQuery({
    queryKey: ["escrow", taskId],
    queryFn: () => paymentApi.getEscrow(taskId),
    enabled: Boolean(taskId),
  });

  // Realtime listeners for submission & payment changes
  useEffect(() => {
    const unsubSub = eventStore.subscribe("submission.status_changed", (event) => {
      const data = event.data as { taskId: string };
      if (data && data.taskId === taskId) {
        queryClient.invalidateQueries({ queryKey: ["submission", "current", taskId] });
      }
    });

    const unsubPay = eventStore.subscribe("payment.state_changed", (event) => {
      const data = event.data as { taskId: string };
      if (data && data.taskId === taskId) {
        queryClient.invalidateQueries({ queryKey: ["escrow", taskId] });
        queryClient.invalidateQueries({ queryKey: ["submission", "current", taskId] });
      }
    });

    return () => {
      unsubSub();
      unsubPay();
    };
  }, [taskId, queryClient]);

  const requiredTestIds =
    taskData?.criteria
      .filter((c) => c.required)
      .flatMap((c) => c.testIds) || [];

  const submissionStatus = subData?.status || "none";
  const isLocked = taskId === "t2" || taskId === "t3";

  // Gate computation
  const gate = computeGate({
    workspaceStatus,
    run: subData?.lastRun || null,
    stale: isStale,
    requiredTestIds,
    submissionStatus,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      return submissionApi.submit(taskId, notes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submission", "current", taskId] });
      queryClient.invalidateQueries({ queryKey: ["workspace", taskId] });
      queryClient.invalidateQueries({ queryKey: ["escrow", taskId] });
    },
  });

  if (subLoading) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4 shadow-sm animate-pulse space-y-3">
        <div className="h-5 w-1/3 bg-raised rounded" />
        <div className="h-20 bg-raised rounded" />
        <div className="h-9 bg-raised rounded" />
      </div>
    );
  }

  if (subError) {
    const apiError = subError instanceof ApiError ? subError : null;
    const corrId = apiError?.correlationId || "err_sub";

    return (
      <div className="rounded-xl border border-line bg-surface p-4 text-center shadow-sm">
        <p className="text-sm text-ink mb-1">Failed to load submission data.</p>
        <p className="text-xs text-muted mb-3 font-mono">Reference: {corrId}</p>
        <button
          type="button"
          onClick={() => refetchSub()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-2.5 py-1 text-xs text-ink hover:bg-raised"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const isReadonly =
    submissionStatus === "in_review" ||
    submissionStatus === "approved" ||
    isLocked;

  const rewardFormatted = paymentData ? formatCurrencyINR(paymentData.amount) : "₹4,500";

  return (
    <section className="rounded-xl border border-line bg-surface p-4 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-line">
        <h3 className="text-sm font-semibold text-ink">Submit for review</h3>
        {submissionStatus === "in_review" && (
          <Chip tone="warning" icon={<Clock className="h-3 w-3" aria-hidden="true" />}>
            In review
          </Chip>
        )}
        {submissionStatus === "approved" && (
          <Chip tone="success" icon={<CheckCircle2 className="h-3 w-3" aria-hidden="true" />}>
            Approved
          </Chip>
        )}
      </div>

      {/* Changes Summary */}
      <div className="flex items-center justify-between text-xs text-muted">
        <span>Workspace changes</span>
        <span className="font-mono font-medium text-ink">
          {changedCount} {changedCount === 1 ? "file" : "files"} changed
        </span>
      </div>

      {/* Status Alerts */}
      {submissionStatus === "in_review" && (
        <Alert tone="info" title="Under Review">
          The owner is reviewing your work. Escrow is moving to Tested.
        </Alert>
      )}

      {submissionStatus === "changes_requested" && (
        <Alert tone="warning" title="Changes Requested by Reviewer">
          <p className="font-medium text-ink mb-1">{subData?.note || "Please revise your implementation."}</p>
          <p className="text-xs text-muted">Run the tests again after your fixes to update your submission.</p>
        </Alert>
      )}

      {submissionStatus === "approved" && (
        <Alert tone="success" title="Milestone Approved!">
          <p className="text-ink">The client has accepted and verified the task requirements.</p>
          <p className="text-xs mt-1 text-money-text font-bold">
            Escrow release authorized: {rewardFormatted}
          </p>
        </Alert>
      )}

      {/* Developer Notes Textarea */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <label htmlFor="submission-notes" className="text-muted font-medium">
            Notes for reviewer
          </label>
          <span className="text-muted font-mono text-[11px]">{notes.length} / 500</span>
        </div>
        <textarea
          id="submission-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value.slice(0, 500))}
          disabled={isReadonly}
          placeholder={
            isReadonly
              ? "Submission locked under client review"
              : "Describe how you resolved duplicate webhook retries and idempotency..."
          }
          rows={3}
          className="w-full rounded-lg border border-line-strong bg-input p-2.5 text-xs text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 disabled:cursor-not-allowed resize-none"
        />
      </div>

      {/* Before you submit Card (Self-check & Draft summary) */}
      {!isLocked && (aiFeature("selfcheck") || aiFeature("draft")) && (
        <BeforeYouSubmitCard
          taskId={taskId}
          hasUnsavedChanges={hasUnsavedChanges}
          onSaveAll={onSaveAll}
          onOpenFile={onOpenFile}
          files={files}
          lastSavedAt={lastSavedAt}
          changedPaths={changedPaths}
          notes={notes}
          onApplyDraft={(newNotes) => setNotes(newNotes)}
        />
      )}

      {/* Gate Checklist */}
      <div className="rounded-lg border border-line bg-raised p-3 space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted block">
          Submission Readiness Gate
        </span>
        <ul className="space-y-1.5 text-xs">
          {gate.reasons.length === 0 ? (
            <li className="flex items-center gap-2 text-success font-medium">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>All verification requirements satisfied</span>
            </li>
          ) : (
            gate.reasons.map((reason, idx) => (
              <li key={idx} className="flex items-start gap-2 text-warning">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{reason}</span>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Submit Action */}
      <div>
        <Button
          variant="primary"
          className="w-full"
          disabled={!gate.canSubmit || isReadonly || submitMutation.isPending}
          onClick={() => submitMutation.mutate()}
        >
          {submitMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Submitting…</span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden="true" />
              <span>Submit for owner review</span>
            </>
          )}
        </Button>
      </div>
    </section>
  );
};
