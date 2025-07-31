import React, { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import ConfiguracaoComercialForm from "@/components/parceiros/ConfiguracaoComercialForm";
import LojaForm from "@/components/parceiros/LojaForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStoresByPartner } from "@/hooks/queries/useUserFormData";
import { api } from "@/lib/apiClient";
import { Building2, Store, ArrowLeft, Plus, MapPin, Phone, Mail, Activity, Settings, BarChart3 } from "lucide-react";

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

  // Calcular estatísticas das lojas
  const storeStats = {
    total: stores.length,
    ativos: stores.length, // Assumindo que todas as lojas retornadas estão ativas
    inativos: 0,
  };

  return (
    <DashboardLayout title={`Detalhe do Parceiro: ${partner.razaoSocial || 'Parceiro'}`}>
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/parceiros">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
            </Link>
            <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                {partner.razaoSocial}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Informações detalhadas do parceiro comercial
              </p>
            </div>
          </div>
          <Badge 
            className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 px-3 py-1"
          >
            Ativo
          </Badge>
        </div>

        {/* Partner Information Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">CNPJ</CardTitle>
              <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-blue-900 dark:text-blue-100 font-mono">{partner.cnpj}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">Total de Lojas</CardTitle>
              <Store className="h-4 w-4 text-green-600 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">{storeStats.total}</div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                lojas cadastradas
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900 border-cyan-200 dark:border-cyan-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-cyan-700 dark:text-cyan-300">Lojas Ativas</CardTitle>
              <Activity className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">{storeStats.ativos}</div>
              <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">
                em operação
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">ID do Parceiro</CardTitle>
              <BarChart3 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{partner.id}</div>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                identificador único
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Lojas Section */}
        <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
          <CardHeader className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Store className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                Lojas do Parceiro
              </CardTitle>
              <Button 
                onClick={() => setIsLojaModalOpen(true)}
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Nova Loja
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {storesLoading ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="border border-gray-200 dark:border-gray-700">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-gray-300 dark:bg-gray-600 rounded-lg animate-pulse"></div>
                        <div className="h-5 w-32 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="h-4 w-24 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                      <div className="h-3 w-16 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : storesError ? (
              <div className="text-center py-12">
                <Store className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-red-600 mb-2">
                  Erro ao carregar lojas
                </h3>
                <p className="text-red-500 mb-6">
                  {storesError.message}
                </p>
              </div>
            ) : stores.length === 0 ? (
              <div className="text-center py-12">
                <Store className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Nenhuma loja cadastrada
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Comece adicionando a primeira loja deste parceiro ao sistema.
                </p>
                <Button 
                  onClick={() => setIsLojaModalOpen(true)}
                  className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Primeira Loja
                </Button>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {stores.map((loja: Store) => (
                  <Card key={loja.id} className="border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200 hover:border-cyan-300 dark:hover:border-cyan-600">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
                          <Store className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                            {loja.nomeLoja}
                          </h3>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Endereço</span>
                        </div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {loja.endereco || "Não informado"}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          ID: {loja.id}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
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
