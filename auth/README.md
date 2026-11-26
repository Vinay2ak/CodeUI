# CodeBridge Auth App

Standalone authentication and onboarding frontend for CodeBridge (`/login` and `/register`), built with React, TypeScript, Vite, Tailwind CSS, React Hook Form, Zod, TanStack Query, and MSW v2.

## Quick Start

```bash
npm install
npm run dev        # starts dev server on http://localhost:5173
```

Build & test:

```bash
npm run build      # type-checks (tsc -b) and builds production bundle
npx vitest run     # runs unit tests
```

## Select Component

A modern, WAI-ARIA accessible custom select component with frosted-glass popover, warm brown scrolling/sliding animation highlight, and full keyboard navigation.

### API

```tsx
import { Select } from "./components/ui/Select";

<Select
  id="timezone"
  name="timezone"
  value={value}
  onChange={(val) => setValue(val)}
  options={[
    { value: "utc", label: "UTC" },
    { value: "est", label: "Eastern Time", description: "UTC-5" },
    { value: "custom", label: "Custom", tone: "primary" },
  ]}
  placeholder="Select an option…"
  disabled={false}
  invalid={false}
  required={false}
  size="md"
  aria-label="Timezone"
/>
```

Also wrapped by `SelectField` for structured forms with `label`, `hint`, and `error` display:

```tsx
import { SelectField } from "./features/onboarding/components/SelectField";

<SelectField
  label="Timezone"
  name="timezone"
  options={timezones}
  value={timezone}
  hint="Detected from your browser"
  onChange={(e) => setTimezone(e.target.value)}
  error={errors.timezone}
/>
```

### Keyboard Shortcuts (WAI-ARIA Combobox)

- **Closed**: `ArrowDown`, `ArrowUp`, `Enter`, `Space` open the popover listbox.
- **Open**:
  - `ArrowDown` / `ArrowUp`: Move active highlight to adjacent enabled option.
  - `Home` / `End`: Jump directly to the first / last enabled option.
  - `PageUp` / `PageDown`: Jump by 10 items (clamped, skipping disabled).
  - `Enter` / `Space`: Select the active option and close.
  - `Escape`: Close without selecting (calls `stopPropagation` so modal/dialog stays open).
  - `Tab`: Select active option, close, and advance focus.
  - `Typeahead`: Character typing performs a 500ms case-insensitive prefix search; repeating the same character cycles through options starting with that letter.

### Theme & Motion

- Restrained frosted-glass popover with `backdrop-filter: blur(16px)` and 1px inner highlight sheen.
- Animated warm brown sliding highlight (`.cb-select-highlight`) that glides between options with high-contrast text visibility.
- Custom brown-accented scrollbar (`scrollbar-color`) across standard and WebKit engines.
- Respects `prefers-reduced-motion` and `prefers-reduced-transparency`.

## Environment Variables

Copy `.env.example` to `.env` for local development.

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_USE_MOCKS` | `false` (`true` in `.env.example`) | Set to `"true"` to enable MSW v2 browser mocks instead of calling the API gateway. |
| `VITE_GATEWAY_URL` | `http://localhost:8080` | API gateway base URL (used when `VITE_USE_MOCKS=false`; proxied under `/api` in dev). |
| `VITE_DASHBOARD_URL` | `http://localhost:5175` | Dashboard app URL used for cross-app redirects after authentication/onboarding. |
| `VITE_GITHUB_MODE` | `"mock"` if `VITE_USE_MOCKS=true`, else `"off"` | Controls GitHub linking UI (`"mock"` for simulated link, `"off"` to hide until live). |
| `VITE_BASE_PATH` | `/` | Vite base public path when serving under a subpath. |

## Testing Flows (Mock Mode)

Ensure `VITE_USE_MOCKS=true` in `.env`, then start the dev server (`npm run dev`).

### Tracks

- **Owner track**: open `/register` or `/register?role=owner`, create an account (Step 0), and complete the 3 owner onboarding steps.
- **Freelancer track**: open `/register?role=freelancer`, create an account (Step 0), and complete the 3 freelancer onboarding steps (including optional mock GitHub linking).
- **Resume onboarding**: open `/login` and sign in with `newowner@demo.dev` or `newfreelancer@demo.dev` (any non-empty password) to trigger the `onboardingCompleted === false` gate and resume at `/register?resume=1`.

### Demo Error Triggers

| Email | Endpoint | Result |
| --- | --- | --- |
| `taken@demo.dev` | `POST /auth/register` | `409 Conflict` (`EMAIL_TAKEN`) |
| `limited@demo.dev` | `POST /auth/login` or `POST /auth/register` | `429 Too Many Requests` (`RATE_LIMITED`, `Retry-After: 10`) |
| `down@demo.dev` | `POST /auth/login` or `POST /auth/register` | `503 Service Unavailable` (`SERVICE_UNAVAILABLE`) |
| `suspended@demo.dev` | `POST /auth/login` | `403 Forbidden` (`ACCOUNT_SUSPENDED`) |

### Dev Console Helpers

When `import.meta.env.DEV && VITE_USE_MOCKS === "true"`, `window.__cbMock` is exposed in the browser console:

```js
// Simulate an upstream service outage (503) or restore it
window.__cbMock.serviceDown("identity" | "talent" | "github", true | false);

// Force the next form submission to return a 422 validation error on a field
window.__cbMock.forceFieldError("<fieldName>");
```

## Docker Packaging

`Dockerfile`, `nginx.conf`, and `.dockerignore` build a static Nginx container serving the SPA on port `80` with a `/healthz` health check endpoint (`200 ok`).

```bash
docker build -t codebridge-auth .
docker run -p 8080:80 codebridge-auth
```

Verify health:

```bash
curl http://localhost:8080/healthz
```
