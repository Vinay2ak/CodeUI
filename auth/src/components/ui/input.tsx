import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  rightAdornment?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, rightAdornment, id, className = "", type, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    const describedBy = [hint ? hintId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ");

    const hasWrapper =
      label !== undefined ||
      error !== undefined ||
      hint !== undefined ||
      rightAdornment !== undefined;

    if (!hasWrapper) {
      return (
        <input
          ref={ref}
          id={id}
          type={type}
          data-slot="input"
          className={cn(
            "h-10 w-full min-w-0 rounded-xl border border-input bg-background px-3.5 py-2 text-sm text-foreground transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/75 hover:border-muted-foreground/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
            className
          )}
          {...props}
        />
      );
    }

    return (
      <div className="flex flex-col gap-1.5">
        {label !== undefined && (
          <label htmlFor={inputId} className="text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <input
            ref={ref}
            id={inputId}
            type={type}
            data-slot="input"
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={describedBy || undefined}
            className={cn(
              "h-10 w-full rounded-xl border bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/75",
              "transition-colors duration-fast outline-none",
              "focus-visible:ring-3",
              error
                ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
                : "border-input hover:border-muted-foreground/60 focus-visible:border-ring focus-visible:ring-ring/25",
              rightAdornment ? "pr-11" : "",
              className
            )}
            {...props}
          />
          {rightAdornment && (
            <div className="absolute right-2 flex items-center">{rightAdornment}</div>
          )}
        </div>
        {hint && !error && (
          <p id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
        <div className="min-h-[1.25rem]">
          {error && (
            <p id={errorId} role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}
        </div>
      </div>
    );
  }
);

Input.displayName = "Input";
