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
import { useAuth } from "@/contexts/AuthContext";
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
  Loader2,
  Edit,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import RefreshButton from "@/components/RefreshButton";

// Removed mock data - now using real API data

interface Proposta {
  id: string;
  status: string;
  nomeCliente: string;
  cpfCliente?: string;
  emailCliente?: string;
  telefoneCliente?: string;
  valorSolicitado?: number;
  prazo?: number;
  lojaId?: number;
  parceiro?: {
    id: number;
    razaoSocial: string;
  };
  loja?: {
    id: number;
    nomeLoja: string;
  };
  createdAt: string;
  updatedAt?: string;
}

const FilaAnalise: React.FC = () => {
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPartner, setFilterPartner] = useState("all");
  const [filterStore, setFilterStore] = useState("all");
  const [showHistorico, setShowHistorico] = useState(false); // Para ANALISTA ver histórico
  const { user } = useAuth();

  // 🔒 Build query based on user role - CRITICAL FOR SECURITY
  const queryUrl = useMemo(() => {
    switch (user?.role) {
      case "ATENDENTE":
        // ATENDENTE vê apenas suas próprias propostas
        return `/api/propostas?atendenteId=${user.id}`;

      case "ANALISTA":
        // ANALISTA vê fila de análise OU histórico completo
        return showHistorico
          ? "/api/propostas" // Histórico completo
          : "/api/propostas?queue=analysis"; // Apenas fila de análise

      case "GERENTE":
      case "ADMINISTRADOR":
      case "DIRETOR":
        // Gestores veem tudo ou fila de análise dependendo da página
        return "/api/propostas?queue=analysis";

      default:
        return "/api/propostas";
    }
  }, [user?.role, user?.id, showHistorico]);

  // Fetch real proposals data - filtered based on role with PROPER SECURITY
  const {
    data: propostas,
    isLoading,
    error,
  } = useQuery<Proposta[]>({
    queryKey: [queryUrl],
    enabled: !!user?.role, // Só fazer query se tiver role definido
  });

  // Fetch partners data
  const { data: parceiros } = useQuery<Array<{ id: number; razaoSocial: string }>>({
    queryKey: ["/api/parceiros"],
  });

  const filteredData = useMemo(() => {
    if (!propostas || !Array.isArray(propostas)) {
      return [];
    }

    let filtered = propostas;

    // For ANALISTA role, filter based on mode (fila vs histórico)
    if (user?.role === "ANALISTA" && !showHistorico) {
      filtered = propostas.filter(
        proposta => proposta.status === "aguardando_analise" || proposta.status === "em_analise"
      );
    }

    // Apply additional filters
    return filtered.filter(proposta => {
      const byStatus = filterStatus !== "all" ? proposta.status === filterStatus : true;
      const byPartner =
        filterPartner !== "all" ? proposta.parceiro?.razaoSocial === filterPartner : true;
      const byStore = filterStore !== "all" ? proposta.loja?.nomeLoja === filterStore : true;
      return byStatus && byPartner && byStore;
    });
  }, [propostas, filterStatus, filterPartner, filterStore, user?.role, showHistorico]);

  const handlePartnerChange = (partnerId: string) => {
    setFilterPartner(partnerId);
    setFilterStore("all"); // Reseta o filtro de loja ao mudar o parceiro
  };

  const { toast } = useToast();

  // Mutation para alternar status
  const toggleStatusMutation = useMutation({
    mutationFn: async ({
      propostaId,
      currentStatus,
    }: {
      propostaId: string;
      currentStatus: string;
    }) => {
      const response = await apiRequest(`/api/propostas/${propostaId}/toggle-status`, {
        method: "PUT",
      });
      return response;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Status alterado com sucesso",
        description: data?.message || "Status alterado com sucesso",
      });
      // Invalidar cache para atualizar a lista
      queryClient.invalidateQueries({ queryKey: [queryUrl] });
    },
    onError: error => {
      toast({
        title: "Erro ao alterar status",
        description:
          error instanceof Error
            ? error.message
            : "Ocorreu um erro ao alterar o status da proposta",
        variant: "destructive",
      });
    },
  });

  const handleToggleStatus = (propostaId: string, currentStatus: string) => {
    toggleStatusMutation.mutate({ propostaId, currentStatus });
  };

  const today = new Date().toISOString().split("T")[0];
  const propostasHoje = propostas?.filter(p => p.createdAt.split("T")[0] === today).length || 0;

  const propostasPendentes =
    propostas?.filter(p => p.status === "aguardando_analise" || p.status === "em_analise").length ||
    0;

  const acumuladoMes = propostas?.length || 0;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: [queryUrl] });
    queryClient.invalidateQueries({ queryKey: ["/api/parceiros"] });
  };

  return (
    <DashboardLayout
      title={
        user?.role === "ANALISTA"
          ? showHistorico
            ? "Histórico de Análises"
            : "Fila de Análise de Crédito"
          : "Minhas Propostas"
      }
      actions={<RefreshButton onRefresh={handleRefresh} isLoading={isLoading} variant="ghost" />}
    >
      <div className="space-y-6">
        {/* KPIs Section */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                <Calendar className="h-5 w-5 text-blue-400" />
                Propostas no Dia
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold text-gray-900 dark:text-white">
              {propostasHoje}
            </CardContent>
          </Card>
          <Card className="border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                <TrendingUp className="h-5 w-5 text-green-400" />
                Acumulado no Mês
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold text-gray-900 dark:text-white">
              {acumuladoMes}
            </CardContent>
          </Card>
          <Card className="border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                <Clock className="h-5 w-5 text-yellow-400" />
                Propostas Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold text-gray-900 dark:text-white">
              {propostasPendentes}
            </CardContent>
          </Card>
        </div>

        {/* Filters Section */}
        <div className="flex flex-col gap-4 md:flex-row">
          {/* Toggle História para ANALISTA */}
          {user?.role === "ANALISTA" && (
            <div className="flex items-center gap-2">
              <Button
                variant={showHistorico ? "default" : "outline"}
                size="sm"
                onClick={() => setShowHistorico(!showHistorico)}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                {showHistorico ? "Ver Fila" : "Ver Histórico"}
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-600 dark:text-gray-400" />
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
                <SelectItem value="suspensa">Suspensa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-600 dark:text-gray-400" />
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
            <Store className="h-4 w-4 text-gray-600 dark:text-gray-400" />
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
        <Card className="border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="flex min-w-[120px] items-center gap-2 text-gray-900 dark:text-white">
                      <FileText className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      ID Proposta
                    </TableHead>
                    <TableHead className="min-w-[100px] text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        Data
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[150px] text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        Cliente
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[130px] text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        Parceiro
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[100px] text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        Loja
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[120px] text-gray-900 dark:text-white">
                      Status
                    </TableHead>
                    <TableHead className="min-w-[100px] text-right text-gray-900 dark:text-white">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-8 text-center text-gray-900 dark:text-white"
                      >
                        <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-gray-600 dark:text-gray-400" />
                        <p>Carregando propostas...</p>
                      </TableCell>
                    </TableRow>
                  ) : error ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-red-500">
                        Erro ao carregar propostas. Por favor, recarregue a página.
                      </TableCell>
                    </TableRow>
                  ) : filteredData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-gray-500">
                        Nenhuma proposta encontrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredData.map(proposta => (
                      <TableRow key={proposta.id}>
                        <TableCell className="font-medium text-gray-900 dark:text-white">
                          {proposta.id}
                        </TableCell>
                        <TableCell className="text-gray-900 dark:text-white">
                          {format(new Date(proposta.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-gray-900 dark:text-white">
                          {proposta.nomeCliente || "-"}
                        </TableCell>
                        <TableCell className="text-gray-900 dark:text-white">
                          {proposta.parceiro?.razaoSocial || "-"}
                        </TableCell>
                        <TableCell className="text-gray-900 dark:text-white">
                          {proposta.loja?.nomeLoja || "-"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              proposta.status === "aprovado"
                                ? "status-approved"
                                : proposta.status === "rejeitado"
                                  ? "status-rejected"
                                  : proposta.status === "suspensa"
                                    ? "status-suspended"
                                    : "status-pending"
                            }
                          >
                            {proposta.status === "aguardando_analise"
                              ? "Aguardando Análise"
                              : proposta.status === "em_analise"
                                ? "Em Análise"
                                : proposta.status === "aprovado"
                                  ? "Aprovado"
                                  : proposta.status === "rejeitado"
                                    ? "Rejeitado"
                                    : proposta.status === "suspensa"
                                      ? "Suspensa"
                                      : proposta.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link to={`/credito/analise/${proposta.id}`}>
                              <Button
                                className="bg-blue-500 text-white hover:bg-blue-600"
                                size="sm"
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                <span className="hidden sm:inline">Analisar</span>
                              </Button>
                            </Link>
                            {/* Botão de editar/suspender para atendentes e administradores */}
                            {(user?.role === "ATENDENTE" || user?.role === "ADMINISTRADOR") &&
                              [
                                "rascunho",
                                "aguardando_analise",
                                "em_analise",
                                "pendente",
                                "suspensa",
                              ].includes(proposta.status) && (
                                <Button
                                  className={
                                    proposta.status === "suspensa"
                                      ? "bg-yellow-500 text-white hover:bg-yellow-600"
                                      : "bg-gray-500 text-white hover:bg-gray-600"
                                  }
                                  size="sm"
                                  onClick={() => handleToggleStatus(proposta.id, proposta.status)}
                                  title={
                                    proposta.status === "suspensa"
                                      ? "Reativar proposta"
                                      : "Suspender proposta"
                                  }
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                          </div>
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
