import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { AnalyticsSection } from './AnalyticsSection';
import * as probeModule from './probe';
import { env } from '../../lib/env';

describe('AnalyticsSection component', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('1. renders not-configured card when VITE_GRAFANA_URL is empty', async () => {
    const original = env.VITE_GRAFANA_URL;
    env.VITE_GRAFANA_URL = '';

    render(<AnalyticsSection />);

    expect(screen.getByRole('heading', { level: 2, name: 'Analytics' })).toBeInTheDocument();
    expect(screen.getByText('Analytics is not configured')).toBeInTheDocument();

    env.VITE_GRAFANA_URL = original;
  });

  it('2. renders unreachable state when Grafana probe fails', async () => {
    const original = env.VITE_GRAFANA_URL;
    env.VITE_GRAFANA_URL = 'http://offline.local:3001/d/codebridge-analytics/platform';

    vi.spyOn(probeModule, 'probeGrafana').mockResolvedValue('unreachable');

    render(<AnalyticsSection />);

    await waitFor(() => {
      expect(screen.getByText("Can't reach Grafana")).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /open in grafana/i }).length).toBeGreaterThanOrEqual(1);

    env.VITE_GRAFANA_URL = original;
  });

  it('3. renders panel cards when probe succeeds', async () => {
    const original = env.VITE_GRAFANA_URL;
    env.VITE_GRAFANA_URL = 'http://backend.local:3001/d/codebridge-analytics/platform';

    vi.spyOn(probeModule, 'probeGrafana').mockResolvedValue('reachable');

    render(<AnalyticsSection />);

    await waitFor(() => {
      expect(screen.getByTitle('Project Creation Timeline (Grafana)')).toBeInTheDocument();
    });

    expect(screen.getByTitle('Projects by Status (Grafana)')).toBeInTheDocument();
    expect(screen.getByTitle('Budget by Status (Grafana)')).toBeInTheDocument();
    expect(screen.getByTitle('Users by Role (Grafana)')).toBeInTheDocument();
    expect(screen.getByTitle('Recent Projects (Grafana)')).toBeInTheDocument();

    env.VITE_GRAFANA_URL = original;
  });

  it('4. updates time range and saves to sessionStorage', async () => {
    const original = env.VITE_GRAFANA_URL;
    env.VITE_GRAFANA_URL = 'http://backend.local:3001/d/codebridge-analytics/platform';

    vi.spyOn(probeModule, 'probeGrafana').mockResolvedValue('reachable');

    render(<AnalyticsSection />);

    await waitFor(() => {
      expect(screen.getByTitle('Project Creation Timeline (Grafana)')).toBeInTheDocument();
    });

    const radio7d = screen.getByRole('radio', { name: '7 days' });
    fireEvent.click(radio7d);

    const saved = JSON.parse(sessionStorage.getItem('cb-analytics-prefs-v1') || '{}');
    expect(saved.range).toBe('7d');

    // Panel iframe src should now reflect 7d
    const iframe = screen.getByTitle('Project Creation Timeline (Grafana)') as HTMLIFrameElement;
    expect(iframe.src).toContain('from=now-7d');

    env.VITE_GRAFANA_URL = original;
  });
});
