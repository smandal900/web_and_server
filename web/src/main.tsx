import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router/dom';
import { NotSupportedError } from './api/client';
import { reportError } from './api/core';
import { router } from './router';
import { AuthProvider } from './state/AuthProvider';
import { I18nProvider } from './state/I18nProvider';
import { ThemeProvider } from './state/ThemeProvider';
import { ToastProvider } from './state/ToastProvider';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      gcTime: 2 * 60_000, // unused data is dropped after 2 minutes (default is 5) to keep browser memory low
      // A feature the server lacks will not appear by retrying; real errors get one retry.
      retry: (count, error) => !(error instanceof NotSupportedError) && count < 1,
    },
  },
});

// Anything that escapes React is sent to the server's error log (Administration -> Error log).
window.addEventListener('error', (e) => reportError(e.error ?? e.message, 'window'));
window.addEventListener('unhandledrejection', (e) => reportError(e.reason, 'promise'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <AuthProvider>
              <RouterProvider router={router} />
            </AuthProvider>
          </ToastProvider>
        </QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
);
