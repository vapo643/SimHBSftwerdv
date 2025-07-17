import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DadosClienteForm from '@/components/forms/DadosClienteForm';

const NovaProposta: React.FC = () => {
  return (
    <DashboardLayout title="Nova Proposta de Crédito">
      <Tabs defaultValue="dados-cliente" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dados-cliente">Dados do Cliente</TabsTrigger>
          <TabsTrigger value="condicoes-emprestimo">Condições do Empréstimo</TabsTrigger>
          <TabsTrigger value="anexo-documentos">Anexo de Documentos</TabsTrigger>
        </TabsList>
        <TabsContent value="dados-cliente">
          <DadosClienteForm />
        </TabsContent>
        <TabsContent value="condicoes-emprestimo">
          <p>Aqui virá o formulário de Condições do Empréstimo.</p>
        </TabsContent>
        <TabsContent value="anexo-documentos">
          <p>Aqui virá o formulário de Anexo de Documentos.</p>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default NovaProposta;