import { Workspace, WorkspaceStatus } from "../services/workspace/types";
import { T1_INITIAL_REPO, REFERENCE_FIX, RepoFileSnapshot } from "./data/repo";
import { TEST_RULES } from "./data/rules";
import { eventStore } from "../realtime/store";
import { CbEvent } from "../realtime/types";
import { Run, TestResult } from "../services/submission/types";

const MOCK_STORAGE_KEY = "mock.workspace.files.v1";

function normalizeTaskId(id: string): string {
  if (id === "task-1") return "t1";
  if (id === "task-2") return "t2";
  if (id === "task-3") return "t3";
  return id;
}

function loadPersistedFiles(): Record<string, Record<string, RepoFileSnapshot>> {
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      const saved = sessionStorage.getItem(MOCK_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignored
    }
  }
  return {
    t1: { ...T1_INITIAL_REPO },
    "task-1": { ...T1_INITIAL_REPO },
  };
}

function persistFiles(files: Record<string, Record<string, RepoFileSnapshot>>): void {
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      sessionStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(files));
    } catch {
      // Ignored
    }
  }
}

let repoFiles: Record<string, Record<string, RepoFileSnapshot>> = loadPersistedFiles();

let currentWorkspaces: Record<string, Workspace> = {
  t1: {
    status: "stopped",
    image: "python:3.12-slim",
    template: "FastAPI template",
    cpu: "2 vCPU",
    memory: "4 GB",
    expiresAt: null,
    repoAccess: "read-only snapshot",
    commit: "a1b2c3d",
  },
  "task-1": {
    status: "stopped",
    image: "python:3.12-slim",
    template: "FastAPI template",
    cpu: "2 vCPU",
    memory: "4 GB",
    expiresAt: null,
    repoAccess: "read-only snapshot",
    commit: "a1b2c3d",
  },
  t2: {
    status: "stopped",
    image: "node:20-alpine",
    template: "React + Vite template",
    cpu: "2 vCPU",
    memory: "4 GB",
    expiresAt: null,
    repoAccess: "read-only snapshot",
    commit: "f4e5d6c",
  },
  "task-2": {
    status: "stopped",
    image: "node:20-alpine",
    template: "React + Vite template",
    cpu: "2 vCPU",
    memory: "4 GB",
    expiresAt: null,
    repoAccess: "read-only snapshot",
    commit: "f4e5d6c",
  },
  t3: {
    status: "stopped",
    image: "golang:1.22-alpine",
    template: "Go CI template",
    cpu: "2 vCPU",
    memory: "4 GB",
    expiresAt: null,
    repoAccess: "read-only snapshot",
    commit: "987654a",
  },
  "task-3": {
    status: "stopped",
    image: "golang:1.22-alpine",
    template: "Go CI template",
    cpu: "2 vCPU",
    memory: "4 GB",
    expiresAt: null,
    repoAccess: "read-only snapshot",
    commit: "987654a",
  },
};

let eventCounter = 1000;

export interface MockSubmissionState {
  status: "none" | "in_review" | "approved" | "changes_requested";
  note?: string;
  lastRun?: Run;
  latestRunCompletedAt?: number;
}

let currentSubmissionState: Record<string, MockSubmissionState> = {
  t1: { status: "none" },
  "task-1": { status: "none" },
  t2: { status: "in_review", note: "Initial submission under review" },
  "task-2": { status: "in_review", note: "Initial submission under review" },
  t3: { status: "approved", note: "All tests verified and accepted" },
  "task-3": { status: "approved", note: "All tests verified and accepted" },
};

let runsStore: Record<string, Run> = {};

export function emitMockEvent(type: string, data: unknown): void {
  const envelope: CbEvent = {
    id: `evt_${Date.now()}_${eventCounter++}`,
    type,
    occurredAt: new Date().toISOString(),
    source: "simulator",
    correlationId: `sim_${Date.now()}`,
    data,
  } as CbEvent;

  eventStore.addEvent(envelope);

  if (typeof BroadcastChannel !== "undefined") {
    try {
      const bc = new BroadcastChannel("cb-events");
      bc.postMessage(envelope);
      bc.close();
    } catch {
      // Ignored
    }
  }
}

export function getWorkspace(taskId: string): Workspace {
  const norm = normalizeTaskId(taskId);
  return (
    currentWorkspaces[taskId] ||
    currentWorkspaces[norm] || {
      status: "stopped",
      image: "python:3.12-slim",
      template: "FastAPI template",
      cpu: "2 vCPU",
      memory: "4 GB",
      expiresAt: null,
      repoAccess: "read-only snapshot",
      commit: "unknown",
    }
  );
}

export function updateWorkspaceStatus(
  taskId: string,
  status: WorkspaceStatus,
  expiresAt: string | null = null
): void {
  const norm = normalizeTaskId(taskId);
  const targets = Array.from(new Set([taskId, norm]));
  for (const t of targets) {
    if (currentWorkspaces[t]) {
      currentWorkspaces[t] = {
        ...currentWorkspaces[t],
        status,
        expiresAt,
      };
    }
  }
  emitMockEvent("workspace.status_changed", { taskId, status });
}

export function startMockWorkspace(taskId: string): void {
  const norm = normalizeTaskId(taskId);
  if (norm === "t2" || norm === "t3") {
    throw new Error("Task is locked");
  }

  updateWorkspaceStatus(taskId, "provisioning", null);

  setTimeout(() => {
    if (currentWorkspaces[taskId]?.status === "provisioning") {
      updateWorkspaceStatus(taskId, "starting", null);

      setTimeout(() => {
        if (currentWorkspaces[taskId]?.status === "starting") {
          const twoHoursLater = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
          updateWorkspaceStatus(taskId, "running", twoHoursLater);
        }
      }, 1500);
    }
  }, 2000);
}

export function stopMockWorkspace(taskId: string): void {
  updateWorkspaceStatus(taskId, "stopped", null);
}

export function resetMockWorkspace(taskId: string): void {
  const norm = normalizeTaskId(taskId);
  if (norm === "t2" || norm === "t3") {
    throw new Error("Task is locked");
  }

  updateWorkspaceStatus(taskId, "provisioning", null);
  repoFiles[taskId] = { ...T1_INITIAL_REPO };
  repoFiles[norm] = { ...T1_INITIAL_REPO };
  persistFiles(repoFiles);

  setTimeout(() => {
    const twoHoursLater = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
    updateWorkspaceStatus(taskId, "running", twoHoursLater);
  }, 1500);
}

export function getMockFiles(taskId: string): RepoFileSnapshot[] {
  const norm = normalizeTaskId(taskId);
  const files = repoFiles[taskId] || repoFiles[norm] || {};
  return Object.values(files);
}

export function getMockFileMap(taskId: string): Record<string, RepoFileSnapshot> {
  const norm = normalizeTaskId(taskId);
  return repoFiles[taskId] || repoFiles[norm] || { ...T1_INITIAL_REPO };
}

export function getMockFileContent(taskId: string, filePath: string): RepoFileSnapshot | null {
  const norm = normalizeTaskId(taskId);
  const files = repoFiles[taskId] || repoFiles[norm] || {};
  return files[filePath] || null;
}

export function saveMockFileContent(taskId: string, filePath: string, content: string): void {
  const norm = normalizeTaskId(taskId);
  const targets = Array.from(new Set([taskId, norm]));
  for (const t of targets) {
    if (!repoFiles[t]) {
      repoFiles[t] = {};
    }
    const existing = repoFiles[t][filePath];
    repoFiles[t][filePath] = {
      path: filePath,
      language: existing ? existing.language : "plaintext",
      content,
    };
  }
  persistFiles(repoFiles);
}

// Submissions & Test runner
export function getSubmissionState(taskId: string): MockSubmissionState {
  return currentSubmissionState[taskId] || { status: "none" };
}

export function getMockRun(runId: string): Run | null {
  return runsStore[runId] || null;
}

export function startMockTestRun(taskId: string): string {
  const runId = `run_${Date.now()}`;
  const files = repoFiles[taskId] || {};

  const sortedRules = [...TEST_RULES].sort((a, b) => a.order - b.order);

  const initialResults: TestResult[] = sortedRules.map((r) => ({
    testId: r.testId,
    status: "pending",
  }));

  const run: Run = {
    runId,
    taskId,
    status: "running",
    results: initialResults,
  };
  runsStore[runId] = run;

  // Stream results through events
  let delayAccum = 200;

  sortedRules.forEach((rule, index) => {
    // 1. emit running progress
    setTimeout(() => {
      run.results[index].status = "running";
      emitMockEvent("test.run.progress", {
        taskId,
        runId,
        testId: rule.testId,
        status: "running",
      });
    }, delayAccum);

    delayAccum += 400;

    // 2. evaluate test against current saved content
    setTimeout(() => {
      const fileRecord = files[rule.file];
      const content = fileRecord ? fileRecord.content : "";

      let passed = false;
      let failMessage = rule.failMessage;

      if (rule.testId === "test_readme_documents_idempotency") {
        passed = /idempotent/i.test(content);
      } else if (rule.testId === "test_state_machine_authorized_to_held") {
        passed = content.includes("def hold");
      } else if (rule.testId === "test_state_machine_release_requires_approval") {
        passed = content.includes("def release");
      } else if (rule.ruleType === "contains") {
        passed = content.includes(rule.needle);
      }

      const resultStatus = passed ? "passed" : "failed";
      run.results[index].status = resultStatus;
      run.results[index].durationMs = Math.floor(Math.random() * 40) + 10;
      if (!passed) {
        run.results[index].message = failMessage;
      }

      emitMockEvent("test.run.progress", {
        taskId,
        runId,
        testId: rule.testId,
        status: resultStatus,
      });
    }, delayAccum);
  });

  // 3. Complete run
  setTimeout(() => {
    run.status = "completed";
    const passedCount = run.results.filter((r) => r.status === "passed").length;
    const failedCount = run.results.length - passedCount;

    const requiredTestIds = new Set(sortedRules.filter((r) => r.required).map((r) => r.testId));
    const requiredPassed = run.results
      .filter((r) => requiredTestIds.has(r.testId))
      .every((r) => r.status === "passed");

    currentSubmissionState[taskId] = {
      ...currentSubmissionState[taskId],
      lastRun: run,
      latestRunCompletedAt: Date.now(),
    };

    emitMockEvent("test.run.completed", {
      taskId,
      runId,
      passed: passedCount,
      failed: failedCount,
      requiredPassed,
    });
  }, delayAccum + 100);

  return runId;
}

export function submitMockSolution(taskId: string, notes: string): string {
  const submissionId = `sub_${Date.now()}`;
  const subState = currentSubmissionState[taskId];

  // Validate server-side gate
  const run = subState?.lastRun;
  const sortedRules = [...TEST_RULES].sort((a, b) => a.order - b.order);
  const requiredTestIds = new Set(sortedRules.filter((r) => r.required).map((r) => r.testId));

  const allRequiredPassed =
    run &&
    run.status === "completed" &&
    run.results
      .filter((r) => requiredTestIds.has(r.testId))
      .every((r) => r.status === "passed");

  const ws = currentWorkspaces[taskId];
  const wsOk = ws && (ws.status === "running" || ws.status === "idle");

  if (!allRequiredPassed || !wsOk || subState?.status === "in_review") {
    throw new Error("GATE_FAILED");
  }

  currentSubmissionState[taskId] = {
    ...currentSubmissionState[taskId],
    status: "in_review",
    note: notes,
  };

  // Lock workspace
  updateWorkspaceStatus(taskId, "stopped", null);

  emitMockEvent("submission.status_changed", {
    taskId,
    status: "in_review",
    note: notes,
  });

  emitMockEvent("payment.state_changed", {
    taskId,
    state: "tested",
  });

  return submissionId;
}

export function applyReferenceFix(taskId: string): void {
  const norm = normalizeTaskId(taskId);
  if (norm === "t1") {
    const targets = Array.from(new Set([taskId, norm]));
    for (const t of targets) {
      if (!repoFiles[t]) repoFiles[t] = {};
      for (const [path, content] of Object.entries(REFERENCE_FIX)) {
        if (repoFiles[t][path]) {
          repoFiles[t][path].content = content;
        }
      }
    }
    persistFiles(repoFiles);
  }
}

export function simulateOwnerDecision(taskId: string, decision: "approve" | "changes"): void {
  const norm = normalizeTaskId(taskId);
  const targets = Array.from(new Set([taskId, norm]));

  if (decision === "approve") {
    for (const t of targets) {
      currentSubmissionState[t] = {
        ...currentSubmissionState[t],
        status: "approved",
        note: "All test criteria verified and approved",
      };
    }
    emitMockEvent("submission.status_changed", {
      taskId,
      status: "approved",
      note: "All test criteria verified and approved",
    });

    // after 2 s payment.state_changed approved
    setTimeout(() => {
      emitMockEvent("payment.state_changed", {
        taskId,
        state: "approved",
      });

      // 2 s later released
      setTimeout(() => {
        emitMockEvent("payment.state_changed", {
          taskId,
          state: "released",
        });
      }, 2000);
    }, 2000);
  } else {
    // simulate changes_requested with note
    const note = "Please also log the duplicate event id before returning.";
    for (const t of targets) {
      currentSubmissionState[t] = {
        ...currentSubmissionState[t],
        status: "changes_requested",
        note,
        // Makes latest run stale
        latestRunCompletedAt: 0,
      };
    }

    emitMockEvent("submission.status_changed", {
      taskId,
      status: "changes_requested",
      note,
    });
  }
}

export function resetTaskState(taskId: string): void {
  const norm = normalizeTaskId(taskId);
  if (norm === "t1") {
    const targets = Array.from(new Set([taskId, norm]));
    for (const t of targets) {
      repoFiles[t] = { ...T1_INITIAL_REPO };
      currentSubmissionState[t] = { status: "none" };
      updateWorkspaceStatus(t, "stopped", null);
    }
    persistFiles(repoFiles);
  }
}
