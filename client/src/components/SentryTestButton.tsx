import { Button } from '@/components/ui/button';
import * as Sentry from '@sentry/react';

export default function SentryTestButton() {
  const testFrontendSentry = () => {
    Sentry.captureException(new Error(`Frontend Sentry test - ${new Date().toISOString()}`));
    throw new Error(`Frontend Sentry test - ${new Date().toISOString()}`);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button 
        onClick={testFrontendSentry}
        variant="destructive"
        size="sm"
        data-testid="button-test-sentry"
      >
        🧪 Test Sentry
      </Button>
    </div>
  );
}