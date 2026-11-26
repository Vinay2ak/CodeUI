export interface OptionCardProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  label: string;
  hint?: string;
  shortcut?: string;
  accentMoney?: boolean;
  disabled?: boolean;
}

export function OptionCard({
  name,
  value,
  checked,
  onChange,
  label,
  hint,
  shortcut,
  accentMoney = false,
  disabled = false,
}: OptionCardProps) {
  return (
    <label
      className={[
        "relative flex items-start justify-between gap-3 rounded-xl border p-3.5 transition-all duration-fast active:scale-[0.99]",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        checked
          ? "border-accent bg-accent/10"
          : "border-border bg-background hover:border-muted-foreground/60",
        "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-offset-2",
      ].join(" ")}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        aria-keyshortcuts={shortcut}
        onChange={() => onChange(value)}
        className="sr-only peer"
      />
      <span className="min-w-0 flex-1 space-y-0.5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-focus-visible:outline-offset-2 rounded-sm">
        <span
          className={[
            "block text-sm",
            accentMoney ? "text-money font-semibold" : "font-medium text-foreground",
          ].join(" ")}
        >
          {label}
        </span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {shortcut && (
          <kbd className="hidden sm:inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-md border border-border bg-card px-1.5 font-mono text-[11px] font-medium text-muted-foreground">
            {shortcut}
          </kbd>
        )}
        <span
          aria-hidden="true"
          className={[
            "mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border transition-colors duration-fast",
            checked ? "border-primary bg-primary" : "border-border bg-card",
          ].join(" ")}
        >
          {checked && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
        </span>
      </span>
    </label>
  );
}
