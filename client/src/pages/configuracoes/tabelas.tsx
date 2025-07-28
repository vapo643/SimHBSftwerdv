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
import { Card, CardContent } from "@/components/ui/card";
import { Edit, Trash2 } from "lucide-react";
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

  return (
    <DashboardLayout title="Gestão de Tabelas Comerciais">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl text-gradient-simpix">Tabelas Comerciais</h1>
          <Button 
            className="btn-simpix-accent" 
            onClick={() => setIsCreateModalOpen(true)}
            disabled={isLoading}
          >
            Nova Tabela Comercial
          </Button>
        </div>

        <Card className="card-simpix">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome da Tabela</TableHead>
                  <TableHead>Taxa de Juros Mensal (%)</TableHead>
                  <TableHead>Comissão (%)</TableHead>
                  <TableHead>Prazos Permitidos</TableHead>
                  <TableHead>Produtos Associados</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(3).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    </TableRow>
                  ))
                ) : tabelas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center">
                      Nenhuma tabela comercial cadastrada
                    </TableCell>
                  </TableRow>
                ) : (
                  tabelas.map(tabela => (
                    <TableRow key={tabela.id}>
                      <TableCell className="font-medium">{tabela.nomeTabela}</TableCell>
                      <TableCell>{Number(tabela.taxaJuros).toFixed(2)}%</TableCell>
                      <TableCell>{Number(tabela.comissao).toFixed(2)}%</TableCell>
                      <TableCell>
                        {tabela.prazos?.map(prazo => `${prazo} meses`).join(", ") || "-"}
                      </TableCell>
                      <TableCell>{tabela.produtoIds?.length || 0} produto(s)</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => openEditModal(tabela)}
                            disabled={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDeleteModal(tabela)}
                            disabled={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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
