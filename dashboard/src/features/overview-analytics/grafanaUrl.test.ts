import { describe, it, expect } from 'vitest';
import {
  parseGrafanaUrl,
  buildPanelUrl,
  buildOpenUrl,
  type ParsedGrafanaUrl,
} from './grafanaUrl';

describe('grafanaUrl logic', () => {
  it('1. returns missing failure for null, undefined, or empty string', () => {
    expect(parseGrafanaUrl(null)).toEqual({ ok: false, reason: 'missing' });
    expect(parseGrafanaUrl(undefined)).toEqual({ ok: false, reason: 'missing' });
    expect(parseGrafanaUrl('')).toEqual({ ok: false, reason: 'missing' });
    expect(parseGrafanaUrl('   ')).toEqual({ ok: false, reason: 'missing' });
  });

  it('2. returns invalid failure for non-URL string', () => {
    expect(parseGrafanaUrl('not-a-url')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('3. rejects non-http/https protocols such as ftp', () => {
    expect(parseGrafanaUrl('ftp://example.com/d/dash-1/slug')).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('4. correctly parses /d/<uid>/<slug> dashboard URL', () => {
    const raw = 'http://grafana.internal:3001/d/codebridge-analytics/platform-overview?orgId=2&kiosk';
    const result = parseGrafanaUrl(raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.origin).toBe('http://grafana.internal:3001');
    expect(result.host).toBe('grafana.internal:3001');
    expect(result.uid).toBe('codebridge-analytics');
    expect(result.slug).toBe('platform-overview');
    expect(result.orgId).toBe('2');
  });

  it('5. correctly parses /d-solo/<uid>/<slug> panel URL', () => {
    const raw = 'https://metrics.internal/d-solo/cb-dash/overview?orgId=1&panelId=4';
    const result = parseGrafanaUrl(raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.origin).toBe('https://metrics.internal');
    expect(result.host).toBe('metrics.internal');
    expect(result.uid).toBe('cb-dash');
    expect(result.slug).toBe('overview');
    expect(result.orgId).toBe('1');
  });

  it('6. buildPanelUrl contains panelId, theme, from, to, and orgId', () => {
    const parsed: ParsedGrafanaUrl = {
      ok: true,
      origin: 'http://grafana.test:3001',
      host: 'grafana.test:3001',
      uid: 'dash-123',
      slug: 'slug-abc',
      orgId: '1',
    };

    const url = buildPanelUrl(parsed, {
      panelId: 5,
      range: '7d',
      refresh: '1m',
      theme: 'dark',
    });

    expect(url).toContain('/d-solo/dash-123/slug-abc');
    expect(url).toContain('panelId=5');
    expect(url).toContain('orgId=1');
    expect(url).toContain('from=now-7d');
    expect(url).toContain('to=now');
    expect(url).toContain('theme=dark');
    expect(url).toContain('refresh=1m');
  });

  it('7. buildPanelUrl omits refresh query parameter when refresh is off', () => {
    const parsed: ParsedGrafanaUrl = {
      ok: true,
      origin: 'http://grafana.test:3001',
      host: 'grafana.test:3001',
      uid: 'dash-123',
      slug: 'slug-abc',
      orgId: '1',
    };

    const url = buildPanelUrl(parsed, {
      panelId: 5,
      range: '24h',
      refresh: 'off',
      theme: 'light',
    });

    expect(url).not.toContain('refresh=');
    expect(url).toContain('theme=light');
  });

  it('8. buildPanelUrl appends template variables as var-<name>=<value>', () => {
    const parsed: ParsedGrafanaUrl = {
      ok: true,
      origin: 'http://grafana.test:3001',
      host: 'grafana.test:3001',
      uid: 'dash-123',
      slug: 'slug-abc',
      orgId: '1',
    };

    const url = buildPanelUrl(parsed, {
      panelId: 8,
      range: '30d',
      vars: { owner_id: '$__all', env: 'production' },
    });

    expect(url).toContain('var-owner_id=%24__all');
    expect(url).toContain('var-env=production');
  });

  it('9. buildOpenUrl returns standard /d/ dashboard URL without kiosk parameter', () => {
    const parsed: ParsedGrafanaUrl = {
      ok: true,
      origin: 'http://grafana.test:3001',
      host: 'grafana.test:3001',
      uid: 'dash-123',
      slug: 'slug-abc',
      orgId: '1',
    };

    const url = buildOpenUrl(parsed, { range: '7d' });

    expect(url).toContain('/d/dash-123/slug-abc');
    expect(url).not.toContain('kiosk');
    expect(url).toContain('from=now-7d');
    expect(url).toContain('to=now');
  });

  it('10. does not hard-code any host, IP, or port in source code', () => {
    const sampleInput = 'http://dynamic-host-999.xyz:4000/d/any-uid/any-slug?orgId=5';
    const parsed = parseGrafanaUrl(sampleInput);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.origin).toBe('http://dynamic-host-999.xyz:4000');
    expect(parsed.host).toBe('dynamic-host-999.xyz:4000');

    const panelUrl = buildPanelUrl(parsed, { panelId: 1 });
    expect(panelUrl.startsWith('http://dynamic-host-999.xyz:4000/d-solo/any-uid/any-slug')).toBe(true);
  });
});
