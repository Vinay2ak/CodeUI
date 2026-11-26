import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { VITE_USE_MOCKS, VITE_MOCK_SERVICES } from "./lib/env";
import { applyTheme, getTheme } from "./lib/theme";
import "./styles/tokens.css";
import "./styles/index.css";
import "./components/ui/Select/select.css";

// Apply saved theme on load
applyTheme(getTheme());

async function enableMocks(): Promise<void> {
  const shouldStartMocks = VITE_USE_MOCKS || VITE_MOCK_SERVICES.length > 0;
  if (!shouldStartMocks) return;
  try {
    const { startMocks } = await import("./mocks/browser");
    await Promise.race([
      startMocks(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("MSW start timeout")), 800)),
    ]);
  } catch (err) {
    console.warn("[MSW] Mock service worker warning (continuing render):", err);
  }

  try {
    if (import.meta.env.DEV && VITE_USE_MOCKS) {
      const { installDevHelpers } = await import("./mocks/devHelpers");
      installDevHelpers();
    }
  } catch (err) {
    console.warn("[MSW] Failed to install dev helpers:", err);
  }
}

async function bootstrap(): Promise<void> {
  const root = document.getElementById("root");
  if (!root) throw new Error("No #root element");

  try {
    await enableMocks();
  } catch (err) {
    console.warn("[Bootstrap] Mock setup error, rendering app anyway:", err);
  }

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>
  );
}

bootstrap().catch((err) => {
  console.error("[Bootstrap] Fatal error:", err);
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0B132B;color:#EEF2F7;font-family:sans-serif;padding:24px;">
        <div style="max-width:440px;background:#1C2541;border:1px solid #3A506B;border-radius:8px;padding:24px;text-align:center;">
          <h2 style="margin:0 0 12px;font-size:18px;">Could not start application</h2>
          <p style="margin:0 0 16px;color:#9FB3C8;font-size:14px;">${err?.message || "An unexpected error occurred during bootstrap."}</p>
          <button onclick="localStorage.clear();sessionStorage.clear();document.cookie='mock_rt=;path=/;max-age=0';location.reload();" style="background:#5BC0DE;color:#0B132B;border:none;border-radius:6px;padding:8px 16px;font-weight:600;cursor:pointer;">
            Clear data & reload
          </button>
        </div>
      </div>
    `;
  }
});
