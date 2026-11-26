import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TaskRadarView } from "./TaskRadarView";
import { projectApi } from "../../services/project/api";
import type { ProjectScope } from "../../services/project/types";
import { clearClaimedTasks } from "../../lib/claimedTasks";

const testProject: ProjectScope = {
  id: "proj_1024",
  title: "Fix payment callback webhook race condition & idempotency",
  description: "Payment succeeds but the callback is not saving the final status. Multiple gateway callbacks arriving within 50ms cause concurrent database transactions to read uncommitted balance states.",
  expectedResult: "All incoming callback events must be idempotent. Concurrent requests with the same transaction_id must return HTTP 200 without duplicate credit executions. The pytest suite tests/test_payment_callback.py must pass 100%.",
  budget: 5000,
  currency: "INR",
  deadline: "2026-09-10",
  skills: ["Python", "FastAPI", "PostgreSQL", "Redis"],
  ownerName: "CodeBridge FinTech Team",
  projectState: "open",
  escrowState: "held",
  github: {
    status: "connected",
    repoName: "codebridge/payments-service",
    defaultBranch: "main",
    commitHash: "c4b2a8f",
    accessLevel: "Controlled Read-Only (No Owner Password Shared)",
  },
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("TaskRadarView Grid & Details Popup", () => {
  beforeEach(() => {
    clearClaimedTasks();
    vi.spyOn(projectApi, "getProjects").mockResolvedValue([testProject]);
    vi.spyOn(projectApi, "acceptProject").mockResolvedValue({
      ...testProject,
      projectState: "in_progress",
    });
  });

  it("renders multiple project boxes with title, fixed price, and Project Description button", async () => {
    renderWithClient(<TaskRadarView onOpenWorkspace={vi.fn()} />);

    // Available tasks grid header
    expect(await screen.findByText("Tasks Radar")).toBeInTheDocument();
    expect(screen.getByText(/Tasks available/i)).toBeInTheDocument();

    // Project card box with Title & Fixed price
    expect(screen.getByText("Fix payment callback webhook race condition & idempotency")).toBeInTheDocument();
    expect(screen.getAllByText(/Fixed price/i).length).toBeGreaterThanOrEqual(1);

    // Project Description button at bottom of box
    const descBtn = screen.getByRole("button", { name: /Project Description/i });
    expect(descBtn).toBeInTheDocument();
  });

  it("opens project description popup modal with sections and escrow in order", async () => {
    renderWithClient(<TaskRadarView onOpenWorkspace={vi.fn()} />);

    // Click Project Description button to expand popup
    const descBtn = await screen.findByRole("button", { name: /Project Description/i });
    fireEvent.click(descBtn);

    // Breadcrumb and Task ID
    const projElements = await screen.findAllByText(/proj_1024/i);
    expect(projElements.length).toBeGreaterThanOrEqual(1);

    // H1 title in modal
    const heading = screen.getByRole("heading", { level: 1, name: /Fix payment callback/i });
    expect(heading).toHaveTextContent("Fix payment callback webhook race condition & idempotency");

    // Headings in required order
    expect(screen.getByText("What is broken")).toBeInTheDocument();
    expect(screen.getByText("What the owner expects")).toBeInTheDocument();
    expect(screen.getByText("Done when")).toBeInTheDocument();
    expect(screen.getByText("Stack")).toBeInTheDocument();

    // 4 Escrow steps & simulated payment note
    expect(screen.getAllByText(/Payment held/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Simulated payment - demo only/i)).toBeInTheDocument();
    expect(screen.getByText("Authorized")).toBeInTheDocument();
    expect(screen.getByText("Held")).toBeInTheDocument();
    expect(screen.getByText("Release pending")).toBeInTheDocument();
    expect(screen.getByText("Released")).toBeInTheDocument();
  });

  it("handles accept and decline workflows cleanly inside modal", async () => {
    const onOpenWorkspace = vi.fn();
    renderWithClient(<TaskRadarView onOpenWorkspace={onOpenWorkspace} />);

    // Open modal
    const descBtn = await screen.findByRole("button", { name: /Project Description/i });
    fireEvent.click(descBtn);

    // Accept task button & Decline button
    const acceptBtn = screen.getByRole("button", { name: "Accept task" });
    const declineBtn = screen.getByRole("button", { name: "Decline" });
    expect(acceptBtn).toBeInTheDocument();
    expect(declineBtn).toBeInTheDocument();
    expect(screen.getByText("Ask the owner a question")).toBeInTheDocument();

    // Click Accept task
    fireEvent.click(acceptBtn);

    // Transitions to Open workspace
    const openWorkspaceBtn = screen.getByRole("button", { name: "Open workspace" });
    expect(openWorkspaceBtn).toBeInTheDocument();

    // Clicking Open workspace invokes callback
    fireEvent.click(openWorkspaceBtn);
    expect(onOpenWorkspace).toHaveBeenCalledWith("proj_1024");
  });

  it("persists accepted task state after navigating away and returning to Task Radar", async () => {
    const onOpenWorkspace = vi.fn();
    const firstRender = renderWithClient(<TaskRadarView onOpenWorkspace={onOpenWorkspace} />);

    // Open modal and accept task
    fireEvent.click(await screen.findByRole("button", { name: /Project Description/i }));
    fireEvent.click(screen.getByRole("button", { name: "Accept task" }));

    // Unmount TaskRadarView (simulates switching to Workspace)
    firstRender.unmount();

    // Remount TaskRadarView (simulates returning to Tasks Radar)
    renderWithClient(<TaskRadarView onOpenWorkspace={onOpenWorkspace} />);

    // Card button now indicates workspace is already accepted/active
    const viewScopeBtn = await screen.findByRole("button", { name: /Project Description for/i });
    expect(viewScopeBtn).toHaveTextContent("View workspace scope");

    // Reopening modal shows Open workspace instead of Accept task
    fireEvent.click(viewScopeBtn);
    expect(screen.getByRole("button", { name: "Open workspace" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept task" })).not.toBeInTheDocument();
  });
});
