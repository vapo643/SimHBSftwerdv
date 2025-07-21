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
          <Card>
            <CardHeader>
              <CardTitle>Propostas no Dia</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{propostasHoje}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Acumulado no Mês</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{acumuladoMes}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Propostas Pendentes</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{propostasPendentes}</CardContent>
          </Card>
        </div>

        {/* Filters Section */}
        <div className="flex flex-col gap-4 md:flex-row">
          <Select onValueChange={setFilterStatus} defaultValue="all">
            <SelectTrigger>
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
          <Select onValueChange={handlePartnerChange} defaultValue="all">
            <SelectTrigger>
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
          <Select
            onValueChange={setFilterStore}
            value={filterStore}
            disabled={filterPartner === "all"}
          >
            <SelectTrigger>
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

        {/* Table Section */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Proposta</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Parceiro</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
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
                    <TableCell>{proposta.status}</TableCell>
                    <TableCell className="text-right">
                      <Link to={`/credito/analise/${proposta.id}`}>
                        <Button variant="outline" size="sm">
                          Analisar
                        </Button>
                      </Link>
                    </TableCell>
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

export default FilaAnalise;
