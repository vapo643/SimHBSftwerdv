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
  Building
} from "lucide-react";

const mockData = [
  {
    id: "PRO-001",
    dataSolicitacao: "2025-07-18",
    cliente: "João Silva",
    cpf: "123.456.789-00",
    parceiro: "Parceiro A",
    loja: "Loja A1",
    valorSolicitado: "R$ 10.000",
    score: 700,
    status: "Em Análise",
  },
  {
    id: "PRO-002",
    dataSolicitacao: "2025-07-18",
    cliente: "Maria Oliveira",
    cpf: "234.567.890-11",
    parceiro: "Parceiro B",
    loja: "Loja B1",
    valorSolicitado: "R$ 20.000",
    score: 680,
    status: "Pendente",
  },
  {
    id: "PRO-003",
    dataSolicitacao: "2025-07-17",
    cliente: "Carlos Almeida",
    cpf: "345.678.901-22",
    parceiro: "Parceiro A",
    loja: "Loja A2",
    valorSolicitado: "R$ 15.000",
    score: 720,
    status: "Aprovado",
  },
  {
    id: "PRO-004",
    dataSolicitacao: "2025-06-25",
    cliente: "Ana Santos",
    cpf: "456.789.012-33",
    parceiro: "Parceiro C",
    loja: "Loja C1",
    valorSolicitado: "R$ 12.000",
    score: 650,
    status: "Rejeitado",
  },
];

const mockParceiros = [
  { id: "parceiro-a", nome: "Parceiro A", lojas: ["Loja A1", "Loja A2"] },
  { id: "parceiro-b", nome: "Parceiro B", lojas: ["Loja B1"] },
  { id: "parceiro-c", nome: "Parceiro C", lojas: ["Loja C1", "Loja C2", "Loja C3"] },
];

const FilaAnalise: React.FC = () => {
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPartner, setFilterPartner] = useState("all");
  const [filterStore, setFilterStore] = useState("all");

  const filteredData = useMemo(
    () =>
      mockData.filter(proposta => {
        const byStatus = filterStatus !== "all" ? proposta.status === filterStatus : true;
        const byPartner =
          filterPartner !== "all"
            ? proposta.parceiro === mockParceiros.find(p => p.id === filterPartner)?.nome
            : true;
        const byStore = filterStore !== "all" ? proposta.loja === filterStore : true;
        return byStatus && byPartner && byStore;
      }),
    [filterStatus, filterPartner, filterStore]
  );

  const handlePartnerChange = (partnerId: string) => {
    setFilterPartner(partnerId);
    setFilterStore("all"); // Reseta o filtro de loja ao mudar o parceiro
  };

  const propostasHoje = mockData.filter(
    p => p.dataSolicitacao === new Date().toISOString().split("T")[0]
  ).length;
  const propostasPendentes = mockData.filter(
    p => p.status === "Pendente" || p.status === "Em Análise"
  ).length;
  const acumuladoMes = mockData.length;

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
                <SelectItem value="Em Análise">Em Análise</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Aprovado">Aprovado</SelectItem>
                <SelectItem value="Rejeitado">Rejeitado</SelectItem>
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
                {mockParceiros.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
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
                {mockParceiros
                  .find(p => p.id === filterPartner)
                  ?.lojas.map(loja => (
                    <SelectItem key={loja} value={loja}>
                      {loja}
                    </SelectItem>
                  ))}
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
                {filteredData.map(proposta => (
                  <TableRow key={proposta.id}>
                    <TableCell className="font-medium">{proposta.id}</TableCell>
                    <TableCell>{proposta.dataSolicitacao}</TableCell>
                    <TableCell>{proposta.cliente}</TableCell>
                    <TableCell>{proposta.parceiro}</TableCell>
                    <TableCell>{proposta.loja}</TableCell>
                    <TableCell>
                      <span className={
                        proposta.status === "Aprovado" ? "status-approved" :
                        proposta.status === "Rejeitado" ? "status-rejected" :
                        "status-pending"
                      }>
                        {proposta.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to={`/credito/analise/${proposta.id}`}>
                        <Button className="btn-simpix-primary" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          <span className="hidden sm:inline">Analisar</span>
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
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
