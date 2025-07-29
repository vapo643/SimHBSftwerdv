import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PDFTemplate {
  id: string;
  name: string;
  description: string;
  pageSize: 'A4' | 'Letter';
  margins: { top: number; bottom: number; left: number; right: number };
}

export default function TemplatesPage() {
  const { user } = useAuth();

  // Single template that actually works - the CCB template used by the system
  const templates = [
    {
      id: 'ccb-standard',
      name: 'CCB Padrão Simpix',
      description: 'Template oficial para CCB - USADO AUTOMATICAMENTE no sistema quando propostas são aprovadas',
      pageSize: 'A4' as const,
      margins: { top: 40, bottom: 40, left: 60, right: 60 }
    }
  ];

  // Check if user is admin
  if (user?.role !== 'ADMINISTRADOR') {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Acesso Negado</h1>
          <p className="text-gray-600">Apenas administradores podem acessar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Template CCB</h1>
          <p className="text-muted-foreground mt-2">
            Template usado para gerar CCB automaticamente quando propostas são aprovadas
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {templates.map((template: PDFTemplate) => (
          <Card key={template.id} className="border-2 border-green-500">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="truncate text-green-700">{template.name}</span>
                <div className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">
                  ATIVO
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                {template.description}
              </p>
              
              <div className="space-y-2 text-sm">
                <div><strong>Formato:</strong> {template.pageSize}</div>
                <div><strong>Status:</strong> Template oficial do sistema</div>
                <div><strong>Uso:</strong> Automático ao aprovar propostas</div>
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>Funcionamento:</strong> Este template é usado automaticamente pelo sistema para gerar CCB quando uma proposta é aprovada. Não precisa de configuração manual.
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}