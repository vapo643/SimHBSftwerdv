import React from 'react';
import { useRoute } from 'wouter';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Clock } from 'lucide-react';

const ChecklistItem = ({ label, completed }: { label: string; completed: boolean }) => (
  <div className="flex items-center space-x-3 p-3 bg-secondary/50 rounded-md">
    {completed ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <Clock className="h-5 w-5 text-yellow-500" />
    )}
    <span className="font-medium">{label}</span>
  </div>
);

const AcompanhamentoFormalizacao: React.FC = () => {
  const [match, params] = useRoute("/formalizacao/acompanhamento/:id");
  const id = params ? params.id : 'Carregando...';

  return (
    <DashboardLayout title={`Acompanhamento da Proposta: ${id}`}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Acompanhamento da Proposta: {id}</h1>
        
        <Card>
          <CardHeader>
            <CardTitle>Checklist de Formalização</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ChecklistItem label="Geração da CCB" completed={true} />
            <ChecklistItem label="Verificação Biométrica" completed={true} />
            <ChecklistItem label="Assinatura Eletrônica" completed={false} />
          </CardContent>
        </Card>

        <Button variant="outline">Reenviar Links para o Cliente</Button>
      </div>
    </DashboardLayout>
  );
};

export default AcompanhamentoFormalizacao;