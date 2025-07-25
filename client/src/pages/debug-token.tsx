import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/apiClient';

export default function DebugTokenPage() {
  const [tokenDebugInfo, setTokenDebugInfo] = React.useState<any>(null);
  const [originationError, setOriginationError] = React.useState<any>(null);
  const [originationData, setOriginationData] = React.useState<any>(null);

  const testTokenDebug = async () => {
    try {
      const response = await api.get('/api/debug/token');
      setTokenDebugInfo(response.data);
    } catch (error: any) {
      setTokenDebugInfo({ error: error.message });
    }
  };

  const testOriginationContext = async () => {
    try {
      const response = await api.get('/api/origination/context');
      setOriginationData(response.data);
      setOriginationError(null);
    } catch (error: any) {
      setOriginationError({ 
        message: error.message,
        status: error.status,
        statusText: error.statusText
      });
      setOriginationData(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold">Debug de Token</h1>

        <Card>
          <CardHeader>
            <CardTitle>Teste de Token</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={testTokenDebug} className="mb-4">
              Testar Token Debug
            </Button>
            
            {tokenDebugInfo && (
              <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded overflow-auto">
                {JSON.stringify(tokenDebugInfo, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Teste de Origination Context</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={testOriginationContext} className="mb-4">
              Testar Origination Context
            </Button>
            
            {originationError && (
              <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 rounded">
                <h3 className="font-bold text-red-700 dark:text-red-300">Erro:</h3>
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(originationError, null, 2)}
                </pre>
              </div>
            )}
            
            {originationData && (
              <div className="p-4 bg-green-100 dark:bg-green-900 rounded">
                <h3 className="font-bold text-green-700 dark:text-green-300">Sucesso:</h3>
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(originationData, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}