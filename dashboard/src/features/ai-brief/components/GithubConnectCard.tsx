import React from 'react';
import { Lock, Loader2, CheckCircle2, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import type { RepoInfo, AiFlowError, AiFlowPhase } from '../types';
import { Button } from '../../../components/ui/button';
import { env } from '../../../lib/env';

export interface GithubConnectCardProps {
  repoUrl: string;
  repo: RepoInfo | null;
  phase: AiFlowPhase;
  error: AiFlowError | null;
  authorizeUrl?: string | null;
  onConnect: () => void;
  onCheckStatus: () => void;
  onRetry: () => void;
}

export const GithubConnectCard: React.FC<GithubConnectCardProps> = ({
  repoUrl,
  repo,
  phase,
  error,
  authorizeUrl,
  onConnect,
  onCheckStatus,
  onRetry,
}) => {
  const isGithubOff = env.VITE_GITHUB_MODE === 'off' && !env.VITE_USE_MOCKS;
  const isConnecting = phase === 'connecting_repo';
  const isGithubError = phase === 'error' && error?.where === 'github';

  const getErrorMessage = (code?: string) => {
    switch (code) {
      case 'REPO_NOT_FOUND':
        return "We can't find that repository.";
      case 'ACCESS_DENIED':
        return 'Access was not granted.';
      case 'GITHUB_UNAVAILABLE':
        return 'GitHub is not responding.';
      default:
        return error?.message || 'Unable to connect to GitHub. Please try again.';
    }
  };

  if (isGithubOff) {
    return (
      <div className="p-4 rounded-lg bg-surface-raised border border-border text-sm text-text-muted">
        GitHub connection isn&apos;t available in this environment.
      </div>
    );
  }

  if (!repoUrl || repoUrl.trim().length === 0) {
    return (
      <div className="p-4 rounded-lg bg-surface-raised border border-border text-sm text-text-muted">
        Add a GitHub repository URL above to enable the repository scan.
      </div>
    );
  }

  if (repo) {
    return (
      <div className="p-4 rounded-lg bg-surface-raised border border-border space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-success font-medium">
            <CheckCircle2 className="w-4 h-4 text-success" strokeWidth={1.5} />
            <span>Repository connected successfully.</span>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-surface border border-border text-text-muted">
            <Lock className="w-3 h-3 text-text-muted" strokeWidth={1.5} />
            Read-only access
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-text-muted pt-1">
          <span className="text-text font-medium">{repo.fullName}</span>
          <span>&bull;</span>
          <span>branch: {repo.defaultBranch}</span>
          <span>&bull;</span>
          <span>commit: {repo.headCommitSha.substring(0, 7)}</span>
        </div>
      </div>
    );
  }

  if (authorizeUrl) {
    return (
      <div className="p-4 rounded-lg bg-surface-raised border border-border space-y-3">
        <div className="text-sm font-medium text-text">GitHub authorization required</div>
        <p className="text-xs text-text-muted">
          Authorize CodeBridge to verify repository read permissions.
        </p>
        <div className="flex items-center gap-3">
          <a
            href={authorizeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-primary text-on-primary hover:bg-primary/90 transition-colors"
          >
            Authorize on GitHub
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
          </a>
          <Button type="button" variant="outline" size="sm" onClick={onCheckStatus}>
            Check status
          </Button>
        </div>
      </div>
    );
  }

  if (isGithubError) {
    return (
      <div className="p-4 rounded-lg bg-surface-raised border border-danger/40 space-y-2">
        <div className="flex items-center gap-2 text-sm text-danger font-medium">
          <AlertCircle className="w-4 h-4 text-danger" strokeWidth={1.5} />
          <span>Unable to connect to GitHub. Please try again.</span>
        </div>
        <p className="text-xs text-text-muted">{getErrorMessage(error?.code)}</p>
        <div className="pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg bg-surface-raised border border-border space-y-2.5">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onConnect}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin text-primary" strokeWidth={1.5} />
              <span aria-live="polite">Connecting to GitHub…</span>
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5 mr-1.5 text-text-muted" strokeWidth={1.5} />
              Connect repository (read-only)
            </>
          )}
        </Button>
      </div>
      <p className="text-xs text-text-muted">
        CodeBridge never asks for your GitHub password. Access is read-only.
      </p>
    </div>
  );
};
