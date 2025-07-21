import React from "react";
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
import { Card, CardContent } from "@/components/ui/card";

const mockData = [
  {
    id: "PROP-098",
    data: "2025-07-17",
    cliente: "Empresa A",
    valor: "R$ 1.500,00",
    dadosBancarios: "Banco X, Ag 0001 C/C 12345-6",
    status: "Pronto para Pagamento",
  },
  {
    id: "PROP-101",
    data: "2025-07-16",
    cliente: "Empresa B",
    valor: "R$ 12.000,00",
    dadosBancarios: "Banco Y, Ag 0002 C/C 78910-1",
    status: "Aprovado",
  },
  {
    id: "PROP-105",
    data: "2025-07-15",
    cliente: "Empresa C",
    valor: "R$ 8.250,00",
    dadosBancarios: "Banco Z, Ag 0003 C/C 11223-3",
    status: "Pronto para Pagamento",
  },
];

const Pagamentos: React.FC = () => {
  return (
    <DashboardLayout title="Fila de Pagamento">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl text-gradient-simpix">Fila de Pagamento</h1>
          <Button className="btn-simpix-accent">Processar Pagamentos Selecionados</Button>
        </div>
        <Card className="card-simpix">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Proposta</TableHead>
                  <TableHead>Data da Formalização</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor a Pagar</TableHead>
                  <TableHead>Dados Bancários</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockData.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.id}</TableCell>
                    <TableCell>{item.data}</TableCell>
                    <TableCell>{item.cliente}</TableCell>
                    <TableCell>{item.valor}</TableCell>
                    <TableCell>{item.dadosBancarios}</TableCell>
                    <TableCell>{item.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Pagamentos;
