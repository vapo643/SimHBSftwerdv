import React from "react";
import { Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

const mockData = [
  { id: 1, cliente: "Cliente A", valor: "R$ 10.000", status: "Aprovado" },
  { id: 2, cliente: "Cliente B", valor: "R$ 20.000", status: "Em Análise" },
  { id: 3, cliente: "Cliente C", valor: "R$ 15.000", status: "Rejeitado" },
];

const Dashboard: React.FC = () => {
  return (
    <DashboardLayout title="Dashboard de Propostas">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Propostas</h1>
          <Link to="/propostas/nova">
            <Button>Criar Nova Proposta</Button>
          </Link>
        </div>
        <Card>
          <CardContent className="p-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockData.map(proposta => (
                  <TableRow key={proposta.id}>
                    <TableCell>{proposta.id}</TableCell>
                    <TableCell>{proposta.cliente}</TableCell>
                    <TableCell>{proposta.valor}</TableCell>
                    <TableCell>{proposta.status}</TableCell>
                  </TableRow>
                ))}
                {mockData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      Nenhuma proposta encontrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
