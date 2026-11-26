import { request } from "../../lib/http";
import type { GitHubHandoffStatus } from "../project/types";

export interface ProjectRepoStatus {
  connected: boolean;
  fullName: string;
  htmlUrl: string | null;
  defaultBranch: string;
  isPrivate: boolean;
  description: string | null;
  source: "github_service" | "project_url" | "placeholder";
}

export interface RepoContentEntry {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink" | "submodule" | "other";
  size: number;
  sha: string;
}

export interface RepoContentsResult {
  fullName: string;
  ref: string | null;
  path: string;
  kind: "file" | "dir";
  sha: string | null;
  size: number | null;
  isBinary: boolean;
  truncated: boolean;
  content: string | null;
  entries: RepoContentEntry[];
}

export interface RepoBranchItem {
  name: string;
  commitSha: string;
  protected: boolean;
}

export interface RepoCommitItem {
  sha: string;
  shortSha: string;
  message: string;
  authorName: string | null;
  authorLogin: string | null;
  committedAt: string | null;
  htmlUrl: string | null;
}

function isRealGitHubFullName(fullName?: string | null): boolean {
  if (!fullName) return false;
  const trimmed = fullName.trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(trimmed)) return false;
  // CodeBridge placeholder repos generated when no real GitHub URL is attached
  if (trimmed.startsWith("codebridge/") && trimmed !== "codebridge/payments-service") {
    return false;
  }
  return trimmed !== "codebridge/payments-service";
}

function decodeBase64Utf8(base64Raw: string): string {
  const cleaned = base64Raw.replace(/\s+/g, "");
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function sortEntries(entries: RepoContentEntry[]): RepoContentEntry[] {
  return [...entries].sort((a, b) => {
    if (a.type === "dir" && b.type !== "dir") return -1;
    if (a.type !== "dir" && b.type === "dir") return 1;
    return a.name.localeCompare(b.name);
  });
}

export const githubReadOnlyApi = {
  async getProjectRepoStatus(
    projectId: string,
    fallback?: GitHubHandoffStatus
  ): Promise<ProjectRepoStatus> {
    try {
      const res = await request<any>(`/api/v1/projects/${projectId}/github/status`);
      if (res?.connected && res?.repository) {
        const repo = res.repository;
        const fullName = String(repo.full_name || `${repo.owner_login}/${repo.repository_name}`);
        return {
          connected: true,
          fullName,
          htmlUrl: repo.html_url || `https://github.com/${fullName}`,
          defaultBranch: String(repo.default_branch || fallback?.defaultBranch || "main"),
          isPrivate: Boolean(repo.is_private),
          description: repo.description ? String(repo.description) : null,
          source: "github_service",
        };
      }
    } catch {
      // Fallback to project metadata URL if github-service has no linked OAuth record
    }

    if (fallback?.repoUrl) {
      return {
        connected: true,
        fullName: fallback.repoName,
        htmlUrl: fallback.repoUrl,
        defaultBranch: fallback.defaultBranch || "main",
        isPrivate: Boolean(fallback.isPrivate),
        description: fallback.description || null,
        source: "project_url",
      };
    }

    if (fallback?.repoName && isRealGitHubFullName(fallback.repoName)) {
      return {
        connected: true,
        fullName: fallback.repoName,
        htmlUrl: `https://github.com/${fallback.repoName}`,
        defaultBranch: fallback.defaultBranch || "main",
        isPrivate: Boolean(fallback.isPrivate),
        description: fallback.description || null,
        source: "project_url",
      };
    }

    return {
      connected: false,
      fullName: fallback?.repoName || "Repository not linked",
      htmlUrl: null,
      defaultBranch: fallback?.defaultBranch || "main",
      isPrivate: false,
      description: null,
      source: "placeholder",
    };
  },

  async listBranches(projectId: string, fullName?: string): Promise<RepoBranchItem[]> {
    try {
      const res = await request<any>(`/api/v1/projects/${projectId}/github/branches`);
      if (Array.isArray(res?.items)) {
        return res.items.map((b: any) => ({
          name: String(b.name),
          commitSha: String(b.commit_sha || b.commitSha || ""),
          protected: Boolean(b.protected),
        }));
      }
    } catch {
      // Fallback to public GitHub API if accessible
    }

    if (fullName && isRealGitHubFullName(fullName)) {
      const resp = await fetch(`https://api.github.com/repos/${fullName}/branches?per_page=30`, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (resp.ok) {
        const list = (await resp.json()) as any[];
        return list.map((b) => ({
          name: String(b.name),
          commitSha: String(b.commit?.sha || ""),
          protected: Boolean(b.protected),
        }));
      }
    }

    return [];
  },

  async getContents(
    projectId: string,
    path: string,
    ref?: string,
    fullName?: string
  ): Promise<RepoContentsResult> {
    const cleanPath = path.replace(/^\/+/, "");
    try {
      const qs = new URLSearchParams();
      if (cleanPath) qs.set("path", cleanPath);
      if (ref) qs.set("ref", ref);
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      const res = await request<any>(`/api/v1/projects/${projectId}/github/contents${suffix}`);

      if (res && (res.kind === "dir" || res.kind === "file")) {
        return {
          fullName: String(res.full_name || fullName || ""),
          ref: res.ref ?? ref ?? null,
          path: String(res.path ?? cleanPath),
          kind: res.kind,
          sha: res.sha ?? null,
          size: typeof res.size === "number" ? res.size : null,
          isBinary: Boolean(res.is_binary),
          truncated: Boolean(res.truncated),
          content: res.content ?? null,
          entries: sortEntries(
            Array.isArray(res.entries)
              ? res.entries.map((e: any) => ({
                  name: String(e.name),
                  path: String(e.path),
                  type: (e.type || "file") as RepoContentEntry["type"],
                  size: Number(e.size || 0),
                  sha: String(e.sha || ""),
                }))
              : []
          ),
        };
      }
    } catch {
      // Fallback to public GitHub REST API (read-only)
    }

    if (!fullName || !isRealGitHubFullName(fullName)) {
      throw new Error(
        "Repository read-only access is unavailable because no GitHub repository is linked to this project yet."
      );
    }

    const encodedPath = cleanPath
      .split("/")
      .filter(Boolean)
      .map(encodeURIComponent)
      .join("/");
    const refParam = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    const url = `https://api.github.com/repos/${fullName}/contents${encodedPath ? `/${encodedPath}` : ""}${refParam}`;
    const resp = await fetch(url, {
      headers: { Accept: "application/vnd.github+json" },
    });

    if (!resp.ok) {
      if (resp.status === 404) {
        throw new Error(
          `Repository "${fullName}" could not be read. If it is private, the owner needs to connect GitHub OAuth on the project.`
        );
      }
      if (resp.status === 403 || resp.status === 429) {
        throw new Error("GitHub API rate limit reached or access denied for this repository.");
      }
      throw new Error(`Unable to read repository contents (HTTP ${resp.status}).`);
    }

    const data = await resp.json();
    if (Array.isArray(data)) {
      return {
        fullName,
        ref: ref ?? null,
        path: cleanPath,
        kind: "dir",
        sha: null,
        size: null,
        isBinary: false,
        truncated: false,
        content: null,
        entries: sortEntries(
          data.map((item: any) => ({
            name: String(item.name),
            path: String(item.path),
            type: (item.type === "dir" ? "dir" : "file") as RepoContentEntry["type"],
            size: Number(item.size || 0),
            sha: String(item.sha || ""),
          }))
        ),
      };
    }

    const isBase64 = data?.encoding === "base64" && typeof data?.content === "string";
    const decoded = isBase64 ? decodeBase64Utf8(data.content) : null;
    const isBinary = decoded !== null && decoded.includes("\u0000");

    return {
      fullName,
      ref: ref ?? null,
      path: String(data?.path ?? cleanPath),
      kind: "file",
      sha: data?.sha ?? null,
      size: typeof data?.size === "number" ? data.size : null,
      isBinary,
      truncated: Boolean(data?.truncated),
      content: isBinary ? null : decoded,
      entries: [],
    };
  },

  async listCommits(
    projectId: string,
    ref?: string,
    fullName?: string
  ): Promise<RepoCommitItem[]> {
    try {
      const qs = new URLSearchParams();
      if (ref) qs.set("sha", ref);
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      const res = await request<any>(`/api/v1/projects/${projectId}/github/commits${suffix}`);
      if (Array.isArray(res?.items)) {
        return res.items.map((c: any) => ({
          sha: String(c.sha),
          shortSha: String(c.short_sha || String(c.sha).slice(0, 7)),
          message: String(c.message || ""),
          authorName: c.author_name ?? null,
          authorLogin: c.author_login ?? null,
          committedAt: c.committed_at ?? null,
          htmlUrl: c.html_url ?? null,
        }));
      }
    } catch {
      // Fallback to public GitHub API
    }

    if (fullName && isRealGitHubFullName(fullName)) {
      const qs = new URLSearchParams({ per_page: "20" });
      if (ref) qs.set("sha", ref);
      const resp = await fetch(`https://api.github.com/repos/${fullName}/commits?${qs.toString()}`, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (resp.ok) {
        const list = (await resp.json()) as any[];
        return list.map((c) => ({
          sha: String(c.sha),
          shortSha: String(c.sha).slice(0, 7),
          message: String(c.commit?.message || "").split("\n")[0],
          authorName: c.commit?.author?.name ?? null,
          authorLogin: c.author?.login ?? null,
          committedAt: c.commit?.author?.date ?? null,
          htmlUrl: c.html_url ?? null,
        }));
      }
    }

    return [];
  },
};
