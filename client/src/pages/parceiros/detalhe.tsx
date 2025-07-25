import React, { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import ConfiguracaoComercialForm from "@/components/parceiros/ConfiguracaoComercialForm";
import LojaForm from "@/components/parceiros/LojaForm";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStoresByPartner } from "@/hooks/queries/useUserFormData";
import { api } from "@/lib/apiClient";

interface Partner {
  id: number;
  razaoSocial: string;
  cnpj: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  isActive: boolean;
}

interface Store {
  id: number;
  nomeLoja: string;
  endereco?: string;
  parceiroId: number;
}

const PartnerDetailPage: React.FC = () => {
  const [match, params] = useRoute("/parceiros/detalhe/:id");
  const partnerId = params ? parseInt(params.id) : null;

  const [isLojaModalOpen, setIsLojaModalOpen] = useState(false);

  // Fetch partner data
  const { data: partner, isLoading: partnerLoading, error: partnerError } = useQuery<Partner>({
    queryKey: ['partner', partnerId],
    queryFn: async () => {
      if (!partnerId) throw new Error('Partner ID is required');
      const response = await api.get<Partner>(`/api/parceiros/${partnerId}`);
      return response.data;
    },
    enabled: !!partnerId,
  });

  // Fetch stores for this partner
  const { data: stores = [], isLoading: storesLoading, error: storesError } = useStoresByPartner(partnerId, !!partnerId);

  const handleAddStore = (data: any) => {
    console.log("Nova Loja Adicionada:", data);
    // Lógica para adicionar a loja ao parceiro no estado/backend será implementada na Fase 2
    setIsLojaModalOpen(false);
  };

  // Loading state
  if (partnerLoading) {
    return (
      <DashboardLayout title="Carregando...">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Carregando dados do parceiro...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (partnerError || !partner) {
    return (
      <DashboardLayout title="Parceiro não encontrado">
        <div className="text-center">
          <p className="text-red-600 mb-4">
            {partnerError?.message || "Parceiro não encontrado."}
          </p>
          <Link to="/parceiros" className="text-blue-600 hover:underline">
            Voltar para a lista de parceiros
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`Detalhe do Parceiro: ${partner.razaoSocial || 'Parceiro'}`}>
      <h1 className="text-2xl font-bold">{partner.razaoSocial}</h1>
      <p className="text-muted-foreground">CNPJ: {partner.cnpj}</p>

      <div className="mt-8 grid gap-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Lojas</CardTitle>
            <Button onClick={() => setIsLojaModalOpen(true)}>Adicionar Nova Loja</Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome da Loja</TableHead>
                  <TableHead>Endereço (a ser adicionado)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {storesLoading ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
                      <p className="mt-2 text-sm text-gray-600">Carregando lojas...</p>
                    </TableCell>
                  </TableRow>
                ) : storesError ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-8 text-red-600">
                      Erro ao carregar lojas: {storesError.message}
                    </TableCell>
                  </TableRow>
                ) : stores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-8">
                      <div className="text-muted-foreground">
                        <p>Nenhuma loja cadastrada para este parceiro</p>
                        <p className="text-sm">Clique em "Adicionar Nova Loja" para começar</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  stores.map((loja: Store) => (
                    <TableRow key={loja.id}>
                      <TableCell>{loja.nomeLoja}</TableCell>
                      <TableCell>{loja.endereco || "Endereço não informado"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <ConfiguracaoComercialForm />
      </div>

      {/* Modal para cadastrar nova loja */}
      <Dialog open={isLojaModalOpen} onOpenChange={setIsLojaModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Nova Loja</DialogTitle>
          </DialogHeader>
          <LojaForm onSubmit={handleAddStore} onCancel={() => setIsLojaModalOpen(false)} />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default PartnerDetailPage;
