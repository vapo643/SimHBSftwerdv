import React, { useEffect } from "react";
import { Link, useLocation } from "wouter";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Loader2, FileText, Clock, Calendar, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";

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
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Fetch real proposals data
  const { data: propostas, isLoading, error } = useQuery<any[]>({
    queryKey: ['/api/propostas'],
  });

  // Fetch user metrics if user is ATENDENTE
  const { data: metricas } = useQuery<{
    hoje: number;
    semana: number;
    mes: number;
  }>({
    queryKey: ['/api/propostas/metricas'],
    enabled: user?.role === 'ATENDENTE',
  });

  // Redirect ANALISTA to analysis queue
  useEffect(() => {
    if (user?.role === 'ANALISTA') {
      setLocation('/credito/fila');
    }
  }, [user?.role, setLocation]);

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
        {/* Métricas de Performance para Atendentes */}
        {user?.role === 'ATENDENTE' && metricas && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Propostas Hoje</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metricas.hoje || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Criadas nas últimas 24 horas
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Propostas Esta Semana</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metricas.semana || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Últimos 7 dias
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Propostas Este Mês</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metricas.mes || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Desde o início do mês
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h1 className="text-2xl text-gradient-simpix">
            {user?.role === 'ATENDENTE' ? 'Minhas Propostas' : 'Propostas'}
          </h1>
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
