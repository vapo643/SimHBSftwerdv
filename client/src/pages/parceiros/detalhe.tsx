import React, { useState } from 'react';
import { useRoute, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '@/components/DashboardLayout';
import ConfiguracaoComercialForm from '@/components/parceiros/ConfiguracaoComercialForm';
import LojaForm from '@/components/parceiros/LojaForm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useStoresByPartner } from '@/hooks/queries/useUserFormData';
import { api } from '@/lib/apiClient';
import {
  _Building2,
  _Store,
  _ArrowLeft,
  _Plus,
  _MapPin,
  _Phone,
  _Mail,
  _Activity,
  _Settings,
  _BarChart3,
} from 'lucide-react';

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
  const [match, params] = useRoute('/parceiros/detalhe/:id');
  const _partnerId = params ? parseInt(params.id) : null;

  const [isLojaModalOpen, setIsLojaModalOpen] = useState(false);

  // Fetch partner data
  const {
    data: partner,
    isLoading: partnerLoading,
    error: partnerError,
  } = useQuery<Partner>({
    queryKey: ['partner', partnerId],
    queryFn: async () => {
      if (!partnerId) throw new Error('Partner ID is required');
      const _response = await api.get<Partner>(`/api/parceiros/${partnerId}`);
      return (response as unknown).data || response; }
    },
    enabled: !!partnerId,
  });

  // Fetch stores for this partner
  const {
    data: stores = [],
    isLoading: storesLoading,
    error: storesError,
  } = useStoresByPartner(partnerId, !!partnerId);

  const _handleAddStore = (data) => {
    console.log('Nova Loja Adicionada:',_data);
    // Lógica para adicionar a loja ao parceiro no estado/backend será implementada na Fase 2
    setIsLojaModalOpen(false);
  };

  // Loading state
  if (partnerLoading) {
    return (
      <DashboardLayout title="Carregando...">
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
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
          <p className="mb-4 text-red-600">{partnerError?.message || 'Parceiro não encontrado.'}</p>
          <Link to="/parceiros" className="text-blue-600 hover:underline">
            Voltar para a lista de parceiros
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  // Calcular estatísticas das lojas
  const _storeStats = {
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
            <div className="rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 p-3 shadow-lg">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-3xl font-bold text-transparent dark:from-white dark:to-gray-300">
                {partner.razaoSocial}
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Informações detalhadas do parceiro comercial
              </p>
            </div>
          </div>
          <Badge className="border-green-200 bg-green-100 px-3 py-1 text-green-800 dark:bg-green-900 dark:text-green-200">
            Ativo
          </Badge>
        </div>

        {/* Partner Information Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 dark:border-blue-800 dark:from-blue-950 dark:to-blue-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
                CNPJ
              </CardTitle>
              <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="font-mono text-lg font-bold text-blue-900 dark:text-blue-100">
                {partner.cnpj}
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100 dark:border-green-800 dark:from-green-950 dark:to-green-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
                Total de Lojas
              </CardTitle>
              <Store className="h-4 w-4 text-green-600 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                {storeStats.total}
              </div>
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">lojas cadastradas</p>
            </CardContent>
          </Card>

          <Card className="border-cyan-200 bg-gradient-to-br from-cyan-50 to-cyan-100 dark:border-cyan-800 dark:from-cyan-950 dark:to-cyan-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-cyan-700 dark:text-cyan-300">
                Lojas Ativas
              </CardTitle>
              <Activity className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">
                {storeStats.ativos}
              </div>
              <p className="mt-1 text-xs text-cyan-600 dark:text-cyan-400">em operação</p>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100 dark:border-purple-800 dark:from-purple-950 dark:to-purple-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
                ID do Parceiro
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {partner.id}
              </div>
              <p className="mt-1 text-xs text-purple-600 dark:text-purple-400">
                identificador único
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Lojas Section */}
        <Card className="border-gray-200 bg-white/50 shadow-xl backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/50">
          <CardHeader className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Store className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                Lojas do Parceiro
              </CardTitle>
              <Button
                onClick={() => setIsLojaModalOpen(true)}
                className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg transition-all duration-200 hover:from-cyan-700 hover:to-blue-700 hover:shadow-xl"
              >
                <Plus className="mr-2 h-4 w-4" />
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
                        <div className="h-9 w-9 animate-pulse rounded-lg bg-gray-300 dark:bg-gray-600"></div>
                        <div className="h-5 w-32 animate-pulse rounded bg-gray-300 dark:bg-gray-600"></div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="h-4 w-24 animate-pulse rounded bg-gray-300 dark:bg-gray-600"></div>
                      <div className="h-3 w-16 animate-pulse rounded bg-gray-300 dark:bg-gray-600"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : storesError ? (
              <div className="py-12 text-center">
                <Store className="mx-auto mb-4 h-12 w-12 text-red-400" />
                <h3 className="mb-2 text-lg font-medium text-red-600">Erro ao carregar lojas</h3>
                <p className="mb-6 text-red-500">{storesError.message}</p>
              </div>
            ) : stores.length == 0 ? (
              <div className="py-12 text-center">
                <Store className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-gray-100">
                  Nenhuma loja cadastrada
                </h3>
                <p className="mb-6 text-gray-500 dark:text-gray-400">
                  Comece adicionando a primeira loja deste parceiro ao sistema.
                </p>
                <Button
                  onClick={() => setIsLojaModalOpen(true)}
                  className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-700 hover:to-blue-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Primeira Loja
                </Button>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {stores.map((loja: Store) => (
                  <Card
                    key={loja.id}
                    className="border border-gray-200 transition-all duration-200 hover:border-cyan-300 hover:shadow-lg dark:border-gray-700 dark:hover:border-cyan-600"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 p-2">
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
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Endereço
                          </span>
                        </div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {loja.endereco || 'Não informado'}
                        </span>
                      </div>
                      <div className="border-t border-gray-100 pt-2 dark:border-gray-700">
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
