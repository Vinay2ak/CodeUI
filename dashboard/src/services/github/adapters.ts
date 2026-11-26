import type { RepoStatusResponse, ConnectRepoResponse } from './types';
import { keysToCamel } from '../../features/ai-brief/adapters';

export function adaptRepoStatusResponse(raw: unknown): RepoStatusResponse {
  const camel = keysToCamel(raw) as RepoStatusResponse;
  return {
    status: camel.status || 'not_connected',
    repo: camel.repo || null,
    authorizeUrl: camel.authorizeUrl || null,
    error: camel.error || null,
  };
}

export function adaptConnectRepoResponse(raw: unknown): ConnectRepoResponse {
  const camel = keysToCamel(raw) as ConnectRepoResponse;
  return {
    status: camel.status || 'pending',
    authorizeUrl: camel.authorizeUrl || null,
    repo: camel.repo || null,
    error: camel.error || null,
  };
}
