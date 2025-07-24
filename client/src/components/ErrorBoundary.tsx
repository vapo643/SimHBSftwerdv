import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[200px] flex items-center justify-center">
          <div className="text-center space-y-4 p-6">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
            <h3 className="text-lg font-semibold">Algo deu errado</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Ocorreu um erro inesperado. Tente novamente ou atualize a página.
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={this.handleRetry} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>
              <Button 
                onClick={() => window.location.reload()} 
                variant="default" 
                size="sm"
              >
                Atualizar Página
              </Button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-xs text-left">
                <summary className="cursor-pointer text-muted-foreground">
                  Detalhes do erro (desenvolvimento)
                </summary>
                <pre className="mt-2 p-2 bg-muted rounded border-l-2 border-red-500 whitespace-pre-wrap">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook-based error boundary for functional components
export function useErrorHandler() {
  return (error: Error, errorInfo?: ErrorInfo) => {
    console.error('Component error:', error, errorInfo);
    // In a real app, you might want to send this to a logging service
  };
}

// Specific error boundary for user form data loading
export function UserFormErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-6 border border-amber-200 bg-amber-50 rounded-lg">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div>
              <h4 className="font-medium text-amber-800">Erro ao carregar dados do formulário</h4>
              <p className="text-sm text-amber-700 mt-1">
                Não foi possível carregar os dados necessários para o formulário. 
                Verifique sua conexão e tente novamente.
              </p>
            </div>
          </div>
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-3" 
            variant="outline" 
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Recarregar
          </Button>
        </div>
      }
      onError={(error, errorInfo) => {
        console.error('User form data loading error:', error, errorInfo);
        // You could send this to analytics/monitoring service
      }}
    >
      {children}
    </ErrorBoundary>
  );
}