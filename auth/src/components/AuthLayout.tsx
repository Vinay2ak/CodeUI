import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Code2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { FieldDescription } from "./ui/field";
import { ThemeToggle } from "./ThemeToggle";

export interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2.5 font-semibold text-foreground">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Code2 className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-base tracking-tight font-semibold">CodeBridge</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex w-full max-w-md flex-col gap-5"
        >
          <Card className="rounded-2xl border-border bg-card py-0 shadow-sm">
            <CardHeader className="px-6 pt-6 pb-2 text-center sm:px-8 sm:pt-8">
              <CardTitle className="text-xl font-semibold tracking-tight text-foreground">
                {title}
              </CardTitle>
              {subtitle && (
                <CardDescription className="text-sm text-muted-foreground">
                  {subtitle}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="px-6 pt-3 pb-6 sm:px-8 sm:pb-8">
              {children}
            </CardContent>
          </Card>

          <FieldDescription className="px-6 text-center text-xs text-muted-foreground">
            Protected by CodeBridge session authentication.
          </FieldDescription>
        </motion.div>
      </main>
    </div>
  );
}
