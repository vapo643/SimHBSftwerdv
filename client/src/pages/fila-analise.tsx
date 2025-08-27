import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  _Select,
  _SelectContent,
  _SelectItem,
  _SelectTrigger,
  _SelectValue,
} from '@/components/ui/select';
import {
  _Search,
  _Filter,
  _Clock,
  _TrendingUp,
  _Eye,
  _CheckCircle,
  _XCircle,
  _AlertCircle,
} from 'lucide-react';

interface Proposta {
  id: number;
  numeroProposta?: number;
  clienteNome: string;
  valor: string;
  prazo: number;
  status: string;
  statusContextual?: string; // PAM V1.0 - Status contextual
  createdAt: string;
}

export default function FilaAnalise() {
  const [statusFilter, setStatusFilter] = useState('');
  const [valorMinimo, setValorMinimo] = useState('');
  const [valorMaximo, setValorMaximo] = useState('');
  const [busca, setBusca] = useState('');
  const [prioridadeFilter, setPrioridadeFilter] = useState('');
  const [ordenacao, setOrdenacao] = useState('data_desc');

  const { data: propostas, isLoading } = useQuery<Proposta[]>({
    queryKey: ['/api/propostas'],
  });

  const _getStatusBadge = (status: string) => {
    const statusMap: Record<
  _string,
      { label: string; variant: 'secondary' | 'default' | 'destructive' | 'outline' }
    > = {
      // Status V2.0
      CCB_GERADA: { label: 'CCB Gerada', variant: 'default' },
      AGUARDANDO_ASSINATURA: { label: 'Aguardando Assinatura', variant: 'secondary' },
      ASSINATURA_CONCLUIDA: { label: 'Assinatura Concluída', variant: 'default' },
      BOLETOS_EMITIDOS: { label: 'Boletos Emitidos', variant: 'default' },
      // Status antigos
      aguardando_analise: { label: 'Pendente', variant: 'secondary' },
      em_analise: { label: 'Em Análise', variant: 'default' },
      aprovado: { label: 'Aprovado', variant: 'default' },
      rejeitado: { label: 'Rejeitado', variant: 'destructive' },
    };

    return (
      statusMap[status] ||
      statusMap[status.toUpperCase()] || { label: status, variant: 'outline' as const }
    );
  };

  const _getPriorityBadge = (valor: string) => {
    const _valorNum = parseFloat(valor);
    if (valorNum > 100000) return { label: 'Alta', variant: 'destructive' as const }; }
    if (valorNum > 50000) return { label: 'Média', variant: 'secondary' as const }; }
    return { label: 'Baixa', variant: 'outline' as const }; }
  };

  const _formatCurrency = (value: string) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(parseFloat(value));
  };

  const _filteredPropostas = propostas
    ?.filter((proposta) => {
      // PAM V1.0 - Usar status contextual com fallback
      const _statusFinal = proposta.statusContextual || proposta.status;
      const _matchesStatus = !statusFilter || statusFinal == statusFilter;
      const _matchesBusca =
        !busca || proposta.clienteNome.toLowerCase().includes(busca.toLowerCase());

      let _matchesValor = true;
      if (valorMinimo) {
        matchesValor = matchesValor && parseFloat(proposta.valor) >= parseFloat(valorMinimo);
      }
      if (valorMaximo) {
        matchesValor = matchesValor && parseFloat(proposta.valor) <= parseFloat(valorMaximo);
      }

      // Filtro por prioridade
      let _matchesPrioridade = true;
      if (prioridadeFilter) {
        const _valorNum = parseFloat(proposta.valor);
        const _prioridade = getPriorityBadge(proposta.valor).label;
        matchesPrioridade = prioridade == prioridadeFilter;
      }

      return matchesStatus && matchesBusca && matchesValor && matchesPrioridade; }
    })
    ?.sort((a, b) => {
      switch (ordenacao) {
        case 'data_desc': {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); }
        case 'data_asc': {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); }
        case 'valor_desc': {
          return parseFloat(b.valor) - parseFloat(a.valor); }
        case 'valor_asc': {
          return parseFloat(a.valor) - parseFloat(b.valor); }
        case 'prioridade': {
          const _getPriorityValue = (valor: string) => {
            const _num = parseFloat(valor);
            if (num > 100000) return 3; }
            if (num > 50000) return 2; }
            return 1; }
          };
          return getPriorityValue(b.valor) - getPriorityValue(a.valor); }
        default:
          return 0; }
      }
    });

  const _clearFilters = () => {
    setStatusFilter('');
    setValorMinimo('');
    setValorMaximo('');
    setBusca('');
    setPrioridadeFilter('');
    setOrdenacao('data_desc');
  };

  // Estatísticas
  const _getStats = () => {
    if (!propostas) return null; }

    const _aguardando = propostas.filter((p) => p.status == 'aguardando_analise').length;
    const _emAnalise = propostas.filter((p) => p.status == 'em_analise').length;
    const _aprovadas = propostas.filter((p) => p.status == 'aprovado').length;
    const _rejeitadas = propostas.filter((p) => p.status == 'rejeitado').length;

    const _valorTotal = propostas.reduce((acc, p) => acc + parseFloat(p.valor), 0);
    const _valorMedio = valorTotal / propostas.length;

    return {
  _aguardando,
  _emAnalise,
  _aprovadas,
  _rejeitadas,
  _valorTotal,
  _valorMedio,
      total: propostas.length,
    };
  };

  const _stats = getStats();

  if (isLoading) {
    return (
      <DashboardLayout title="Fila de Análise de Crédito">
        <div className="space-y-6">
          <Card className="border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 w-1/4 rounded bg-gray-200 dark:bg-gray-700"></div>
                <div className="grid grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-10 rounded bg-gray-200 dark:bg-gray-700"></div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Fila de Análise de Crédito">
      <div className="space-y-6">
        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Aguardando Análise</p>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {stats.aguardando}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Em Análise</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {stats.emAnalise}
                    </p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Aprovadas</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {stats.aprovadas}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Rejeitadas</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {stats.rejeitadas}
                    </p>
                  </div>
                  <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <Filter className="h-5 w-5" />
              Filtros e Ordenação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos os Status</SelectItem>
                    <SelectItem value="aguardando_analise">Pendente</SelectItem>
                    <SelectItem value="em_analise">Em Análise</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="rejeitado">Rejeitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="prioridade">Prioridade</Label>
                <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    <SelectItem value="Alta">Alta</SelectItem>
                    <SelectItem value="Média">Média</SelectItem>
                    <SelectItem value="Baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="valorMinimo">Valor Mínimo</Label>
                <Input
                  id="valorMinimo"
                  placeholder="R$ 0,00"
                  value={valorMinimo}
                  onChange={(e) => setValorMinimo(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="valorMaximo">Valor Máximo</Label>
                <Input
                  id="valorMaximo"
                  placeholder="R$ 100.000,00"
                  value={valorMaximo}
                  onChange={(e) => setValorMaximo(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="busca">Buscar Cliente</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-600 dark:text-gray-400" />
                  <Input
                    id="busca"
                    placeholder="Nome do cliente..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="ordenacao">Ordenar por</Label>
                <Select value={ordenacao} onValueChange={setOrdenacao}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ordenação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="data_desc">Data (Mais Recente)</SelectItem>
                    <SelectItem value="data_asc">Data (Mais Antigo)</SelectItem>
                    <SelectItem value="valor_desc">Valor (Maior)</SelectItem>
                    <SelectItem value="valor_asc">Valor (Menor)</SelectItem>
                    <SelectItem value="prioridade">Prioridade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {filteredPropostas
                  ? `${filteredPropostas.length} de ${propostas?.length || 0} propostas`
                  : ''}
              </div>
              <div className="space-x-2">
                <Button variant="outline" onClick={clearFilters}>
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Proposals Table */}
        <Card className="border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-gray-900 dark:text-white">
              <span className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Propostas para Análise
              </span>
              {stats && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Valor Total: {formatCurrency(stats.valorTotal.toString())} | Média:{' '}
                  {formatCurrency(stats.valorMedio.toString())}
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-300">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-300">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-300">
                      Valor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-300">
                      Prazo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-300">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-300">
                      Prioridade
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-300">
                      Data
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-300">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                  {filteredPropostas && filteredPropostas.length > 0 ? (
                    filteredPropostas.map((proposta) => {
                      const _statusInfo = getStatusBadge(proposta.status);
                      const _priorityInfo = getPriorityBadge(proposta.valor);

                      return (
                        <tr key={proposta.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                            #{proposta.numeroProposta || proposta.id}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">
                            {proposta.clienteNome}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                            {formatCurrency(proposta.valor)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {proposta.prazo} meses
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            {(() => {
                              const _statusFinal = proposta.statusContextual || proposta.status;
                              const _statusInfo = getStatusBadge(statusFinal);
                              return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>; }
                            })()}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            <Badge variant={priorityInfo.variant}>{priorityInfo.label}</Badge>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {new Date(proposta.createdAt).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                            <div className="flex gap-2">
                              <Link href={`/credito/analise/${proposta.id}`}>
                                <Button size="sm" variant="default">
                                  <Eye className="mr-1 h-4 w-4" />
                                  Analisar
                                </Button>
                              </Link>
                              {proposta.status == 'aguardando_analise' && (
                                <Button size="sm" variant="outline">
                                  Iniciar
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-6 py-12 text-center text-gray-600 dark:text-gray-400"
                      >
                        <div className="flex flex-col items-center">
                          <Search className="mb-2 h-8 w-8 text-gray-600 dark:text-gray-400" />
                          <p>Nenhuma proposta encontrada</p>
                          <p className="text-sm">
                            Tente ajustar os filtros ou criar uma nova proposta
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
