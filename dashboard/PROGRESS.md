# CodeBridge Dashboard Implementation Progress

- [x] Phase 1: Scaffold, tokens, theme, shell
- [x] Phase 2: Core session, http, guards
- [x] Phase 3: Mocks (the stand-in for all services)
- [x] Phase 4: Realtime
- [x] Phase 5: The three dashboards
- [x] Phase 6: Dev drawer (only when VITE_DEV_TOOLS === "true")
- [x] Phase 7: Independent deployment packaging

## Feature: Post project and matches
- [x] Phase 1: Dependencies, vocabulary, schema, pure logic (tested)
- [x] Phase 2: Services and mocks
- [x] Phase 3: The Post project page (/owner/projects/new)
- [x] Phase 4: The project page and recommended developers (/owner/projects/:projectId)
- [x] Phase 5: Routing, owner dashboard changes, events, theme
- [x] Phase 6: Docs and checks

## Feature: Admin analytics
Deleted files:
- src/features/dashboard/components/GrafanaAnalytics.tsx
- src/features/admin/AdminAnalytics.tsx
- src/features/admin/AdminAnalytics.test.tsx
- src/pages/admin/Analytics.tsx

Plan:
- [x] Phase 1: Pure logic (grafanaUrl, probe, prefs) and tests
- [x] Phase 2: AnalyticsPage component, states (configured, unreachable, loading, ready), theme sync
- [x] Phase 3: Routing (/admin/analytics), admin sidebar item, and overview entry card
- [x] Phase 4: Docs (.env.example, README.md, CROSS_APP_CONTRACT.md), Dockerfile, and checks

## Feature: modern Select
Audit of native selects:
- src/features/matching/ProjectMatchesPage.tsx: Match sorting (3 options: best, price, availability; controlled)
- src/features/dashboard/components/SettingsPanel.tsx: Escrow auto-release days (3 options: 3, 7, 14 days; controlled)
- src/features/project/PostProjectModal.tsx: Project initial status (2 options: in_progress, draft; controlled)
- src/features/admin-analytics/AutoRefreshControl.tsx: Grafana auto-refresh interval (4 options: off, 30s, 1m, 5m; controlled)
- src/features/admin-analytics/TimeRangeControl.tsx: Mobile Grafana time range (5 options: 1h, 6h, 24h, 7d, 30d; controlled)
Exceptions (stay native): src/devtools/DevDrawer.tsx (dev drawer)

Replaced files (user-facing UI native selects replaced with custom Select):
- src/features/matching/ProjectMatchesPage.tsx (Match sorting)
- src/features/dashboard/components/SettingsPanel.tsx (Escrow auto-release period)
- src/features/project/PostProjectModal.tsx (Project initial status)
- src/features/admin-analytics/AutoRefreshControl.tsx (Grafana auto-refresh)
- src/features/admin-analytics/TimeRangeControl.tsx (Mobile Grafana time range)

Plan:
- [x] Phase 1: Audit and pure logic (logic.ts, logic.test.ts)
- [x] Phase 2: Custom Select component, useSelect hook, styles (select.css), main.tsx import
- [x] Phase 3: Replace native <select> in user-facing UI
- [x] Phase 4: Documentation (README.md, PROGRESS.md) and verification checks

## Feature: Analytics merged into the Admin Overview
- [x] Phase 1: Audit & remove standalone analytics page/route/sidebar, discovery script & docs/GRAFANA_PANELS.md, panels.config.ts
  - Removed files:
    - src/features/admin-analytics/AdminAnalyticsPage.tsx
    - src/features/admin-analytics/AdminAnalyticsPage.test.tsx
    - src/features/admin-analytics/AutoRefreshControl.tsx
    - src/features/admin-analytics/TimeRangeControl.tsx
    - src/features/admin-analytics/types.ts
    - src/features/admin-analytics/constants.ts
    - src/features/admin-analytics/analytics.css
    - src/features/admin-analytics/components/AdminHeader.tsx
    - src/features/admin-analytics/components/LiveTelemetryHeader.tsx
    - src/features/admin-analytics/components/StatCards.tsx
    - src/features/admin-analytics/components/TelemetryDrawer.tsx
    - src/features/admin-analytics/components/UserRetentionChart.tsx
    - src/features/admin-analytics/components/GrafanaKioskFrame.tsx
    - src/features/admin-analytics/components/ProjectDistributionChart.tsx
    - src/features/admin-analytics/components/RevenueTrendChart.tsx
- [x] Phase 2: Pure logic (grafanaUrl, probe, layout, prefs) & Vitest suites in src/features/overview-analytics/
- [x] Phase 3: AnalyticsSection component, PanelCard, 12-col grid, states (not-configured, mixed-content, checking, unreachable, ready)
- [x] Phase 4: Integrate AnalyticsSection into Admin Overview (#analytics), /admin route & /admin/analytics redirect, env & contract docs
- [x] Phase 5: Verification checks, test suite validation, build check, and dev start commands

## Feature: AI developer brief (Part A)
- [x] Phase 1: Pure foundations (features flag, safeText secret redaction, hash, zod schemas, briefEdit, aiFlow reducer, safeRendering test, types)
- [x] Phase 2: Services (project, github, codeContext), adapters, mock handlers, sessionStorage persistence, and dev drawer helpers
- [x] Phase 3: PostProjectPage Card 4 (GithubConnectCard, AnalyzeBar, honest 3-stage AnalysisProgress with polling & cancel)
- [x] Phase 4: Side-by-side BriefComparison (snapshot vs advisory brief, inline edit/remove, validation, stale tracking, publish & draft persistence) and Project page read-only card
- [x] Phase 5: Documentation (.env.example, README.md, CROSS_APP_CONTRACT.md, Dockerfile), checks and verification report

## Feature: Review and payment verification (Part B)
- [x] Phase 1: Pure logic (types, schemas, decisionGuard, evidence, signals, format) and Vitest suites
- [x] Phase 2: Services (review, verification, payment), adapters, mock scenarios ("pass"|"mixed"|"fail"), dev drawer helpers
- [x] Phase 3: ReviewPage component (/owner/projects/:projectId/review), 4 sections, ApproveDialog & ChangesDialog
- [x] Phase 4: Integration (router, project in_review card, table link, realtime submission.status_changed event, drawer)
- [x] Phase 5: Documentation (.env.example, Dockerfile, README, CROSS_APP_CONTRACT), AI_INTEGRATION_NOTES.md & verification checks
