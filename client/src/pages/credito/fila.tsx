import React, { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { 
  Calendar, 
  TrendingUp, 
  Clock, 
  Eye, 
  FileText, 
  Users, 
  Store, 
  Filter,
  User,
  Building,
  Loader2
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Removed mock data - now using real API data

interface Proposta {
  id: number;
  status: string;
  clienteNome: string;
  clienteCpf: string;
  valorSolicitado: string;
  parceiro?: {
    razaoSocial: string;
  };
  loja?: {
    nomeLoja: string;
  };
  createdAt: string;
  updatedAt: string;
}

const FilaAnalise: React.FC = () => {
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPartner, setFilterPartner] = useState("all");
  const [filterStore, setFilterStore] = useState("all");

  // Fetch real proposals data
  const { data: propostas, isLoading, error } = useQuery<Proposta[]>({
    queryKey: ['/api/propostas'],
  });

  // Fetch partners data
  const { data: parceiros } = useQuery({
    queryKey: ['/api/parceiros'],
  });

  const filteredData = useMemo(
    () => {
      if (!propostas) return [];
      
      return propostas.filter(proposta => {
        const byStatus = filterStatus !== "all" ? proposta.status === filterStatus : true;
        const byPartner =
          filterPartner !== "all"
            ? proposta.parceiro?.razaoSocial === filterPartner
            : true;
        const byStore = filterStore !== "all" ? proposta.loja?.nomeLoja === filterStore : true;
        return byStatus && byPartner && byStore;
      });
    },
    [propostas, filterStatus, filterPartner, filterStore]
  );

  const handlePartnerChange = (partnerId: string) => {
    setFilterPartner(partnerId);
    setFilterStore("all"); // Reseta o filtro de loja ao mudar o parceiro
  };

  const today = new Date().toISOString().split("T")[0];
  const propostasHoje = propostas?.filter(
    p => p.createdAt.split("T")[0] === today
  ).length || 0;
  
  const propostasPendentes = propostas?.filter(
    p => p.status === "aguardando_analise" || p.status === "em_analise"
  ).length || 0;
  
  const acumuladoMes = propostas?.length || 0;

  return (
    <DashboardLayout title="Fila de Análise de Crédito">
      <div className="space-y-6">
        {/* KPIs Section */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="card-simpix">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-400" />
                Propostas no Dia
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{propostasHoje}</CardContent>
          </Card>
          <Card className="card-simpix">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-400" />
                Acumulado no Mês
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{acumuladoMes}</CardContent>
          </Card>
          <Card className="card-simpix">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-400" />
                Propostas Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{propostasPendentes}</CardContent>
          </Card>
        </div>

        {/* Filters Section */}
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select onValueChange={setFilterStatus} defaultValue="all">
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filtrar por Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="aguardando_analise">Aguardando Análise</SelectItem>
                <SelectItem value="em_analise">Em Análise</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="rejeitado">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Select onValueChange={handlePartnerChange} defaultValue="all">
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filtrar por Parceiro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Parceiros</SelectItem>
                {parceiros?.map((p: any) => (
                  <SelectItem key={p.id} value={p.razaoSocial}>
                    {p.razaoSocial}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-muted-foreground" />
            <Select
              onValueChange={setFilterStore}
              value={filterStore}
              disabled={filterPartner === "all"}
            >
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filtrar por Loja" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Lojas</SelectItem>
                {/* TODO: Load stores based on selected partner */}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table Section */}
        <Card className="card-simpix">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="flex items-center gap-2 min-w-[120px]">
                      <FileText className="h-4 w-4" />
                      ID Proposta
                    </TableHead>
                    <TableHead className="min-w-[100px]">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Data
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[150px]">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Cliente
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[130px]">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        Parceiro
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[100px]">
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4" />
                        Loja
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[120px]">Status</TableHead>
                    <TableHead className="text-right min-w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                      <p>Carregando propostas...</p>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-red-500">
                      Erro ao carregar propostas. Por favor, recarregue a página.
                    </TableCell>
                  </TableRow>
                ) : filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      Nenhuma proposta encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map(proposta => (
                    <TableRow key={proposta.id}>
                      <TableCell className="font-medium">PRO-{proposta.id}</TableCell>
                      <TableCell>{format(new Date(proposta.createdAt), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                      <TableCell>{proposta.clienteNome}</TableCell>
                      <TableCell>{proposta.parceiro?.razaoSocial || '-'}</TableCell>
                      <TableCell>{proposta.loja?.nomeLoja || '-'}</TableCell>
                      <TableCell>
                        <span className={
                          proposta.status === "aprovado" ? "status-approved" :
                          proposta.status === "rejeitado" ? "status-rejected" :
                          "status-pending"
                        }>
                          {proposta.status === "aguardando_analise" ? "Aguardando Análise" :
                           proposta.status === "em_analise" ? "Em Análise" :
                           proposta.status === "aprovado" ? "Aprovado" :
                           proposta.status === "rejeitado" ? "Rejeitado" :
                           proposta.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to={`/credito/analise/PRO-${proposta.id}`}>
                          <Button className="btn-simpix-primary" size="sm">
                            <Eye className="h-4 w-4 mr-2" />
                            <span className="hidden sm:inline">Analisar</span>
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default FilaAnalise;
