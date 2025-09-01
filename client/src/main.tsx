import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';

// Initialize Sentry for frontend error tracking
if (import.meta.env.VITE_SENTRY_DSN && import.meta.env.MODE === 'production') {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE || 'development',
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
    beforeSend(event) {
      // Remove sensitive data from frontend errors
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      return event;
    },
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

// Global error handling for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  // Ignore common browser extension errors
  const ignoredErrors = [
    'The message port closed before a response was received',
    'mce-autosize-textarea',
    'custom element',
    'ResizeObserver loop limit exceeded',
  ];

  const shouldIgnore = ignoredErrors.some(
    (ignored) =>
      event.reason?.message?.includes(ignored) || event.reason?.toString()?.includes(ignored)
  );

  if (shouldIgnore) {
    event.preventDefault();
  }
});

// Global error handling for script errors
window.addEventListener('error', (event) => {
  // Ignore common HMR and extension errors
  const ignoredErrors = ['mce-autosize-textarea', 'custom element', 'webcomponents-ce.js'];

  const shouldIgnore = ignoredErrors.some(
    (ignored) => event.message?.includes(ignored) || event.filename?.includes(ignored)
  );

  if (shouldIgnore) {
    event.preventDefault();
  }
});

// Wrap App with Sentry Error Boundary
const SentryApp = (import.meta.env.VITE_SENTRY_DSN && import.meta.env.MODE === 'production')
  ? Sentry.withErrorBoundary(App, {
      fallback: ({ error, resetError }) => (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Oops! Algo deu errado</h2>
            <p className="text-gray-600 mb-4">
              Um erro inesperado aconteceu. Nossa equipe foi notificada automaticamente.
            </p>
            <button 
              onClick={resetError}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      ),
      showDialog: false,
    })
  : App;

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <SentryApp />
  </ErrorBoundary>
);
