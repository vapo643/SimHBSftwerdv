import React, { useEffect, useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  FileText,
  Clock,
  Calendar,
  TrendingUp,
  AlertCircle,
  Edit,
  Search,
  Filter,
  Eye,
  Users,
  DollarSign,
  BarChart3,
  Briefcase,
  PlusCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Banknote,
} from "lucide-react";
import RefreshButton from "@/components/RefreshButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FeatureFlagExample } from "@/components/FeatureFlagExample";
import { useFeatureFlag } from "@/contexts/FeatureFlagContext";

const getStatusColor = (status: string) => {
  switch (status.toUpperCase()) {
    // Status V2.0
    case "CCB_GERADA":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "AGUARDANDO_ASSINATURA":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "ASSINATURA_CONCLUIDA":
      return "bg-green-100 text-green-800 border-green-200";
    case "BOLETOS_EMITIDOS":
      return "bg-purple-100 text-purple-800 border-purple-200";
    // Status antigos mantidos para compatibilidade
    case "APROVADO":
      return "bg-green-100 text-green-800 border-green-200";
    case "EM_ANALISE":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "AGUARDANDO_ANALISE":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "PENDENCIADO":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "REJEITADO":
      return "bg-red-100 text-red-800 border-red-200";
    case "PAGO":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "PRONTO_PAGAMENTO":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "RASCUNHO":
      return "bg-gray-100 text-gray-800 border-gray-200";
    case "CANCELADO":
      return "bg-slate-100 text-slate-800 border-slate-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const getStatusText = (status: string) => {
  switch (status.toUpperCase()) {
    // Status V2.0
    case "CCB_GERADA":
      return "CCB Gerada";
    case "AGUARDANDO_ASSINATURA":
      return "Aguardando Assinatura";
    case "ASSINATURA_CONCLUIDA":
      return "Assinatura Concluída";
    case "BOLETOS_EMITIDOS":
      return "Boletos Emitidos";
    // Status antigos mantidos para compatibilidade
    case "AGUARDANDO_ANALISE":
      return "Aguardando Análise";
    case "EM_ANALISE":
      return "Em Análise";
    case "PRONTO_PAGAMENTO":
      return "Pronto para Pagamento";
    case "APROVADO":
      return "Aprovado";
    case "REJEITADO":
      return "Rejeitado";
    case "PENDENCIADO":
      return "Pendenciado";
    case "PAGO":
      return "Pago";
    case "CANCELADO":
      return "Cancelado";
    default:
      return status.replace(/_/g, " ").replace(/^\w/, (c: string) => c.toUpperCase());
  }
};

const getStatusIcon = (status: string) => {
  switch (status.toUpperCase()) {
    // Status V2.0
    case "CCB_GERADA":
      return <FileText className="h-4 w-4" />;
    case "AGUARDANDO_ASSINATURA":
      return <Clock className="h-4 w-4" />;
    case "ASSINATURA_CONCLUIDA":
      return <CheckCircle2 className="h-4 w-4" />;
    case "BOLETOS_EMITIDOS":
      return <Banknote className="h-4 w-4" />;
    // Status antigos mantidos para compatibilidade
    case "APROVADO":
      return <CheckCircle2 className="h-4 w-4" />;
    case "REJEITADO":
      return <XCircle className="h-4 w-4" />;
    case "EM_ANALISE":
    case "AGUARDANDO_ANALISE":
      return <Clock className="h-4 w-4" />;
    case "PENDENCIADO":
      return <AlertCircle className="h-4 w-4" />;
    case "PAGO":
      return <Banknote className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [parceiroFilter, setParceiroFilter] = useState<string>("todos");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Fetch real proposals data
  const {
    data: propostasResponse,
    isLoading,
    error,
    refetch,
  } = useQuery<{ success: boolean; data: any[]; total: number }>({
    queryKey: ["/api/propostas"],
  });
  
  // Extract propostas - dual-key transformation in apiClient ensures both formats work
  // The apiClient automatically adds camelCase aliases for all snake_case keys
  const propostas = (propostasResponse?.data || []).map((p: any) => ({
    id: p.id,
    status: p.status,
    // Use camelCase properties directly (added by dual-key transformation)
    nomeCliente: p.nomeCliente || p.cliente_nome, // Both work now
    cpfCliente: p.cpfCliente || p.cliente_cpf,     // Both work now
    valorSolicitado: p.valorSolicitado || p.valor,
    prazo: p.prazo,
    taxaJuros: p.taxaJuros || p.taxa_juros,
    produtoId: p.produtoId || p.produto_id,
    lojaId: p.lojaId || p.loja_id,
    createdAt: p.createdAt || p.created_at,
    valorParcela: p.valorParcela || p.valor_parcela,
    // Add contextual status for compatibility
    statusContextual: p.status,
    parceiro: p.parceiro || { razaoSocial: 'Parceiro Padrão' }
  }));

  // Fetch user metrics if user is ATENDENTE
  const { data: metricas } = useQuery<{
    hoje: number;
    semana: number;
    mes: number;
  }>({
    queryKey: ["/api/propostas/metricas"],
    enabled: user?.role === "ATENDENTE",
  });

  // Redirect ANALISTA to analysis queue
  useEffect(() => {
    if (user?.role === "ANALISTA") {
      setLocation("/credito/fila");
    }
  }, [user?.role, setLocation]);

  // IMPORTANTE: Sempre definir dados e hooks ANTES dos returns condicionais
  const propostasData = propostas || [];

  // Filtrar propostas - HOOK SEMPRE EXECUTADO
  const propostasFiltradas = useMemo(() => {
    return propostasData.filter(proposta => {
      const matchesSearch =
        proposta.nomeCliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        proposta.id.includes(searchTerm) ||
        proposta.cpfCliente?.includes(searchTerm);

      // PAM V1.0 - Usar status contextual com fallback
      const statusFinal = proposta.statusContextual || proposta.status;
      const matchesStatus = statusFilter === "todos" || statusFinal === statusFilter;

      const matchesParceiro =
        parceiroFilter === "todos" || proposta.parceiro?.razaoSocial === parceiroFilter;

      return matchesSearch && matchesStatus && matchesParceiro;
    });
  }, [propostasData, searchTerm, statusFilter, parceiroFilter]);

  // Estatísticas computadas - HOOK SEMPRE EXECUTADO
  const estatisticas = useMemo(() => {
    const total = propostasData.length;
    const aprovadas = propostasData.filter(p => p.status === "aprovado").length;
    const pendentes = propostasData.filter(
      p => p.status === "aguardando_analise" || p.status === "em_analise"
    ).length;
    const rejeitadas = propostasData.filter(p => p.status === "rejeitado").length;
    const pendenciadas = propostasData.filter(p => p.status === "pendenciado").length;
    // Debug: log first few values to understand the data structure
    console.log(
      "DEBUG - First 3 proposals values:",
      propostasData.slice(0, 3).map(p => ({
        id: p.id,
        valorSolicitado: p.valorSolicitado,
        type: typeof p.valorSolicitado,
      }))
    );

    // Convert to numbers safely and filter out invalid values
    const valorTotal = propostasData.reduce((acc, p) => {
      const valor =
        typeof p.valorSolicitado === "string"
          ? parseFloat(p.valorSolicitado.replace(/[^\d,.-]/g, "").replace(",", "."))
          : Number(p.valorSolicitado) || 0;
      return acc + valor;
    }, 0);
    const valorMedio = total > 0 ? valorTotal / total : 0;

    // Status distribution
    const statusCounts = propostasData.reduce(
      (acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Unique partners
    const parceiros = Array.from(
      new Set(propostasData.map(p => p.parceiro?.razaoSocial).filter(Boolean))
    );

    return {
      total,
      aprovadas,
      pendentes,
      rejeitadas,
      pendenciadas,
      valorTotal,
      valorMedio,
      statusCounts,
      parceiros,
      taxaAprovacao: total > 0 ? ((aprovadas / total) * 100).toFixed(1) : "0",
    };
  }, [propostasData]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/propostas"] });
    if (user?.role === "ATENDENTE") {
      queryClient.invalidateQueries({ queryKey: ["/api/propostas/metricas"] });
    }
  };

  // Agora sim os returns condicionais - DEPOIS de todos os hooks
  if (isLoading) {
    return (
      <DashboardLayout title="Dashboard de Propostas">
        <div className="flex h-64 items-center justify-center">
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

  return (
    <DashboardLayout
      title="Dashboard de Propostas"
      actions={<RefreshButton onRefresh={handleRefresh} isLoading={isLoading} variant="ghost" />}
    >
      <div className="space-y-6">
        {/* Estatísticas Gerais */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Propostas</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{estatisticas.total}</div>
              <div className="text-xs text-muted-foreground">
                {estatisticas.pendenciadas > 0 && (
                  <span className="text-orange-600">{estatisticas.pendenciadas} pendências</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Aprovação</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{estatisticas.taxaAprovacao}%</div>
              <div className="text-xs text-muted-foreground">
                {estatisticas.aprovadas} de {estatisticas.total} aprovadas
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Valor Total ✓</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(estatisticas.valorTotal)}</div>
              <div className="text-xs text-muted-foreground">
                Média: {formatCurrency(estatisticas.valorMedio)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Em Análise</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{estatisticas.pendentes}</div>
              <div className="text-xs text-muted-foreground">Aguardando processamento</div>
            </CardContent>
          </Card>
        </div>

        {/* Demonstração de Feature Flags (Apenas para Admins) */}
        {user?.role === "ADMIN" && (
          <FeatureFlagExample />
        )}

        {/* Métricas de Performance para Atendentes */}
        {user?.role === "ATENDENTE" && metricas && (
          <Card>
            <CardHeader>
              <CardTitle>Suas Métricas</CardTitle>
              <CardDescription>Performance individual no período</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="bg-muted/50 flex items-center gap-3 rounded-lg p-3">
                  <Calendar className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{metricas.hoje || 0}</p>
                    <p className="text-sm text-muted-foreground">Hoje</p>
                  </div>
                </div>
                <div className="bg-muted/50 flex items-center gap-3 rounded-lg p-3">
                  <Clock className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{metricas.semana || 0}</p>
                    <p className="text-sm text-muted-foreground">Esta Semana</p>
                  </div>
                </div>
                <div className="bg-muted/50 flex items-center gap-3 rounded-lg p-3">
                  <TrendingUp className="h-8 w-8 text-purple-500" />
                  <div>
                    <p className="text-2xl font-bold">{metricas.mes || 0}</p>
                    <p className="text-sm text-muted-foreground">Este Mês</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Controles e Filtros */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {user?.role === "ATENDENTE" ? "Minhas Propostas" : "Propostas"}
                </CardTitle>
                <CardDescription>
                  Gerencie e acompanhe todas as propostas de crédito
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Link to="/propostas/nova">
                  <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Nova Proposta
                  </Button>
                </Link>
                {user?.role === "ATENDENTE" && (
                  <Link to="/aceite-atendente">
                    <Button variant="outline">
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Aceitar Propostas
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, CPF ou ID..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="aguardando_analise">Aguardando Análise</SelectItem>
                  <SelectItem value="em_analise">Em Análise</SelectItem>
                  <SelectItem value="aprovado">Aprovado</SelectItem>
                  <SelectItem value="rejeitado">Rejeitado</SelectItem>
                  <SelectItem value="pendenciado">Pendenciado</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                </SelectContent>
              </Select>
              {estatisticas.parceiros.length > 0 && (
                <Select value={parceiroFilter} onValueChange={setParceiroFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Parceiro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Parceiros</SelectItem>
                    {estatisticas.parceiros.map(parceiro => (
                      <SelectItem key={parceiro} value={parceiro}>
                        {parceiro}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lista de Propostas */}
        <div className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Carregando propostas...</span>
                </div>
              </CardContent>
            </Card>
          ) : propostasFiltradas.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground">
                  <FileText className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
                  <h3 className="mb-2 text-lg font-medium">Nenhuma proposta encontrada</h3>
                  <p>Nenhuma proposta corresponde aos filtros aplicados</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            propostasFiltradas.map((proposta: any) => (
              <Card key={proposta.id} className="overflow-hidden transition-shadow hover:shadow-md">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                        {getStatusIcon(proposta.status)}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-4">
                          <h3 className="text-lg font-semibold">
                            {proposta.nomeCliente || "Cliente não informado"}
                          </h3>
                          <Badge className={`${getStatusColor(proposta.statusContextual || proposta.status)} border`}>
                            {getStatusText(proposta.statusContextual || proposta.status)}
                          </Badge>
                          {proposta.status === "pendenciado" && (
                            <Badge
                              variant="outline"
                              className="gap-1 border-orange-200 text-orange-700"
                            >
                              <AlertCircle className="h-3 w-3" />
                              Ação Necessária
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Proposta: #{proposta.numeroProposta || proposta.id} | CPF: {proposta.cpfCliente || "Não informado"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Criado em:{" "}
                          {format(new Date(proposta.createdAt), "dd/MM/yyyy HH:mm", {
                            locale: ptBR,
                          })}
                          {proposta.parceiro?.razaoSocial && (
                            <span className="ml-2">
                              | Parceiro: {proposta.parceiro.razaoSocial}
                            </span>
                          )}
                        </div>
                        {proposta.status === "pendenciado" && proposta.motivo_pendencia && (
                          <div className="mt-2 flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 p-2">
                            <AlertCircle className="h-4 w-4 text-orange-600" />
                            <span className="text-sm text-orange-700">
                              Pendência: {proposta.motivo_pendencia}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 text-right">
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(proposta.valorSolicitado || 0)}
                      </div>
                      <div className="flex justify-end gap-2">
                        {proposta.status === "pendenciado" ? (
                          <Link to={`/propostas/editar/${proposta.id}`}>
                            <Button size="sm" variant="outline" className="flex items-center gap-1">
                              <Edit className="h-4 w-4" />
                              Corrigir
                            </Button>
                          </Link>
                        ) : (
                          <Link to={`/credito/analise/${proposta.id}`}>
                            <Button size="sm" variant="outline">
                              <Eye className="mr-1 h-4 w-4" />
                              Visualizar
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
