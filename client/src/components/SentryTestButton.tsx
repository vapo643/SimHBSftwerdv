import { Button } from '@/components/ui/button';
import * as Sentry from '@sentry/react';
import { useState } from 'react';

export default function SentryTestButton() {
  const [testStatus, setTestStatus] = useState<string>('');

  const testFrontendSentry = () => {
    try {
      // Captura o erro diretamente no Sentry
      const errorMessage = `Frontend Sentry test - ${new Date().toISOString()}`;
      Sentry.captureException(new Error(errorMessage));
      
      // Também lança erro para testar Error Boundary
      setTimeout(() => {
        throw new Error(errorMessage);
      }, 100);
      
      setTestStatus('✅ Teste enviado!');
      setTimeout(() => setTestStatus(''), 3000);
      
      console.error('🧪 SENTRY TEST:', errorMessage);
    } catch (error) {
      setTestStatus('❌ Erro no teste');
      setTimeout(() => setTestStatus(''), 3000);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      <Button 
        onClick={testFrontendSentry}
        variant="destructive"
        size="sm"
        data-testid="button-test-sentry"
        className="w-full"
      >
        🧪 Test Sentry
      </Button>
      {testStatus && (
        <div className="bg-black text-white px-2 py-1 rounded text-xs text-center">
          {testStatus}
        </div>
      )}
    </div>
  );
}