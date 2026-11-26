export type GrafanaConnectionStatus = 'reachable' | 'unreachable';

export interface ProbeOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Checks whether the target Grafana server is reachable by probing /api/health.
 * Uses mode: 'no-cors' so cross-origin requests resolve successfully without CORS headers.
 */
export async function probeGrafana(
  origin: string,
  { timeoutMs = 5000, fetchImpl = fetch }: ProbeOptions = {}
): Promise<GrafanaConnectionStatus> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const healthUrl = `${origin.replace(/\/+$/, '')}/api/health`;
    await fetchImpl(healthUrl, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return 'reachable';
  } catch {
    clearTimeout(timeoutId);
    return 'unreachable';
  }
}

/**
 * Detects whether embedding Grafana triggers browser mixed-content blocking
 * (i.e. serving the application over HTTPS while requesting Grafana over plain HTTP).
 */
export function isMixedContent(pageProtocol: string, targetProtocol: string): boolean {
  return pageProtocol === 'https:' && targetProtocol === 'http:';
}
