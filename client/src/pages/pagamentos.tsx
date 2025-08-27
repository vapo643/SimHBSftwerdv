import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import RefreshButton from '@/components/RefreshButton';
import {
  Clock,
  DollarSign,
  CheckCircle,
  Download,
  CreditCard,
  Eye,
  Search,
  Filter,
  ArrowUpDown,
  Calendar,
  User,
  FileText,
  AlertCircle,
  TrendingUp,
  Activity,
  Send,
  Banknote,
  Receipt,
  Shield,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface Pagamento {
  id: string;
  propostaId: string;
  numeroContrato: string;
  nomeCliente: string;
  cpfCliente: string;
  valorFinanciado: number;
  valorLiquido: number;
  valorIOF: number;
  valorTAC: number;
  contaBancaria: {
    banco: string;
    agencia: string;
    conta: string;
    tipoConta: string;
    titular: string;
  };
  status: string;
  dataRequisicao: string;
  dataAprovacao?: string;
  dataPagamento?: string;
  requisitadoPor: {
    id: string;
    nome: string;
    papel: string;
    loja: string;
  };
  aprovadoPor?: {
    id: string;
    nome: string;
    papel: string;
  };
  motivoRejeicao: string;
  observacoes?: string;
  comprovante: string;
  formaPagamento: 'ted' | 'pix';
  loja: string;
  produto: string;
}

// Keeping legacy interface for compatibility during transition
interface Proposta {
  id: string;
  clienteData: {
    nome: string;
    cpf: string;
    email: string;
    telefone?: string;
    dataNascimento?: string;
    renda?: string;
  };
  condicoesData: {
    valorSolicitado: number;
    prazo: number;
    taxaJuros: number;
    valorParcela?: number;
    finalidade?: string;
  };
  status: string;
  created_at: string;
}

const paymentSchema = z.object({
  propostaId: z.string(),
  valorPago: z.string(),
  metodoPagamento: z.enum(['transferencia', 'ted', 'pix', 'boleto']),
  numeroConta: z.string().optional(),
  agencia: z.string().optional(),
  banco: z.string().optional(),
  chavePixCpf: z.string().optional(),
  observacoes: z.string().optional(),
});

type PaymentForm = z.infer<typeof paymentSchema>;

export default function Pagamentos() {
  const [selectedPropostas, setSelectedPropostas] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('dataAprovacao');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedProposta, setSelectedProposta] = useState<Pagamento | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('queue');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: paymentPropostas, isLoading } = useQuery<Pagamento[]>({
    queryKey: ['/api/pagamentos'],
    queryFn: async () => {
      const response = await apiRequest('/api/pagamentos');
      return response as Pagamento[];
    },
  });

  const form = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      metodoPagamento: 'transferencia',
      valorPago: '',
      observacoes: '',
    },
  });

  const processPaymentMutation = useMutation({
    mutationFn: async (data: PaymentForm) => {
      const response = await apiRequest(`/api/propostas/${data.propostaId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'pago',
          dataPagamento: new Date().toISOString(),
          observacoesFormalização: data.observacoes,
        }),
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: 'Pagamento processado com sucesso!',
        description: "O status da proposta foi atualizado para 'pago'.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/pagamentos'] });
      setIsPaymentDialogOpen(false);
      setSelectedProposta(null);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: 'Erro ao processar pagamento',
        description: 'Tente novamente em alguns instantes.',
        variant: 'destructive',
      });
    },
  });

  const batchProcessMutation = useMutation({
    mutationFn: async (proposalIds: string[]) => {
      const promises = proposalIds.map((id) =>
        apiRequest(`/api/propostas/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'pago',
            // dataPagamento will be handled by backend
          }),
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast({
        title: 'Lote processado com sucesso!',
        description: `${selectedPropostas.length} pagamentos foram processados.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/pagamentos'] });
      setSelectedPropostas([]);
    },
    onError: (error) => {
      toast({
        title: 'Erro ao processar lote',
        description: 'Alguns pagamentos podem não ter sido processados.',
        variant: 'destructive',
      });
    },
  });

  const formatCurrency = (value: string | number) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(numValue);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getStatusColor = (status: string) => {
    const statusColors = {
      contratos_assinados: 'bg-purple-500',
      pronto_pagamento: 'bg-orange-500',
      BOLETOS_EMITIDOS: 'bg-blue-600',
      PAGAMENTO_PENDENTE: 'bg-yellow-500',
      PAGAMENTO_PARCIAL: 'bg-amber-500',
      INADIMPLENTE: 'bg-red-600',
      QUITADO: 'bg-green-600',
      pago: 'bg-green-600',
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-500';
  };

  const getStatusText = (status: string) => {
    const statusTexts = {
      contratos_assinados: 'Contratos Assinados',
      pronto_pagamento: 'Pronto para Pagamento',
      BOLETOS_EMITIDOS: 'Boletos Emitidos',
      PAGAMENTO_PENDENTE: 'Aguardando Pagamento',
      PAGAMENTO_PARCIAL: 'Pagamento Parcial',
      INADIMPLENTE: 'Inadimplente',
      QUITADO: 'Quitado',
      pago: 'Pago',
    };
    return statusTexts[status as keyof typeof statusTexts] || status;
  };

  const getMethodText = (method: string) => {
    const methodTexts = {
      transferencia: 'Transferência',
      ted: 'TED',
      pix: 'PIX',
      boleto: 'Boleto',
    };
    return methodTexts[method as keyof typeof methodTexts] || method;
  };

  // Backend now filters by V2.0 status including BOLETOS_EMITIDOS
  const allPaymentPropostas = paymentPropostas || [];

  // For completed payments, filter from the main query
  const completedPayments: Pagamento[] = allPaymentPropostas.filter(
    (p) => p.status === 'pago' || p.status === 'QUITADO'
  );

  // Apply filters and search
  const filteredPropostas = allPaymentPropostas.filter((proposta) => {
    const matchesSearch =
      proposta.nomeCliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proposta.cpfCliente.includes(searchTerm) ||
      proposta.id.toString().includes(searchTerm);

    const matchesStatus = filterStatus === 'all' || proposta.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // Sort propostas
  const sortedPropostas = [...filteredPropostas].sort((a, b) => {
    let aVal: unknown;
    let bVal: unknown;

    if (sortBy === 'valor' || sortBy === 'valorSolicitado' || sortBy === 'valorAprovado') {
      aVal = a.valorFinanciado || 0;
      bVal = b.valorFinanciado || 0;
    } else if (sortBy === 'clienteNome') {
      aVal = a.nomeCliente;
      bVal = b.nomeCliente;
    } else if (sortBy === 'dataAprovacao') {
      aVal = new Date(a.dataAprovacao || a.dataRequisicao || 0);
      bVal = new Date(b.dataAprovacao || b.dataRequisicao || 0);
    } else if (sortBy === 'prazo') {
      // We don't have prazo in the new structure, use dataRequisicao as fallback
      aVal = new Date(a.dataRequisicao || 0);
      bVal = new Date(b.dataRequisicao || 0);
    } else {
      // Default fallback
      aVal = a.status;
      bVal = b.status;
    }

    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  const handleSelectProposta = (propostaId: string) => {
    setSelectedPropostas((prev) =>
      prev.includes(propostaId) ? prev.filter((id) => id !== propostaId) : [...prev, propostaId]
    );
  };

  const handleSelectAll = () => {
    if (selectedPropostas.length === sortedPropostas.length) {
      setSelectedPropostas([]);
    } else {
      setSelectedPropostas(sortedPropostas.map((p) => p.id));
    }
  };

  const handleProcessPayment = (proposta: Pagamento) => {
    setSelectedProposta(proposta);
    form.setValue('propostaId', proposta.id);
    form.setValue('valorPago', proposta.valorLiquido.toString());
    setIsPaymentDialogOpen(true);
  };

  const onSubmit = (data: PaymentForm) => {
    processPaymentMutation.mutate(data);
  };

  const handleBatchProcess = () => {
    if (selectedPropostas.length === 0) {
      toast({
        title: 'Nenhuma proposta selecionada',
        description: 'Selecione ao menos uma proposta para processar.',
        variant: 'destructive',
      });
      return;
    }

    batchProcessMutation.mutate(selectedPropostas);
  };

  // Calculate statistics
  const totalPendingValue = allPaymentPropostas.reduce((sum, p) => sum + p.valorFinanciado, 0);

  const totalCompletedValue = completedPayments.reduce((sum, p) => sum + p.valorFinanciado, 0);

  const readyForPayment = allPaymentPropostas.filter(
    (p) =>
      p.status === 'BOLETOS_EMITIDOS' ||
      p.status === 'pronto_pagamento' ||
      p.status === 'em_processamento'
  ).length;
  const contractsSigned = 0; // Since we're only showing pronto_pagamento, this would be 0

  if (isLoading) {
    return (
      <DashboardLayout title="Fila de Pagamento">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <Card key={index} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="mb-4 h-6 rounded bg-gray-200"></div>
                  <div className="mb-2 h-8 rounded bg-gray-200"></div>
                  <div className="h-4 w-2/3 rounded bg-gray-200"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/pagamentos'] });
  };

  return (
    <DashboardLayout
      title="Fila de Pagamento"
      actions={<RefreshButton onRefresh={handleRefresh} isLoading={isLoading} variant="ghost" />}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fila de Pagamento</h1>
            <p className="text-gray-600">Gerencie e processe pagamentos de propostas aprovadas</p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={handleBatchProcess}
              disabled={selectedPropostas.length === 0 || batchProcessMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {batchProcessMutation.isPending ? (
                <>
                  <Activity className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Processar Lote ({selectedPropostas.length})
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Statistics Overview */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pronto para Pagamento</p>
                  <p className="text-2xl font-bold text-orange-600">{readyForPayment}</p>
                </div>
                <div className="rounded-full bg-orange-100 p-3">
                  <Banknote className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Contratos Assinados</p>
                  <p className="text-2xl font-bold text-purple-600">{contractsSigned}</p>
                </div>
                <div className="rounded-full bg-purple-100 p-3">
                  <FileText className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Valor Pendente</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(totalPendingValue)}
                  </p>
                </div>
                <div className="rounded-full bg-blue-100 p-3">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Valor Pago</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(totalCompletedValue)}
                  </p>
                </div>
                <div className="rounded-full bg-green-100 p-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="queue">Fila de Pagamento</TabsTrigger>
            <TabsTrigger value="history">Histórico de Pagamentos</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="space-y-6">
            {/* Search and Filter Controls */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
                <Input
                  placeholder="Buscar por cliente, CPF ou ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[200px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filtrar status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="BOLETOS_EMITIDOS">Boletos Emitidos</SelectItem>
                  <SelectItem value="PAGAMENTO_PENDENTE">Aguardando Pagamento</SelectItem>
                  <SelectItem value="PAGAMENTO_PARCIAL">Pagamento Parcial</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[200px]">
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dataAprovacao">Data de Aprovação</SelectItem>
                  <SelectItem value="valorAprovado">Valor</SelectItem>
                  <SelectItem value="clienteNome">Cliente</SelectItem>
                  <SelectItem value="prazo">Prazo</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </Button>
            </div>

            {/* Batch Actions */}
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
              <div className="flex items-center space-x-4">
                <Checkbox
                  checked={
                    selectedPropostas.length === sortedPropostas.length &&
                    sortedPropostas.length > 0
                  }
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm font-medium">
                  {selectedPropostas.length} de {sortedPropostas.length} selecionados
                </span>
              </div>

              {selectedPropostas.length > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    Total:{' '}
                    {formatCurrency(
                      selectedPropostas.reduce((sum, id) => {
                        const proposta = sortedPropostas.find((p) => p.id === id);
                        return sum + (proposta?.valorFinanciado || 0);
                      }, 0)
                    )}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => setSelectedPropostas([])}>
                    Limpar
                  </Button>
                </div>
              )}
            </div>

            {/* Payment Queue Table */}
            <div className="space-y-4">
              {sortedPropostas.map((proposta) => (
                <Card key={proposta.id} className="transition-shadow hover:shadow-md">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <Checkbox
                          checked={selectedPropostas.includes(proposta.id)}
                          onCheckedChange={() => handleSelectProposta(proposta.id)}
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-4">
                            <div>
                              <p className="font-semibold text-gray-900">
                                #{proposta.id.slice(0, 8)}
                              </p>
                              <p className="text-sm text-gray-600">{proposta.nomeCliente}</p>
                            </div>
                            <div className="hidden sm:block">
                              <p className="text-sm text-gray-600">CPF</p>
                              <p className="font-medium">{proposta.cpfCliente}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Valor Financiado</p>
                              <p className="font-bold text-green-600">
                                {formatCurrency(proposta.valorFinanciado)}
                              </p>
                            </div>
                            <div className="hidden md:block">
                              <p className="text-sm text-gray-600">Valor Líquido</p>
                              <p className="font-medium">{formatCurrency(proposta.valorLiquido)}</p>
                            </div>
                            <div className="hidden lg:block">
                              <p className="text-sm text-gray-600">Data Requisição</p>
                              <p className="font-medium">{formatDate(proposta.dataRequisicao)}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <Badge className={`${getStatusColor(proposta.status)} text-white`}>
                          {getStatusText(proposta.status)}
                        </Badge>
                        <Button
                          size="sm"
                          onClick={() => handleProcessPayment(proposta)}
                          disabled={processPaymentMutation.isPending}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {processPaymentMutation.isPending ? (
                            <Activity className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Send className="mr-2 h-4 w-4" />
                              Processar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {sortedPropostas.length === 0 && (
              <div className="py-12 text-center">
                <CreditCard className="mx-auto mb-4 h-16 w-16 text-gray-400" />
                <p className="text-lg text-gray-500">
                  {searchTerm || filterStatus !== 'all'
                    ? 'Nenhuma proposta encontrada'
                    : 'Nenhuma proposta na fila de pagamento'}
                </p>
                <p className="mt-2 text-gray-400">
                  {searchTerm || filterStatus !== 'all'
                    ? 'Tente ajustar os filtros de busca'
                    : 'Propostas com boletos emitidos aparecerão aqui'}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            {/* Payment History */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Histórico de Pagamentos</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Total de pagamentos:</span>
                  <span className="font-bold text-green-600">{completedPayments.length}</span>
                </div>
              </div>

              {completedPayments.length === 0 ? (
                <div className="py-12 text-center">
                  <Receipt className="mx-auto mb-4 h-16 w-16 text-gray-400" />
                  <p className="text-lg text-gray-500">Nenhum pagamento realizado</p>
                  <p className="mt-2 text-gray-400">Pagamentos processados aparecerão aqui</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {completedPayments.map((proposta) => (
                    <Card key={proposta.id}>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="rounded-full bg-green-100 p-2">
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">
                                #{proposta.id.slice(0, 8)} - {proposta.nomeCliente}
                              </p>
                              <p className="text-sm text-gray-600">CPF: {proposta.cpfCliente}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600">
                              {formatCurrency(proposta.valorFinanciado)}
                            </p>
                            <p className="text-sm text-gray-600">
                              Pago em{' '}
                              {formatDate(
                                proposta.dataPagamento ||
                                  proposta.dataAprovacao ||
                                  proposta.dataRequisicao
                              )}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Payment Processing Dialog */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Processar Pagamento</DialogTitle>
            </DialogHeader>

            {selectedProposta && (
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Client Information */}
                <div className="rounded-lg bg-gray-50 p-4">
                  <h4 className="mb-2 font-semibold">Informações do Cliente</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Nome:</span>
                      <p className="font-medium">{selectedProposta.nomeCliente}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">CPF:</span>
                      <p className="font-medium">{selectedProposta.cpfCliente}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Contrato:</span>
                      <p className="font-medium">{selectedProposta.numeroContrato}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Loja:</span>
                      <p className="font-medium">{selectedProposta.loja}</p>
                    </div>
                  </div>
                </div>

                {/* Payment Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="valorPago">Valor a Pagar</Label>
                    <Input
                      id="valorPago"
                      {...form.register('valorPago')}
                      placeholder="0,00"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="metodoPagamento">Método de Pagamento</Label>
                    <Select
                      onValueChange={(value) =>
                        form.setValue(
                          'metodoPagamento',
                          value as 'ted' | 'pix' | 'boleto' | 'transferencia'
                        )
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione o método" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                        <SelectItem value="ted">TED</SelectItem>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="boleto">Boleto Bancário</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Banking Information */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="banco">Banco</Label>
                    <Input
                      id="banco"
                      {...form.register('banco')}
                      placeholder="Banco do Brasil"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="agencia">Agência</Label>
                    <Input
                      id="agencia"
                      {...form.register('agencia')}
                      placeholder="1234-5"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="numeroConta">Número da Conta</Label>
                    <Input
                      id="numeroConta"
                      {...form.register('numeroConta')}
                      placeholder="12345-6"
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* PIX Information */}
                <div>
                  <Label htmlFor="chavePixCpf">Chave PIX (CPF)</Label>
                  <Input
                    id="chavePixCpf"
                    {...form.register('chavePixCpf')}
                    placeholder="123.456.789-00"
                    className="mt-1"
                  />
                </div>

                {/* Observations */}
                <div>
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    {...form.register('observacoes')}
                    placeholder="Observações sobre o pagamento..."
                    className="mt-1"
                    rows={3}
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPaymentDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={processPaymentMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {processPaymentMutation.isPending ? (
                      <>
                        <Activity className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Processar Pagamento
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
