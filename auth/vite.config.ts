import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type HttpProxy } from "vite";
import type { IncomingMessage } from "node:http";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = process.env.VITE_BASE_PATH ?? env.VITE_BASE_PATH ?? "/";
  const useMocks = (process.env.VITE_USE_MOCKS ?? env.VITE_USE_MOCKS) === "true";
  const gatewayUrl = (
    process.env.VITE_GATEWAY_URL ??
    env.VITE_GATEWAY_URL ??
    process.env.VITE_API_URL ??
    env.VITE_API_URL ??
    "http://localhost:8000"
  )
    .trim()
    .replace(/\/$/, "");

  const isHttps = /^https:/i.test(gatewayUrl);
  const isLocal = /localhost|127\.0\.0\.1/i.test(gatewayUrl);

  const proxyConfig = useMocks
    ? undefined
    : {
        "/api": {
          target: gatewayUrl,
          changeOrigin: true,
          secure: isHttps,
          cookieDomainRewrite: "localhost",
          headers: {
            "bypass-tunnel-reminder": "true",
            "ngrok-skip-browser-warning": "true",
          },
          // Dev-only workaround: rewrite Set-Cookie so cookies from remote HTTPS tunnels are accepted on http://localhost
          configure: (proxy: HttpProxy.Server) => {
            proxy.on("error", (err, _req, res) => {
              if (res && "writeHead" in res && !(res as any).headersSent) {
                (res as any).writeHead(503, { "Content-Type": "application/json" });
                (res as any).end(
                  JSON.stringify({
                    success: false,
                    error: {
                      code: "SERVICE_UNAVAILABLE",
                      message: `Gateway unreachable (${gatewayUrl}): ${err.message}`,
                    },
                  })
                );
              }
            });

            if (isHttps && !isLocal) {
              proxy.on("proxyRes", (proxyRes: IncomingMessage) => {
                const setCookie = proxyRes.headers["set-cookie"];
                if (setCookie) {
                  proxyRes.headers["set-cookie"] = (
                    Array.isArray(setCookie) ? setCookie : [setCookie]
                  ).map((cookie: string) =>
                    cookie
                      .replace(/;\s*Secure/gi, "")
                      .replace(/;\s*SameSite=None/gi, "; SameSite=Lax")
                      .replace(/;\s*Domain=[^;]+/gi, "")
                  );
                }
              });
            }
          },
        },
        "/ws": {
          target: gatewayUrl,
          changeOrigin: true,
          ws: true,
          secure: isHttps,
          cookieDomainRewrite: "localhost",
          headers: {
            "bypass-tunnel-reminder": "true",
            "ngrok-skip-browser-warning": "true",
          },
        },
      };

  return {
    base,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    plugins: [
      react(),
      {
        name: "disable-dev-cache",
        configureServer(server) {
          server.middlewares.use((_req, res, next) => {
            const origSetHeader = res.setHeader.bind(res);
            res.setHeader = function (name: string, value: any) {
              if (name.toLowerCase() === "cache-control") {
                return origSetHeader(name, "no-store, no-cache, must-revalidate");
              }
              return origSetHeader(name, value);
            };
            next();
          });
        },
      },
    ],
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      headers: {
        "Cache-Control": "no-store",
      },
      proxy: proxyConfig,
    },
    test: {
      globals: false,
      environment: "node",
      pool: "forks",
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
    },
  };
});
