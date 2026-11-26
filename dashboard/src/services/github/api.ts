import { http } from '../../lib/http';
import type { RepoStatusResponse, ConnectRepoResponse } from './types';
import { adaptRepoStatusResponse, adaptConnectRepoResponse } from './adapters';

export const githubApi = {
  connectRepo: async (projectId: string, repoUrl: string): Promise<ConnectRepoResponse> => {
    const res = await http.post<any>(`/api/v1/projects/${projectId}/github/connect`, { repoUrl });
    return adaptConnectRepoResponse(res);
  },

  getRepoStatus: async (projectId: string): Promise<RepoStatusResponse> => {
    const res = await http.get<any>(`/api/v1/projects/${projectId}/github/status`);
    return adaptRepoStatusResponse(res);
  },
};

export const connectRepo = githubApi.connectRepo;
export const getRepoStatus = githubApi.getRepoStatus;
