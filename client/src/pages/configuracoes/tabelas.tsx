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

export interface TabelaComercial {
  id: string;
  nomeTabela: string;
  taxaJuros: number;
  prazosPermitidos: number[];
  produtoId: number;
  emUso?: boolean;
}

const mockTabelas: TabelaComercial[] = [
  {
    id: "1",
    nomeTabela: "Tabela A - Preferencial",
    taxaJuros: 1.5,
    prazosPermitidos: [12, 24, 36],
    produtoId: 1,
    emUso: true,
  },
  {
    id: "2",
    nomeTabela: "Tabela B - Padrão",
    taxaJuros: 2.0,
    prazosPermitidos: [6, 12, 18, 24],
    produtoId: 2,
    emUso: false,
  },
  {
    id: "3",
    nomeTabela: "Tabela C - Especial",
    taxaJuros: 1.8,
    prazosPermitidos: [24, 36, 48],
    produtoId: 1,
    emUso: true,
  },
];

const TabelasComerciais: React.FC = () => {
  const [tabelas, setTabelas] = useState<TabelaComercial[]>(mockTabelas);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTabela, setSelectedTabela] = useState<TabelaComercial | null>(null);

  const handleCreate = (novaTabela: Omit<TabelaComercial, "id">) => {
    const tabela: TabelaComercial = {
      ...novaTabela,
      id: String(Date.now()),
      emUso: false,
    };
    setTabelas([...tabelas, tabela]);
    setIsCreateModalOpen(false);
  };

  const handleEdit = (tabelaAtualizada: Omit<TabelaComercial, "id">) => {
    if (selectedTabela) {
      setTabelas(
        tabelas.map(t =>
          t.id === selectedTabela.id
            ? { ...tabelaAtualizada, id: selectedTabela.id, emUso: selectedTabela.emUso }
            : t
        )
      );
      setIsEditModalOpen(false);
      setSelectedTabela(null);
    }
  };

  const handleDelete = () => {
    if (selectedTabela) {
      setTabelas(tabelas.filter(t => t.id !== selectedTabela.id));
      setIsDeleteModalOpen(false);
      setSelectedTabela(null);
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

  return (
    <DashboardLayout title="Gestão de Tabelas Comerciais">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl text-gradient-simpix">Tabelas Comerciais</h1>
          <Button className="btn-simpix-accent" onClick={() => setIsCreateModalOpen(true)}>Nova Tabela Comercial</Button>
        </div>

        <Card className="card-simpix">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome da Tabela</TableHead>
                  <TableHead>Taxa de Juros Mensal (%)</TableHead>
                  <TableHead>Prazos Permitidos</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tabelas.map(tabela => (
                  <TableRow key={tabela.id}>
                    <TableCell className="font-medium">{tabela.nomeTabela}</TableCell>
                    <TableCell>{tabela.taxaJuros}%</TableCell>
                    <TableCell>
                      {tabela.prazosPermitidos.map(prazo => `${prazo} meses`).join(", ")}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" onClick={() => openEditModal(tabela)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDeleteModal(tabela)}
                          disabled={tabela.emUso}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {tabelas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center">
                      Nenhuma tabela comercial cadastrada
                    </TableCell>
                  </TableRow>
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
