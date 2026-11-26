import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const basePath = env.VITE_BASE_PATH || "/";
  const useMocks = env.VITE_USE_MOCKS === "true";
  const gatewayUrl = (
    env.VITE_GATEWAY_URL ||
    process.env.VITE_GATEWAY_URL ||
    "https://proud-swans-spend.loca.lt"
  )
    .trim()
    .replace(/\/$/, "");

  const isHttps = gatewayUrl.startsWith("https://");
  const isLocal =
    gatewayUrl.startsWith("http://localhost") ||
    gatewayUrl.startsWith("http://127.0.0.1") ||
    gatewayUrl.startsWith("http://192.168.") ||
    gatewayUrl.startsWith("http://10.") ||
    gatewayUrl.startsWith("http://172.");

  // Tunnel skip headers
  const remoteHeaders = {
    "bypass-tunnel-reminder": "true",
    "ngrok-skip-browser-warning": "true",
  };

  // Cookie rewrite helper for dev so local http://localhost receives cookies from remote HTTPS
  const configureProxyCookies = (proxy: any) => {
    proxy.on("proxyRes", (proxyRes: any) => {
      const sc = proxyRes.headers["set-cookie"];
      if (sc) {
        proxyRes.headers["set-cookie"] = (Array.isArray(sc) ? sc : [sc]).map((c: string) =>
          c
            .replace(/;\s*Secure/gi, "")
            .replace(/;\s*SameSite=None/gi, "; SameSite=Lax")
            .replace(/;\s*Domain=[^;]+/gi, "")
        );
      }
    });
  };

  const proxyConfig = !useMocks
    ? {
        "/api": isLocal
          ? {
              target: gatewayUrl,
              changeOrigin: true,
              secure: false,
              ws: true,
            }
          : {
              target: gatewayUrl,
              changeOrigin: true,
              secure: isHttps,
              cookieDomainRewrite: "localhost",
              ws: true,
              headers: remoteHeaders,
              configure: configureProxyCookies,
            },
        "/ws": isLocal
          ? {
              target: gatewayUrl,
              ws: true,
              changeOrigin: true,
              secure: false,
              rewrite: (path: string) =>
                path.replace(/^\/ws(\/events)?/, "/api/v1/notifications/ws"),
            }
          : {
              target: gatewayUrl,
              ws: true,
              changeOrigin: true,
              secure: isHttps,
              cookieDomainRewrite: "localhost",
              rewrite: (path: string) =>
                path.replace(/^\/ws(\/events)?/, "/api/v1/notifications/ws"),
              headers: remoteHeaders,
              configure: configureProxyCookies,
            },
      }
    : undefined;

  return {
    base: basePath,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    plugins: [
      react(),
      {
        name: "disable-dev-cache",
        configureServer(server: any) {
          server.middlewares.use((_req: any, res: any, next: any) => {
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
      port: 5177,
      strictPort: true,
      headers: {
        "Cache-Control": "no-store",
      },
      proxy: proxyConfig,
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      pool: "forks",
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
    },
  };
});
