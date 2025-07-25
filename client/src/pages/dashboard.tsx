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
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const getStatusClass = (status: string) => {
  switch (status.toLowerCase()) {
    case "aprovado":
      return "status-approved";
    case "em_analise":
    case "aguardando_analise":
      return "status-pending";
    case "rejeitado":
      return "status-rejected";
    case "pago":
      return "status-approved";
    case "pronto_pagamento":
      return "status-pending";
    case "rascunho":
      return "status-draft";
    case "cancelado":
      return "status-rejected";
    default:
      return "status-pending";
  }
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const Dashboard: React.FC = () => {
  // Fetch real proposals data
  const { data: propostas, isLoading, error } = useQuery({
    queryKey: ['/api/propostas'],
  });

  if (isLoading) {
    return (
      <DashboardLayout title="Dashboard de Propostas">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title="Dashboard de Propostas">
        <Alert variant="destructive">
          <AlertDescription>
            Erro ao carregar propostas. Por favor, tente novamente.
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }
  const propostasData = propostas || [];

  return (
    <DashboardLayout title="Dashboard de Propostas">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl text-gradient-simpix">Propostas</h1>
          <Link to="/propostas/nova">
            <Button className="btn-simpix-accent">Criar Nova Proposta</Button>
          </Link>
        </div>
        <Card className="card-simpix">
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
                {propostasData.map((proposta: any) => (
                  <TableRow key={proposta.id}>
                    <TableCell className="font-mono">#{proposta.id}</TableCell>
                    <TableCell>{proposta.nomeCliente || 'Sem nome'}</TableCell>
                    <TableCell>{formatCurrency(proposta.valorSolicitado || 0)}</TableCell>
                    <TableCell>
                      <span className={getStatusClass(proposta.status)}>
                        {proposta.status.replace(/_/g, ' ').replace(/^\w/, (c: string) => c.toUpperCase())}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {propostasData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500">
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
