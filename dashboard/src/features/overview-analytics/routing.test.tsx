import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '../../app/AppShell';
import * as sessionModule from '../session/session';

function renderShell(initialEntry = '/admin', role: 'owner' | 'admin' = 'admin') {
  vi.spyOn(sessionModule, 'useSession').mockReturnValue({
    status: 'authenticated',
    user: {
      id: `user-${role}`,
      email: `${role}@example.com`,
      displayName: `${role.toUpperCase()} User`,
      role,
      status: 'active',
      createdAt: new Date().toISOString(),
    },
    accessToken: 'test-token',
    expiresAt: Date.now() + 3600000,
  });

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AppShell>
        <div>Admin Content</div>
      </AppShell>
    </MemoryRouter>
  );
}

describe('Admin Sidebar and Routing without separate Analytics item', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('admin sidebar contains Overview, Users, Service health, Settings without Activity or Analytics', () => {
    renderShell('/admin', 'admin');

    expect(screen.getByRole('link', { name: /^overview$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^users$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^service health$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^settings$/i })).toBeInTheDocument();
    expect(screen.queryAllByRole('link', { name: /^activity$/i })).toHaveLength(0);
  });

  it('does NOT contain an Analytics navigation link in the admin sidebar', () => {
    renderShell('/admin', 'admin');

    const analyticsLinks = screen.queryAllByRole('link', { name: /^analytics$/i });
    expect(analyticsLinks).toHaveLength(0);
  });
});
