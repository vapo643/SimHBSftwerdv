import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
  TableCell,
  TableHead,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ProdutoForm from "@/components/produtos/ProdutoForm";
import { apiRequest } from "@/lib/queryClient";

interface Produto {
  id: number;
  nome: string;
  descricao?: string;
  taxaJuros: string;
  prazoMinimo: number;
  prazoMaximo: number;
  valorMinimo: string;
  valorMaximo: string;
  ativo: boolean;
  status: "Ativo" | "Inativo";
  emUso?: boolean;
}

const ProdutosPage: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);

  // Fetch products from API
  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["/api/produtos"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/produtos");
      return (response as unknown as any[]).map((produto: any) => ({
        ...produto,
        status: produto.ativo ? "Ativo" : "Inativo",
        emUso: false, // This would be determined by actual usage check
      }));
    },
  });

  // Create product mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/produtos", {
        ...data,
        lojaId: 1, // This should come from user context/auth
        taxaJuros: "5.00", // Default values, should come from form
        prazoMinimo: 12,
        prazoMaximo: 60,
        valorMinimo: "1000.00",
        valorMaximo: "50000.00",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/produtos"] });
      toast({
        title: "Sucesso",
        description: "Produto criado com sucesso.",
      });
      setIsModalOpen(false);
      setSelectedProduto(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar produto.",
        variant: "destructive",
      });
    },
  });

  // Update product mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest("PUT", `/api/produtos/${id}`, {
        ...data,
        lojaId: 1, // This should come from user context/auth
        taxaJuros: "5.00", // Default values, should come from form
        prazoMinimo: 12,
        prazoMaximo: 60,
        valorMinimo: "1000.00",
        valorMaximo: "50000.00",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/produtos"] });
      toast({
        title: "Sucesso",
        description: "Produto atualizado com sucesso.",
      });
      setIsModalOpen(false);
      setSelectedProduto(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar produto.",
        variant: "destructive",
      });
    },
  });

  // Delete product mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/produtos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/produtos"] });
      toast({
        title: "Sucesso",
        description: "Produto excluído com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir produto.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (id: number) => {
    const produto = produtos.find(p => p.id === id);
    if (produto?.emUso) {
      toast({
        title: "Ação Bloqueada",
        description: "Este produto não pode ser excluído pois está vinculado a propostas.",
        variant: "destructive",
      });
    } else {
      deleteMutation.mutate(id);
    }
  };

  const handleSubmit = (data: any) => {
    if (selectedProduto) {
      updateMutation.mutate({ id: selectedProduto.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (produto: Produto) => {
    setSelectedProduto(produto);
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setSelectedProduto(null);
  };

  const openNewModal = () => {
    setSelectedProduto(null);
    setIsModalOpen(true);
  };

  return (
    <DashboardLayout title="Gestão de Produtos de Crédito">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Produtos de Crédito</h1>
          <Button onClick={openNewModal}>Novo Produto</Button>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Produto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6">
                      Carregando produtos...
                    </TableCell>
                  </TableRow>
                ) : produtos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6">
                      Nenhum produto encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  produtos.map((produto: Produto) => (
                    <TableRow key={produto.id}>
                      <TableCell className="font-medium">{produto.nome}</TableCell>
                      <TableCell>{produto.status}</TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(produto)}>
                          Editar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(produto.id)}
                          disabled={produto.emUso}
                        >
                          Excluir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedProduto ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>
          <ProdutoForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            initialData={
              selectedProduto
                ? { nome: selectedProduto.nome, status: selectedProduto.status }
                : undefined
            }
          />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ProdutosPage;
