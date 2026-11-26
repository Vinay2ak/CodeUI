import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type { UserRole } from "../types";

export interface StepperProps {
  currentStep: number;
  role: UserRole | null;
  onStepClick?: (step: number) => void;
}

const LABELS_BY_ROLE: Record<UserRole | "none", readonly string[]> = {
  owner: ["Account", "Profile"],
  freelancer: ["Account", "Identity", "Skills"],
  none: ["Account", "Profile"],
};

export function Stepper({ currentStep, role, onStepClick }: StepperProps) {
  const labels = LABELS_BY_ROLE[role ?? "none"];
  const total = labels.length;

  return (
    <nav aria-label="Onboarding progress" className="mb-6">
      <p className="text-xs font-medium text-muted-foreground mb-2.5">
        Step {Math.min(currentStep + 1, total)} of {total}
      </p>
      <ol
        className="grid gap-2 rounded-2xl border border-border bg-card p-1.5"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
      >
        {labels.map((label, index) => {
          const isActive = index === currentStep;
          const isDone = index < currentStep;
          const isClickable = index >= 1 && isDone && Boolean(onStepClick);

          const badgeClass = [
            "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold border transition-colors duration-fast",
            isActive
              ? "border-primary bg-primary text-primary-foreground"
              : isDone
                ? "border-accent/60 bg-accent/15 text-accent"
                : "border-border bg-background text-muted-foreground",
          ].join(" ");

          const content = (
            <>
              {isActive && (
                <motion.span
                  layoutId="wizard-active-step"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-xl bg-secondary border border-border/70"
                  aria-hidden="true"
                />
              )}
              <span className={badgeClass} aria-hidden="true">
                {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span
                className={[
                  "relative z-10 truncate text-[11px] sm:text-xs font-medium",
                  isActive ? "text-foreground" : isDone ? "text-foreground" : "text-muted-foreground",
                ].join(" ")}
              >
                {label}
              </span>
            </>
          );

          return (
            <li
              key={label}
              aria-current={isActive ? "step" : undefined}
              className="relative min-w-0"
            >
              {isClickable ? (
                <button
                  type="button"
                  onClick={() => onStepClick?.(index)}
                  className="relative flex w-full min-w-0 items-center gap-1.5 sm:gap-2 rounded-xl px-2 py-1.5 text-left transition-colors duration-fast hover:bg-secondary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                >
                  {content}
                </button>
              ) : (
                <span className="relative flex w-full min-w-0 items-center gap-1.5 sm:gap-2 rounded-xl px-2 py-1.5">
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
