import {
  serviceDownState,
  setForceExpireToken,
  setMockSuspended,
  setAiScenario,
  resetAiState,
  failNextAiJob,
  AiScenario,
} from "./handlers";
import {
  emitMockEvent,
  applyReferenceFix,
  simulateOwnerDecision,
  resetTaskState,
} from "./simulator";
import { realtimeManager } from "../realtime/manager";

export interface CbMockControls {
  expireToken: () => void;
  setSuspended: (suspended: boolean) => void;
  serviceDown: (
    service: "workspace" | "submission" | "ai" | "payment" | "notification",
    down: boolean
  ) => void;
  emitEvent: (type: string, data: unknown) => void;
  dropConnection: (ms?: number) => void;
  applyReferenceFix: (taskId: string) => void;
  simulateOwnerDecision: (taskId: string, decision: "approve" | "changes") => void;
  resetTask: (taskId: string) => void;
  setAiScenario: (scenario: AiScenario) => void;
  resetAi: () => void;
  failNextAiJob: (fail?: boolean) => void;
}

declare global {
  interface Window {
    __cbMock?: CbMockControls;
  }
}

export function registerMockControls(): void {
  window.__cbMock = {
    expireToken() {
      setForceExpireToken(true);
    },
    setSuspended(suspended: boolean) {
      setMockSuspended(suspended);
    },
    serviceDown(service, down) {
      serviceDownState[service] = down;
    },
    emitEvent(type, data) {
      emitMockEvent(type, data);
    },
    dropConnection(ms = 3000) {
      realtimeManager.dropConnection(ms);
    },
    applyReferenceFix(taskId: string) {
      applyReferenceFix(taskId);
    },
    simulateOwnerDecision(taskId: string, decision: "approve" | "changes") {
      simulateOwnerDecision(taskId, decision);
    },
    resetTask(taskId: string) {
      resetTaskState(taskId);
    },
    setAiScenario(scenario: AiScenario) {
      setAiScenario(scenario);
    },
    resetAi() {
      resetAiState();
    },
    failNextAiJob(fail = true) {
      failNextAiJob(fail);
    },
  };
}

