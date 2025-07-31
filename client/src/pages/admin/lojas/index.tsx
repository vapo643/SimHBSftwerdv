import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/apiClient";
import { queryKeys } from "@/hooks/queries/queryKeys";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Store, Edit, Trash2, Plus, Building2, Activity, BarChart3, TrendingUp, MapPin, Settings } from "lucide-react";

import { LojaForm } from "@/components/lojas/LojaForm";
import type { Loja, InsertLoja, UpdateLoja } from "@shared/schema";

export default function LojasPage() {
  const [selectedLoja, setSelectedLoja] = useState<Loja | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch lojas using new apiClient and hierarchical query keys
  const { data: lojas = [], isLoading: loadingLojas } = useQuery<Loja[]>({
    queryKey: queryKeys.stores.list(),
    queryFn: async () => {
      const response = await api.get<Loja[]>('/api/admin/lojas');
      return response.data;
    },
  });

  // Create mutation using new apiClient
  const createMutation = useMutation({
    mutationFn: async (data: InsertLoja) => {
      const response = await api.post<Loja>('/api/admin/lojas', data);
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Loja criada com sucesso!",
      });
      // Invalidate all stores-related queries using hierarchical keys
      queryClient.invalidateQueries({ queryKey: queryKeys.stores.all });
      // Also invalidate system metadata and user form data
      queryClient.invalidateQueries({ queryKey: queryKeys.system.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      setIsModalOpen(false);
      setSelectedLoja(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar loja",
        variant: "destructive",
      });
    },
  });

  // Update mutation using new apiClient
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateLoja }) => {
      const response = await api.put<Loja>(`/api/admin/lojas/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Loja atualizada com sucesso!",
      });
      // Invalidate all stores-related queries using hierarchical keys
      queryClient.invalidateQueries({ queryKey: queryKeys.stores.all });
      // Also invalidate system metadata and user form data
      queryClient.invalidateQueries({ queryKey: queryKeys.system.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      setIsModalOpen(false);
      setSelectedLoja(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar loja",
        variant: "destructive",
      });
    },
  });

  // Delete mutation using new apiClient
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.delete(`/api/admin/lojas/${id}`);
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Loja desativada com sucesso!",
      });
      // Invalidate all stores-related queries using hierarchical keys
      queryClient.invalidateQueries({ queryKey: queryKeys.stores.all });
      // Also invalidate system metadata and user form data
      queryClient.invalidateQueries({ queryKey: queryKeys.system.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao Desativar",
        description: error.details || error.message || "Erro ao desativar loja",
        variant: "destructive",
      });
    },
  });

  const openNewModal = () => {
    setModalMode('create');
    setSelectedLoja(null);
    setIsModalOpen(true);
  };

  const openEditModal = (loja: Loja) => {
    setModalMode('edit');
    setSelectedLoja(loja);
    setIsModalOpen(true);
  };

  const handleDelete = async (loja: Loja) => {
    if (window.confirm(`Tem certeza que deseja desativar a loja "${loja.nomeLoja}"? Esta ação não pode ser desfeita.`)) {
      deleteMutation.mutate(loja.id);
    }
  };

  const handleSubmit = (data: InsertLoja | UpdateLoja) => {
    if (modalMode === 'edit' && selectedLoja) {
      updateMutation.mutate({ id: selectedLoja.id, data: data as UpdateLoja });
    } else {
      createMutation.mutate(data as InsertLoja);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  // Calcular estatísticas das lojas
  const lojaStats = {
    total: lojas.length,
    ativas: lojas.filter(l => !l.deletedAt).length,
    inativas: lojas.filter(l => l.deletedAt).length,
    parceirosUnicos: new Set(lojas.map(l => l.parceiroId)).size
  };

  if (loadingLojas) {
    return (
      <DashboardLayout title="Gestão de Lojas">
        <div className="space-y-8">
          {/* Header Section Loading */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
                <Store className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="h-9 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg mb-2 animate-pulse"></div>
                <div className="h-4 w-80 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
            </div>
            <div className="h-12 w-40 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
          </div>

          {/* Statistics Cards Loading */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-gray-200 dark:border-gray-700">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="h-4 w-24 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                  <div className="h-4 w-4 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-12 bg-gray-300 dark:bg-gray-600 rounded animate-pulse mb-1"></div>
                  <div className="h-3 w-16 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Stores Grid Loading */}
          <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
            <CardHeader className="border-b border-gray-200 dark:border-gray-700">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="h-5 w-5 text-green-600 dark:text-green-400" />
                Rede de Lojas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="border border-gray-200 dark:border-gray-700">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 bg-gray-300 dark:bg-gray-600 rounded-lg animate-pulse"></div>
                          <div className="h-5 w-32 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                        </div>
                        <div className="flex gap-2">
                          <div className="h-8 w-8 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                          <div className="h-8 w-8 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <div className="h-4 w-16 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                        <div className="h-6 w-16 bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse"></div>
                      </div>
                      <div className="h-3 w-12 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Gestão de Lojas">
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
              <Store className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                Gestão de Lojas
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Gerencie toda a rede de lojas do sistema
              </p>
            </div>
          </div>
          <Button 
            onClick={openNewModal}
            disabled={isSubmitting}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
            size="lg"
          >
            <Plus className="h-5 w-5 mr-2" />
            {createMutation.isPending ? "Criando..." : "Nova Loja"}
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">Total de Lojas</CardTitle>
              <Store className="h-4 w-4 text-green-600 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">{lojaStats.total}</div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                lojas cadastradas
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">Lojas Ativas</CardTitle>
              <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{lojaStats.ativas}</div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                em operação
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">Lojas Inativas</CardTitle>
              <BarChart3 className="h-4 w-4 text-red-600 dark:text-red-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-900 dark:text-red-100">{lojaStats.inativas}</div>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                temporariamente inativas
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">Parceiros Conectados</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{lojaStats.parceirosUnicos}</div>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                parceiros únicos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Stores Grid */}
        <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
          <CardHeader className="border-b border-gray-200 dark:border-gray-700">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5 text-green-600 dark:text-green-400" />
              Rede de Lojas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {lojas.length === 0 ? (
              <div className="text-center py-12">
                <Store className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Nenhuma loja cadastrada
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Comece adicionando a primeira loja ao sistema.
                </p>
                <Button 
                  onClick={openNewModal}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Primeira Loja
                </Button>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {lojas.map((loja: Loja) => (
                  <Card key={loja.id} className="border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200 hover:border-green-300 dark:hover:border-green-600">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex-shrink-0">
                            <Store className="h-5 w-5 text-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate text-sm">
                              {loja.nomeLoja}
                            </h3>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(loja)}
                            disabled={isSubmitting}
                            className="h-7 w-7 p-0 border-gray-300 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-950"
                          >
                            <Edit className="h-3 w-3 text-gray-600 hover:text-green-600" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(loja)}
                            disabled={isSubmitting}
                            className="h-7 w-7 p-0 border-gray-300 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                          >
                            <Trash2 className="h-3 w-3 text-gray-600 hover:text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Endereço</span>
                        </div>
                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-32">
                          {loja.endereco || "Não informado"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Parceiro</span>
                        </div>
                        <Badge className="bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200">
                          #{loja.parceiroId}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</span>
                        </div>
                        <Badge 
                          className={
                            !loja.deletedAt 
                              ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200"
                              : "bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200"
                          }
                        >
                          {!loja.deletedAt ? "Ativa" : "Inativa"}
                        </Badge>
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
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {modalMode === 'create' ? 'Nova Loja' : 'Editar Loja'}
            </DialogTitle>
          </DialogHeader>
          <LojaForm
            initialData={selectedLoja}
            onSubmit={handleSubmit}
            onCancel={() => setIsModalOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}