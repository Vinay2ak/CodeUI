import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BeforeYouSubmitCard } from "./BeforeYouSubmitCard";

describe("BeforeYouSubmitCard", () => {
  beforeEach(() => {
    cleanup();
    vi.stubEnv("VITE_FEATURE_AI", "true");
    vi.stubEnv("VITE_USE_MOCKS", "true");
    vi.stubEnv("VITE_AI_FEATURES", "");
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.clear();
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders card header and disabled state when hasUnsavedChanges is true", () => {
    const onSaveAll = vi.fn();
    render(
      <BeforeYouSubmitCard
        taskId="t1"
        hasUnsavedChanges={true}
        onSaveAll={onSaveAll}
        onOpenFile={vi.fn()}
        files={[{ path: "app/webhooks.py" }]}
        lastSavedAt={Date.now()}
        changedPaths={["app/webhooks.py"]}
        notes=""
        onApplyDraft={vi.fn()}
      />
    );

    expect(screen.getByText("Before you submit")).toBeInTheDocument();
    expect(screen.getAllByText("AI · advisory").length).toBeGreaterThan(0);
    expect(screen.getByText("Save your changes first")).toBeInTheDocument();
    expect(screen.getByText("Save all")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Save all"));
    expect(onSaveAll).toHaveBeenCalled();

    const runBtn = screen.getByText("Run AI self-check").closest("button");
    expect(runBtn).toBeDisabled();
  });

  it("renders draft action buttons according to notes length", () => {
    const onApplyDraft = vi.fn();
    const { rerender } = render(
      <BeforeYouSubmitCard
        taskId="t1"
        hasUnsavedChanges={false}
        onOpenFile={vi.fn()}
        files={[{ path: "app/webhooks.py" }]}
        lastSavedAt={Date.now()}
        changedPaths={[]}
        notes=""
        onApplyDraft={onApplyDraft}
      />
    );

    // Initial render has Run AI self-check and Draft summary buttons enabled
    const runBtn = screen.getByText("Run AI self-check").closest("button");
    const draftBtn = screen.getByText("Draft summary from my changes").closest("button");
    expect(runBtn).not.toBeDisabled();
    expect(draftBtn).not.toBeDisabled();

    // Rerender with notes
    rerender(
      <BeforeYouSubmitCard
        taskId="t1"
        hasUnsavedChanges={false}
        onOpenFile={vi.fn()}
        files={[{ path: "app/webhooks.py" }]}
        lastSavedAt={Date.now()}
        changedPaths={[]}
        notes="Existing note from developer"
        onApplyDraft={onApplyDraft}
      />
    );

    expect(screen.getByText("Draft summary from my changes")).toBeInTheDocument();
  });
});
