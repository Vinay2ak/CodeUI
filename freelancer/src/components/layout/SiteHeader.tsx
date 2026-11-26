import React from "react";
import { Keyboard } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Button } from "@/components/ui/Button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SiteHeaderProps {
  sectionLabel: string;
  activeProjectId?: string | null;
  onNavigateHome: () => void;
  onOpenShortcuts: () => void;
}

export const SiteHeader: React.FC<SiteHeaderProps> = ({
  sectionLabel,
  activeProjectId,
  onNavigateHome,
  onOpenShortcuts,
}) => {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-4 sm:px-6 transition-[width,height] ease-linear">
      <div className="flex items-center gap-2 min-w-0">
        <SidebarTrigger className="-ml-1 rounded-xl" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink
                href="#overview"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigateHome();
                }}
                className="text-muted hover:text-foreground transition-colors"
              >
                CodeBridge
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-semibold text-foreground">
                {sectionLabel}
              </BreadcrumbPage>
            </BreadcrumbItem>
            {activeProjectId && (
              <>
                <BreadcrumbSeparator className="hidden sm:block" />
                <BreadcrumbItem className="hidden sm:block">
                  <span className="font-mono text-xs text-muted px-2 py-0.5 rounded-full bg-raised border border-border tabular-nums">
                    {activeProjectId}
                  </span>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border bg-raised px-2.5 py-1 text-xs font-medium text-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
          <span>Freelancer</span>
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onOpenShortcuts}
              aria-label="Keyboard shortcuts"
              className="h-9 w-9 rounded-xl border-border bg-card text-foreground hover:bg-raised"
            >
              <Keyboard className="h-4 w-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Keyboard shortcuts</TooltipContent>
        </Tooltip>

        <ThemeToggle />
      </div>
    </header>
  );
};
