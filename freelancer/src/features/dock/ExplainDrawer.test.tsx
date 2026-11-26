import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExplainDrawer } from "./ExplainDrawer";
import type { FailureExplanation } from "../ai-assistant/types";

describe("ExplainDrawer", () => {
  const mockExplanation: FailureExplanation = {
    explanationId: "exp_123",
    generatedAt: "2026-11-22T10:00:00Z",
    explanation: "Duplicate event received without idempotency check.",
    likelyCause: "The endpoint records charges for all deliveries.",
    suspectedLocations: [
      {
        path: "app/webhooks.py",
        startLine: 74,
        endLine: 74,
        reason: "Missing check",
      },
      {
        path: "app/external_unknown.py",
        startLine: 10,
        endLine: 12,
        reason: "External missing",
      },
    ],
    nextSteps: [
      "Add processed_event_ids set.",
      "Check event before charging.",
    ],
  };

  it("renders explanation, cause, and suspected locations", () => {
    const onOpen = vi.fn();
    render(
      <ExplainDrawer
        testId="test_webhook_idempotent_duplicate_event"
        explanation={mockExplanation}
        isLoading={false}
        elapsedSeconds={0}
        error={null}
        onRetry={vi.fn()}
        onStop={vi.fn()}
        onClose={vi.fn()}
        onOpenFile={onOpen}
        knownFiles={["app/webhooks.py"]}
        isStale={false}
      />
    );

    expect(screen.getByText("AI · advisory")).toBeInTheDocument();
    expect(screen.getByText("Duplicate event received without idempotency check.")).toBeInTheDocument();
    expect(screen.getByText("The endpoint records charges for all deliveries.")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Not in workspace")).toBeInTheDocument();
    expect(screen.getByText("Add processed_event_ids set.")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Open"));
    expect(onOpen).toHaveBeenCalledWith("app/webhooks.py");
  });

  it("renders stale chip when code was saved after explanation", () => {
    render(
      <ExplainDrawer
        testId="test_webhook_idempotent_duplicate_event"
        explanation={mockExplanation}
        isLoading={false}
        elapsedSeconds={0}
        error={null}
        onRetry={vi.fn()}
        onStop={vi.fn()}
        onClose={vi.fn()}
        onOpenFile={vi.fn()}
        knownFiles={["app/webhooks.py"]}
        isStale={true}
      />
    );

    expect(screen.getByText("Code changed since this explanation")).toBeInTheDocument();
  });

  it("renders loading state with elapsed seconds and Stop button", () => {
    const onStop = vi.fn();
    render(
      <ExplainDrawer
        testId="test_webhook_idempotent_duplicate_event"
        explanation={null}
        isLoading={true}
        elapsedSeconds={4}
        error={null}
        onRetry={vi.fn()}
        onStop={onStop}
        onClose={vi.fn()}
        onOpenFile={vi.fn()}
        knownFiles={[]}
        isStale={false}
      />
    );

    expect(screen.getByText(/Reading the failure… \(4s\)/)).toBeInTheDocument();
    const stopBtn = screen.getByText("Stop");
    fireEvent.click(stopBtn);
    expect(onStop).toHaveBeenCalled();
  });

  it("renders error state with Retry button", () => {
    const onRetry = vi.fn();
    render(
      <ExplainDrawer
        testId="test_webhook_idempotent_duplicate_event"
        explanation={null}
        isLoading={false}
        elapsedSeconds={0}
        error={{ code: "UNKNOWN", message: "Failed to connect to AI service" }}
        onRetry={onRetry}
        onStop={vi.fn()}
        onClose={vi.fn()}
        onOpenFile={vi.fn()}
        knownFiles={[]}
        isStale={false}
      />
    );

    expect(screen.getByText("Failed to connect to AI service")).toBeInTheDocument();
    const retryBtn = screen.getByText("Retry");
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalled();
  });
});
