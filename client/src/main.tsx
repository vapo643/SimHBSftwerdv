import { createRoot } from 'react-dom/client';
// Temporarily commented to fix rendering issue
// import * as Sentry from '@sentry/react';
import App from './App';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';

// Sentry integration temporarily removed to fix frontend rendering
// TODO: Re-implement with production-only dynamic import

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

// Simplified app without Sentry wrapper for now
const SentryApp = App;

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
