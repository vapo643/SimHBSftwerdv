
import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus } from "lucide-react";
import { api } from "@/lib/apiClient";
import { handleApiError, showSuccessMessage } from "@/lib/errorHandler";
import { useLoadingStates } from "@/hooks/useLoadingStates";
import DashboardLayout from "@/components/DashboardLayout";

interface Produto {
  id: number;
  nomeProduto: string;
  isActive: boolean;
}

interface ProdutoFormData {
  nome: string;
  status: "Ativo" | "Inativo";
}

export default function GestãoProdutos() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Produto | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Produto | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [formData, setFormData] = useState<ProdutoFormData>({
    nome: "",
    status: "Ativo",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const loadingStates = useLoadingStates();

  // Query para buscar produtos
  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const response = await api.get<Produto[]>("/api/produtos");
      return response.data;
    },
  });

  // Mutation para criar produto
  const createMutation = useMutation({
    mutationFn: async (data: ProdutoFormData) => {
      const response = await api.post<Produto>("/api/produtos", {
        nome: data.nome,
        status: data.status
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      showSuccessMessage("create", "Produto");
      handleCloseDialog();
    },
    onError: (error: any) => {
      handleApiError(error);
    },
  });

  // Mutation para atualizar produto
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ProdutoFormData }) => {
      const response = await api.put<Produto>(`/api/produtos/${id}`, {
        nome: data.nome,
        status: data.status
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      showSuccessMessage("update", "Produto");
      handleCloseDialog();
    },
    onError: (error: any) => {
      handleApiError(error);
    },
  });

  // Mutation para deletar produto
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.delete(`/api/produtos/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      showSuccessMessage("delete", "Produto");
    },
    onError: (error: any) => {
      handleApiError(error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      toast({
        title: "Erro",
        description: "Nome do produto é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (produto: Produto) => {
    setEditingProduct(produto);
    setFormData({
      nome: produto.nomeProduto,
      status: produto.isActive ? "Ativo" : "Inativo",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = () => {
    if (deletingProduct) {
      deleteMutation.mutate(deletingProduct.id, {
        onSuccess: () => {
          setIsDeleteDialogOpen(false);
          setDeletingProduct(null);
        }
      });
    }
  };

  const handleOpenDeleteDialog = (produto: Produto) => {
    setDeletingProduct(produto);
    setIsDeleteDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProduct(null);
    setFormData({ nome: "", status: "Ativo" });
  };

  const handleOpenDialog = () => {
    setEditingProduct(null);
    setFormData({ nome: "", status: "Ativo" });
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Gestão de Produtos">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">Carregando produtos...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Gestão de Produtos">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Gestão de Produtos</h1>
            <p className="text-muted-foreground">
              Gerencie os produtos de crédito disponíveis no sistema
            </p>
          </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-card-foreground">
                {editingProduct ? "Editar Produto" : "Novo Produto"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingProduct
                  ? "Atualize as informações do produto"
                  : "Adicione um novo produto de crédito"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-card-foreground">Nome do Produto</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) =>
                    setFormData({ ...formData, nome: e.target.value })
                  }
                  placeholder="Ex: Crédito Pessoal"
                  className="bg-input border-border text-foreground"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status" className="text-card-foreground">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: "Ativo" | "Inativo") =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger className="bg-input border-border text-foreground">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="Ativo" className="text-card-foreground hover:bg-muted">Ativo</SelectItem>
                    <SelectItem value="Inativo" className="text-card-foreground hover:bg-muted">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? loadingStates.saving
                    : editingProduct
                    ? "Atualizar"
                    : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Produtos Cadastrados</CardTitle>
          <CardDescription className="text-muted-foreground">
            Lista de todos os produtos de crédito no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-muted/50">
                <TableHead className="text-card-foreground">Nome do Produto</TableHead>
                <TableHead className="text-card-foreground">Status</TableHead>
                <TableHead className="text-right text-card-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {produtos.length === 0 ? (
                <TableRow className="border-border hover:bg-muted/50">
                  <TableCell colSpan={3} className="text-center py-8">
                    <div className="text-muted-foreground">
                      <p>Nenhum produto encontrado</p>
                      <p className="text-sm">Clique em "Novo Produto" para começar</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                produtos.map((produto: Produto) => (
                  <TableRow key={produto.id} className="border-border hover:bg-muted/50">
                    <TableCell className="font-medium text-card-foreground">
                      {produto.nomeProduto}
                    </TableCell>
                    <TableCell>
                      <Badge variant={produto.isActive ? "default" : "secondary"}>
                        {produto.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(produto)}
                          className="border-border hover:bg-muted"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleOpenDeleteDialog(produto)}
                          className="border-border hover:bg-muted"
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
      </div>

      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setDeletingProduct(null);
        }}
        onConfirm={handleDelete}
        title="Tem a certeza?"
        description={
          deletingProduct
            ? `Esta ação é irreversível e irá apagar permanentemente o produto "${deletingProduct.nomeProduto}" do banco de dados. Esta operação só será bem-sucedida se o produto não estiver associado a nenhuma Tabela Comercial.`
            : ""
        }
        confirmText="Excluir Permanentemente"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </DashboardLayout>
  );
}
