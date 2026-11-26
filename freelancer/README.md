# CodeBridge Freelancer Developer Workspace (Parts A & B)

Standalone frontend single-page application for CodeBridge freelancers to inspect task specifications, view simulated AI context, follow timeline activities, observe isolated Docker workspace status, edit files in a syntax-highlighted code workspace, run test suites with live streaming progress, interact with an in-browser workspace terminal, track escrow payment progression, and submit solutions for client verification.

---

## Quick Start

### 1. Installation & Local Development
```powershell
Set-Location d:\CodeFreelancer\freelancer
npm install
npm run dev
```

The application runs on **port 5177** (`http://localhost:5177`).

### 2. Demo User Role Shortcut (`?role=`)
To quickly authenticate without the external Identity service in mock mode:
- **Freelancer Workspace**: `http://localhost:5177/?role=freelancer` (Auto-logs in as Ravi Freelancer and selects the active task).
- **Owner Redirect**: `http://localhost:5177/?role=owner` (Navigates to `${VITE_DASHBOARD_URL}/owner`).
- **Admin Redirect**: `http://localhost:5177/?role=admin` (Navigates to `${VITE_DASHBOARD_URL}/admin`).

The query parameter is stripped immediately using `history.replaceState` after bootstrapping the `mock_rt` cookie.

---

## Keyboard Shortcuts

| Shortcut | Description |
| :--- | :--- |
| `Ctrl + S` | Save active file changes in the code editor. |
| `Ctrl + Enter` | Trigger automated test verification suite in the dock. |
| `Ctrl + \`` | Focus the workspace terminal command input prompt. |
| `Ctrl + Shift + D` | Toggle the developer diagnostics side drawer. |
| `Esc` | Leave code editor mode or dismiss modal dialogs. |

---

## Select Component

Accessible, custom frosted-glass combobox component complying with the WAI-ARIA select-only pattern.

### API
```tsx
<Select
  id?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  name?: string
  options: SelectOption[] // { value, label, description?, disabled?, tone?: "success" | "primary" | "muted" }
  placeholder?: string     // Default "Select…"
  disabled?: boolean
  invalid?: boolean
  required?: boolean
  size?: "md" | "sm"       // "md" (40px) or "sm" (32px)
  aria-label?: string
  aria-labelledby?: string
  aria-describedby?: string
  className?: string
/>
```

### Keyboard Shortcuts (Focus on Trigger)
| Key | Action |
| :--- | :--- |
| `Enter` / `Space` / `ArrowDown` / `ArrowUp` | Open popover (when closed). |
| `ArrowDown` / `ArrowUp` | Move active option with boundary clamping (skips disabled). |
| `Home` / `End` | Jump to first / last enabled option. |
| `PageUp` / `PageDown` | Jump 10 enabled options up / down. |
| `Enter` / `Space` | Select active option and close popover. |
| `Tab` | Select active option and advance focus to next focusable element. |
| `Escape` | Dismiss popover without selecting (preserves parent dialogs). |
| Printable characters | 500ms typeahead buffer (case-insensitive prefix match & cycling). |

---

## Testing & Production Build

### Vitest Test Suite (Single Run)
```powershell
npx vitest run
```
Runs:
- WCAG theme contrast verification ($\ge 4.5:1$ text and $\ge 3:1$ controls)
- AST/file guard against color literals and default Tailwind palettes
- Session refresh coalescing tests (5 parallel 401s $\rightarrow$ 1 refresh)
- Realtime backoff and event store deduplication tests
- Submission gate state verification (9 test cases)
- Terminal command parser & execution tests (7 test cases)

### Production Build
```powershell
npm run build
```
Typechecks via `tsc -b` and bundles production assets via Vite into `dist/`.

---

## Mock Simulation Controls (`window.__cbMock`)

In local development with `VITE_USE_MOCKS=true`, the developer console exposes `window.__cbMock`:

| Command | Description |
| :--- | :--- |
| `window.__cbMock.expireToken()` | Forces the current access token to be considered expired on the next API call, exercising single-flight `/auth/refresh` replay. |
| `window.__cbMock.setSuspended(true)` | Simulates account suspension triggering the full-screen `SuspendedScreen`. |
| `window.__cbMock.serviceDown("ai", true)` | Simulates 503 Service Unavailable on the AI context service to verify isolated error boundary & retry behavior. |
| `window.__cbMock.serviceDown("payment", true)` | Simulates 503 on the escrow payment service without breaking coding or workspace controls. |
| `window.__cbMock.serviceDown("workspace", true)` | Simulates 503 on the workspace management service. |
| `window.__cbMock.serviceDown("submission", true)` | Simulates 503 on the submission & test runner service. |
| `window.__cbMock.emitEvent(type, data)` | Dispatches a realtime event envelope over the `BroadcastChannel("cb-events")` and internal event store. |
| `window.__cbMock.dropConnection(ms)` | Simulates network drop and shows reconnecting countdown on the LivePill. |
| `window.__cbMock.applyReferenceFix("t1")` | Loads the reference fix code into mock files to satisfy all test rules. |
| `window.__cbMock.simulateOwnerDecision("t1", "approve")` | Dispatches owner acceptance and payment release events. |
| `window.__cbMock.simulateOwnerDecision("t1", "changes")` | Dispatches reviewer changes requested event and makes the test run stale. |
| `window.__cbMock.resetTask("t1")` | Restores files, run state, and task status to initial snapshot. |
| `window.__cbMock.setAiScenario(scenario)` | Sets simulated AI scenario: `"ok"`, `"slow"`, `"fail"`, `"not_configured"`, `"no_evidence"`, `"rate_limited"`, `"hostile"`. |
| `window.__cbMock.resetAi()` | Resets AI question counts, quota, idempotency cache, and returns scenario to `"ok"`. |

---

## AI Assistant Feature Flags & Privacy

### Feature Flags
Configured via environment variables:
- `VITE_FEATURE_AI`: `"true"` = on, `"false"` = off, unset = defaults to on when `VITE_USE_MOCKS="true"`, otherwise off.
- `VITE_AI_FEATURES`: Optional comma-separated list of enabled AI features: `context`, `ask`, `explain`, `selfcheck`, `draft` (case-insensitive; empty or unset = all features enabled).
When a feature is disabled, its UI elements are not rendered at all and the workspace behaves as before.

### Privacy & Advisory Principles
1. **Advisory Only**: AI provides code guidance and answers queries. It never executes shell commands, edits files, submits solutions, or bypasses test gates.
2. **References Only**: The browser only ever transmits references: `taskId`, the user's question (3-500 chars), and optional relative `focusPath`. Never file contents, diffs, terminal logs, or tokens.
3. **Untrusted Plain Text**: All output from AI services is validated, size-clamped, control-character stripped, secret-redacted, and rendered strictly as plain text (no HTML, no dangerouslySetInnerHTML, and no markdown interpreters).
4. **Grounded Citations**: An answer must cite repository code ranges. Citations only link to files confirmed to exist in the current workspace snapshot. Answers without supporting code are visibly flagged "Not grounded in code".


---

## Docker Packaging

### Build Docker Image
```bash
docker build -t codebridge-freelancer:latest .
```

### Run Container
```bash
docker run -d --name codebridge-freelancer -p 8085:80 codebridge-freelancer:latest
```

- Application URL: `http://localhost:8085`
- Health check endpoint: `http://localhost:8085/healthz` (Returns `200 ok`)

---

## Architectural Contracts
See [docs/CROSS_APP_CONTRACT.md](file:///d:/CodeFreelancer/freelancer/docs/CROSS_APP_CONTRACT.md) for full cross-app navigation rules, cookie formats, session lifecycles, and realtime WebSocket event envelopes.


---

## AI Assistant (Part B)

The AI assistant provides advisory code intelligence for freelancers:
1. **Explain Failure** (Tests tab in Dock): On failed, timed-out, or error test rows, provides likely cause analysis, line-accurate suspected workspace locations with "Open" shortcuts, and next steps. Cached per `(runId, testId)` and invalidated when a new run begins or files are modified.
2. **AI Self-Check** (Submission panel): "Before you submit" card evaluates saved workspace changes against acceptance criteria (Met / Partially met / Not met / Unknown), highlights evidence citations with workspace verification, details security/error-handling risks (bare except, print statements, secrets detection), and shows staleness alerts.
3. **Draft Summary** (Submission panel): Inspects workspace modifications to generate concise reviewer notes and files-modified listings with Insert, Replace, and Append options adhering to the 500-character limit.

### Security & Privacy Principles
- **Advisory Only**: AI suggestions never alter or influence the deterministic submission gate.
- **Privacy First**: The browser transmits only task references and IDs, never code contents or logs.
- **Untrusted Plain Text**: All output is validated through strict Zod schemas, stripped of control characters, masked for secrets, and rendered strictly as plain text without Markdown or HTML parsers.
- **Unsaved File Protection**: Self-check and draft summary require all workspace changes to be saved first.

### Environment Flags
- `VITE_FEATURE_AI`: Master toggle (`true` \| `false`).
- `VITE_AI_FEATURES`: Comma-separated feature list (`context,ask,explain,selfcheck,draft`).

### Diagnostic Controls (`window.__cbMock`)
- `window.__cbMock.setAiScenario(scenario)`: `ok`, `slow`, `fail`, `not_configured`, `no_evidence`, `rate_limited`, `hostile`.
- `window.__cbMock.failNextAiJob()`: Simulates an immediate failure on the next async job.
- `window.__cbMock.resetAi()`: Resets AI state, quotas, and clears active job states.
