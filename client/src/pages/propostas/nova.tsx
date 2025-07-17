import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Tabs, Tab } from '@/components/ui/tabs';

const NovaProposta: React.FC = () => {
  return (
    <DashboardLayout title="Nova Proposta de Crédito">
      <Tabs defaultValue="dados-cliente">
        <Tab value="dados-cliente">Dados do Cliente</Tab>
        <Tab value="condicoes-emprestimo">Condições do Empréstimo</Tab>
        <Tab value="anexo-documentos">Anexo de Documentos</Tab>
      </Tabs>

      <div className="mt-6">
        <h2>Conteúdo da aba selecionada</h2>
        <p>Este é apenas um texto simples para a aba.</p>
      </div>
    </DashboardLayout>
  );
};

export default NovaProposta;