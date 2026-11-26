# CodeBridge Dashboard Micro-Frontend

This application is the central product dashboard for the CodeBridge platform, supporting three role dashboards:
- Project Owner (`/owner`)
- Freelancer (`/freelancer`)
- Platform Administrator (`/admin`)

For full architectural details, cross-app link conventions, cookie structures, and event models, consult [docs/CROSS_APP_CONTRACT.md](docs/CROSS_APP_CONTRACT.md).

---

## Getting Started

### 1. Development Server
Runs the standalone Vite application on port `5175` with strict port checking:

```bash
npm install
npm run dev
```

Visit [http://localhost:5175](http://localhost:5175).

### 2. Running Automated Tests
Executes unit and integration suites (session single-flight refresh, backoff bounds, store dedupe):

```bash
npm test
```

### 3. Production Build
Validates TypeScript strict typing and compiles optimized assets to `dist/`:

```bash
npm run build
```

---

## Containerization & Deployment

Build and run the production image using Docker and Nginx:

```bash
# Build the multi-stage image
docker build -t codebridge-dashboard .

# Run on port 8083
docker run -d -p 8083:80 --name cb-dashboard codebridge-dashboard

# Check health endpoint
curl http://localhost:8083/healthz
```

---

## Developer Tools

Press `Ctrl+Shift+D` anywhere in the dashboard to toggle the Dev Drawer:
- Inspect decoded token claims and live countdown
- Trigger token expiry or simulated account suspension
- Toggle 503 service failure on individual microservices
- Emit mock events or test connection drop and reconnection
- Live ring buffer of the last 20 API requests with correlation IDs



---

## Post Project & Developer Matching Flow

### Features
1. **Post Project Form (`/owner/projects/new`)**:
   - 3 structured cards: Problem & scope, Tech stack & specialties, Budget, timeline & verification mode.
   - Live draft autosaving via `sessionStorage` with visual indicator.
   - Automatic pre-fill from Owner Profile (`/api/v1/users/me/owner-profile`).
   - Idempotent submission via `Idempotency-Key` header.
2. **Project Detail & Recommendations (`/owner/projects/:projectId`)**:
   - Project summary card with formatted INR escrow budget.
   - Independent polling of developer matches from Talent service.
   - Interactive filtering (fits budget, available now, GitHub verified, shortlisted only).
   - Instant sorting (best match, price low-to-high, availability).
   - "Why this match" positive reason bullets and cautionary warnings.
   - Expandable 7-factor algorithm score breakdown with meters.
   - Slide-over Developer Profile Drawer with full bio and verification details.
   - One-click shortlisting with optimistic updates and server persistence.

### Testing Matching Controls in Dev Tools
Open Dev Drawer (`Ctrl+Shift+D` or bottom-left terminal icon):
- **Talent Service Simulator**: Toggle Talent 503 to test independent fallback when the Talent service is degraded.
- **Fail Matching**: Simulate matching calculation failure (`status: "failed"`).
- **Matching Delay**: Adjust artificial latency to test the "computing" polling state.
- **Emit `project.posted`**: Test real-time event propagation.

---

## Admin Overview Analytics (Merged Native Panels)

Analytics are embedded directly inside the Admin Overview page (`/admin`) as a native "Analytics" section positioned immediately after the primary KPI cards. Rather than embedding an entire Grafana chrome dashboard, each Grafana panel is individually embedded using Grafana's `/d-solo/` URLs inside custom, responsive `PanelCard` wrappers with 12-column layout management.

---

## AI Developer Brief (Advisory Repo Analysis)

### Overview
On the Post Project page (`/owner/projects/new`), when `VITE_FEATURE_AI_BRIEF` is enabled, an optional Card 4 "Repository & advisory brief" allows the project owner to:
1. Connect a GitHub repository with verified read-only access.
2. Click "Analyze repo & generate brief" and observe honest 3-stage progress (`indexing` -> `hypothesizing` -> `planning`).
3. Inspect a side-by-side comparison:
   - Left column: "Your project" snapshot (source of truth).
   - Right column: "Developer brief" advisory analysis (problem summary, suspected files, root cause, implementation plan, editable acceptance criteria).
4. Remove unwanted suspected files or criteria, add new criteria, edit existing ones.
5. Confirm and publish directly (`Confirm & publish to developers`) or draft & publish (`VITE_DRAFT_PUBLISH`). The confirmed brief is persisted with the project and rendered read-only on the project detail screen (`/owner/projects/:projectId`).

### Security & Sanitization
- All AI and repository outputs are strictly treated as UNTRUSTED content:
  - Validated by Zod schemas and capped in length.
  - Rendered exclusively as plain text (no markdown parsing, no HTML interpretation, no auto-links).
  - Secret redaction automatically masks embedded API keys, JWTs, OAuth tokens, and URL credentials.

### Feature Flags
- `VITE_FEATURE_AI_BRIEF`: Enables the AI advisory brief flow (`true` = on, `false` = off, unset = on when mocks enabled).
- `VITE_DRAFT_PUBLISH`: Enables draft-first project creation before final publish (`true` = on, `false` = off, unset = on when mocks enabled).

### Dev Drawer Controls (`Ctrl+Shift+D`)
- **GitHub Service**: Toggle 503 error simulation or select mock scenarios (`normal`, `needs-auth`, `missing-repo`, `no-access`).
- **Code-Context Service**: Toggle 503 error simulation or brief generation failure (`normal`, `fail-stage-1`, `fail-stage-2`, `fail-stage-3`).
- **AI Brief Delay**: Adjust polling stage duration (0ms to 4000ms).

---

## Review and Payment Verification (Part B)

### Overview
When a developer submits completed work for a project, the project enters `in_review` status. The project owner navigates to the dedicated Review and Payment page (`/owner/projects/:projectId/review`), which enforces an exact 4-tier evaluation and settlement flow:

1. **Submission details**:
   - Version tag, submission timestamp, developer identity, summary, and developer handover notes.
   - Commit SHA with one-click copy and verified state.
2. **Automated check results**:
   - Container execution results (`passed`, `failed`, or `running`) with overall duration.
   - Individual check entries (e.g. `npm ci`, `npm run build`, `npm run lint`, `pytest`, `mkdocs build`).
   - Exit code, execution duration, and expandable execution log tail with secret masking.
   - Full log drawer (`GET /checks/{id}/log`) for inspectable execution stdout/stderr.
3. **AI requirement scorecard** (rendered when `VITE_FEATURE_AI_VERIFICATION` is enabled):
   - Strict advisory evaluation against project acceptance criteria: `met`, `partially_met`, `not_met`, or `unclear`.
   - Confidence rating (`high`, `medium`, `low`) and summary.
   - File citations with line ranges and snippet evidence.
   - Potential risks with severity (`high`, `medium`, `low`) and concrete recommendations.
   - Clear advisory badge: *"AI is advisory and does not decide acceptance or release funds."*
4. **Human decision bar & escrow settlement**:
   - Sticky bar with primary action: `Approve and release ₹{amount}` (amber-accented currency).
   - Secondary action: `Request changes`.
   - Pure decision guard: The AI scorecard **never** enables, disables, or alters decision buttons. Decisions are governed strictly by project status, submission status, automated container checks, and escrow payment availability.
   - **ApproveDialog**: Requires explicit confirmation, displays recipient freelancer name, releases held escrow (`POST /payment/release`), submits approval (`POST /review`), and transitions project to `completed`.
   - **ChangesDialog**: Prompts the owner for feedback (minimum 10 characters, maximum 1000) and optional flagged criteria, submits `changes_requested`, and transitions project back to `in_progress`.

### Failure Isolation
- If AI verification fails to load (`GET /submissions/{id}/ai-verification` 404 or 500), an inline card error with a **Retry** button is displayed. Automated check results, submission details, and the human decision bar remain fully functional and unblocked.
- If payment release fails (e.g. network partition or bank timeout), the dialog shows an inline error notification allowing the owner to retry without losing submission review state.

### Security & Sanitization
- All container logs, developer notes, and AI scorecard reasoning/snippets are UNTRUSTED strings:
  - Secrets (OAuth tokens, API keys, GitHub PATs, JWTs, HTTP passwords) are automatically redacted via `redactSecrets`.
  - Zero Markdown or HTML rendering; text is displayed strictly via native plain text React nodes.

### Feature Flags & Environment
- `VITE_FEATURE_AI_VERIFICATION`: Controls the AI requirement verification section (`"true"` = on, `"false"` = off, unset = on when `VITE_USE_MOCKS=true`, otherwise off).
- Money is formatted in INR (`₹`) using `Intl.NumberFormat('en-IN')` with `tabular-nums`.

### Dev Drawer Controls (`Ctrl+Shift+D`)
- **Review Scenario**: Toggle between three realistic scenarios:
  - `pass`: Clean build, all checks passing, all criteria met, low risk.
  - `mixed`: All automated checks pass, but AI flags 1 partial criterion and a medium regression risk.
  - `fail`: Automated unit test failure (`exitCode: 1`), failing criterion, high risk; Approve button automatically disabled by automated check failure.
- **Fail Next Payment Release**: Simulates a payment gateway error on escrow release to test settlement failure handling.
- **Fail AI Verification**: Simulates AI verification service failure to verify failure isolation.
- **Reset Review State**: Clears `mock.review.v1` in `sessionStorage` and restores initial review fixture state.


### Environment Variable
Configure `VITE_GRAFANA_URL` in your `.env` (never hard-coded in source):
```env
VITE_GRAFANA_URL=http://<backend-host>:3001/d/codebridge-analytics/codebridge-platform-analytics?orgId=1&kiosk
```

### Discovery Script
To automatically discover all panels and template variables from the running Grafana dashboard and update documentation:
```bash
node scripts/discover-grafana-panels.mjs
```
This updates `docs/GRAFANA_PANELS.md` and outputs panel IDs, titles, types, rows, and grid positions.

### Configuration Flags
Configured in `src/features/overview-analytics/panels.config.ts`:
- **`SHOW_STAT_PANELS`** (default: `false`): The Overview already renders native KPI cards. Set to `true` to also show the four Grafana stat panels as a compact strip above the charts.
- **`hidden`** on any `PanelSpec`: Set `hidden: true` to suppress any specific panel from rendering in the grid.

### Features & Controls
- **Time range selector**: `24 hours`, `7 days`, `30 days` with arrow-key keyboard navigation and mobile Select support.
- **External link**: "Open in Grafana" link launches the full Grafana dashboard in a new tab without kiosk chrome.
- **Dynamic theme synchronization**: `MutationObserver` on `document.documentElement` syncs light/dark mode with Grafana via `theme=dark` or `theme=light`.
- **Auto-refresh**: Each panel refreshes automatically every 1 minute via the `refresh=1m` URL parameter.
- **Preferences persistence**: Time range selection persists in `sessionStorage` under key `cb-analytics-prefs-v1`.

### Testing the Four Connection States
1. **Not configured**:
   - Set `VITE_GRAFANA_URL=` (empty or omitted in `.env`).
   - The section displays an "Analytics is not configured" card with configuration guidance.
2. **Can't reach Grafana (Unreachable)**:
   - Set `VITE_GRAFANA_URL=http://127.0.0.1:9999/d/codebridge-analytics/platform?orgId=1` (an offline port).
   - The probe attempts connection, fails gracefully, and displays "Can't reach Grafana" with "Try again" and "Open in Grafana" buttons (no black box).
3. **Mixed content block**:
   - Serve the app over `https://` while `VITE_GRAFANA_URL` uses `http://`.
   - The section displays "The browser blocks this embed" explaining the HTTPS/HTTP mismatch.
4. **Connected / Ready**:
   - Set `VITE_GRAFANA_URL` to the active Grafana host.
   - The individual panel cards load smoothly inside the grid with lazy loading and skeleton overlays.

---

## Select Component

A reusable, accessible, frosted-glass Select component that replaces native `<select>` controls across the user-facing UI. Built in accordance with WAI-ARIA 1.2 select-only combobox patterns, featuring subtle glassmorphism, warm brown theme highlights, and fluid sliding active motion.

### Component API

```tsx
import { Select, type SelectOption } from './components/ui/Select';

<Select
  id="optional-id"
  value={value}
  onChange={(newValue: string) => setValue(newValue)}
  onBlur={() => {}}
  name="fieldName" // Renders hidden input for form integration
  options={[
    { value: 'available', label: 'Available for Tasks', tone: 'success' },
    { value: 'open', label: 'Open to Offers', tone: 'primary' },
    { value: 'busy', label: 'Busy / Not Taking Tasks', disabled: true, tone: 'muted' },
    { value: 'offline', label: 'Offline', description: 'Do not disturb' }
  ]}
  placeholder="Select an option…"
  disabled={false}
  invalid={false}
  required={false}
  size="md" // 'md' (40px) or 'sm' (32px)
  aria-label="Selection label"
  aria-labelledby="label-element-id"
  aria-describedby="description-element-id"
  className="custom-classes"
/>
```

### Keyboard Navigation & Shortcuts

| Key | When Closed | When Open |
| --- | --- | --- |
| `ArrowDown` | Opens popover; selects current or first enabled option | Moves active highlight down (skips disabled, clamps) |
| `ArrowUp` | Opens popover; selects current or first enabled option | Moves active highlight up (skips disabled, clamps) |
| `Enter` / `Space` | Opens popover | Selects active option and closes |
| `Home` | — | Jumps to first enabled option |
| `End` | — | Jumps to last enabled option |
| `PageDown` | — | Moves down by 10 options |
| `PageUp` | — | Moves up by 10 options |
| `Escape` | — | Closes popover without selecting; stops event propagation to parent dialogs |
| `Tab` | Advances focus naturally | Selects active option, closes, and advances focus |
| Character keys (`a`-`z`) | Opens and cycles matching options | 500ms typeahead buffer; repeated letters cycle matches |


