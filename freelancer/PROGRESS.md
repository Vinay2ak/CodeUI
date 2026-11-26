# Implementation Progress - Freelancer Developer Workspace

## Part B Plan
1. Code state & services: useFiles, highlight.js core, gate.ts & gate.test.ts, commands.ts & commands.test.ts, mock runner.
2. Code pane UI: FileExplorer, CodeTabs, CodeView, CodeEditor, code.css syntax tokens, AI context "Open" button.
3. Dock: Terminal (boot logs, history, commands) & Tests runner (streaming progress, stale banner, Brief criteria sync).
4. Submission & Dev drawer: SubmissionPanel (gate checklist, notes, escrow sync), DevDrawer (503 toggles, scenarios).
5. Layout, accessibility & docs: 3-column / mobile tabs, keyboard shortcuts modal, contract & README update, verification.

## Part B Phases
- [x] **Phase 1: Code state and services**
  - `features/code/useFiles.ts` (tree, tabs max 6, drafts, dirty/saved tracking)
  - `features/code/highlight.ts` (highlight.js/lib/core with 9 languages)
  - `features/submission/gate.ts` & `features/submission/gate.test.ts` (>=8 tests)
  - `features/dock/commands.ts` & `features/dock/commands.test.ts` (>=6 tests)
  - Enhanced mock handlers & simulator (mock.workspace.files.v1 persistence, test streaming, gate validation)
- [x] **Phase 2: Explorer, tabs, viewer, editor**
  - `FileExplorer` (tree, collapsible, changed badges, Changes list modal)
  - `CodeTabs` (dirty dot, close, tablist navigation)
  - `CodeView` & `CodeEditor` (synced gutter, Tab 2 spaces, Esc, Ctrl+S)
  - `src/styles/code.css` token-based syntax styles without color literals
  - AI Context tab "Open" button integration
- [x] **Phase 3: Dock: terminal and tests**
  - Collapsible `Dock` (Terminal & Tests tabs, Ctrl+` focus)
  - `Terminal` (boot logs, dev@workspace prompt, command history)
  - `Tests` panel (Run tests, Ctrl+Enter, progressbar, live CbEvents, stale indicator)
  - `BriefTab` criteria status chips updated from latest run
- [x] **Phase 4: Submission panel and dev drawer**
  - `SubmissionPanel` (checklist reasons, notes counter, In review state, reviewer feedback alert)
  - `DevDrawer` (Ctrl+Shift+D, session claims, API call ring log, 503 toggles, scenarios)
- [x] **Phase 5: Layout, accessibility, docs**
  - 3-column desktop & responsive mobile Run tab auto-switching
  - Shortcuts modal dialog (Ctrl+S, Ctrl+Enter, Ctrl+`, Ctrl+Shift+D)
  - Update `README.md`, `CROSS_APP_CONTRACT.md`, `.env.example`, verify build & tests

---
## Completed in Part A
- [x] Phase 1: Scaffold, theme, guards for the theme
- [x] Phase 2: Core: http, session, guards, realtime
- [x] Phase 3: Services and mocks
- [x] Phase 4: Page shell, escrow bar, task panel, workspace status
- [x] Phase 5: Packaging and docs

---
## Feature: modern Select
1. Audit all native <select> elements across src and record list in PROGRESS.md.
2. Implement pure selection and placement logic in src/components/ui/Select/logic.ts.
3. Write comprehensive unit test suite in src/components/ui/Select/logic.test.ts (>=14 cases).
4. Implement custom Select component with WAI-ARIA combobox, frosted glass popover, and select.css.
5. Import select.css into src/main.tsx and verify design tokens without color literals.
6. Replace all non-exempt native selects across features (portfolio availability, runner image, task switchers).
7. Document API and keyboard shortcuts in README.md and update PROGRESS.md.
8. Verify production build (npm run build) and vitest suite (npx vitest run).

### Native Select Audit
- `src/features/portfolio/VerifiedPortfolioView.tsx:380`: Freelancer availability status selection, 3 options, controlled value/onChange.
- `src/features/portfolio/VerifiedPortfolioView.tsx:519`: Default workspace runner container image selection, 3 options, controlled value/onChange.
- `src/features/task/TaskSwitcher.tsx:52`: Active workspace task switcher, dynamic options, controlled value/onChange.
- `src/features/workspace/ControlledWorkspaceView.tsx:143`: Switch workspace task, dynamic options, controlled value/onChange.
- Exception (retained native): `src/components/dev/DevDrawer.tsx:250`: Developer diagnostics test scenario picker (dev drawer internal diagnostic utility).

### Replaced Files
- `src/features/portfolio/VerifiedPortfolioView.tsx`:
  - Replaced availability select with `<Select>` (tones: success, primary, muted).
  - Replaced default runner image select with `<Select>`.
- `src/features/task/TaskSwitcher.tsx`:
  - Replaced task switcher select with `<Select size="sm">`.
- `src/features/workspace/ControlledWorkspaceView.tsx`:
  - Replaced task switch select with `<Select size="sm">`.

### Phases
- [x] Phase 1: Audit and pure logic (tested)
- [x] Phase 2: The component (Select.tsx, useSelect.ts, select.css, index.ts)
- [x] Phase 3: Replace every native select
- [x] Phase 4: Docs and checks

---
## Feature: AI assistant (Part A)
Root files noted: package.json, tsconfig.json, .gitignore (ignored).
Untouched existing features: radar (tasks radar), portfolio (verified developer profile), analytics (telemetry), dashboard (developer overview).

### Plan (at most 10 lines)
1. Pure logic & tests: flags, safeText secret redaction, zod schemas, citations, answerBlocks, askHistory, staleness, rateLimit, requests, safeRendering guard.
2. Services & mocks: extend ai service (capabilities, context, ask), upgrade t1 mock data, keyword-routed aiAsk with citations, handlers & dev scenarios.
3. Upgraded AI context tab: advisory chip, original requirement preview, summary, findings, relevant files with Open/workspace check, dependencies, hints, approach.
4. "Ask AI" tab in Dock: 3-tab Dock, turns log with plain text/code blocks, citations, suggestions, composer, quota, rate-limit timer, task-scoped history.
5. Docs & verification: CROSS_APP_CONTRACT.md, README.md, env & Dockerfile args, tokens/HTML check, vitest run, npm run build.

### Phases
- [x] Phase 1: Pure logic (tested)
- [x] Phase 2: Services and mocks
- [x] Phase 3: Upgrade the AI context tab
- [x] Phase 4: The "Ask AI" tab in the Dock
- [x] Phase 5: Docs and checks

### Changed & Created Files
- `src/lib/features.ts` & `src/lib/features.test.ts` (Feature flag evaluation for VITE_FEATURE_AI & VITE_AI_FEATURES)
- `src/lib/safeText.ts` & `src/lib/safeText.test.ts` (Secret redaction, safeLine control stripping, clampText, isSafePath)
- `src/lib/rateLimit.ts` & `src/lib/rateLimit.test.ts` (Retry-After parser for seconds and HTTP dates)
- `src/lib/env.ts`, `.env.example`, `Dockerfile` (Environment declarations for featureAi & aiFeatures)
- `src/lib/http.ts` (Connected caller AbortSignal to fetch request)
- `src/features/ai-assistant/types.ts` (AiContext, AskAnswer, Citation, AskRequest, AiCapabilities)
- `src/features/ai-assistant/schemas.ts` & `adapters.ts` & `schemas.test.ts` (Zod schemas, deep camelCase, string sanitization)
- `src/features/ai-assistant/citations.ts` & `citations.test.ts` (normalizePath, validateCitations with workspace check, formatRange)
- `src/features/ai-assistant/answerBlocks.ts` & `answerBlocks.test.ts` (parseAnswerBlocks, code fence extraction, plain text output)
- `src/features/ai-assistant/askHistory.ts` & `askHistory.test.ts` (Reducer, 20-turn cap, sessionStorage persistence, clear on logout)
- `src/features/ai-assistant/staleness.ts` & `staleness.test.ts` (isStale comparison with lastSavedAt)
- `src/features/ai-assistant/requests.ts` & `requests.test.ts` (buildAskRequest strict 2-key whitelist)
- `src/features/ai-assistant/safeRendering.test.ts` (Security guard preventing dangerouslySetInnerHTML and markdown parsers)
- `src/services/ai/types.ts`, `api.ts`, `adapters.ts` (Capabilities, context, and askQuestion endpoints)
- `src/mocks/data/ai.ts` (t1 context with dependencies, affectedAreas, setupHints, line ranges)
- `src/mocks/data/aiAsk.ts` & `aiAsk.test.ts` (Keyword routing, mock code blocks, citations, integrity test)
- `src/mocks/handlers.ts` & `src/mocks/controls.ts` (Endpoints, delay, quotas, hostile/slow/fail/rate_limited scenarios)
- `src/components/dev/DevDrawer.tsx` (AI scenario picker & Reset AI button)
- `src/features/task/AiContextTab.tsx` (Advisory chip, original requirement preview, summary, findings, files, dependencies, hints, approach)
- `src/features/task/TaskPanel.tsx` (Conditionally renders AI Context tab based on aiFeature("context"))
- `src/features/dock/AskAiPanel.tsx` (Ask AI conversation log, PlainText, fenced code with copy, citations with editor link, suggestions, composer, live rate-limit counter)
- `src/features/dock/Dock.tsx` (Added 3rd Ask AI tab conditionally on aiFeature("ask"))
- `src/features/code/WorkspaceCenter.tsx` (Passes lastSavedAt and activeEditorFile to Dock)
- `src/session/session.ts` (Calls clearAllAskHistory on session logout)
- `docs/CROSS_APP_CONTRACT.md` (AI assistant contract specification)
- `README.md` (Documented flags, privacy rules, and window.__cbMock controls)

---
## Feature: AI assistant (Part B)
Part A verified intact: features.ts, safeText.ts, ai-assistant/, and "Ask AI" Dock tab.
Untouched features: radar, portfolio, analytics, dashboard (all intact).

### Plan (at most 10 lines)
1. Pure logic & tests: FailureExplanation, SelfCheckReport, DraftSummary schemas, selfCheck logic, draft application/fit, jobs delay, gate invariance, request validation.
2. Services & mocks: extend aiApi (explainFailure, selfCheck, draftSummary, jobs), mock file scanning & rules evaluation, jobs simulator, dev drawer controls.
3. Explain failure: Tests tab "Explain failure" button, explanation drawer with cause, locations, steps, code copy, staleness indicator, error handling.
4. Submission panel: "Before you submit" card with AI self-check table & risks details, draft summary card with insert/replace/append, unsaved file gates.
5. Real-backend mapping & docs: AI_INTEGRATION_NOTES.md, CROSS_APP_CONTRACT.md, README.md, PROGRESS.md, verification checks.

### Phases
- [x] Phase 1: Pure logic (tested)
- [x] Phase 2: Services and mocks
- [x] Phase 3: Explain failure (Tests tab in Dock)
- [x] Phase 4: Submission panel: self-check and draft summary
- [x] Phase 5: Real-backend mapping, docs and checks

### Files Changed & Created in Part B
- `src/features/ai-assistant/types.ts` (Part B failure explanation, self-check report, draft summary, AI jobs)
- `src/features/ai-assistant/schemas.ts` & `src/features/ai-assistant/schemas.test.ts` (Zod schemas with sanitization & secret redaction)
- `src/features/ai-assistant/adapters.ts` & `src/services/ai/adapters.ts` (camelCase adapters)
- `src/features/ai-assistant/selfCheck.ts` & `src/features/ai-assistant/selfCheck.test.ts` (summarizeReport, flagEvidence, isReportStale)
- `src/features/ai-assistant/draft.ts` & `src/features/ai-assistant/draft.test.ts` (clampToWord, applyDraft, fitDraft)
- `src/features/ai-assistant/jobs.ts` & `src/features/ai-assistant/jobs.test.ts` (nextJobDelay, MAX_JOB_POLLS)
- `src/features/ai-assistant/cache.ts` (clearAllAiCaches on logout)
- `src/features/submission/gateInvariance.test.ts` (Verifies computeGate parameter invariance against AI tampering)
- `src/features/ai-assistant/requests.ts` & `src/features/ai-assistant/requests.test.ts` (Strict request whitelisting)
- `src/services/ai/api.ts` & `src/services/ai/types.ts` (explainFailure, startSelfCheck, startDraftSummary, getJob, cancelJob)
- `src/mocks/data/selfCheck.ts` & `src/mocks/data/selfCheck.test.ts` (Pure buildSelfCheck & scanRisks)
- `src/mocks/data/draft.ts` & `src/mocks/data/draft.test.ts` (Pure buildDraft & criteria status notes)
- `src/mocks/handlers.ts` & `src/mocks/controls.ts` (AI mock endpoints, job simulation lifecycle, failNextAiJob)
- `src/components/dev/DevDrawer.tsx` ("Fail next AI job" button)
- `src/features/dock/ExplainDrawer.tsx` & `src/features/dock/ExplainDrawer.test.tsx` (Failure explanation drawer)
- `src/features/dock/TestsPanel.tsx` (Integrated Explain failure buttons, caching, staleness chip, AI not configured warning)
- `src/features/dock/Dock.tsx` (Passed files and lastSavedAt to TestsPanel)
- `src/features/submission/BeforeYouSubmitCard.tsx` & `src/features/submission/BeforeYouSubmitCard.test.tsx` (Self-check & draft card)
- `src/features/submission/SubmissionPanel.tsx` (Integrated BeforeYouSubmitCard before gate checklist)
- `src/session/session.ts` (Hooked clearAllAiCaches on session cleanup)
- `AI_INTEGRATION_NOTES.md` (Capability mapping table and backend LLM provider documentation)
- `docs/CROSS_APP_CONTRACT.md` (Part B AI assistant contract specification)




