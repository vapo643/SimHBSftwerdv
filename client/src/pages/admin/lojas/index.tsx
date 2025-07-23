import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Store, Eye, Edit, Trash2, Plus } from "lucide-react";
import { api } from "@/lib/apiClient";
import { LojaForm } from "@/components/lojas/LojaForm";
import type { Loja, InsertLoja, UpdateLoja } from "@shared/schema";

export default function LojasPage() {
  const [selectedLoja, setSelectedLoja] = useState<Loja | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch lojas
  const { data: lojas = [], isLoading: loadingLojas } = useQuery<Loja[]>({
    queryKey: ['/api/lojas'],
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: InsertLoja) => api.post('/admin/lojas', data),
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Loja criada com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/lojas'] });
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

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateLoja }) => 
      api.put(`/admin/lojas/${id}`, data),
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Loja atualizada com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/lojas'] });
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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/lojas/${id}`),
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Loja desativada com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/lojas'] });
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

  return (
    <DashboardLayout title="Gestão de Lojas">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Store className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl text-gradient-simpix">Lojas</h1>
        </div>
        <Button 
          className="btn-simpix-accent" 
          onClick={openNewModal}
          disabled={isSubmitting}
        >
          <Plus className="h-4 w-4 mr-2" />
          {createMutation.isPending ? "Criando..." : "Nova Loja"}
        </Button>
      </div>

      {loadingLojas ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-2">Carregando lojas...</p>
          </div>
        </div>
      ) : (
        <div className="rounded-md border bg-gray-900 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-800">
                <TableHead className="font-semibold">Nome da Loja</TableHead>
                <TableHead className="font-semibold">Endereço</TableHead>
                <TableHead className="font-semibold">Parceiro ID</TableHead>
                <TableHead className="font-semibold text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lojas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Store className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">Nenhuma loja encontrada</p>
                      <Button variant="outline" onClick={openNewModal} className="mt-2">
                        Criar primeira loja
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                lojas.map((loja: Loja) => (
                  <TableRow key={loja.id} className="hover:bg-gray-800">
                    <TableCell className="font-medium">{loja.nomeLoja}</TableCell>
                    <TableCell>{loja.endereco}</TableCell>
                    <TableCell>{loja.parceiroId}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-1"
                          onClick={() => openEditModal(loja)}
                          disabled={isSubmitting}
                        >
                          <Edit className="h-4 w-4" />
                          Editar
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          className="gap-1"
                          onClick={() => handleDelete(loja)}
                          disabled={isSubmitting}
                        >
                          <Trash2 className="h-4 w-4" />
                          Desativar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

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