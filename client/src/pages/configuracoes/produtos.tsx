
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus } from "lucide-react";
import { api } from "@/lib/apiClient";
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
  const [formData, setFormData] = useState<ProdutoFormData>({
    nome: "",
    status: "Ativo",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

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
        status: data.status === "Ativo"
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      toast({
        title: "Sucesso!",
        description: "Produto criado com sucesso.",
      });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para atualizar produto
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ProdutoFormData }) => {
      const response = await api.put<Produto>(`/api/produtos/${id}`, {
        nome: data.nome,
        status: data.status === "Ativo"
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      toast({
        title: "Sucesso!",
        description: "Produto atualizado com sucesso.",
      });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
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
      toast({
        title: "Sucesso!",
        description: "Produto excluído com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
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

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
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
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Carregando produtos...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout title="Gestão de Produtos">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestão de Produtos</h1>
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? "Editar Produto" : "Novo Produto"}
              </DialogTitle>
              <DialogDescription>
                {editingProduct
                  ? "Atualize as informações do produto"
                  : "Adicione um novo produto de crédito"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Produto</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) =>
                    setFormData({ ...formData, nome: e.target.value })
                  }
                  placeholder="Ex: Crédito Pessoal"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: "Ativo" | "Inativo") =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Inativo">Inativo</SelectItem>
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
                    ? "Salvando..."
                    : editingProduct
                    ? "Atualizar"
                    : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Produtos Cadastrados</CardTitle>
          <CardDescription>
            Lista de todos os produtos de crédito no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome do Produto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {produtos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8">
                    <div className="text-muted-foreground">
                      <p>Nenhum produto encontrado</p>
                      <p className="text-sm">Clique em "Novo Produto" para começar</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                produtos.map((produto: Produto) => (
                  <TableRow key={produto.id}>
                    <TableCell className="font-medium">
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
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir o produto "{produto.nomeProduto}"?
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(produto.id)}
                                disabled={deleteMutation.isPending}
                              >
                                {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
    </DashboardLayout>
  );
}
