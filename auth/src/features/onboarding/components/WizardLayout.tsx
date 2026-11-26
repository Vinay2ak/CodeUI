import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Code2 } from "lucide-react";
import { ThemeToggle } from "../../../components/ThemeToggle";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import type { UserRole } from "../types";
import { Stepper } from "./Stepper";

export interface WizardLayoutProps {
  role: UserRole | null;
  currentStep: number;
  onStepClick?: (step: number) => void;
  isSignedIn: boolean;
  onSignOut?: () => void;
  preview?: ReactNode;
  children: ReactNode;
}

export function WizardLayout({
  role,
  currentStep,
  onStepClick,
  isSignedIn,
  onSignOut,
  preview,
  children,
}: WizardLayoutProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-2.5 font-semibold text-foreground">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Code2 className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-base tracking-tight font-semibold">CodeBridge</span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isSignedIn && (
              <Button variant="ghost" size="sm" onClick={onSignOut}>
                Sign out
              </Button>
            )}
          </div>
        </div>
      </header>

      <main
        className={`w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 lg:py-10 flex-1 ${
          preview ? "max-w-7xl" : "max-w-2xl"
        }`}
      >
        {preview ? (
          <div className="lg:grid lg:grid-cols-[55fr_45fr] lg:gap-10 lg:items-start max-w-7xl">
            <div className="min-w-0">
              <Stepper currentStep={currentStep} role={role} onStepClick={onStepClick} />
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <Card className="max-w-xl min-w-0 rounded-2xl border-border bg-card py-0 shadow-sm">
                  <CardContent className="p-5 sm:p-7 lg:p-8">{children}</CardContent>
                </Card>
              </motion.div>

              <div className="lg:hidden mt-6 max-w-xl">
                <details className="rounded-2xl border border-border bg-card p-4">
                  <summary className="cursor-pointer text-sm font-medium text-foreground">
                    Preview your card
                  </summary>
                  <div className="mt-4">{preview}</div>
                </details>
              </div>
            </div>

            <aside className="hidden lg:block lg:sticky lg:top-6 min-w-0">{preview}</aside>
          </div>
        ) : (
          <div className="min-w-0">
            <Stepper currentStep={currentStep} role={role} onStepClick={onStepClick} />
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <Card className="min-w-0 rounded-2xl border-border bg-card py-0 shadow-sm">
                <CardContent className="p-5 sm:p-7 lg:p-8">{children}</CardContent>
              </Card>
            </motion.div>
          </div>
        )}
      </main>
    </div>
  );
}
