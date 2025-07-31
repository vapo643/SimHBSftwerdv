import React, { useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Table as TableIcon, TrendingUp, BarChart3, Settings, Users, Package, Calculator, Plus } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import TabelaComercialForm from "@/components/tabelas-comerciais/TabelaComercialForm";
import ConfirmDeleteModal from "@/components/tabelas-comerciais/ConfirmDeleteModal";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { api } from "@/lib/apiClient";
import { Skeleton } from "@/components/ui/skeleton";

export interface TabelaComercial {
  id: string | number;
  nomeTabela: string;
  taxaJuros: number | string;
  comissao: number | string;
  prazos: number[];
  produtoIds: number[];
  parceiroId?: number | null;
  createdAt?: string;
}

const TabelasComerciais: React.FC = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTabela, setSelectedTabela] = useState<TabelaComercial | null>(null);
  const { toast } = useToast();

  // Fetch all commercial tables
  const { data: tabelas = [], isLoading, error } = useQuery<TabelaComercial[]>({
    queryKey: ['tabelas-comerciais-admin'],
    queryFn: async () => {
      const response = await api.get<TabelaComercial[]>('/api/tabelas-comerciais');
      return response.data;
    }
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: Omit<TabelaComercial, "id">) => {
      const response = await api.post('/api/admin/tabelas-comerciais', {
        nomeTabela: data.nomeTabela,
        taxaJuros: Number(data.taxaJuros),
        prazos: data.prazos || [],
        produtoIds: data.produtoIds || [],
        comissao: Number(data.comissao)
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tabelas-comerciais-admin'] });
      queryClient.invalidateQueries({ queryKey: ['tabelas-comerciais'] });
      setIsCreateModalOpen(false);
      toast({
        title: "Tabela criada com sucesso",
        description: "A tabela comercial foi adicionada ao sistema.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar tabela",
        description: error.message || "Ocorreu um erro ao criar a tabela comercial.",
        variant: "destructive",
      });
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: string | number; data: Omit<TabelaComercial, "id"> }) => {
      const response = await api.put(`/api/admin/tabelas-comerciais/${data.id}`, {
        nomeTabela: data.data.nomeTabela,
        taxaJuros: Number(data.data.taxaJuros),
        prazos: data.data.prazos || [],
        produtoIds: data.data.produtoIds || [],
        comissao: Number(data.data.comissao)
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tabelas-comerciais-admin'] });
      queryClient.invalidateQueries({ queryKey: ['tabelas-comerciais'] });
      setIsEditModalOpen(false);
      setSelectedTabela(null);
      toast({
        title: "Tabela atualizada com sucesso",
        description: "As alterações foram salvas.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar tabela",
        description: error.message || "Ocorreu um erro ao atualizar a tabela comercial.",
        variant: "destructive",
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string | number) => {
      await api.delete(`/api/admin/tabelas-comerciais/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tabelas-comerciais-admin'] });
      queryClient.invalidateQueries({ queryKey: ['tabelas-comerciais'] });
      setIsDeleteModalOpen(false);
      setSelectedTabela(null);
      toast({
        title: "Tabela excluída com sucesso",
        description: "A tabela comercial foi removida do sistema.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir tabela",
        description: error.message || "Ocorreu um erro ao excluir a tabela comercial.",
        variant: "destructive",
      });
    }
  });

  const handleCreate = (novaTabela: Omit<TabelaComercial, "id">) => {
    createMutation.mutate(novaTabela);
  };

  const handleEdit = (tabelaAtualizada: Omit<TabelaComercial, "id">) => {
    if (selectedTabela) {
      updateMutation.mutate({ id: selectedTabela.id, data: tabelaAtualizada });
    }
  };

  const handleDelete = () => {
    if (selectedTabela) {
      deleteMutation.mutate(selectedTabela.id);
    }
  };

  const openEditModal = (tabela: TabelaComercial) => {
    setSelectedTabela(tabela);
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (tabela: TabelaComercial) => {
    setSelectedTabela(tabela);
    setIsDeleteModalOpen(true);
  };

  if (error) {
    return (
      <DashboardLayout title="Gestão de Tabelas Comerciais">
        <div className="flex items-center justify-center h-64">
          <p className="text-red-500">Erro ao carregar tabelas comerciais</p>
        </div>
      </DashboardLayout>
    );
  }

  // Calcular estatísticas das tabelas
  const tabelasStats = {
    total: tabelas.length,
    taxaMediaJuros: tabelas.length > 0 ? 
      (tabelas.reduce((acc, t) => acc + Number(t.taxaJuros), 0) / tabelas.length).toFixed(2) : '0.00',
    comissaoMedia: tabelas.length > 0 ? 
      (tabelas.reduce((acc, t) => acc + Number(t.comissao), 0) / tabelas.length).toFixed(2) : '0.00',
    totalProdutos: tabelas.reduce((acc, t) => acc + (t.produtoIds?.length || 0), 0),
    prazosUnicos: Array.from(new Set(tabelas.flatMap(t => t.prazos || []))).length
  };

  return (
    <DashboardLayout title="Gestão de Tabelas Comerciais">
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
              <TableIcon className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                Tabelas Comerciais
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Configuração e gestão de taxas e condições comerciais
              </p>
            </div>
          </div>
          <Button 
            onClick={() => setIsCreateModalOpen(true)}
            disabled={isLoading}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
            size="lg"
          >
            <Plus className="h-5 w-5 mr-2" />
            Nova Tabela Comercial
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">Total de Tabelas</CardTitle>
              <TableIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{tabelasStats.total}</div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Ativas no sistema
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">Taxa Média</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">{tabelasStats.taxaMediaJuros}%</div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                Juros mensais
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">Comissão Média</CardTitle>
              <Calculator className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{tabelasStats.comissaoMedia}%</div>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                Percentual médio
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">Produtos Vinculados</CardTitle>
              <Package className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">{tabelasStats.totalProdutos}</div>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                Total de associações
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tables Grid */}
        <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
          <CardHeader className="border-b border-gray-200 dark:border-gray-700">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5 text-green-600 dark:text-green-400" />
              Configurações Comerciais
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {[...Array(6)].map((_, i) => (
                    <Card key={i} className="border border-gray-200 dark:border-gray-700">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-5 w-32" />
                          <Skeleton className="h-4 w-4" />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-12" />
                        </div>
                        <div className="flex justify-between">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 w-12" />
                        </div>
                        <Skeleton className="h-4 w-full" />
                        <div className="flex justify-between pt-2">
                          <Skeleton className="h-8 w-8" />
                          <Skeleton className="h-8 w-8" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : tabelas.length === 0 ? (
              <div className="text-center py-12">
                <TableIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Nenhuma tabela comercial cadastrada
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Comece criando a primeira tabela comercial do sistema
                </p>
                <Button 
                  onClick={() => setIsCreateModalOpen(true)}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Tabela
                </Button>
              </div>
            ) : (
              <div className="p-6">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {tabelas.map(tabela => (
                    <Card key={tabela.id} className="border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow duration-200">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                            {tabela.nomeTabela}
                          </CardTitle>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => openEditModal(tabela)}
                              disabled={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}
                              className="h-8 w-8 p-0 border-blue-200 hover:bg-blue-50 hover:border-blue-300 dark:border-blue-700 dark:hover:bg-blue-900/20"
                              title="Editar tabela"
                            >
                              <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDeleteModal(tabela)}
                              disabled={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}
                              className="h-8 w-8 p-0 border-red-200 hover:bg-red-50 hover:border-red-300 dark:border-red-700 dark:hover:bg-red-900/20"
                              title="Excluir tabela"
                            >
                              <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3 text-green-600" />
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Taxa de Juros</span>
                            </div>
                            <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200">
                              {Number(tabela.taxaJuros).toFixed(2)}% a.m.
                            </Badge>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <Calculator className="h-3 w-3 text-purple-600" />
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Comissão</span>
                            </div>
                            <Badge className="bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-200">
                              {Number(tabela.comissao).toFixed(2)}%
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center gap-1">
                            <BarChart3 className="h-3 w-3 text-blue-600" />
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Prazos Permitidos</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {(tabela.prazos || []).map(prazo => (
                              <Badge key={prazo} variant="secondary" className="text-xs">
                                {prazo}m
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Package className="h-3 w-3 text-orange-600" />
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Produtos</span>
                            </div>
                            <Badge className="bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-200">
                              {tabela.produtoIds?.length || 0}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de Criação */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Nova Tabela Comercial</DialogTitle>
            </DialogHeader>
            <TabelaComercialForm
              onSubmit={handleCreate}
              onCancel={() => setIsCreateModalOpen(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Modal de Edição */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Editar Tabela Comercial</DialogTitle>
            </DialogHeader>
            <TabelaComercialForm
              initialData={selectedTabela}
              onSubmit={handleEdit}
              onCancel={() => {
                setIsEditModalOpen(false);
                setSelectedTabela(null);
              }}
            />
          </DialogContent>
        </Dialog>

        {/* Modal de Confirmação de Exclusão */}
        <ConfirmDeleteModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedTabela(null);
          }}
          onConfirm={handleDelete}
          tabelaNome={selectedTabela?.nomeTabela || ""}
        />
      </div>
    </DashboardLayout>
  );
};

export default TabelasComerciais;
