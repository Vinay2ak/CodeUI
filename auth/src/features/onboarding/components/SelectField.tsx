import { forwardRef, useId, useMemo } from "react";
import { AlertCircle } from "lucide-react";
import { Select, type SelectOption as UISelectOption } from "../../../components/ui/Select";

export type SelectOption =
  | string
  | {
      value: string;
      label: string;
      description?: string;
      disabled?: boolean;
      tone?: "success" | "primary" | "muted";
    };

export interface SelectFieldProps {
  id?: string;
  name?: string;
  label: string;
  options: readonly SelectOption[];
  value?: string;
  defaultValue?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  onChange?: (e: { target: { value: string; name?: string } } | any) => void;
  onBlur?: () => void;
}

export const SelectField = forwardRef<any, SelectFieldProps>(
  (
    {
      label,
      options,
      value,
      defaultValue,
      error,
      hint,
      id,
      name,
      disabled = false,
      required = false,
      placeholder = "Select…",
      className = "",
      onChange,
      onBlur,
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const labelId = `${selectId}-label`;
    const hintId = `${selectId}-hint`;
    const errorId = `${selectId}-error`;

    const describedBy = [hint ? hintId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ");

    const normalizedOptions = useMemo<UISelectOption[]>(() => {
      return options.map((opt) => {
        if (typeof opt === "string") {
          return { value: opt, label: opt };
        }
        return {
          value: opt.value,
          label: opt.label,
          description: opt.description,
          disabled: opt.disabled,
          tone: opt.tone,
        };
      });
    }, [options]);

    const handleChange = (newVal: string) => {
      if (onChange) {
        onChange({
          target: {
            value: newVal,
            name: name ?? "",
          },
        });
      }
    };

    return (
      <div className="flex flex-col gap-1.5 min-w-0">
        <label id={labelId} htmlFor={selectId} className="text-sm font-medium text-text">
          {label}
        </label>
        <Select
          ref={ref}
          id={selectId}
          name={name}
          value={value ?? defaultValue}
          options={normalizedOptions}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          invalid={Boolean(error)}
          aria-labelledby={labelId}
          aria-describedby={describedBy || undefined}
          className={className}
          onChange={handleChange}
          onBlur={onBlur}
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

SelectField.displayName = "SelectField";
