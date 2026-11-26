import { CheckCircle2, Github } from "lucide-react";
import { Button } from "../../../components/ui/button";

export interface GitHubCardProps {
  mode: "mock" | "off";
  connectedUsername?: string;
  onOpenDialog?: () => void;
  onDisconnect?: () => void;
  loading?: boolean;
}

export function GitHubCard({
  mode,
  connectedUsername,
  onOpenDialog,
  onDisconnect,
  loading = false,
}: GitHubCardProps) {
  return (
    <div className="rounded-md border border-border bg-surface-raised/60 p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <Github className="h-5 w-5 shrink-0 text-text mt-0.5" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-text">GitHub connection</p>
          <p className="text-xs text-text-muted">
            CodeBridge never asks for your GitHub password. You connect repositories later with
            controlled read-only access, only for the projects you choose.
          </p>
        </div>
      </div>

      {mode === "off" ? (
        <p className="rounded-md border border-border bg-bg px-3 py-2 text-xs text-text-muted">
          GitHub connection arrives with the GitHub service. You can link it when you post a
          project.
        </p>
      ) : connectedUsername ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-bg px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>@{connectedUsername}</span>
          </span>
          <div className="flex items-center gap-2">
            {onOpenDialog && (
              <Button
                variant="secondary"
                onClick={onOpenDialog}
                disabled={loading}
                className="px-3 py-1.5 text-xs"
              >
                Change
              </Button>
            )}
            {onDisconnect && (
              <Button
                variant="ghost"
                onClick={onDisconnect}
                disabled={loading}
                className="px-2.5 py-1.5 text-xs"
              >
                Disconnect
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div>
          <Button
            variant="secondary"
            onClick={onOpenDialog}
            loading={loading}
            disabled={loading}
          >
            Link GitHub account now
          </Button>
        </div>
      )}
    </div>
  );
}
