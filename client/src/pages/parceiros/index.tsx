import React, { useState } from "react";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Edit2, Trash2 } from "lucide-react";

interface Parceiro {
  id: number;
  razaoSocial: string;
  cnpj: string;
  comissaoPadrao?: string;
  tabelaComercialPadraoId?: number;
  createdAt: string;
}

const PartnersPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Parceiro | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [partnerToDelete, setPartnerToDelete] = useState<Parceiro | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch partners
  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["/api/parceiros"],
  });

  // Create partner mutation
  const createPartnerMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/admin/parceiros", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parceiros"] });
      setIsModalOpen(false);
      setSelectedPartner(null);
      toast({
        title: "Sucesso",
        description: "Parceiro criado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar parceiro.",
        variant: "destructive",
      });
    },
  });

  // Update partner mutation
  const updatePartnerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest(`/api/admin/parceiros/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parceiros"] });
      setIsModalOpen(false);
      setSelectedPartner(null);
      toast({
        title: "Sucesso",
        description: "Parceiro atualizado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar parceiro.",
        variant: "destructive",
      });
    },
  });

  // Delete partner mutation
  const deletePartnerMutation = useMutation({
    mutationFn: async (partnerId: number) => {
      return apiRequest(`/api/admin/parceiros/${partnerId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parceiros"] });
      setIsDeleteDialogOpen(false);
      setPartnerToDelete(null);
      toast({
        title: "Sucesso", 
        description: "Parceiro excluído com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não é possível excluir um parceiro que possui lojas cadastradas.",
        variant: "destructive",
      });
      setIsDeleteDialogOpen(false);
      setPartnerToDelete(null);
    },
  });

  const handleCreateOrEdit = (data: any) => {
    if (selectedPartner) {
      // Update existing partner
      updatePartnerMutation.mutate({
        id: selectedPartner.id,
        data: {
          razaoSocial: data.razaoSocial,
          cnpj: data.cnpj,
        },
      });
    } else {
      // Create new partner
      createPartnerMutation.mutate({
        razaoSocial: data.razaoSocial,
        cnpj: data.cnpj,
      });
    }
  };

  const openNewModal = () => {
    setSelectedPartner(null);
    setIsModalOpen(true);
  };

  const openEditModal = (partner: Parceiro) => {
    setSelectedPartner(partner);
    setIsModalOpen(true);
  };

  const openDeleteDialog = (partner: Parceiro) => {
    setPartnerToDelete(partner);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (partnerToDelete) {
      deletePartnerMutation.mutate(partnerToDelete.id);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Gestão de Parceiros">
        <div className="flex items-center justify-center h-64">
          <p>Carregando parceiros...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Gestão de Parceiros">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl text-gradient-simpix">Parceiros</h1>
        <Button className="btn-simpix-accent" onClick={openNewModal}>Novo Parceiro</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Razão Social</TableHead>
            <TableHead>CNPJ</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {partners.map((partner: Parceiro) => (
            <TableRow key={partner.id}>
              <TableCell>{partner.razaoSocial}</TableCell>
              <TableCell>{partner.cnpj}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(partner)}
                    className="flex items-center gap-1"
                  >
                    <Edit2 className="h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDeleteDialog(partner)}
                    className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </Button>
                  <Link to={`/parceiros/detalhe/${partner.id}`}>
                    <Button className="btn-simpix-primary" size="sm">
                      Ver Detalhes
                    </Button>
                  </Link>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza de que deseja excluir o parceiro "{partnerToDelete?.razaoSocial}"?
              {" "}Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deletePartnerMutation.isPending}
            >
              {deletePartnerMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};
export default PartnersPage;
