import React from 'react';
import { useRoute } from 'wouter';
import DashboardLayout from '@/components/DashboardLayout';
import { mockPartners } from '@/data/partners';
  
const PartnerDetailPage: React.FC = () => {
  const [match, params] = useRoute("/parceiros/detalhe/:id");
  const id = params ? params.id : null;
  const partner = mockPartners.find(p => p.id === id);

  return (
    <DashboardLayout title={`Detalhe do Parceiro: ${partner?.nomeFantasia || ''}`}>
      <h1 className="text-2xl font-bold">{partner?.razaoSocial}</h1>
      <p>CNPJ: {partner?.cnpj}</p>
      <div className="mt-6">
        <h2 className="text-xl font-semibold">Lojas</h2>
        {/* Aqui virá a tabela de lojas e o botão "Adicionar Nova Loja" */}
      </div>
       <div className="mt-6">
        <h2 className="text-xl font-semibold">Configuração Comercial</h2>
        {/* Aqui virá o formulário de configuração comercial */}
      </div>
    </DashboardLayout>
  );
};

export default PartnerDetailPage;