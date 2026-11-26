import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { AlertCircle } from "lucide-react";

export interface NumberFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
  hint?: string;
  prefix?: string;
}

export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(
  ({ label, error, hint, prefix = "₹", id, className = "", ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const hintId = `${inputId}-hint`;
    const errorId = `${inputId}-error`;

    const describedBy = [hint ? hintId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ");

    return (
      <div className="flex flex-col gap-1.5 min-w-0">
        <label htmlFor={inputId} className="text-sm font-medium text-text">
          {label}
        </label>
        <div className="relative flex items-center">
          {prefix && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 font-mono text-sm font-medium text-muted-foreground"
            >
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            type="number"
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={describedBy || undefined}
            className={[
              "h-10 w-full rounded-xl border bg-background py-2 pr-3.5 font-mono tabular-nums text-sm text-foreground placeholder:text-muted-foreground/75",
              "transition-colors duration-fast outline-none",
              "focus-visible:ring-3",
              prefix ? "pl-8" : "pl-3.5",
              error
                ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
                : "border-input hover:border-muted-foreground/60 focus-visible:border-ring focus-visible:ring-ring/25",
              className,
            ]
              .filter(Boolean)
              .join(" ")}
            {...props}
          />
        </div>
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

NumberField.displayName = "NumberField";
