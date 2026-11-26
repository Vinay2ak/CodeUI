import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Folder,
  FileCode2,
  ChevronRight,
  ArrowUp,
  ExternalLink,
  Lock,
  GitBranch,
  GitCommit,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/Button";
import { githubReadOnlyApi, type ProjectRepoStatus } from "@/services/github/api";
import { getLanguageForFile, highlightCode } from "./highlight";

interface ReadOnlyRepoViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  repoStatus: ProjectRepoStatus;
}

function formatBytes(size: number): string {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  return `${(size / 1024).toFixed(1)} KB`;
}

export const ReadOnlyRepoViewer: React.FC<ReadOnlyRepoViewerProps> = ({
  open,
  onOpenChange,
  projectId,
  repoStatus,
}) => {
  const [activeTab, setActiveTab] = useState<"files" | "commits">("files");
  const [currentDir, setCurrentDir] = useState<string>("");
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>(repoStatus.defaultBranch || "main");
  const [copiedFile, setCopiedFile] = useState(false);

  useEffect(() => {
    setSelectedBranch(repoStatus.defaultBranch || "main");
    setCurrentDir("");
    setSelectedFilePath(null);
    setActiveTab("files");
  }, [projectId, repoStatus.fullName, repoStatus.defaultBranch]);

  const branchesQuery = useQuery({
    queryKey: ["github-ro", projectId, "branches", repoStatus.fullName],
    queryFn: () => githubReadOnlyApi.listBranches(projectId, repoStatus.fullName),
    enabled: open && Boolean(projectId),
    staleTime: 60_000,
  });

  const dirQuery = useQuery({
    queryKey: ["github-ro", projectId, "dir", currentDir, selectedBranch, repoStatus.fullName],
    queryFn: () =>
      githubReadOnlyApi.getContents(projectId, currentDir, selectedBranch, repoStatus.fullName),
    enabled: open && activeTab === "files" && Boolean(projectId),
    retry: 0,
  });

  const fileQuery = useQuery({
    queryKey: ["github-ro", projectId, "file", selectedFilePath, selectedBranch, repoStatus.fullName],
    queryFn: () =>
      githubReadOnlyApi.getContents(
        projectId,
        selectedFilePath || "",
        selectedBranch,
        repoStatus.fullName
      ),
    enabled: open && activeTab === "files" && Boolean(selectedFilePath),
    retry: 0,
  });

  const commitsQuery = useQuery({
    queryKey: ["github-ro", projectId, "commits", selectedBranch, repoStatus.fullName],
    queryFn: () =>
      githubReadOnlyApi.listCommits(projectId, selectedBranch, repoStatus.fullName),
    enabled: open && activeTab === "commits" && Boolean(projectId),
    retry: 0,
  });

  // Auto-open README or first file when root directory loads and no file is selected
  useEffect(() => {
    if (
      open &&
      activeTab === "files" &&
      !selectedFilePath &&
      dirQuery.data?.kind === "dir" &&
      dirQuery.data.entries.length > 0
    ) {
      const readme = dirQuery.data.entries.find(
        (e) => e.type === "file" && /^readme/i.test(e.name)
      );
      const firstFile = readme || dirQuery.data.entries.find((e) => e.type === "file");
      if (firstFile) {
        setSelectedFilePath(firstFile.path);
      }
    }
  }, [open, activeTab, selectedFilePath, dirQuery.data]);

  const fileContent = fileQuery.data?.content || "";
  const language = useMemo(
    () => (selectedFilePath ? getLanguageForFile(selectedFilePath) : "plaintext"),
    [selectedFilePath]
  );
  const highlighted = useMemo(
    () => highlightCode(fileContent, language),
    [fileContent, language]
  );
  const lines = useMemo(() => highlighted.split("\n"), [highlighted]);

  const breadcrumbs = useMemo(() => {
    if (!currentDir) return [];
    const parts = currentDir.split("/").filter(Boolean);
    return parts.map((name, idx) => ({
      name,
      path: parts.slice(0, idx + 1).join("/"),
    }));
  }, [currentDir]);

  const handleGoUp = () => {
    if (!currentDir) return;
    const parts = currentDir.split("/").filter(Boolean);
    parts.pop();
    setCurrentDir(parts.join("/"));
  };

  const handleCopyCode = () => {
    if (!fileContent) return;
    navigator.clipboard?.writeText(fileContent);
    setCopiedFile(true);
    toast.success(`Copied ${selectedFilePath}`);
    setTimeout(() => setCopiedFile(false), 1600);
  };

  const branches = branchesQuery.data || [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-4xl lg:max-w-5xl bg-card border-l border-border p-0 flex flex-col gap-0 overflow-hidden"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b border-border pr-12 space-y-2 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-base font-bold text-foreground flex items-center gap-2 flex-wrap">
                <span className="font-mono break-all">{repoStatus.fullName}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-background border border-border text-muted">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  Read-only
                </span>
                {repoStatus.isPrivate && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-warning-bg text-warning border border-warning-border">
                    Private
                  </span>
                )}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted mt-0.5">
                {repoStatus.description ||
                  "Browse repository files, folders, and commit history in read-only mode."}
              </SheetDescription>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {branches.length > 0 ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-border bg-background text-xs">
                  <GitBranch className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                  <select
                    aria-label="Select branch"
                    value={selectedBranch}
                    onChange={(e) => {
                      setSelectedBranch(e.target.value);
                      setCurrentDir("");
                      setSelectedFilePath(null);
                    }}
                    className="bg-transparent font-mono text-xs text-foreground focus:outline-none cursor-pointer"
                  >
                    {branches.map((b) => (
                      <option key={b.name} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-border bg-background text-xs font-mono text-muted">
                  <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
                  {selectedBranch}
                </span>
              )}

              {repoStatus.htmlUrl && (
                <a
                  href={repoStatus.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-raised text-xs font-medium text-foreground transition-colors"
                >
                  <span>Open on GitHub</span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>

          {/* Sub-navigation Tabs */}
          <div className="flex items-center justify-between pt-1">
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-background border border-border">
              <button
                type="button"
                onClick={() => setActiveTab("files")}
                className={`px-3.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === "files"
                    ? "bg-card text-foreground font-semibold shadow-xs border border-border"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Files
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("commits")}
                className={`px-3.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === "commits"
                    ? "bg-card text-foreground font-semibold shadow-xs border border-border"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Commits
              </button>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (activeTab === "files") {
                  dirQuery.refetch();
                  if (selectedFilePath) fileQuery.refetch();
                } else {
                  commitsQuery.refetch();
                }
              }}
              className="text-xs h-7"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
              Refresh
            </Button>
          </div>
        </SheetHeader>

        {/* Body */}
        {activeTab === "files" ? (
          <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
            {/* Left File Tree */}
            <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-border bg-background/60 flex flex-col min-h-[180px] max-h-[240px] md:max-h-none shrink-0 overflow-hidden">
              {/* Path Breadcrumb */}
              <div className="px-3 py-2 border-b border-border flex items-center gap-1 text-xs font-mono overflow-x-auto whitespace-nowrap shrink-0">
                <button
                  type="button"
                  onClick={() => setCurrentDir("")}
                  className="text-primary dark:text-accent hover:underline font-semibold cursor-pointer"
                >
                  root
                </button>
                {breadcrumbs.map((crumb) => (
                  <React.Fragment key={crumb.path}>
                    <ChevronRight className="h-3 w-3 text-muted shrink-0" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={() => setCurrentDir(crumb.path)}
                      className="text-foreground hover:underline cursor-pointer"
                    >
                      {crumb.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-0.5 text-xs">
                {currentDir && (
                  <button
                    type="button"
                    onClick={handleGoUp}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-card text-muted hover:text-foreground transition-colors cursor-pointer"
                  >
                    <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="font-mono">..</span>
                  </button>
                )}

                {dirQuery.isLoading ? (
                  <div className="p-4 text-center text-muted">Loading repository tree...</div>
                ) : dirQuery.isError ? (
                  <div className="p-3 rounded-xl border border-danger-border bg-danger-bg text-danger space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                      <span className="leading-relaxed">
                        {(dirQuery.error as Error)?.message || "Unable to read repository tree."}
                      </span>
                    </div>
                  </div>
                ) : dirQuery.data?.entries.length === 0 ? (
                  <div className="p-4 text-center text-muted">Empty directory</div>
                ) : (
                  dirQuery.data?.entries.map((entry) => {
                    const isDir = entry.type === "dir";
                    const isSelected = !isDir && selectedFilePath === entry.path;
                    return (
                      <button
                        key={entry.path}
                        type="button"
                        onClick={() => {
                          if (isDir) {
                            setCurrentDir(entry.path);
                          } else {
                            setSelectedFilePath(entry.path);
                          }
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-card text-foreground font-semibold border border-border shadow-xs"
                            : "text-foreground/90 hover:bg-card/80"
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          {isDir ? (
                            <Folder className="h-3.5 w-3.5 text-primary dark:text-accent shrink-0" aria-hidden="true" />
                          ) : (
                            <FileCode2 className="h-3.5 w-3.5 text-muted shrink-0" aria-hidden="true" />
                          )}
                          <span className="truncate font-mono">{entry.name}</span>
                        </span>
                        {!isDir && entry.size > 0 && (
                          <span className="text-[10px] font-mono text-muted shrink-0">
                            {formatBytes(entry.size)}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Read-Only Code Viewer */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-card overflow-hidden">
              {selectedFilePath ? (
                <>
                  <div className="px-4 py-2 border-b border-border bg-background/40 flex items-center justify-between gap-3 text-xs shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-foreground font-medium truncate">
                        {selectedFilePath}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-background border border-border font-mono text-[10px] text-muted shrink-0">
                        {language}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyCode}
                      disabled={!fileContent}
                      className="h-7 text-xs shrink-0"
                    >
                      {copiedFile ? (
                        <>
                          <Check className="h-3.5 w-3.5 mr-1 text-success" aria-hidden="true" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                          <span>Copy</span>
                        </>
                      )}
                    </Button>
                  </div>

                  {fileQuery.isLoading ? (
                    <div className="flex-1 flex items-center justify-center text-xs text-muted">
                      Loading file content...
                    </div>
                  ) : fileQuery.isError ? (
                    <div className="p-6 text-xs text-danger">
                      {(fileQuery.error as Error)?.message || "Unable to read this file."}
                    </div>
                  ) : fileQuery.data?.isBinary ? (
                    <div className="flex-1 flex items-center justify-center p-6 text-xs text-muted">
                      Binary file preview is disabled in read-only mode.
                    </div>
                  ) : (
                    <div className="flex-1 flex overflow-auto bg-background/30">
                      <div
                        aria-hidden="true"
                        className="w-12 py-3 bg-background/60 border-r border-border text-muted font-mono text-xs text-right pr-2.5 select-none shrink-0 leading-6"
                      >
                        {Array.from({ length: lines.length }).map((_, i) => (
                          <div key={i + 1}>{i + 1}</div>
                        ))}
                      </div>
                      <pre className="flex-1 p-3 font-mono text-xs leading-6 overflow-auto whitespace-pre">
                        <code
                          className={`hljs language-${language}`}
                          dangerouslySetInnerHTML={{ __html: highlighted }}
                        />
                      </pre>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-muted space-y-2">
                  <FileCode2 className="h-6 w-6 text-muted" aria-hidden="true" />
                  <p>Select any file from the left tree to inspect source code (read-only).</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Commits Tab */
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {commitsQuery.isLoading ? (
              <div className="text-center text-xs text-muted py-8">Loading commit history...</div>
            ) : commitsQuery.isError ? (
              <div className="p-4 rounded-xl border border-danger-border bg-danger-bg text-xs text-danger">
                {(commitsQuery.error as Error)?.message || "Unable to load commits."}
              </div>
            ) : (commitsQuery.data || []).length === 0 ? (
              <div className="text-center text-xs text-muted py-8">No commits found.</div>
            ) : (
              (commitsQuery.data || []).map((c) => (
                <div
                  key={c.sha}
                  className="p-4 rounded-2xl border border-border bg-background flex items-start justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground break-words [overflow-wrap:anywhere]">
                      {c.message}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="font-mono inline-flex items-center gap-1 text-primary dark:text-accent">
                        <GitCommit className="h-3.5 w-3.5" aria-hidden="true" />
                        {c.shortSha}
                      </span>
                      {c.authorName && (
                        <>
                          <span>·</span>
                          <span>{c.authorName}</span>
                        </>
                      )}
                      {c.committedAt && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-[11px]">
                            {new Date(c.committedAt).toLocaleString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {c.htmlUrl && (
                    <a
                      href={c.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted hover:text-foreground inline-flex items-center gap-1 shrink-0"
                    >
                      <span>View</span>
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
