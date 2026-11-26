import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight,
  GitCommit,
  User,
  AlertTriangle,
  RefreshCw,
  Clock,
  BadgeCheck,
} from 'lucide-react';
import { projectApi } from '../../services/project/api';
import { reviewApi } from '../../services/review/api';
import { verificationApi } from '../../services/verification/api';
import { paymentApi } from '../../services/payment/api';
import { FEATURES } from '../../lib/features';
import {
  CurrentSubmission,
  AutomatedRun,
  AiVerificationReport,
  ProjectPayment,
} from './types';
import { shortSha } from './format';
import { computeDecisionGuard } from './decisionGuard';
import { Chip } from '../../components/ui/Chip';
import { Button } from '../../components/ui/button';
import { PaymentCard } from './components/PaymentCard';
import { SubmissionSection } from './components/SubmissionSection';
import { AutomatedRunSection } from './components/AutomatedRunSection';
import { AiVerificationSection } from './components/AiVerificationSection';
import { DecisionBar } from './components/DecisionBar';
import { ApproveDialog } from './components/ApproveDialog';
import { ChangesDialog } from './components/ChangesDialog';

export const ReviewPage: React.FC = () => {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();

  // Dialog states
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isChangesOpen, setIsChangesOpen] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [retryReleaseLoading, setRetryReleaseLoading] = useState(false);

  // Cached state for cross-component computations
  const [report, setReport] = useState<AiVerificationReport | null>(null);
  const [payment, setPayment] = useState<ProjectPayment | null>(null);

  // Set document title
  useEffect(() => {
    document.title = 'Review submission - CodeBridge';
  }, []);

  // 1. Fetch Project
  const {
    data: project,
    isLoading: isProjectLoading,
    isError: isProjectError,
    error: projectError,
  } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectApi.getProject(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });

  // 2. Fetch Current Submission
  const {
    data: submission,
    isLoading: isSubmissionLoading,
    isError: isSubmissionError,
    refetch: refetchSubmission,
  } = useQuery<CurrentSubmission>({
    queryKey: ['review-submission', projectId],
    queryFn: () => reviewApi.getCurrentSubmission(projectId),
    enabled: !!projectId,
    staleTime: 10_000,
  });

  // 3. Fetch Automated Run
  const submissionId = submission?.submissionId || '';
  const {
    data: run,
    isLoading: isRunLoading,
    isError: isRunError,
    refetch: refetchRun,
  } = useQuery<AutomatedRun | null>({
    queryKey: ['verification-run', submissionId],
    queryFn: () => (submissionId ? verificationApi.getAutomatedRun(submissionId) : Promise.resolve(null)),
    enabled: !!submissionId && submission?.status === 'in_review',
    staleTime: 15_000,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    queryClient.invalidateQueries({ queryKey: ['review-submission', projectId] });
    queryClient.invalidateQueries({ queryKey: ['verification-run', submissionId] });
    queryClient.invalidateQueries({ queryKey: ['project-payment', projectId] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  };

  const handleActionSuccess = (msg: string) => {
    setLiveAnnouncement(msg);
    invalidateAll();
  };

  const handleRetryRelease = async () => {
    setRetryReleaseLoading(true);
    try {
      await paymentApi.releasePayment(projectId);
      setLiveAnnouncement(`Payment release completed successfully.`);
      invalidateAll();
    } catch {
      setLiveAnnouncement('Payment release retry failed. Please try again.');
    } finally {
      setRetryReleaseLoading(false);
    }
  };

  // Error boundary / Project Not Found / Forbidden states
  if (isProjectError) {
    const status = (projectError as any)?.status || (projectError as any)?.response?.status;
    const isForbidden = status === 403;
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-text">
          {isForbidden ? "You can't review this submission" : 'Project Not Found'}
        </h1>
        <p className="text-sm text-text-muted max-w-md mx-auto">
          {isForbidden
            ? 'Only the project owner has authorization to inspect and approve submission milestones.'
            : 'The requested project could not be found or has been archived.'}
        </p>
        <div>
          <Link to="/owner">
            <Button variant="primary">Return to Owner Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isProjectLoading || isSubmissionLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-6">
        <div className="h-6 w-64 bg-surface-raised animate-pulse rounded" />
        <div className="h-10 w-96 bg-surface-raised animate-pulse rounded" />
        <div className="h-64 bg-surface-raised animate-pulse rounded-xl" />
      </div>
    );
  }

  if (isSubmissionError || !submission) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-text">Failed to load submission</h1>
        <p className="text-sm text-text-muted">
          Unable to communicate with the review service to inspect this submission.
        </p>
        <Button variant="outline" onClick={() => refetchSubmission()}>
          <RefreshCw className="w-4 h-4 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  // Derive guard inputs:
  const runSummary = run
    ? {
        status: run.status,
        requiredFailed: run.checks.filter(
          (c) => c.required && (c.status === 'failed' || c.status === 'error' || c.status === 'timed_out')
        ).length,
        requiredTotal: run.checks.filter((c) => c.required).length,
      }
    : null;

  const paymentState = payment?.state ?? 'unrequested';
  const guard = computeDecisionGuard({
    projectStatus: project?.status,
    submissionStatus: submission.status,
    paymentState,
    run: runSummary,
  });

  const submissionStatus = submission.status;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Aria Live Announcement Region */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveAnnouncement}
      </div>

      {/* Header and Breadcrumb */}
      <header className="space-y-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-text-muted">
          <Link to="/owner" className="hover:text-text transition-colors">
            Owner dashboard
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link to={`/owner/projects/${projectId}`} className="hover:text-text transition-colors truncate max-w-xs">
            {project?.title || 'Project'}
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-text font-medium">Review</span>
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <div className="md:col-span-2 space-y-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-text">
              Review submission
            </h1>

            <div className="flex flex-wrap items-center gap-2">
              <Chip
                size="sm"
                tone={
                  submissionStatus === 'in_review'
                    ? 'primary'
                    : submissionStatus === 'approved'
                    ? 'success'
                    : submissionStatus === 'changes_requested'
                    ? 'warning'
                    : 'neutral'
                }
                label={
                  submissionStatus === 'in_review'
                    ? 'In review'
                    : submissionStatus === 'approved'
                    ? 'Approved'
                    : submissionStatus === 'changes_requested'
                    ? 'Changes requested'
                    : 'Waiting for submission'
                }
              />

              {submission.versionCount > 0 && (
                <Chip
                  size="sm"
                  tone="neutral"
                  label={`Submission ${submission.version} of ${submission.versionCount}`}
                />
              )}

              {submission.commitSha && (
                <Chip
                  size="sm"
                  tone="neutral"
                  icon={<GitCommit className="w-3 h-3" />}
                  label={<span className="font-mono">{shortSha(submission.commitSha)}</span>}
                />
              )}

              {submission.developerName && (
                <Chip
                  size="sm"
                  tone="neutral"
                  icon={<User className="w-3 h-3" />}
                  label={submission.developerName}
                />
              )}
            </div>
          </div>

          {/* Side Payment Card */}
          <div className="md:col-span-1">
            <PaymentCard projectId={projectId} onPaymentChange={setPayment} />
          </div>
        </div>
      </header>

      {/* Global State Banners by submission status */}
      {submissionStatus === 'none' && (
        <div className="p-8 text-center rounded-xl border border-dashed border-border bg-surface space-y-3">
          <Clock className="w-10 h-10 text-text-muted mx-auto" />
          <h2 className="text-base font-semibold text-text">Waiting for the developer's submission.</h2>
          <p className="text-xs text-text-muted max-w-sm mx-auto">
            The assigned developer is currently working on the task. Once they push commits and submit their solution, automated tests and verification reports will be shown here.
          </p>
        </div>
      )}

      {submissionStatus === 'changes_requested' && (
        <div className="p-6 rounded-xl border border-warning/40 bg-warning/5 space-y-3">
          <div className="flex items-center gap-2 text-warning font-semibold text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>Changes requested</span>
          </div>
          {submission.feedback && (
            <p className="text-sm text-text bg-surface p-3.5 rounded-lg border border-border whitespace-pre-wrap font-sans">
              {submission.feedback}
            </p>
          )}
          <p className="text-xs text-text-muted">
            Waiting for the developer to resubmit with required adjustments.
          </p>
        </div>
      )}

      {submissionStatus === 'approved' && (
        <div className="space-y-4">
          <div className="p-6 rounded-xl border border-success/40 bg-success/5 space-y-2">
            <div className="flex items-center gap-2 text-success font-semibold text-sm">
              <BadgeCheck className="w-5 h-5" />
              <span>
                Approved{submission.decidedAt ? ` on ${new Date(submission.decidedAt).toLocaleDateString()}` : ''}.
              </span>
            </div>
            <p className="text-xs text-text-muted">
              Milestone work has been verified and confirmed.
            </p>
          </div>

          {/* Release pending banner with Retry button */}
          {payment?.state === 'release_pending' && (
            <div className="p-4 rounded-xl border border-warning/50 bg-warning/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-xs text-text font-medium">
                <Clock className="w-4 h-4 text-warning shrink-0" />
                <span>Approved. Payment release is pending.</span>
              </div>
              <Button
                size="sm"
                variant="primary"
                onClick={handleRetryRelease}
                disabled={retryReleaseLoading}
              >
                {retryReleaseLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Releasing…
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Retry release
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Mandatory Order of Sections:
          1. Submission
          2. Automated check results
          3. AI requirement verification (when flag is on)
          4. Decision (when in_review) */}
      {submissionStatus === 'in_review' && (
        <div className="space-y-8">
          {/* Section 1: Submission */}
          <SubmissionSection submission={submission} run={run || null} />

          {/* Section 2: Automated check results */}
          <AutomatedRunSection
            run={run || null}
            isLoading={isRunLoading}
            isError={isRunError}
            onRetry={refetchRun}
          />

          {/* Section 3: AI requirement verification (when flag is on) */}
          {FEATURES.AI_VERIFICATION && (
            <AiVerificationSection
              submissionId={submission.submissionId}
              run={run || null}
              onReportChange={setReport}
            />
          )}

          {/* Section 4: Decision Bar */}
          <DecisionBar
            guard={guard}
            amount={payment?.amount ?? 0}
            onRequestChanges={() => setIsChangesOpen(true)}
            onApprove={() => setIsApproveOpen(true)}
          />
        </div>
      )}

      {/* Approve and Release Dialog */}
      <ApproveDialog
        isOpen={isApproveOpen}
        onClose={() => setIsApproveOpen(false)}
        projectId={projectId}
        submission={submission}
        run={run || null}
        report={report}
        payment={payment}
        needsAcknowledgment={guard.needsAcknowledgment}
        onSuccess={handleActionSuccess}
        onReload={invalidateAll}
      />

      {/* Request Changes Dialog */}
      <ChangesDialog
        isOpen={isChangesOpen}
        onClose={() => setIsChangesOpen(false)}
        projectId={projectId}
        submission={submission}
        run={run || null}
        report={report}
        onSuccess={handleActionSuccess}
      />
    </div>
  );
};

export default ReviewPage;
