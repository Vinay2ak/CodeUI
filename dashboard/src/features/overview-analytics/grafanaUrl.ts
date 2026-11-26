export type AppTheme = 'light' | 'dark';
export type TimeRange = '24h' | '7d' | '30d';
export type RefreshInterval = 'off' | '30s' | '1m' | '5m';

export interface ParsedGrafanaUrl {
  ok: true;
  origin: string;
  host: string;
  uid: string;
  slug: string;
  orgId: string;
}

export interface ParseGrafanaUrlFailure {
  ok: false;
  reason: 'missing' | 'invalid';
}

export type ParseGrafanaUrlResult = ParsedGrafanaUrl | ParseGrafanaUrlFailure;

/**
 * Parses a configured Grafana URL from environment variables.
 * Accepts /d/<uid>/<slug> or /d-solo/<uid>/<slug> paths under http or https.
 */
export function parseGrafanaUrl(raw: string | undefined | null): ParseGrafanaUrlResult {
  if (!raw || typeof raw !== 'string') {
    return { ok: false, reason: 'missing' };
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, reason: 'missing' };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'invalid' };
  }

  const match = url.pathname.match(/^\/(?:d|d-solo)\/([^/]+)(?:\/([^/]+))?/);
  if (!match) {
    return { ok: false, reason: 'invalid' };
  }

  const uid = match[1];
  const slug = match[2] || uid;
  const orgId = url.searchParams.get('orgId') || '1';

  return {
    ok: true,
    origin: url.origin,
    host: url.host,
    uid,
    slug,
    orgId,
  };
}

export interface BuildPanelUrlOptions {
  panelId: number | null;
  range?: TimeRange;
  refresh?: RefreshInterval;
  theme?: AppTheme;
  vars?: Record<string, string>;
}

/**
 * Constructs an embedded d-solo panel iframe URL.
 */
export function buildPanelUrl(
  parsed: ParsedGrafanaUrl,
  {
    panelId,
    range = '24h',
    refresh = '1m',
    theme = 'dark',
    vars = {},
  }: BuildPanelUrlOptions
): string {
  const url = new URL(`${parsed.origin}/d-solo/${parsed.uid}/${parsed.slug}`);

  url.searchParams.set('orgId', parsed.orgId);
  if (panelId !== null && panelId !== undefined) {
    url.searchParams.set('panelId', String(panelId));
  }
  url.searchParams.set('from', `now-${range}`);
  url.searchParams.set('to', 'now');
  url.searchParams.set('theme', theme);

  if (refresh && refresh !== 'off') {
    url.searchParams.set('refresh', refresh);
  }

  for (const [varName, varValue] of Object.entries(vars)) {
    if (varValue !== undefined && varValue !== null && varValue !== '') {
      url.searchParams.set(`var-${varName}`, varValue);
    }
  }

  return url.toString();
}

export interface BuildOpenUrlOptions {
  range?: TimeRange;
  vars?: Record<string, string>;
}

/**
 * Constructs the target URL to view the full Grafana dashboard in a new tab without kiosk.
 */
export function buildOpenUrl(
  parsed: ParsedGrafanaUrl,
  { range = '24h', vars = {} }: BuildOpenUrlOptions = {}
): string {
  const url = new URL(`${parsed.origin}/d/${parsed.uid}/${parsed.slug}`);
  url.searchParams.set('orgId', parsed.orgId);
  url.searchParams.set('from', `now-${range}`);
  url.searchParams.set('to', 'now');

  for (const [varName, varValue] of Object.entries(vars)) {
    if (varValue !== undefined && varValue !== null && varValue !== '') {
      url.searchParams.set(`var-${varName}`, varValue);
    }
  }

  return url.toString();
}
