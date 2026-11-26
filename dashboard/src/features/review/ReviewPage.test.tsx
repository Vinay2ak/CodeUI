import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { handlers } from '../../mocks/handlers';
import { setAccessToken } from '../../lib/authHeader';
import ReviewPage from './ReviewPage';

function createMockJwt(role = 'owner') {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      gen: 1,
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: 'user-owner-1',
      role,
    })
  );
  return `${header}.${payload}.signature`;
}

const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
  setAccessToken(createMockJwt('owner'));
});

afterAll(() => {
  server.close();
  setAccessToken(null);
});

describe('ReviewPage Component Rendering and Structure', () => {
  it('renders breadcrumb, title, payment card and 4 sections in mandatory order', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/owner/projects/proj-1/review']}>
          <Routes>
            <Route path="/owner/projects/:projectId/review" element={<ReviewPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Wait for submission to load
    await waitFor(() => {
      expect(screen.getByText('Review submission')).toBeDefined();
    });

    // Check payment card
    expect(screen.getByText('Escrow Payment')).toBeDefined();

    // Section 1: Submission
    expect(screen.getByText('Submission')).toBeDefined();
    expect(screen.getAllByText('Ravi Freelancer').length).toBeGreaterThanOrEqual(1);

    // Section 2: Automated check results
    expect(screen.getAllByText('Automated check results').length).toBeGreaterThanOrEqual(1);

    // Section 4: Decision Bar buttons
    expect(screen.getByText('Request changes')).toBeDefined();
    expect(screen.getByText(/Approve and release/i)).toBeDefined();
  });
});
