import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";

export type AlertVariant = "error" | "warning" | "info" | "success";

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<AlertVariant, { container: string; icon: typeof Info }> = {
  error: {
    container: "border-danger/60 bg-danger/10 text-text",
    icon: AlertCircle,
  },
  warning: {
    container: "border-warning/60 bg-warning/10 text-text",
    icon: AlertTriangle,
  },
  info: {
    container: "border-primary/60 bg-primary/10 text-text",
    icon: Info,
  },
  success: {
    container: "border-success/60 bg-success/10 text-text",
    icon: CheckCircle2,
  },
};

const iconColor: Record<AlertVariant, string> = {
  error: "text-danger",
  warning: "text-warning",
  info: "text-primary",
  success: "text-success",
};

export function Alert({ variant = "info", title, children, className = "" }: AlertProps) {
  const { container, icon: Icon } = variantStyles[variant];
  const role = variant === "error" || variant === "warning" ? "alert" : "status";

  return (
    <div
      role={role}
      className={[
        "flex items-start gap-3 rounded-xl border p-3.5 text-sm",
        container,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Icon className={["mt-0.5 h-4 w-4 shrink-0", iconColor[variant]].join(" ")} aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold text-text">{title}</p>}
        <div className="text-text-muted">{children}</div>
      </div>
    </div>
  );
}
