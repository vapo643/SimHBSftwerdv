import React, { useState } from "react";
import { useRoute, Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { mockPartners } from "@/data/partners";
import ConfiguracaoComercialForm from "@/components/parceiros/ConfiguracaoComercialForm";
import LojaForm from "@/components/parceiros/LojaForm";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PartnerDetailPage: React.FC = () => {
  const [match, params] = useRoute("/parceiros/detalhe/:id");
  const id = params ? params.id : null;
  const partner = mockPartners.find(p => p.id === id);

  const [isLojaModalOpen, setIsLojaModalOpen] = useState(false);

  const handleAddStore = (data: any) => {
    console.log("Nova Loja Adicionada:", data);
    // Lógica para adicionar a loja ao parceiro no estado/backend será implementada na Fase 2
    setIsLojaModalOpen(false);
  };

  if (!partner) {
    return (
      <DashboardLayout title="Parceiro não encontrado">
        <p>
          Parceiro não encontrado. <Link to="/parceiros">Voltar para a lista.</Link>
        </p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`Detalhe do Parceiro: ${partner.nomeFantasia}`}>
      <h1 className="text-2xl font-bold">{partner.razaoSocial}</h1>
      <p className="text-muted-foreground">CNPJ: {partner.cnpj}</p>

      <div className="mt-8 grid gap-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Lojas</CardTitle>
            <Button onClick={() => setIsLojaModalOpen(true)}>Adicionar Nova Loja</Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome da Loja</TableHead>
                  <TableHead>Endereço (a ser adicionado)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partner.lojas.map(loja => (
                  <TableRow key={loja.id}>
                    <TableCell>{loja.nome}</TableCell>
                    <TableCell>Endereço a ser implementado</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <ConfiguracaoComercialForm />
      </div>

      {/* Modal para cadastrar nova loja */}
      <Dialog open={isLojaModalOpen} onOpenChange={setIsLojaModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Nova Loja</DialogTitle>
          </DialogHeader>
          <LojaForm onSubmit={handleAddStore} onCancel={() => setIsLojaModalOpen(false)} />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default PartnerDetailPage;
