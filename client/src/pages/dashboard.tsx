import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
} from 'lucide-react';
import RefreshButton from '@/components/RefreshButton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FeatureFlagExample } from '@/components/FeatureFlagExample';
import { useFeatureFlag } from '@/contexts/FeatureFlagContext';
import { queryKeys } from '@/hooks/queries/queryKeys';

// UX-011: Sistema semântico de cores fortes e proeminentes
const getStatusColor = (status: string) => {
  switch (status.toUpperCase()) {
    // 🟢 VERDE: Status de Sucesso
    case 'APROVADO':
    case 'ASSINATURA_CONCLUIDA':
    case 'PAGO':
      return 'bg-green-600 text-white border-green-600 font-semibold shadow-lg';

    // 🔴 VERMELHO: Status de Falha/Bloqueio
    case 'REJEITADO':
    case 'CANCELADO':
      return 'bg-red-600 text-white border-red-600 font-semibold shadow-lg';

    // 🟡 AMARELO/LARANJA: Status de Pendência/Atenção
    case 'PENDENCIADO':
    case 'AGUARDANDO_ASSINATURA':
    case 'AGUARDANDO_ANALISE':
    case 'EM_ANALISE':
      return 'bg-amber-500 text-white border-amber-500 font-semibold shadow-lg';

    // 🔵 AZUL/CINZA: Status Informativos/Iniciais
    case 'CCB_GERADA':
    case 'BOLETOS_EMITIDOS':
    case 'PRONTO_PAGAMENTO':
      return 'bg-blue-600 text-white border-blue-600 font-semibold shadow-lg';

    case 'RASCUNHO':
    default:
      return 'bg-gray-500 text-white border-gray-500 font-semibold shadow-lg';
  }
};

// UX-011: Função para bordas coloridas dos cards
const getStatusBorderColor = (status: string) => {
  switch (status.toUpperCase()) {
    // 🟢 VERDE: Status de Sucesso
    case 'APROVADO':
    case 'ASSINATURA_CONCLUIDA':
    case 'PAGO':
      return 'border-l-4 border-l-green-500';

    // 🔴 VERMELHO: Status de Falha/Bloqueio
    case 'REJEITADO':
    case 'CANCELADO':
      return 'border-l-4 border-l-red-500';

    // 🟡 AMARELO/LARANJA: Status de Pendência/Atenção
    case 'PENDENCIADO':
    case 'AGUARDANDO_ASSINATURA':
    case 'AGUARDANDO_ANALISE':
    case 'EM_ANALISE':
      return 'border-l-4 border-l-amber-500';

    // 🔵 AZUL/CINZA: Status Informativos/Iniciais
    case 'CCB_GERADA':
    case 'BOLETOS_EMITIDOS':
    case 'PRONTO_PAGAMENTO':
      return 'border-l-4 border-l-blue-500';

    case 'RASCUNHO':
    default:
      return 'border-l-4 border-l-gray-400';
  }
};

// UX-011: Função para cor do background do ícone
const getStatusIconBackground = (status: string) => {
  switch (status.toUpperCase()) {
    // 🟢 VERDE: Status de Sucesso
    case 'APROVADO':
    case 'ASSINATURA_CONCLUIDA':
    case 'PAGO':
      return 'bg-green-100 text-green-600';

    // 🔴 VERMELHO: Status de Falha/Bloqueio
    case 'REJEITADO':
    case 'CANCELADO':
      return 'bg-red-100 text-red-600';

    // 🟡 AMARELO/LARANJA: Status de Pendência/Atenção
    case 'PENDENCIADO':
    case 'AGUARDANDO_ASSINATURA':
    case 'AGUARDANDO_ANALISE':
    case 'EM_ANALISE':
      return 'bg-amber-100 text-amber-600';

    // 🔵 AZUL/CINZA: Status Informativos/Iniciais
    case 'CCB_GERADA':
    case 'BOLETOS_EMITIDOS':
    case 'PRONTO_PAGAMENTO':
      return 'bg-blue-100 text-blue-600';

    case 'RASCUNHO':
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

const getStatusText = (status: string) => {
  switch (status.toUpperCase()) {
    // Status V2.0
    case 'CCB_GERADA':
      return 'CCB Gerada';
    case 'AGUARDANDO_ASSINATURA':
      return 'Aguardando Assinatura';
    case 'ASSINATURA_CONCLUIDA':
      return 'Assinatura Concluída';
    case 'BOLETOS_EMITIDOS':
      return 'Boletos Emitidos';
    // Status antigos mantidos para compatibilidade
    case 'AGUARDANDO_ANALISE':
      return 'Aguardando Análise';
    case 'EM_ANALISE':
      return 'Em Análise';
    case 'PRONTO_PAGAMENTO':
      return 'Pronto para Pagamento';
    case 'APROVADO':
      return 'Aprovado';
    case 'REJEITADO':
      return 'Rejeitado';
    case 'PENDENCIADO':
      return 'Pendenciado';
    case 'PAGO':
      return 'Pago';
    case 'CANCELADO':
      return 'Cancelado';
    default:
      return status.replace(/_/g, ' ').replace(/^\w/, (c: string) => c.toUpperCase());
  }
};

// UX-011: Ícones mais explícitos e maiores para melhor diferenciação visual
const getStatusIcon = (status: string) => {
  switch (status.toUpperCase()) {
    // 🟢 VERDE: Status de Sucesso - Ícones de confirmação
    case 'APROVADO':
    case 'ASSINATURA_CONCLUIDA':
      return <CheckCircle2 className="h-6 w-6" />;
    case 'PAGO':
      return <Banknote className="h-6 w-6" />;

    // 🔴 VERMELHO: Status de Falha - Ícones de erro/bloqueio
    case 'REJEITADO':
      return <XCircle className="h-6 w-6" />;
    case 'CANCELADO':
      return <XCircle className="h-6 w-6" />;

    // 🟡 AMARELO/LARANJA: Status de Pendência - Ícones de atenção/tempo
    case 'PENDENCIADO':
      return <AlertCircle className="h-6 w-6" />;
    case 'AGUARDANDO_ASSINATURA':
    case 'AGUARDANDO_ANALISE':
      return <Clock className="h-6 w-6" />;
    case 'EM_ANALISE':
      return <Clock className="h-6 w-6" />;

    // 🔵 AZUL/CINZA: Status Informativos - Ícones de documentos/processos
    case 'CCB_GERADA':
      return <FileText className="h-6 w-6" />;
    case 'BOLETOS_EMITIDOS':
    case 'PRONTO_PAGAMENTO':
      return <Banknote className="h-6 w-6" />;

    case 'RASCUNHO':
    default:
      return <FileText className="h-6 w-6" />;
  }
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// Dashboard Skeleton Component
const DashboardSkeleton: React.FC = () => (
  <DashboardLayout title="Dashboard">
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-16 animate-pulse"></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content Skeleton */}
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded animate-pulse"></div>
        ))}
      </div>
    </div>
  </DashboardLayout>
);

// Error Display Component
const ErrorDisplay: React.FC<{ message: string }> = ({ message }) => (
  <DashboardLayout title="Dashboard">
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>Erro ao carregar dashboard: {message}</AlertDescription>
    </Alert>
  </DashboardLayout>
);

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // UX-002: TODOS os hooks devem estar no início - regra fundamental do React
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [parceiroFilter, setParceiroFilter] = useState<string>('todos');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // UX-002: Mover TODOS os useQuery hooks para o topo, antes de qualquer early return
  // Fetch real proposals data - conditional enabled based on user role
  const {
    data: propostasResponse,
    isLoading,
    error,
    isError,
    refetch,
  } = useQuery<{ success: boolean; data: any[]; total: number }>({
    queryKey: queryKeys.propostas.all,
    queryFn: async () => {
      const { api } = await import('@/lib/apiClient');
      return await api.get('/api/propostas');
    },
    enabled: !!user && user?.role !== 'ANALISTA', // Only fetch when user is authenticated and not ANALISTA
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

  // UX-002: Extract propostas - cálculo baseado nos dados da query
  const propostas = Array.isArray(propostasResponse?.data)
    ? propostasResponse.data.map((p: any) => ({
        id: p.id,
        status: p.status,
        // Use camelCase properties directly (added by dual-key transformation)
        nomeCliente: p.nomeCliente || p.clienteNome || p.cliente_nome,
        cpfCliente: p.cpfCliente || p.clienteCpf || p.cliente_cpf,
        valorSolicitado: p.valorSolicitado || p.valor,
        prazo: p.prazo,
        taxaJuros: p.taxaJuros || p.taxa_juros,
        produtoId: p.produtoId || p.produto_id,
        lojaId: p.lojaId || p.loja_id,
        createdAt: p.createdAt || p.created_at,
        valorParcela: p.valorParcela || p.valor_parcela,
        statusContextual: p.status,
        parceiro: p.parceiro || { razaoSocial: p.loja_nome || 'Parceiro Padrão' },
      }))
    : [];

  const propostasData = propostas || [];

  // UX-002: Mover useMemo para o topo - HOOK SEMPRE EXECUTADO
  const propostasFiltradas = useMemo(() => {
    return Array.isArray(propostasData)
      ? propostasData.filter((proposta) => {
          // Proteção extra para garantir que a proposta existe
          if (!proposta || !proposta.id) return false;

          const matchesSearch =
            proposta.nomeCliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            proposta.id.includes(searchTerm) ||
            proposta.cpfCliente?.includes(searchTerm);

          // PAM V1.0 - Usar status contextual com fallback
          const statusFinal = proposta.statusContextual || proposta.status || 'rascunho';
          const matchesStatus = statusFilter === 'todos' || statusFinal === statusFilter;

          const matchesParceiro =
            parceiroFilter === 'todos' || proposta.parceiro?.razaoSocial === parceiroFilter;

          return matchesSearch && matchesStatus && matchesParceiro;
        })
      : [];
  }, [propostasData, searchTerm, statusFilter, parceiroFilter]);

  // UX-002: Mover useMemo para o topo - Estatísticas computadas
  const estatisticas = useMemo(() => {
    const total = propostasData.length;
    const aprovadas = Array.isArray(propostasData)
      ? propostasData.filter((p) => p.status === 'aprovado').length
      : 0;
    const pendentes = Array.isArray(propostasData)
      ? propostasData.filter((p) => p.status === 'aguardando_analise' || p.status === 'em_analise')
          .length
      : 0;
    const rejeitadas = Array.isArray(propostasData)
      ? propostasData.filter((p) => p.status === 'rejeitado').length
      : 0;
    const pendenciadas = Array.isArray(propostasData)
      ? propostasData.filter((p) => p.status === 'pendenciado').length
      : 0;
    // Debug: log first few values to understand the data structure
    console.log(
      'DEBUG - First 3 proposals values:',
      propostasData.slice(0, 3).map((p) => ({
        id: p.id,
        valorSolicitado: p.valorSolicitado,
        type: typeof p.valorSolicitado,
      }))
    );

    // Convert to numbers safely and filter out invalid values
    const valorTotal = propostasData.reduce((acc, p) => {
      const valor =
        typeof p.valorSolicitado === 'string'
          ? parseFloat(p.valorSolicitado.replace(/[^\d,.-]/g, '').replace(',', '.'))
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
      new Set(propostasData.map((p) => p.parceiro?.razaoSocial).filter(Boolean))
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
      taxaAprovacao: total > 0 ? ((aprovadas / total) * 100).toFixed(1) : '0',
    };
  }, [propostasData]);

  // UX-002: Mover useCallback para o topo
  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/propostas'] });
    if (user?.role === 'ATENDENTE') {
      queryClient.invalidateQueries({ queryKey: ['/api/propostas/metricas'] });
    }
  }, [queryClient, user?.role]);

  // UX-002: useEffect também deve estar no início
  useEffect(() => {
    if (user?.role === 'ANALISTA') {
      setLocation('/credito/fila');
      return; // Exit early to prevent further execution
    }
  }, [user?.role, setLocation]);

  // UX-002: AGORA todos os hooks foram executados - Early returns são seguros
  if (user?.role === 'ANALISTA') {
    return <DashboardSkeleton />; // Show loading while redirecting
  }

  // Early Return para Loading State
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // Early Return para Error State
  if (isError) {
    return <ErrorDisplay message={error?.message || 'Erro desconhecido'} />;
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
              <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
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
        {user?.role === 'ADMIN' && <FeatureFlagExample />}

        {/* Métricas de Performance para Atendentes */}
        {user?.role === 'ATENDENTE' && metricas && (
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
                  {user?.role === 'ATENDENTE' ? 'Minhas Propostas' : 'Propostas'}
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
                {user?.role === 'ATENDENTE' && (
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
                    onChange={(e) => setSearchTerm(e.target.value)}
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
                    {estatisticas.parceiros.map((parceiro, index) => (
                      <SelectItem key={`parceiro-${index}-${parceiro}`} value={parceiro}>
                        {parceiro}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* UX-007: Contador de Resultados Dinâmico */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>
              Exibindo{' '}
              <span className="font-medium text-foreground">{propostasFiltradas.length}</span> de{' '}
              <span className="font-medium text-foreground">{propostasData.length}</span> propostas
            </span>
          </div>
          {propostasFiltradas.length !== propostasData.length && (
            <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-200">
              <Filter className="inline h-3 w-3 mr-1" />
              Filtros ativos
            </div>
          )}
        </div>

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
            propostasFiltradas.map((proposta: any, index: number) => (
              <Card
                key={`proposta-${proposta?.id || index}`}
                className={`overflow-hidden transition-all hover:shadow-xl hover:scale-[1.02] ${getStatusBorderColor(proposta?.statusContextual || proposta?.status || 'rascunho')}`}
                data-testid={`proposal-card-${proposta?.id || index}`}
              >
                <CardContent className="p-0">
                  <div className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-16 w-16 items-center justify-center rounded-xl ${getStatusIconBackground(proposta?.status || 'rascunho')} shadow-lg`}
                      >
                        {getStatusIcon(proposta?.status || 'rascunho')}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-4">
                          <h3 className="text-lg font-semibold">
                            {proposta?.nomeCliente || 'Cliente não informado'}
                          </h3>
                          <Badge
                            className={`${getStatusColor(proposta?.statusContextual || proposta?.status || 'rascunho')} border px-3 py-1 text-sm`}
                            data-testid={`status-badge-${proposta?.status || 'rascunho'}`}
                          >
                            {getStatusText(
                              proposta?.statusContextual || proposta?.status || 'rascunho'
                            )}
                          </Badge>
                          {proposta?.status === 'pendenciado' && (
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
                          Proposta: #{proposta?.numeroProposta || proposta?.id || 'N/A'} | CPF:{' '}
                          {proposta?.cpfCliente || 'Não informado'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Criado em:{' '}
                          {proposta?.created_at
                            ? format(new Date(proposta.created_at), 'dd/MM/yyyy HH:mm', {
                                locale: ptBR,
                              })
                            : 'Data não disponível'}
                          {proposta?.loja_nome && (
                            <span className="ml-2">| Parceiro: {String(proposta.loja_nome)}</span>
                          )}
                        </div>
                        {(proposta?.status === 'pendenciado' || proposta?.status === 'pendente') &&
                          proposta?.motivo_pendencia && (
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
                        {formatCurrency(proposta?.valorSolicitado || 0)}
                      </div>
                      <div className="flex justify-end gap-2">
                        {proposta?.status === 'pendenciado' || proposta?.status === 'pendente' ? (
                          <Link to={`/propostas/editar/${proposta?.id || 'new'}`}>
                            <Button size="sm" variant="outline" className="flex items-center gap-1">
                              <Edit className="h-4 w-4" />
                              Corrigir
                            </Button>
                          </Link>
                        ) : (
                          <Link to={`/credito/analise/${proposta?.id || 'new'}`}>
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
