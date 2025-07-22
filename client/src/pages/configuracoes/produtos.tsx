import React, { useState } from "react";
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

interface Produto {
  id: number;
  nome: string;
  status: "Ativo" | "Inativo";
  emUso: boolean;
}

const mockProdutos: Produto[] = [
  { id: 1, nome: "Crédito Pessoal", status: "Ativo", emUso: true },
  { id: 2, nome: "Crédito Imobiliário", status: "Inativo", emUso: false },
  { id: 3, nome: "Crédito Consignado", status: "Ativo", emUso: false },
];

const ProdutosPage: React.FC = () => {
  const { toast } = useToast();
  const [produtos, setProdutos] = useState<Produto[]>(mockProdutos);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);

  const handleDelete = (id: number) => {
    const produto = produtos.find(p => p.id === id);
    if (produto?.emUso) {
      toast({
        title: "Ação Bloqueada",
        description: "Este produto não pode ser excluído pois está vinculado a propostas.",
        variant: "destructive",
      });
    } else {
      setProdutos(produtos.filter(p => p.id !== id));
      toast({
        title: "Sucesso",
        description: "Produto excluído com sucesso.",
      });
    }
  };

  const handleSubmit = (data: any) => {
    if (selectedProduto) {
      // Editar produto existente
      setProdutos(produtos.map(p => (p.id === selectedProduto.id ? { ...p, ...data } : p)));
      toast({
        title: "Sucesso",
        description: "Produto atualizado com sucesso.",
      });
    } else {
      // Criar novo produto
      const newProduto = {
        id: Math.max(...produtos.map(p => p.id)) + 1,
        ...data,
        emUso: false,
      };
      setProdutos([...produtos, newProduto]);
      toast({
        title: "Sucesso",
        description: "Produto criado com sucesso.",
      });
    }
    setIsModalOpen(false);
    setSelectedProduto(null);
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
                {produtos.map(produto => (
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
                ))}
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
