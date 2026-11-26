import React, { useState } from "react";
import {
  Briefcase,
  Zap,
  Code2,
  Calendar,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Coins,
  FolderGit2,
  Layers,
  Award,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Chip } from "../../components/ui/Chip";
import { formatCurrencyINR } from "../../lib/format";
import { MOCK_TASKS } from "../../mocks/data/tasks";
import { claimTaskId } from "../../lib/claimedTasks";

interface TaskMarketplaceProps {
  onSelectTask: (taskId: string) => void;
  onBack?: () => void;
  hasExistingTasks?: boolean;
}

export const TaskMarketplace: React.FC<TaskMarketplaceProps> = ({
  onSelectTask,
  onBack,
  hasExistingTasks = false,
}) => {
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const handleClaim = (taskId: string) => {
    setClaimingId(taskId);
    claimTaskId(taskId);
    setTimeout(() => {
      onSelectTask(taskId);
    }, 250);
  };

  const tasksList = [
    {
      id: "task-1",
      task: MOCK_TASKS["task-1"] || MOCK_TASKS.t1,
      isFlagship: true,
      tag: "Flagship Task",
    },
    {
      id: "task-2",
      task: MOCK_TASKS["task-2"] || MOCK_TASKS.t2,
      isFlagship: false,
      tag: "Frontend",
    },
    {
      id: "task-3",
      task: MOCK_TASKS["task-3"] || MOCK_TASKS.t3,
      isFlagship: false,
      tag: "DevOps",
    },
  ];

  const flagship = tasksList[0];

  return (
    <div className="flex-1 overflow-y-auto bg-canvas p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Navigation Bar / Return */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex p-1.5 rounded-lg bg-primary-subtle text-primary">
                <Briefcase className="h-5 w-5" aria-hidden="true" />
              </span>
              <h1 className="text-2xl font-bold text-ink tracking-tight">
                Freelancer Task Hub & Marketplace
              </h1>
            </div>
            <p className="text-sm text-muted">
              Explore available client specifications or load a flagship starter task to launch your cloud development sandbox.
            </p>
          </div>

          {hasExistingTasks && onBack && (
            <Button variant="secondary" size="sm" onClick={onBack} className="self-start sm:self-auto">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Back to Active Workspace</span>
            </Button>
          )}
        </div>

        {/* Hero Flagship Starter Card */}
        {flagship && (
          <div className="relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-surface to-raised p-6 md:p-8 shadow-md">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Code2 className="h-48 w-48 text-primary" />
            </div>

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-4 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary text-on-primary shadow-sm">
                    <Award className="h-3.5 w-3.5" aria-hidden="true" />
                    Recommended starter project
                  </span>
                  <Chip tone="success" icon={<ShieldCheck className="h-3 w-3" />}>
                    Verified Escrow
                  </Chip>
                  <Chip tone="neutral" icon={<Layers className="h-3 w-3" />}>
                    Full Interactive Sandbox
                  </Chip>
                </div>

                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-ink">
                    {flagship.task.title}
                  </h2>
                  <p className="text-xs font-mono text-muted mt-1">
                    Project: {flagship.task.projectTitle} • Repo: {flagship.task.repo.name}
                  </p>
                </div>

                <p className="text-sm text-muted leading-relaxed">
                  {flagship.task.brief[0]}
                </p>

                {/* Tech stack & reward pills */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {flagship.task.stack.map((tech) => (
                    <span
                      key={tech}
                      className="px-2.5 py-1 rounded-md text-xs font-medium bg-raised text-ink border border-line"
                    >
                      {tech}
                    </span>
                  ))}
                  <div className="h-4 w-px bg-line mx-1 hidden sm:block" />
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success bg-success-bg px-2.5 py-1 rounded-md border border-success-border">
                    <Coins className="h-3.5 w-3.5" />
                    {formatCurrencyINR(flagship.task.reward)} Escrow
                  </span>
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-start lg:items-end gap-3">
                <Button
                  size="lg"
                  variant="primary"
                  onClick={() => handleClaim(flagship.id)}
                  disabled={claimingId === flagship.id}
                  className="w-full sm:w-auto shadow-lg shadow-primary/20"
                >
                  <Zap className="h-4 w-4 fill-current" aria-hidden="true" />
                  <span>
                    {claimingId === flagship.id
                      ? "Launching Sandbox…"
                      : "Load Flagship Starter Workspace"}
                  </span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <span className="text-xs text-muted">
                  Pre-configured with test runner, virtual filesystem & git snapshot
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Open Tasks Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-ink flex items-center gap-2">
              <FolderGit2 className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>Available Project Tasks ({tasksList.length})</span>
            </h3>
            <span className="text-xs text-muted">Instant launch into Developer Workspace</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {tasksList.map(({ id, task, tag, isFlagship }) => (
              <div
                key={id}
                className={`rounded-xl border bg-surface p-5 flex flex-col justify-between transition-all hover:shadow-md ${
                  isFlagship ? "border-primary/50 ring-1 ring-primary/20" : "border-line hover:border-line-strong"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-raised text-muted uppercase tracking-wider">
                      {tag}
                    </span>
                    <span className="text-xs font-bold text-success flex items-center gap-1">
                      <Coins className="h-3 w-3" />
                      {formatCurrencyINR(task.reward)}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-ink line-clamp-1">{task.title}</h4>
                    <p className="text-xs text-muted truncate mt-0.5">{task.projectTitle}</p>
                  </div>

                  <p className="text-xs text-muted line-clamp-2 leading-relaxed">
                    {task.brief[0]}
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {task.stack.slice(0, 3).map((s) => (
                      <span key={s} className="px-2 py-0.5 rounded bg-canvas text-[11px] text-muted border border-line">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-line mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[11px] text-muted">
                    <Calendar className="h-3 w-3" />
                    <span>{task.criteria.length} criteria</span>
                  </div>

                  <Button
                    size="sm"
                    variant={isFlagship ? "primary" : "secondary"}
                    onClick={() => handleClaim(id)}
                    disabled={claimingId === id}
                  >
                    <span>{claimingId === id ? "Opening…" : "Launch Workspace"}</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
