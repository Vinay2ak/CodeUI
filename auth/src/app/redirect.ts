import { VITE_DASHBOARD_URL, VITE_FREELANCER_URL } from "../lib/env";
import type { User } from "../services/identity/types";

export interface RedirectAuthOptions {
  user?: User | null;
  accessToken?: string | null;
  refreshToken?: string | null;
}

export function redirectToDashboard(
  role: "owner" | "freelancer" | "admin",
  auth?: RedirectAuthOptions
): void {
  const token =
    auth?.accessToken ||
    (typeof localStorage !== "undefined"
      ? localStorage.getItem("cb_access_token") || localStorage.getItem("cb_token")
      : null);

  const rt =
    auth?.refreshToken ||
    (typeof localStorage !== "undefined"
      ? localStorage.getItem("cb_refresh_token") || localStorage.getItem("cb_rt")
      : null);

  let user = auth?.user;
  if (!user && typeof localStorage !== "undefined") {
    try {
      const saved = localStorage.getItem("cb_user");
      if (saved) user = JSON.parse(saved);
    } catch {}
  }

  // Set cross-port cookies for all localhost ports
  if (typeof document !== "undefined") {
    if (token) {
      document.cookie = `cb_access_token=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`;
      document.cookie = `cb_token=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`;
    }
    if (rt) {
      document.cookie = `cb_refresh_token=${encodeURIComponent(rt)}; path=/; max-age=604800; SameSite=Lax`;
      document.cookie = `cb_rt=${encodeURIComponent(rt)}; path=/; max-age=604800; SameSite=Lax`;
    }
    if (user) {
      try {
        const uStr = JSON.stringify(user);
        document.cookie = `cb_user=${encodeURIComponent(uStr)}; path=/; max-age=604800; SameSite=Lax`;
        const b64 = btoa(unescape(encodeURIComponent(uStr)));
        document.cookie = `mock_rt=${encodeURIComponent(b64)}; path=/; max-age=604800; SameSite=Lax`;
      } catch {}
    }
  }

  const base =
    role === "freelancer"
      ? (VITE_FREELANCER_URL || "http://localhost:5177").replace(/\/$/, "")
      : (VITE_DASHBOARD_URL || "http://localhost:5175").replace(/\/$/, "");

  const params = new URLSearchParams();
  if (token) {
    params.set("token", token);
    params.set("access_token", token);
  }
  if (rt) {
    params.set("rt", rt);
    params.set("refresh_token", rt);
  }
  params.set("role", role);
  if (user) {
    try {
      params.set("user", JSON.stringify(user));
    } catch {}
  }

  const queryString = params.toString();
  const target = queryString ? `${base}?${queryString}` : base;
  window.location.assign(target);
}

export function redirectToLogin(): void {
  window.location.assign("/login");
}
