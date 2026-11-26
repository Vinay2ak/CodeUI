import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast';
import { Toaster } from '../components/ui/sonner';
import { ErrorBoundary } from './ErrorBoundary';

interface ProvidersProps {
  children: React.ReactNode;
}

export const Providers: React.FC<ProvidersProps> = ({ children }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: false,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <ErrorBoundary fallbackTitle="Application Error">
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter
            basename={import.meta.env.BASE_URL}
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            {children}
          </BrowserRouter>
          <Toaster position="bottom-right" />
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};
