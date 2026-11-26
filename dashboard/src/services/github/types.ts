import type { RepoInfo, RepoStatusResponse } from '../../features/ai-brief/types';

export type { RepoInfo, RepoStatusResponse };

export interface ConnectRepoResponse {
  status: 'not_connected' | 'pending' | 'connected' | 'error' | 'revoked';
  authorizeUrl?: string | null;
  repo?: RepoInfo | null;
  error?: { code: string; message: string } | null;
}
