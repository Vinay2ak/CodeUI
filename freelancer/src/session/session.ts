import { env } from "../lib/env";
import { configureHttpAuth, request } from "../lib/http";
import { ApiError } from "../lib/errors";
import { realtimeManager } from "../realtime/manager";
import { clearAllAskHistory } from "../features/ai-assistant/askHistory";
import { clearAllAiCaches } from "../features/ai-assistant/cache";

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: "owner" | "freelancer" | "admin";
  status: "active" | "suspended";
  createdAt: string;
  onboardingCompleted: boolean;
}

export type SessionStatus = "loading" | "authenticated" | "unavailable" | "suspended" | "expired";

export interface SessionState {
  status: SessionStatus;
  user: User | null;
  accessToken: string | null;
  expiresAt: number | null;
}

class SessionStore {
  private state: SessionState = {
    status: "loading",
    user: null,
    accessToken: null,
    expiresAt: null,
  };

  // In-memory refresh token fallback if needed without cookies
  private inMemoryRefreshToken: string | null = null;
  private listeners = new Set<(state: SessionState) => void>();
  private refreshPromise: Promise<string | null> | null = null;
  private proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private authChannel: BroadcastChannel | null = null;

  constructor() {
    // Access token is strictly kept in memory
    configureHttpAuth(
      () => this.state.accessToken,
      () => this.refreshSession()
    );

    if (typeof BroadcastChannel !== "undefined") {
      this.authChannel = new BroadcastChannel("cb-auth");
      this.authChannel.onmessage = (event) => {
        if (event.data?.type === "logout") {
          this.handleExternalLogout();
        }
      };
    }
  }

  public getState(): SessionState {
    return this.state;
  }

  public subscribe(listener: (state: SessionState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(partial: Partial<SessionState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener(this.state));
  }

  public async restoreSession(): Promise<void> {
    try {
      this.setState({ status: "loading" });
      const token = await this.refreshSession();
      if (!token) {
        window.location.assign(env.signinUrl);
        return;
      }

      // Fetch user profile only if not already populated from refresh response
      let user: User | null = this.state.user;
      if (!user) {
        let rawUser: any;
        try {
          rawUser = await request<any>("/users/me");
        } catch {
          try {
            rawUser = await request<any>("/auth/me");
          } catch {
            // Both failed
          }
        }

        if (rawUser) {
          const userObj = rawUser.user || rawUser.data || rawUser;
          const roleStr = (userObj.role || "freelancer").toLowerCase();
          user = {
            id: userObj.id || "anonymous",
            email: userObj.email || "",
            displayName:
              userObj.displayName ||
              userObj.full_name ||
              userObj.name ||
              userObj.email?.split("@")[0] ||
              "Freelancer",
            role: (roleStr === "owner" ? "owner" : roleStr === "admin" ? "admin" : "freelancer"),
            status:
              userObj.is_active === false || userObj.status === "suspended"
                ? "suspended"
                : "active",
            createdAt: userObj.created_at || userObj.createdAt || new Date().toISOString(),
            onboardingCompleted: userObj.onboardingCompleted ?? userObj.onboarding_completed ?? true,
          };
        }
      }

      if (user && user.status === "suspended") {
        this.setState({ status: "suspended", user });
        return;
      }

      // Redirect if onboarding incomplete
      if (user && user.onboardingCompleted === false) {
        window.location.assign(`${env.registerUrl}?resume=1`);
        return;
      }

      // Role guard: redirect if not freelancer
      if (user && user.role !== "freelancer") {
        window.location.assign(`${env.dashboardUrl}/${user.role}`);
        return;
      }

      this.setState({
        status: "authenticated",
        user,
      });

      realtimeManager.start(token);
    } catch (err: unknown) {
      if (this.state.user && this.state.accessToken) {
        this.setState({ status: "authenticated" });
        return;
      }

      if (env.useMocks) {
        const fallbackUser: User = {
          id: "freelancer_demo",
          email: "freelancer@demo.dev",
          displayName: "Freelancer Dev",
          role: "freelancer",
          status: "active",
          createdAt: new Date().toISOString(),
          onboardingCompleted: true,
        };
        this.setState({
          status: "authenticated",
          user: fallbackUser,
          accessToken: this.state.accessToken || "mock_token_fl_dev",
        });
        return;
      }

      if (err instanceof ApiError) {
        if (err.code === "ACCOUNT_SUSPENDED" || err.status === 403) {
          this.setState({ status: "suspended" });
          return;
        }
        if (err.status === 401) {
          window.location.assign(env.signinUrl);
          return;
        }
        if (err.status === 503) {
          this.setState({ status: "unavailable" });
          return;
        }
      }
      window.location.assign(env.signinUrl);
    }
  }

  public refreshSession(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        let initialToken: string | null = this.state.accessToken;

        // Check localStorage for persisted token or user
        if (typeof localStorage !== "undefined") {
          if (!initialToken) {
            initialToken =
              localStorage.getItem("cb_access_token") ||
              localStorage.getItem("cb_token") ||
              localStorage.getItem("access_token") ||
              localStorage.getItem("token") ||
              null;
          }
          if (!this.inMemoryRefreshToken) {
            this.inMemoryRefreshToken =
              localStorage.getItem("cb_refresh_token") ||
              localStorage.getItem("refresh_token") ||
              null;
          }
          const storedUser = localStorage.getItem("cb_user") || localStorage.getItem("user");
          if (storedUser && !this.state.user) {
            try {
              const parsed = JSON.parse(storedUser);
              this.setState({ user: parsed });
            } catch {}
          }
        }

        // Check URL parameters for token handoff from auth service
        if (typeof window !== "undefined") {
          const urlParams = new URLSearchParams(window.location.search);
          const hashParams = new URLSearchParams(
            window.location.hash.replace(/^#\/?/, "")
          );

          const urlToken =
            urlParams.get("token") ||
            urlParams.get("access_token") ||
            urlParams.get("accessToken") ||
            hashParams.get("token") ||
            hashParams.get("access_token");

          const urlRt =
            urlParams.get("rt") ||
            urlParams.get("refresh_token") ||
            urlParams.get("refreshToken") ||
            hashParams.get("rt") ||
            hashParams.get("refresh_token");

          const urlUser = urlParams.get("user") || hashParams.get("user");
          let initialUser: User | null = null;
          if (urlUser) {
            try {
              initialUser = JSON.parse(decodeURIComponent(urlUser));
            } catch {
              try {
                initialUser = JSON.parse(urlUser);
              } catch {
                // Invalid JSON
              }
            }
          }

          if (urlToken) {
            initialToken = urlToken;
            urlParams.delete("token");
            urlParams.delete("access_token");
            urlParams.delete("accessToken");
          }

          if (urlRt) {
            this.inMemoryRefreshToken = urlRt;
            urlParams.delete("rt");
            urlParams.delete("refresh_token");
            urlParams.delete("refreshToken");
          }

          if (urlUser) {
            urlParams.delete("user");
            urlParams.delete("role");
          }

          if (urlToken || urlRt || urlUser) {
            const newQuery = urlParams.toString();
            const cleanUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ""
              }`;
            window.history.replaceState({}, "", cleanUrl);
          }

          if (initialUser && !this.state.user) {
            this.setState({ user: initialUser });
          }
        }

        let accessToken: string | null = initialToken;
        let expiresIn = 900;
        let user: User | null = this.state.user;

        // In real backend, refresh token is sent as httpOnly cookie with credentials: "include"
        // Also support inMemoryRefreshToken in request body if cookie is absent
        try {
          const bodyPayload = this.inMemoryRefreshToken
            ? JSON.stringify({ refreshToken: this.inMemoryRefreshToken })
            : undefined;

          const data = await request<any>("/auth/refresh", {
            method: "POST",
            body: bodyPayload,
            skipAuth: true,
          });

          if (data && (data.accessToken || data.access_token)) {
            accessToken = data.accessToken || data.access_token;
          }
          if (data && (data.refreshToken || data.refresh_token)) {
            this.inMemoryRefreshToken = data.refreshToken || data.refresh_token;
          }
          expiresIn = data?.expiresIn || data?.expires_in || 900;

          const rawUser = data?.user || data?.data?.user;
          if (rawUser) {
            const roleStr = (rawUser.role || "freelancer").toLowerCase();
            user = {
              id: rawUser.id || "anonymous",
              email: rawUser.email || "",
              displayName:
                rawUser.displayName ||
                rawUser.full_name ||
                rawUser.name ||
                rawUser.email?.split("@")[0] ||
                "Freelancer",
              role: (roleStr === "owner" ? "owner" : roleStr === "admin" ? "admin" : "freelancer"),
              status:
                rawUser.is_active === false || rawUser.status === "suspended"
                  ? "suspended"
                  : "active",
              createdAt:
                rawUser.created_at || rawUser.createdAt || new Date().toISOString(),
              onboardingCompleted: rawUser.onboardingCompleted ?? rawUser.onboarding_completed ?? true,
            };
          }
        } catch (refreshErr) {
          // If refresh request fails, continue only if we already have an in-memory access token or mock mode
          if (!accessToken && !env.useMocks) {
            throw refreshErr;
          }
          if (env.useMocks && !accessToken) {
            accessToken = "mock_token_fl_dev";
          }
        }

        if (!accessToken && env.useMocks) {
          accessToken = "mock_token_fl_dev";
        }

        if (!accessToken && !env.useMocks) {
          return null;
        }

        const expiresAt = Date.now() + expiresIn * 1000;

        if (typeof localStorage !== "undefined") {
          try {
            if (accessToken) {
              localStorage.setItem("cb_access_token", accessToken);
            }
            if (this.inMemoryRefreshToken) {
              localStorage.setItem("cb_refresh_token", this.inMemoryRefreshToken);
            }
            if (user) {
              localStorage.setItem("cb_user", JSON.stringify(user));
            }
          } catch {}
        }

        this.setState({
          accessToken,
          expiresAt,
          ...(user ? { user } : {}),
        });

        if (accessToken) {
          realtimeManager.reauth(accessToken);
        }
        this.scheduleProactiveRefresh(expiresIn);

        return accessToken;
      } catch (err: unknown) {
        if (err instanceof ApiError) {
          if (err.code === "ACCOUNT_SUSPENDED") {
            this.setState({ status: "suspended" });
            return null;
          }
          if (err.status === 401 && this.state.status === "authenticated") {
            this.setState({ status: "expired" });
            return null;
          }
        }
        if (this.state.status === "authenticated") {
          this.setState({ status: "expired" });
        }
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private scheduleProactiveRefresh(expiresInSec: number): void {
    if (this.proactiveRefreshTimer) {
      clearTimeout(this.proactiveRefreshTimer);
    }
    const delaySec = Math.max(expiresInSec - 60, 30);
    this.proactiveRefreshTimer = setTimeout(() => {
      this.refreshSession().catch(() => {
        // Failed proactive refresh; will retry on 401
      });
    }, delaySec * 1000);
  }

  public async logout(): Promise<void> {
    if (this.proactiveRefreshTimer) {
      clearTimeout(this.proactiveRefreshTimer);
      this.proactiveRefreshTimer = null;
    }

    try {
      await request<void>("/auth/logout", {
        method: "POST",
        body: this.inMemoryRefreshToken
          ? JSON.stringify({ refreshToken: this.inMemoryRefreshToken })
          : undefined,
      });
    } catch {
      // Ignored
    }

    this.clearSession();

    if (this.authChannel) {
      this.authChannel.postMessage({ type: "logout" });
    }

    window.location.assign(env.signinUrl);
  }

  private handleExternalLogout(): void {
    this.clearSession();
    window.location.assign(env.signinUrl);
  }

  private clearSession(): void {
    realtimeManager.stop();
    clearAllAskHistory();
    clearAllAiCaches();
    this.inMemoryRefreshToken = null;
    this.setState({
      status: "expired",
      user: null,
      accessToken: null,
      expiresAt: null,
    });
    // Clean up any legacy localStorage tokens if present
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("cb_access_token");
      localStorage.removeItem("cb_token");
      localStorage.removeItem("cb_refresh_token");
      localStorage.removeItem("cb_rt");
      localStorage.removeItem("cb_user");
    }
  }
}

export const sessionStore = new SessionStore();
