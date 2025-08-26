import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Pencil,
  Trash2,
  Plus,
  Package,
  BarChart3,
  Activity,
  Settings,
  TrendingUp,
} from 'lucide-react';
import { api } from '@/lib/apiClient';
import { handleApiError, showSuccessMessage } from '@/lib/errorHandler';
import { useLoadingStates } from '@/hooks/useLoadingStates';
import DashboardLayout from '@/components/DashboardLayout';

interface Produto {
  id: number;
  nomeProduto: string;
  isActive: boolean;
  tacValor?: number;
  tacTipo?: 'fixo' | 'percentual';
}

interface ProdutoFormData {
  nome: string;
  status: 'Ativo' | 'Inativo';
  tacValor: number;
  tacTipo: 'fixo' | 'percentual';
}

export default function GestãoProdutos() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Produto | null>(null);
  const [formData, setFormData] = useState<ProdutoFormData>({
    nome: '',
    status: 'Ativo',
    tacValor: 0,
    tacTipo: 'fixo',
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const loadingStates = useLoadingStates();

  // Query para buscar produtos
  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ['produtos'],
    queryFn: async () => {
      const response = await api.get<Produto[]>('/api/produtos');
      return response.data;
    },
  });

  // Mutation para criar produto
  const createMutation = useMutation({
    mutationFn: async (data: ProdutoFormData) => {
      const response = await api.post<Produto>('/api/produtos', {
        nome: data.nome,
        status: data.status,
        tacValor: data.tacValor,
        tacTipo: data.tacTipo,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      showSuccessMessage('create', 'Produto');
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
        status: data.status,
        tacValor: data.tacValor,
        tacTipo: data.tacTipo,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      showSuccessMessage('update', 'Produto');
      handleCloseDialog();
    },
    onError: (error: any) => {
      handleApiError(error);
    },
  });

  // Mutation para deletar produto
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/produtos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      showSuccessMessage('delete', 'Produto');
    },
    onError: (error: any) => {
      handleApiError(error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      updateMutation.mutate({
        id: editingProduct.id,
        data: formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (produto: Produto) => {
    setEditingProduct(produto);
    setFormData({
      nome: produto.nomeProduto,
      status: produto.isActive ? 'Ativo' : 'Inativo',
      tacValor: produto.tacValor || 0,
      tacTipo: produto.tacTipo || 'fixo',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Tem certeza de que deseja excluir este produto?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProduct(null);
    setFormData({ nome: '', status: 'Ativo', tacValor: 0, tacTipo: 'fixo' });
  };

  const handleOpenDialog = () => {
    setEditingProduct(null);
    setFormData({ nome: '', status: 'Ativo', tacValor: 0, tacTipo: 'fixo' });
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Gestão de Produtos">
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 p-3 shadow-lg">
                <Package className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="mb-2 h-9 w-64 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700"></div>
                <div className="h-4 w-80 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
              </div>
            </div>
            <div className="h-12 w-40 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700"></div>
          </div>
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
        </div>
      </DashboardLayout>
    );
  }

  // Calcular estatísticas dos produtos
  const produtosStats = {
    total: produtos.length,
    ativos: produtos.filter((p) => p.isActive).length,
    inativos: produtos.filter((p) => !p.isActive).length,
    percentualAtivos:
      produtos.length > 0
        ? ((produtos.filter((p) => p.isActive).length / produtos.length) * 100).toFixed(1)
        : '0',
  };

  return (
    <DashboardLayout title="Gestão de Produtos">
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 p-3 shadow-lg">
              <Package className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-3xl font-bold text-transparent dark:from-white dark:to-gray-300">
                Gestão de Produtos
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Gerencie os produtos de crédito disponíveis no sistema
              </p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={handleOpenDialog}
                className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg transition-all duration-200 hover:from-cyan-700 hover:to-blue-700 hover:shadow-xl"
                size="lg"
              >
                <Plus className="mr-2 h-5 w-5" />
                Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent className="border-border bg-card">
              <DialogHeader>
                <DialogTitle className="text-card-foreground">
                  {editingProduct ? 'Editar Produto' : 'Novo Produto'}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {editingProduct
                    ? 'Atualize as informações do produto'
                    : 'Adicione um novo produto de crédito'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome" className="text-card-foreground">
                    Nome do Produto
                  </Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Crédito Pessoal"
                    className="border-border bg-input text-foreground"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status" className="text-card-foreground">
                    Status
                  </Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: 'Ativo' | 'Inativo') =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger className="border-border bg-input text-foreground">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card">
                      <SelectItem value="Ativo" className="text-card-foreground hover:bg-muted">
                        Ativo
                      </SelectItem>
                      <SelectItem value="Inativo" className="text-card-foreground hover:bg-muted">
                        Inativo
                      </SelectItem>
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
                        ? 'Atualizar'
                        : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 dark:border-blue-800 dark:from-blue-950 dark:to-blue-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Total de Produtos
              </CardTitle>
              <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {produtosStats.total}
              </div>
              <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">produtos cadastrados</p>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100 dark:border-green-800 dark:from-green-950 dark:to-green-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
                Produtos Ativos
              </CardTitle>
              <Activity className="h-4 w-4 text-green-600 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                {produtosStats.ativos}
              </div>
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                disponíveis para venda
              </p>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-gradient-to-br from-red-50 to-red-100 dark:border-red-800 dark:from-red-950 dark:to-red-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">
                Produtos Inativos
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-red-600 dark:text-red-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                {produtosStats.inativos}
              </div>
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                temporariamente desabilitados
              </p>
            </CardContent>
          </Card>

          <Card className="border-cyan-200 bg-gradient-to-br from-cyan-50 to-cyan-100 dark:border-cyan-800 dark:from-cyan-950 dark:to-cyan-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-cyan-700 dark:text-cyan-300">
                Taxa de Ativação
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">
                {produtosStats.percentualAtivos}%
              </div>
              <p className="mt-1 text-xs text-cyan-600 dark:text-cyan-400">produtos em operação</p>
            </CardContent>
          </Card>
        </div>

        {/* Products Grid */}
        <Card className="border-gray-200 bg-white/50 shadow-xl backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/50">
          <CardHeader className="border-b border-gray-200 dark:border-gray-700">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              Catálogo de Produtos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {produtos.length === 0 ? (
              <div className="py-12 text-center">
                <Package className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-gray-100">
                  Nenhum produto cadastrado
                </h3>
                <p className="mb-6 text-gray-500 dark:text-gray-400">
                  Comece adicionando o primeiro produto de crédito ao sistema.
                </p>
                <Button
                  onClick={handleOpenDialog}
                  className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-700 hover:to-blue-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Primeiro Produto
                </Button>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {produtos.map((produto) => (
                  <Card
                    key={produto.id}
                    className="border border-gray-200 transition-all duration-200 hover:border-cyan-300 hover:shadow-lg dark:border-gray-700 dark:hover:border-cyan-600"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 p-2">
                            <Package className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="truncate font-semibold text-gray-900 dark:text-gray-100">
                              {produto.nomeProduto}
                            </h3>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(produto)}
                            className="h-8 w-8 border-gray-300 p-0 hover:border-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950"
                          >
                            <Pencil className="h-3 w-3 text-gray-600 hover:text-cyan-600" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(produto.id)}
                            className="h-8 w-8 border-gray-300 p-0 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                          >
                            <Trash2 className="h-3 w-3 text-gray-600 hover:text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Status
                          </span>
                        </div>
                        <Badge
                          className={
                            produto.isActive
                              ? 'border-green-200 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'border-red-200 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }
                        >
                          {produto.isActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      <div className="border-t border-gray-100 pt-2 dark:border-gray-700">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          ID: {produto.id}
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
    </DashboardLayout>
  );
}
