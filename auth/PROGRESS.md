# CodeBridge Auth App — Build Progress

## Plan (8 lines)
Phase 1: Pure TypeScript — options, types, schemas (zod), password, skills, timezone, format, draft; unit tests.
Phase 2: lib/env, lib/http, lib/events, services (identity/talent/github api+types), MSW v2 mocks, dev-helper window.__cbMock.
Phase 3: UI components — Stepper, WizardLayout, OptionCard, PillGroup, TextField/TextArea/NumberField/SelectField, CheckboxRow, GitHubCard/Dialog, WizardNav, PreviewPanel, OwnerTrustCard, FreelancerProfileCard.
Phase 4: Full /register flow — step 0 account creation, owner track (3 steps), freelancer track (3 steps), resume gate, session bootstrap, router.
Phase 5: Packaging — Dockerfile, nginx.conf, .dockerignore, .env.example, README.md; update CROSS_APP_CONTRACT.md. Build + tests green.

## Phases

- [x] Phase 1: Types, options, validation, password logic (pure code, tested)
- [x] Phase 2: Services and mocks
- [x] Phase 3: UI building blocks
- [x] Phase 4: The flow (/register, replaces stub)
- [x] Phase 5: Docs, packaging, verification

## Feature: modern Select

### Plan
1. Audit native <select> occurrences in auth and implement pure selection/placement/typeahead logic in logic.ts with 17+ tests.
2. Build WAI-ARIA accessible <Select> component with useSelect hook, portal popover, sliding highlight, and select.css styles.
3. Replace native select in SelectField and OwnerSteps with <Select>, maintaining controlled value/onChange wiring and styling.
4. Document the component API and shortcuts in README.md, verify build, Vitest suite, and zero color literal violations.

### Phases
- [x] Phase 1: Audit and pure logic (tested)
- [x] Phase 2: The component (Select.tsx, useSelect.ts, select.css, index.ts)
- [x] Phase 3: Replace every native select
- [x] Phase 4: Docs and checks

### Audit of native <select> elements in src/
- `src/features/onboarding/components/SelectField.tsx`: Replaced native `<select>` with `<Select>`. Options normalized to `{ value, label, description, disabled, tone }`. Controlled wiring preserves `e.target.value` synthetic event format.
- `src/features/onboarding/steps/OwnerSteps.tsx`: Uses `<SelectField label="Timezone" name="timezone" options={timezones} value={timezone} ... />` with ~400 IANA timezone options. Fully operational with `<Select>`.
- Exceptions kept native: None in `auth`. Zero native `<select>` tags remain in user-facing code.
