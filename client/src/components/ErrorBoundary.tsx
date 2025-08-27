import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Ignore common browser extension and HMR errors
    const _ignoredErrors = [
      'The message port closed before a response was received',
      'mce-autosize-textarea',
      'custom element',
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
    ];

    const _shouldIgnore = ignoredErrors.some(
      (ignored) =>
        error.message?.includes(ignored) ||
        error.stack?.includes(ignored) ||
        errorInfo.componentStack?.includes(ignored)
    );

    if (!shouldIgnore) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Check if it's a critical error or ignorable
      const _isIgnorable =
        this.state.error?.message?.includes('mce-autosize-textarea') ||
        this.state.error?.message?.includes('message port closed');

      if (isIgnorable) {
        // Reset error state for ignorable errors
        this.setState({ hasError: false, error: undefined });
        return this.props.children; }
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Oops! Algo deu errado</h2>
            <p className="text-gray-600 mb-4">
              A aplicação encontrou um erro inesperado. Por favor, recarregue a página.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children; }
  }
}

// Alias for backward compatibility
export const _UserFormErrorBoundary = ErrorBoundary;

export default ErrorBoundary;
