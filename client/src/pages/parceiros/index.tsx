import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Edit, Trash2, Eye, Building2, Users } from "lucide-react";

const PartnersPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Parceiro | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [partnerToDelete, setPartnerToDelete] = useState<Parceiro | null>(null);
  const { toast } = useToast();

  // Fetch partners data using new apiClient and hierarchical query keys
  const { data: partners = [], isLoading, error } = useQuery<Parceiro[]>({
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
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-red-600">Erro ao carregar parceiros</h3>
            <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Gestão de Parceiros">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl text-gradient-simpix">Parceiros</h1>
        </div>
        <Button 
          className="btn-simpix-accent" 
          onClick={openNewModal}
          disabled={createMutation.isPending}
        >
          <Users className="h-4 w-4 mr-2" />
          {createMutation.isPending ? "Criando..." : "Novo Parceiro"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-2">Carregando parceiros...</p>
          </div>
        </div>
      ) : (
        <div className="rounded-md border bg-gray-900 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-800">
                <TableHead className="font-semibold">Razão Social</TableHead>
                <TableHead className="font-semibold">CNPJ</TableHead>

                <TableHead className="font-semibold text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Building2 className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">Nenhum parceiro encontrado</p>
                      <Button variant="outline" onClick={openNewModal} className="mt-2">
                        Criar primeiro parceiro
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                partners.map((partner) => (
                  <TableRow key={partner.id} className="hover:bg-gray-800">
                    <TableCell className="font-medium">{partner.razaoSocial}</TableCell>
                    <TableCell className="font-mono text-sm">{partner.cnpj}</TableCell>

                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link to={`/parceiros/detalhe/${partner.id}`}>
                          <Button variant="outline" size="sm" className="gap-1">
                            <Eye className="h-4 w-4" />
                            Detalhes
                          </Button>
                        </Link>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleEdit(partner)}
                          disabled={updateMutation.isPending}
                          className="gap-1"
                        >
                          <Edit className="h-4 w-4" />
                          {updateMutation.isPending && selectedPartner?.id === partner.id ? "Salvando..." : "Editar"}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDelete(partner)}
                          disabled={deleteMutation.isPending}
                          className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                          {deleteMutation.isPending && partnerToDelete?.id === partner.id ? "Excluindo..." : "Excluir"}
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
      {/* Create/Edit Partner Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPartner ? "Editar Parceiro" : "Novo Parceiro"}
            </DialogTitle>
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
              Tem certeza que deseja excluir o parceiro <strong>{partnerToDelete?.razaoSocial}</strong>?
              <br />
              <br />
              <span className="text-red-600 font-medium">
                Atenção: Esta ação não pode ser desfeita. O parceiro será permanentemente removido do sistema.
              </span>
              {partnerToDelete && (
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded">
                  <p className="text-sm"><strong>CNPJ:</strong> {partnerToDelete.cnpj}</p>
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
              className="bg-red-600 hover:bg-red-700 text-white"
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
