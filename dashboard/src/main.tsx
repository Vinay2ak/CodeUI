import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import './components/ui/Select/select.css';
import { env } from './lib/env';

// Step 4d: Mock-only shortcut for local testing without Sign in app
if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true') {
  try {
    const url = new URL(window.location.href);
    let role = url.searchParams.get('role');
    const validRoles = ['owner', 'freelancer', 'admin'];

    // If no mock_rt cookie exists and no role param was provided, default to 'owner'
    // so opening http://localhost:5175/ directly opens the dashboard
    const hasMockCookie = /(?:^|;\s*)mock_rt=/.test(document.cookie);
    if (!role && !hasMockCookie) {
      role = 'owner';
    }

    if (role && validRoles.includes(role)) {
      const mockUsers = {
        owner: {
          id: 'user-owner-1',
          email: 'asha.owner@example.com',
          displayName: 'Asha Owner',
          role: 'owner',
          status: 'active',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        freelancer: {
          id: 'user-freelancer-1',
          email: 'ravi.freelancer@example.com',
          displayName: 'Ravi Freelancer',
          role: 'freelancer',
          status: 'active',
          createdAt: '2026-01-10T00:00:00.000Z',
        },
        admin: {
          id: 'user-admin-1',
          email: 'admin.user@example.com',
          displayName: 'Admin User',
          role: 'admin',
          status: 'active',
          createdAt: '2025-10-01T00:00:00.000Z',
        },
      };

      const userData = mockUsers[role as 'owner' | 'freelancer' | 'admin'];
      const encoded = btoa(JSON.stringify(userData));
      document.cookie = `mock_rt=${encoded}; path=/; max-age=604800; SameSite=Lax`;

      if (url.searchParams.has('role')) {
        url.searchParams.delete('role');
        window.history.replaceState(
          {},
          '',
          url.pathname + (url.search ? url.search : '') + url.hash
        );
      }
    }
  } catch (e) {
    console.warn('Mock shortcut initialization error', e);
  }
}

async function bootstrap() {
  const isFullMock = env.VITE_USE_MOCKS;
  const mockServices = env.VITE_MOCK_SERVICES;
  const isSelectiveMock = !isFullMock && mockServices.length > 0;

  // Print active mode and mocked services once in development console group [CodeBridge env]
  if (import.meta.env.DEV) {
    console.group('[CodeBridge env]');
    console.log(
      'Mode:',
      isFullMock ? 'full-mock' : isSelectiveMock ? 'selective-mock' : 'real-backend'
    );
    console.log(
      'Mocked services:',
      isFullMock
        ? 'all'
        : isSelectiveMock
        ? mockServices.join(', ')
        : 'none'
    );
    console.log('Gateway URL:', env.VITE_GATEWAY_URL);
    console.log('GitHub Mode:', env.VITE_GITHUB_MODE);
    console.groupEnd();
  }

  if (isFullMock) {
    const { startWorker } = await import('./mocks/browser');
    await startWorker();
  } else if (isSelectiveMock) {
    const { startWorker } = await import('./mocks/browser');
    await startWorker(mockServices);
  }

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Failed to find root element');
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap().catch(console.error);
