import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const basePath = env.VITE_BASE_PATH || process.env.VITE_BASE_PATH || '/';
  const useMocks = env.VITE_USE_MOCKS === 'true';

  const gatewayUrl = (
    env.VITE_GATEWAY_URL ||
    process.env.VITE_GATEWAY_URL ||
    'http://localhost:8000'
  )
    .trim()
    .replace(/\/$/, '');
  const isHttps = gatewayUrl.startsWith('https://');

  console.log('>>> VITE PROXY IS CONNECTING TO:', gatewayUrl);

  return {
    base: basePath,
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: true,
      port: 5175,
      strictPort: true,
      headers: {
        'Cache-Control': 'no-store',
      },
      proxy: !useMocks
        ? {
          '/api': {
            target: gatewayUrl,
            changeOrigin: true,
            secure: isHttps,
            cookieDomainRewrite: 'localhost',
            headers: {
              'bypass-tunnel-reminder': 'true',
              'ngrok-skip-browser-warning': 'true',
            },
            configure: (proxy) => {
              proxy.on('error', (err, _req, res) => {
                if (res && 'writeHead' in res && !(res as any).headersSent) {
                  (res as any).writeHead(503, { 'Content-Type': 'application/json' });
                  (res as any).end(
                    JSON.stringify({
                      success: false,
                      error: {
                        code: 'SERVICE_UNAVAILABLE',
                        message: `Gateway unreachable (${gatewayUrl}): ${err.message}`,
                      },
                    })
                  );
                }
              });
              if (isHttps) {
                proxy.on('proxyRes', (proxyRes) => {
                  const setCookie = proxyRes.headers['set-cookie'];
                  if (setCookie) {
                    proxyRes.headers['set-cookie'] = (
                      Array.isArray(setCookie) ? setCookie : [setCookie]
                    ).map((c: string) =>
                      c
                        .replace(/;\s*Secure/gi, '')
                        .replace(/;\s*SameSite=None/gi, '; SameSite=Lax')
                        .replace(/;\s*Domain=[^;]+/gi, '')
                    );
                  }
                });
              }
            },
          },
          '/ws/events': {
            target: gatewayUrl,
            ws: true,
            changeOrigin: true,
            secure: isHttps,
            cookieDomainRewrite: 'localhost',
            rewrite: (path) =>
              path.replace(/^\/ws\/events/, '/api/v1/notifications/ws'),
            headers: {
              'bypass-tunnel-reminder': 'true',
              'ngrok-skip-browser-warning': 'true',
            },
          },
          '/ws': {
            target: gatewayUrl,
            ws: true,
            changeOrigin: true,
            secure: isHttps,
            cookieDomainRewrite: 'localhost',
            headers: {
              'bypass-tunnel-reminder': 'true',
              'ngrok-skip-browser-warning': 'true',
            },
          },
        }
        : undefined,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
    },
  };
});