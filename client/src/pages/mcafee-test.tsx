/**
 * Página de Teste para Bypass do McAfee
 * Interface para testar soluções específicas para ti!7da91cf510c0
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Download, Shield, FileText, Image } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function McAfeeTestPage() {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProposta] = useState('902183dd-b5d1-4e20-8a72-79d3d3559d4d'); // Proposta de teste

  const testMethods = [
    {
      id: 'pdf-bypass',
      name: 'PDF com Bypass ti!7da91cf510c0',
      description: 'PDF modificado especificamente para contornar a ameaça McAfee',
      icon: Shield,
      params: '?format=pdf-bypass'
    },
    {
      id: 'image-container',
      name: 'Container de Imagem',
      description: 'PDF embutido em arquivo PNG (bypass total)',
      icon: Image,
      params: '?format=image-container'
    },
    {
      id: 'text-only',
      name: 'Códigos de Texto',
      description: 'Códigos de barras e PIX em texto puro (100% seguro)',
      icon: FileText,
      params: '?format=text'
    }
  ];

  const testMethod = async (method: any) => {
    setIsLoading(true);
    const startTime = Date.now();
    
    try {
      console.log(`[MCAFEE_TEST] 🎯 Testando método: ${method.name}`);
      
      const response = await fetch(`/api/mcafee-bypass/${selectedProposta}${method.params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        }
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        const contentLength = response.headers.get('content-length');
        
        // Criar link de download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        
        let filename = 'download';
        if (method.id === 'pdf-bypass') filename = 'boleto-mcafee-bypass.pdf';
        else if (method.id === 'image-container') filename = 'boleto-container.png';
        else if (method.id === 'text-only') filename = 'boletos-codigos.txt';
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        const result = {
          method: method.name,
          status: 'SUCESSO',
          duration: `${duration}ms`,
          contentType,
          size: contentLength ? `${Math.round(parseInt(contentLength) / 1024)}KB` : 'N/A',
          timestamp: new Date().toLocaleTimeString()
        };
        
        setTestResults(prev => [result, ...prev]);
        console.log(`[MCAFEE_TEST] ✅ ${method.name} - Download iniciado`);
        
      } else {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
    } catch (error: any) {
      const result = {
        method: method.name,
        status: 'ERRO',
        duration: `${Date.now() - startTime}ms`,
        error: error.message,
        timestamp: new Date().toLocaleTimeString()
      };
      
      setTestResults(prev => [result, ...prev]);
      console.error(`[MCAFEE_TEST] ❌ ${method.name}:`, error.message);
    }
    
    setIsLoading(false);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Teste de Bypass McAfee</h1>
          <p className="text-muted-foreground">
            Teste específico para contornar a ameaça <code className="font-mono bg-red-100 px-2 py-1 rounded">ti!7da91cf510c0</code>
          </p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Esta página testa diferentes métodos de bypass desenvolvidos especificamente para a ameaça McAfee "ti!7da91cf510c0". 
            Use apenas em ambiente de teste ou quando necessário para atendentes com McAfee configurado.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-3">
          {testMethods.map((method) => {
            const Icon = method.icon;
            return (
              <Card key={method.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="text-center">
                  <Icon className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <CardTitle className="text-lg">{method.name}</CardTitle>
                  <CardDescription className="text-sm">
                    {method.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={() => testMethod(method)}
                    disabled={isLoading}
                    className="w-full"
                    data-testid={`button-test-${method.id}`}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isLoading ? 'Testando...' : 'Testar Download'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {testResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Resultados dos Testes</CardTitle>
              <CardDescription>
                Histórico de testes realizados - verifique se algum foi detectado pelo McAfee
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {testResults.map((result, index) => (
                  <div 
                    key={index}
                    className={`p-3 rounded-lg border ${
                      result.status === 'SUCESSO' 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{result.method}</p>
                        <p className="text-sm text-gray-600">
                          {result.timestamp} • {result.duration}
                        </p>
                        {result.contentType && (
                          <p className="text-xs text-gray-500">
                            {result.contentType} • {result.size}
                          </p>
                        )}
                      </div>
                      <span 
                        className={`text-xs px-2 py-1 rounded ${
                          result.status === 'SUCESSO'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {result.status}
                      </span>
                    </div>
                    {result.error && (
                      <p className="text-sm text-red-600 mt-1">{result.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center text-sm text-gray-500">
          <p>Proposta de teste: <code className="font-mono">{selectedProposta}</code></p>
          <p>Desenvolvido para resolver especificamente a detecção McAfee ti!7da91cf510c0</p>
        </div>
      </div>
    </div>
  );
}