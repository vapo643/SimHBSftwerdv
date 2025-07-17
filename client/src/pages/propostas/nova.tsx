import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Tabs, Tab } from '@/components/ui/tabs';
import DadosClienteForm from '@/components/forms/DadosClienteForm';

const NovaProposta: React.FC = () => {
  return (
    <DashboardLayout title="Nova Proposta de Crédito">
      <Tabs defaultValue="dados-cliente">
        <Tab label="Dados do Cliente" value="dados-cliente">
          <DadosClienteForm />
        </Tab>
        <Tab label="Condições do Empréstimo" value="condicoes-emprestimo">
          <h2>Condições do Empréstimo</h2>
          <p>Este é apenas um texto simples para a aba.</p>
        </Tab>
        <Tab label="Anexo de Documentos" value="anexo-documentos">
          <h2>Anexo de Documentos</h2>
          <p>Este é apenas um texto simples para a aba.</p>
        </Tab>
      </Tabs>
    </DashboardLayout>
  );
};

export default NovaProposta;