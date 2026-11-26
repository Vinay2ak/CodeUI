import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CodePane } from "./CodePane";
import { Dock } from "../dock/Dock";
import { useFiles } from "./useFiles";
import { submissionApi } from "../../services/submission/api";
import { workspaceApi } from "../../services/workspace/api";
import { eventStore } from "../../realtime/store";
import { Run, TestResult } from "../../services/submission/types";
import { isRunStale } from "../submission/gate";
import { ErrorBoundary } from "../../app/ErrorBoundary";

interface WorkspaceCenterProps {
  taskId: string;
  workspaceStatus: string;
  filesState: ReturnType<typeof useFiles>;
  mobileView?: "code" | "run";
  onOpenMobileRun?: () => void;
}

export const WorkspaceCenter: React.FC<WorkspaceCenterProps> = ({
  taskId,
  workspaceStatus,
  filesState: fileHook,
  mobileView = "code",
  onOpenMobileRun,
}) => {
  const queryClient = useQueryClient();

  const isWorkspaceRunning = workspaceStatus === "running";

  const terminalInputRef = useRef<HTMLInputElement>(null);
  const [activeDockTab, setActiveDockTab] = useState<"terminal" | "tests" | "ask">("terminal");
  const [liveRun, setLiveRun] = useState<Run | null>(null);
  const [runCompletedAt, setRunCompletedAt] = useState<number | null>(null);

  // Fetch initial submission info including lastRun
  const { data: subData } = useQuery({
    queryKey: ["submission", "current", taskId],
    queryFn: () => submissionApi.getCurrentSubmission(taskId),
    enabled: Boolean(taskId),
  });

  const { data: taskData } = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => workspaceApi.getTask(taskId),
    enabled: Boolean(taskId),
  });

  const latestHistoryLine = taskData?.history?.[0]?.text || "Isolated Docker sandbox provisioned";

  // Realtime test progress listener
  useEffect(() => {
    const unsubProgress = eventStore.subscribe("test.run.progress", (event) => {
      const data = event.data as {
        taskId: string;
        runId: string;
        testId: string;
        status: "running" | "passed" | "failed";
      };
      if (data && data.taskId === taskId) {
        setLiveRun((prev) => {
          const currentResults = prev ? [...prev.results] : [];
          const idx = currentResults.findIndex((r) => r.testId === data.testId);
          const updatedItem: TestResult = {
            testId: data.testId,
            status: data.status,
            durationMs: data.status !== "running" ? 25 : undefined,
          };
          if (idx >= 0) {
            currentResults[idx] = { ...currentResults[idx], ...updatedItem };
          } else {
            currentResults.push(updatedItem);
          }

          return {
            runId: data.runId,
            taskId: data.taskId,
            status: "running",
            results: currentResults,
          };
        });
      }
    });

    const unsubCompleted = eventStore.subscribe("test.run.completed", (event) => {
      const data = event.data as {
        taskId: string;
        runId: string;
        passed: number;
        failed: number;
        requiredPassed: boolean;
      };
      if (data && data.taskId === taskId) {
        setLiveRun((prev) => (prev ? { ...prev, status: "completed" } : prev));
        setRunCompletedAt(Date.now());
        queryClient.invalidateQueries({ queryKey: ["submission", "current", taskId] });
      }
    });

    return () => {
      unsubProgress();
      unsubCompleted();
    };
  }, [taskId, queryClient]);

  const currentEffectiveRun = liveRun || subData?.lastRun || null;

  // Compute staleness
  const stale = isRunStale(runCompletedAt, fileHook.lastSavedAt);

  const startRunMutation = useMutation({
    mutationFn: () => submissionApi.startRun(taskId),
    onSuccess: (data) => {
      setLiveRun({
        runId: data.runId,
        taskId,
        status: "running",
        results: [],
      });
      setActiveDockTab("tests");
      onOpenMobileRun?.();
    },
  });

  const handleRunTests = useCallback(() => {
    if (!isWorkspaceRunning || fileHook.hasUnsavedChanges || startRunMutation.isPending) {
      return;
    }
    startRunMutation.mutate();
  }, [isWorkspaceRunning, fileHook.hasUnsavedChanges, startRunMutation]);

  // Keyboard shortcut listeners: Ctrl+` (terminal), Ctrl+Enter (run tests)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "`") {
        e.preventDefault();
        setActiveDockTab("terminal");
        setTimeout(() => terminalInputRef.current?.focus(), 50);
      } else if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        handleRunTests();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [handleRunTests]);

  return (
    <div className="h-full flex flex-col min-h-0 bg-canvas overflow-hidden">
      {/* Code Pane Area */}
      <div
        className={`flex-1 min-h-0 overflow-hidden ${
          mobileView === "run" ? "hidden xl:block" : "block"
        }`}
      >
        <ErrorBoundary fallbackTitle="Code Editor Error">
          <CodePane taskId={taskId} workspaceStatus={workspaceStatus} />
        </ErrorBoundary>
      </div>

      {/* Dock Area (Terminal + Tests) */}
      <div
        className={`shrink-0 ${
          mobileView === "code" ? "hidden xl:block" : "block flex-1 xl:flex-none"
        }`}
      >
        <ErrorBoundary fallbackTitle="Workspace Dock Error">
          <Dock
            taskId={taskId}
            files={fileHook.files}
            fileContents={fileHook.initialSnapshot}
            initialSnapshot={fileHook.initialSnapshot}
            commit={fileHook.commit}
            latestHistoryLine={latestHistoryLine}
            isWorkspaceRunning={isWorkspaceRunning}
            hasUnsavedChanges={fileHook.hasUnsavedChanges}
            isStale={stale}
            latestRun={currentEffectiveRun}
            isRunningTests={startRunMutation.isPending || currentEffectiveRun?.status === "running"}
            onRunTests={handleRunTests}
            onSaveAll={fileHook.saveAll}
            onOpenFile={fileHook.openFile}
            terminalInputRef={terminalInputRef}
            activeDockTab={activeDockTab}
            onTabChange={setActiveDockTab}
            lastSavedAt={fileHook.lastSavedAt}
            activeEditorFile={fileHook.activePath}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
};
