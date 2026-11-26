import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ShieldCheck, X } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { TextField } from "./TextField";

export interface GitHubDialogProps {
  open: boolean;
  onClose: () => void;
  onAuthorize: (githubUsername: string) => void;
  initialUsername?: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function GitHubDialog({
  open,
  onClose,
  onAuthorize,
  initialUsername,
}: GitHubDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState(initialUsername?.trim() || "demo-dev");
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousFocus = document.activeElement as HTMLElement | null;
    setUsername(initialUsername?.trim() || "demo-dev");
    setError(undefined);

    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );
      if (focusables.length === 0) {
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [open, initialUsername, onClose]);

  if (!open) {
    return null;
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = username.trim().replace(/^@/, "");
    if (!trimmed) {
      setError("Enter a GitHub handle to simulate authorization.");
      inputRef.current?.focus();
      return;
    }
    onAuthorize(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 id={titleId} className="text-base font-semibold text-foreground">
              Simulated GitHub authorization
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <ul className="mb-5 space-y-2 rounded-xl border border-border bg-background p-3.5 text-xs text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary font-semibold" aria-hidden="true">•</span>
            <span>Read-only access to repositories you choose later</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-semibold" aria-hidden="true">•</span>
            <span>No write access to your code</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-semibold" aria-hidden="true">•</span>
            <span>CodeBridge never asks for your GitHub password</span>
          </li>
        </ul>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <TextField
            ref={inputRef}
            label="Simulated GitHub handle"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              if (error) {
                setError(undefined);
              }
            }}
            placeholder="demo-dev"
            error={error}
            hint="Used locally to simulate OAuth authorization."
          />

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Authorize (simulated)
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
