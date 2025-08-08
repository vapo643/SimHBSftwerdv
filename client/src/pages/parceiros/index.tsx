import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import PartnerForm from "@/components/parceiros/PartnerForm";
import DashboardLayout from "@/components/DashboardLayout";
import { Link } from "wouter";
import { api } from "@/lib/apiClient";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/hooks/queries/queryKeys";
import { useToast } from "@/hooks/use-toast";
import { Parceiro, InsertParceiro } from "@shared/schema";
import {
  Edit,
  Trash2,
  Eye,
  Building2,
  Users,
  Plus,
  BarChart3,
  Activity,
  Settings,
  TrendingUp,
} from "lucide-react";

const PartnersPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Parceiro | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [partnerToDelete, setPartnerToDelete] = useState<Parceiro | null>(null);
  const { toast } = useToast();

  // Fetch partners data using new apiClient and hierarchical query keys
  const {
    data: partners = [],
    isLoading,
    error,
  } = useQuery<Parceiro[]>({
    queryKey: queryKeys.partners.list(),
    queryFn: async () => {
      const response = await api.get<Parceiro[]>("/api/parceiros");
      return response.data;
    },
  });

  // Create partner mutation using new apiClient
  const createMutation = useMutation({
    mutationFn: async (data: InsertParceiro) => {
      const response = await api.post<Parceiro>("/api/admin/parceiros", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.partners.all });
      setIsModalOpen(false);
      setSelectedPartner(null);
      toast({
        title: "Sucesso!",
        description: "Parceiro criado com sucesso!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro!",
        description: `Erro ao criar parceiro: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Update partner mutation using new apiClient
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertParceiro> }) => {
      const response = await api.put<Parceiro>(`/api/admin/parceiros/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.partners.all });
      setIsModalOpen(false);
      setSelectedPartner(null);
      toast({
        title: "Sucesso!",
        description: "Parceiro atualizado com sucesso!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro!",
        description: `Erro ao atualizar parceiro: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Delete partner mutation using new apiClient
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.delete(`/api/admin/parceiros/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.partners.all });
      setDeleteDialogOpen(false);
      setPartnerToDelete(null);
      toast({
        title: "Sucesso!",
        description: "Parceiro excluído com sucesso!",
      });
    },
    onError: (error: Error) => {
      setDeleteDialogOpen(false);
      setPartnerToDelete(null);
      toast({
        title: "Erro!",
        description: `Erro ao excluir parceiro: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleCreateOrEdit = async (data: { razaoSocial: string; cnpj: string }) => {
    // Add default values for the optional fields
    const completeData = {
      ...data,
      comissaoPadrao: null,
      tabelaComercialPadraoId: null,
    };

    if (selectedPartner) {
      // Update existing partner
      updateMutation.mutate({ id: selectedPartner.id, data: completeData });
    } else {
      // Create new partner
      createMutation.mutate(completeData);
    }
  };

  const handleEdit = (partner: Parceiro) => {
    setSelectedPartner(partner);
    setIsModalOpen(true);
  };

  const handleDelete = (partner: Parceiro) => {
    setPartnerToDelete(partner);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (partnerToDelete) {
      deleteMutation.mutate(partnerToDelete.id);
    }
  };

  const openNewModal = () => {
    setSelectedPartner(null);
    setIsModalOpen(true);
  };

  if (error) {
    return (
      <DashboardLayout title="Gestão de Parceiros">
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-red-600">Erro ao carregar parceiros</h3>
            <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Calcular estatísticas dos parceiros
  const partnerStats = {
    total: partners.length,
    ativos: partners.filter(p => !p.deletedAt).length,
    inativos: partners.filter(p => p.deletedAt).length,
    percentualAtivos:
      partners.length > 0
        ? ((partners.filter(p => !p.deletedAt).length / partners.length) * 100).toFixed(1)
        : "0",
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Gestão de Parceiros">
        <div className="space-y-8">
          {/* Header Section Loading */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 p-3 shadow-lg">
                <Building2 className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="mb-2 h-9 w-64 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700"></div>
                <div className="h-4 w-80 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
              </div>
            </div>
            <div className="h-12 w-40 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700"></div>
          </div>

          {/* Statistics Cards Loading */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card
                key={i}
                className="border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 dark:border-gray-700 dark:from-gray-800 dark:to-gray-900"
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-gray-300 dark:bg-gray-600"></div>
                  <div className="h-4 w-4 animate-pulse rounded bg-gray-300 dark:bg-gray-600"></div>
                </CardHeader>
                <CardContent>
                  <div className="mb-1 h-8 w-12 animate-pulse rounded bg-gray-300 dark:bg-gray-600"></div>
                  <div className="h-3 w-16 animate-pulse rounded bg-gray-300 dark:bg-gray-600"></div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Partners Grid Loading */}
          <Card className="border-gray-200 bg-white/50 shadow-xl backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/50">
            <CardHeader className="border-b border-gray-200 dark:border-gray-700">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                Rede de Parceiros
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="border border-gray-200 dark:border-gray-700">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 animate-pulse rounded-lg bg-gray-300 dark:bg-gray-600"></div>
                          <div className="h-5 w-32 animate-pulse rounded bg-gray-300 dark:bg-gray-600"></div>
                        </div>
                        <div className="flex gap-2">
                          <div className="h-8 w-8 animate-pulse rounded bg-gray-300 dark:bg-gray-600"></div>
                          <div className="h-8 w-8 animate-pulse rounded bg-gray-300 dark:bg-gray-600"></div>
                          <div className="h-8 w-8 animate-pulse rounded bg-gray-300 dark:bg-gray-600"></div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <div className="h-4 w-16 animate-pulse rounded bg-gray-300 dark:bg-gray-600"></div>
                        <div className="h-6 w-16 animate-pulse rounded-full bg-gray-300 dark:bg-gray-600"></div>
                      </div>
                      <div className="h-3 w-12 animate-pulse rounded bg-gray-300 dark:bg-gray-600"></div>
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
    <DashboardLayout title="Gestão de Parceiros">
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 p-3 shadow-lg">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-3xl font-bold text-transparent dark:from-white dark:to-gray-300">
                Gestão de Parceiros
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Gerencie sua rede de parceiros comerciais
              </p>
            </div>
          </div>
          <Button
            onClick={openNewModal}
            disabled={createMutation.isPending}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg transition-all duration-200 hover:from-cyan-700 hover:to-blue-700 hover:shadow-xl"
            size="lg"
          >
            <Plus className="mr-2 h-5 w-5" />
            {createMutation.isPending ? "Criando..." : "Novo Parceiro"}
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 dark:border-blue-800 dark:from-blue-950 dark:to-blue-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Total de Parceiros
              </CardTitle>
              <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {partnerStats.total}
              </div>
              <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">parceiros cadastrados</p>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100 dark:border-green-800 dark:from-green-950 dark:to-green-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
                Parceiros Ativos
              </CardTitle>
              <Activity className="h-4 w-4 text-green-600 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                {partnerStats.ativos}
              </div>
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">em operação</p>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-gradient-to-br from-red-50 to-red-100 dark:border-red-800 dark:from-red-950 dark:to-red-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">
                Parceiros Inativos
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-red-600 dark:text-red-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                {partnerStats.inativos}
              </div>
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                temporariamente inativos
              </p>
            </CardContent>
          </Card>

          <Card className="border-cyan-200 bg-gradient-to-br from-cyan-50 to-cyan-100 dark:border-cyan-800 dark:from-cyan-950 dark:to-cyan-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-cyan-700 dark:text-cyan-300">
                Taxa de Atividade
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">
                {partnerStats.percentualAtivos}%
              </div>
              <p className="mt-1 text-xs text-cyan-600 dark:text-cyan-400">
                parceiros operacionais
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Partners Grid */}
        <Card className="border-gray-200 bg-white/50 shadow-xl backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/50">
          <CardHeader className="border-b border-gray-200 dark:border-gray-700">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              Rede de Parceiros
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {partners.length === 0 ? (
              <div className="py-12 text-center">
                <Building2 className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-gray-100">
                  Nenhum parceiro cadastrado
                </h3>
                <p className="mb-6 text-gray-500 dark:text-gray-400">
                  Comece adicionando o primeiro parceiro comercial ao sistema.
                </p>
                <Button
                  onClick={openNewModal}
                  className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-700 hover:to-blue-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Primeiro Parceiro
                </Button>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {partners.map(partner => (
                  <Card
                    key={partner.id}
                    className="border border-gray-200 transition-all duration-200 hover:border-cyan-300 hover:shadow-lg dark:border-gray-700 dark:hover:border-cyan-600"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex-shrink-0 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 p-2">
                            <Building2 className="h-5 w-5 text-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {partner.razaoSocial}
                            </h3>
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 gap-1">
                          <Link to={`/parceiros/detalhe/${partner.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 border-gray-300 p-0 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950"
                            >
                              <Eye className="h-3 w-3 text-gray-600 hover:text-blue-600" />
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(partner)}
                            disabled={updateMutation.isPending}
                            className="h-7 w-7 border-gray-300 p-0 hover:border-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950"
                          >
                            <Edit className="h-3 w-3 text-gray-600 hover:text-cyan-600" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(partner)}
                            disabled={deleteMutation.isPending}
                            className="h-7 w-7 border-gray-300 p-0 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                          >
                            <Trash2 className="h-3 w-3 text-gray-600 hover:text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            CNPJ
                          </span>
                        </div>
                        <Badge className="border-gray-200 bg-gray-100 font-mono text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                          {partner.cnpj}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Status
                          </span>
                        </div>
                        <Badge
                          className={
                            !partner.deletedAt
                              ? "border-green-200 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "border-red-200 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          }
                        >
                          {!partner.deletedAt ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <div className="border-t border-gray-100 pt-2 dark:border-gray-700">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          ID: {partner.id}
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
      {/* Create/Edit Partner Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedPartner ? "Editar Parceiro" : "Novo Parceiro"}</DialogTitle>
          </DialogHeader>
          <PartnerForm
            initialData={selectedPartner}
            onSubmit={handleCreateOrEdit}
            onCancel={() => {
              setIsModalOpen(false);
              setSelectedPartner(null);
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o parceiro{" "}
              <strong>{partnerToDelete?.razaoSocial}</strong>?
              <br />
              <br />
              <span className="font-medium text-red-600">
                Atenção: Esta ação não pode ser desfeita. O parceiro será permanentemente removido
                do sistema.
              </span>
              {partnerToDelete && (
                <div className="mt-3 rounded bg-gray-50 p-3 dark:bg-gray-800">
                  <p className="text-sm">
                    <strong>CNPJ:</strong> {partnerToDelete.cnpj}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteDialogOpen(false);
                setPartnerToDelete(null);
              }}
              disabled={deleteMutation.isPending}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir Parceiro"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};
export default PartnersPage;
