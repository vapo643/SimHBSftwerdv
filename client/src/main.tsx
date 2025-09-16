import { createRoot } from 'react-dom/client';
import './index.css';
// Dynamic imports for better performance

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

// Dynamic loading initialized below

// Dynamic loading for performance optimization
async function initializeApp() {
  const root = createRoot(document.getElementById('root')!);
  
  // Show loading immediately
  root.render(
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#2563eb', marginBottom: '16px', fontSize: '2rem' }}>
          ⚡ Simpix
        </h1>
        <p style={{ color: '#6b7280', fontSize: '1.1rem' }}>
          Carregando sistema...
        </p>
      </div>
    </div>
  );

  try {
    // Dynamic imports - load only after first paint
    const [{ default: App }, { default: ErrorBoundary }] = await Promise.all([
      import('./App'),
      import('./components/ErrorBoundary')
    ]);

    // Render full app
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
  } catch (error) {
    console.error('Failed to load application:', error);
    root.render(
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ textAlign: 'center', color: '#dc2626' }}>
          <h1>❌ Erro ao Carregar</h1>
          <p>Falha na inicialização do sistema</p>
        </div>
      </div>
    );
  }
}

initializeApp();
