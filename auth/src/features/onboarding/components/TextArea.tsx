import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
import { AlertCircle } from "lucide-react";

export interface TextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value"> {
  label: string;
  value: string;
  error?: string;
  hint?: string;
  maxLength?: number;
  minLength?: number;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    { label, value, error, hint, maxLength, minLength, id, className = "", rows = 4, ...props },
    ref
  ) => {
    const generatedId = useId();
    const textareaId = id ?? generatedId;
    const hintId = `${textareaId}-hint`;
    const countId = `${textareaId}-count`;
    const errorId = `${textareaId}-error`;

    const describedBy = [
      hint ? hintId : null,
      maxLength !== undefined ? countId : null,
      error ? errorId : null,
    ]
      .filter(Boolean)
      .join(" ");

    const len = value.length;
    const isOver = maxLength !== undefined && len > maxLength;
    const isInRange =
      !isOver &&
      (minLength !== undefined ? len >= minLength : len > 0) &&
      (maxLength === undefined || len <= maxLength);

    const counterColor = isOver
      ? "text-danger"
      : isInRange
        ? "text-success"
        : "text-text-muted";

    return (
      <div className="flex flex-col gap-1.5 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={textareaId} className="text-sm font-medium text-text">
            {label}
          </label>
          {maxLength !== undefined && (
            <span id={countId} className={["text-xs font-mono shrink-0", counterColor].join(" ")}>
              {len} / {maxLength}
            </span>
          )}
        </div>

        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          value={value}
          maxLength={maxLength}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy || undefined}
          className={[
            "w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/75",
            "transition-colors duration-fast resize-y outline-none",
            "focus-visible:ring-3",
            error
              ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
              : "border-input hover:border-muted-foreground/60 focus-visible:border-ring focus-visible:ring-ring/25",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />

        {hint && !error && (
          <p id={hintId} className="text-xs text-text-muted">
            {hint}
          </p>
        )}

        <div className="min-h-[1.25rem]">
          {error && (
            <p id={errorId} role="alert" className="flex items-center gap-1.5 text-xs text-danger">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}
        </div>
      </div>
    );
  }
);

TextArea.displayName = "TextArea";
