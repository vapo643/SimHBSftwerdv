import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  Calendar,
  Search,
  Phone,
  MessageSquare,
  Eye,
  EyeOff,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Receipt,
  DollarSign,
  FileText,
  Send,
  Filter,
  QrCode,
  Copy,
  Building2,
  RefreshCw,
  Barcode,
  User,
  Mail,
  MapPin,
  CreditCard,
  UserCheck,
  History,
  AlertTriangle,
  X,
  MoreVertical,
  CalendarPlus,
  Percent
} from "lucide-react";
import { format, parseISO, differenceInDays, isToday, isFuture, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";

interface FichaCliente {
  cliente: {
    nome: string;
    cpf: string;
    email: string;
    telefone: string;
    dataNascimento: string;
    endereco: string;
    cep: string;
    ocupacao: string;
  };
  dadosBancarios: {
    banco: string;
    agencia: string;
    conta: string;
    tipoConta: string;
    pix: string;
    tipoPix: string;
    titular: string;
  };
  referencias: Array<{
    id: number;
    nomeCompleto: string;
    grauParentesco: string;
    telefone: string;
  }>;
  contrato: {
    numeroContrato: string;
    dataContrato: string;
    valorTotal: number;
    valorFinanciado: number;
    prazo: number;
    taxaJuros: number;
    ccbAssinada: boolean;
    status: string;
  };
  parcelas: Array<{
    id: number;
    numeroParcela: number;
    valorParcela: number;
    dataVencimento: string;
    dataPagamento?: string;
    status: string;
    diasAtraso: number;
    vencida: boolean;
    interPixCopiaECola?: string;
    interLinhaDigitavel?: string;
    interCodigoBarras?: string;
    interSituacao?: string;
  }>;
  observacoes: Array<{
    id: number;
    userName: string;
    observacao: string;
    tipoContato?: string;
    statusPromessa?: string;
    dataPromessaPagamento?: string;
    createdAt: string;
  }>;
  resumoFinanceiro: {
    totalParcelas: number;
    parcelasPagas: number;
    parcelasVencidas: number;
    parcelasPendentes: number;
    valorTotalPago: number;
    valorTotalVencido: number;
    valorTotalPendente: number;
  };
}

export default function CobrancasPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [atrasoFilter, setAtrasoFilter] = useState<string>("todos");
  const [showCpf, setShowCpf] = useState(false);
  const [selectedPropostaId, setSelectedPropostaId] = useState<string | null>(null);
  const [showFichaModal, setShowFichaModal] = useState(false);
  const [novaObservacao, setNovaObservacao] = useState("");
  const [tipoContato, setTipoContato] = useState("");
  const [statusPromessa, setStatusPromessa] = useState("");
  const [dataPromessaPagamento, setDataPromessaPagamento] = useState("");
  
  // Estados para modais de modificação de boletos
  const [showProrrogarModal, setShowProrrogarModal] = useState(false);
  const [showDescontoModal, setShowDescontoModal] = useState(false);
  const [selectedBoleto, setSelectedBoleto] = useState<any>(null);
  const [novaDataVencimento, setNovaDataVencimento] = useState("");
  const [valorDesconto, setValorDesconto] = useState("");
  const [dataLimiteDesconto, setDataLimiteDesconto] = useState("");
  
  // Verificar se o usuário tem role de cobrança
  const isCobrancaUser = user?.role === 'COBRANÇA';
  const isAdmin = user?.role === 'ADMINISTRADOR';

  // Mutations para modificar boletos
  const prorrogarMutation = useMutation({
    mutationFn: async (data: { codigoSolicitacao: string; novaDataVencimento: string }) => {
      return apiRequest(`/api/inter/collections/${data.codigoSolicitacao}`, 'PATCH', {
        action: 'prorrogar',
        novaDataVencimento: data.novaDataVencimento
      });
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Vencimento prorrogado com sucesso",
      });
      setShowProrrogarModal(false);
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao prorrogar vencimento",
        variant: "destructive",
      });
    }
  });

  const descontoMutation = useMutation({
    mutationFn: async (data: { codigoSolicitacao: string; valor: number; dataLimite: string }) => {
      return apiRequest(`/api/inter/collections/${data.codigoSolicitacao}`, 'PATCH', {
        action: 'desconto',
        valor: data.valor,
        dataLimite: data.dataLimite
      });
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Desconto aplicado com sucesso",
      });
      setShowDescontoModal(false);
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao aplicar desconto",
        variant: "destructive",
      });
    }
  });

  // Buscar propostas de cobrança
  const { data: propostas, isLoading, refetch } = useQuery({
    queryKey: ['/api/cobrancas', statusFilter, atrasoFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'todos') params.append('status', statusFilter);
      if (atrasoFilter !== 'todos') params.append('atraso', atrasoFilter);
      
      return apiRequest(`/api/cobrancas?${params.toString()}`);
    }
  });
  
  // Função para atualizar sem precisar recarregar a página
  const handleRefresh = () => {
    console.log("[COBRANÇAS] Atualizando dados da API do Banco Inter...");
    refetch();
  };

  // Buscar KPIs
  const { data: kpis } = useQuery({
    queryKey: ['/api/cobrancas/kpis'],
    queryFn: () => apiRequest('/api/cobrancas/kpis')
  });

  // Buscar ficha do cliente
  const { data: fichaCliente, isLoading: loadingFicha } = useQuery<FichaCliente>({
    queryKey: ['/api/cobrancas/ficha', selectedPropostaId],
    queryFn: () => apiRequest(`/api/cobrancas/${selectedPropostaId}/ficha`),
    enabled: !!selectedPropostaId && showFichaModal
  });

  // Mutation para adicionar observação
  const adicionarObservacaoMutation = useMutation({
    mutationFn: (data: any) => 
      apiRequest(`/api/cobrancas/${selectedPropostaId}/observacao`, {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      toast({
        title: "Observação adicionada",
        description: "A observação foi registrada com sucesso.",
      });
      setNovaObservacao("");
      setTipoContato("");
      setStatusPromessa("");
      setDataPromessaPagamento("");
      queryClient.invalidateQueries({ queryKey: ['/api/cobrancas/ficha'] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a observação.",
        variant: "destructive",
      });
    }
  });

  // Função para copiar texto
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: `${label} copiado!`,
      description: "Código copiado para a área de transferência.",
    });
  };

  // Função para mascarar CPF/CNPJ
  const maskDocument = (doc: string) => {
    if (!doc) return '';
    if (!showCpf) {
      if (doc.length === 11) { // CPF
        return `${doc.substring(0, 3)}.***.***-${doc.substring(9)}`;
      } else if (doc.length === 14) { // CNPJ
        return `${doc.substring(0, 2)}.****.****/****-${doc.substring(12)}`;
      }
    }
    return doc;
  };

  // Função para exportar inadimplentes
  const exportarInadimplentes = async () => {
    try {
      const data = await apiRequest('/api/cobrancas/exportar/inadimplentes');
      
      // Criar CSV manualmente
      const headers = Object.keys(data.inadimplentes[0] || {});
      const csv = [
        headers.join(','),
        ...data.inadimplentes.map((row: any) => 
          headers.map(header => `"${row[header] || ''}"`).join(',')
        )
      ].join('\n');
      
      // Download do CSV
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `inadimplentes_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
      
      toast({
        title: "Exportação concluída",
        description: `${data.total} registros exportados com sucesso.`,
      });
    } catch (error) {
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar os dados.",
        variant: "destructive",
      });
    }
  };

  // Filtrar propostas localmente pela busca
  const propostasFiltradas = propostas?.filter((proposta: any) => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    return (
      proposta.nomeCliente?.toLowerCase().includes(search) ||
      proposta.cpfCliente?.includes(searchTerm) ||
      proposta.numeroContrato?.toLowerCase().includes(search) ||
      proposta.id?.includes(searchTerm)
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'em_dia':
        return 'bg-green-100 text-green-800';
      case 'inadimplente':
        return 'bg-red-100 text-red-800';
      case 'quitado':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getParcelaStatusColor = (status: string) => {
    switch (status) {
      case 'pago':
        return 'bg-green-100 text-green-800';
      case 'vencido':
        return 'bg-red-100 text-red-800';
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Função para mapear status do Inter Bank para cores
  const getInterBankStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'RECEBIDO':
      case 'MARCADO_RECEBIDO':
        return 'bg-green-100 text-green-800';
      case 'CANCELADO':
      case 'EXPIRADO':
      case 'FALHA_EMISSAO':
        return 'bg-gray-100 text-gray-800';
      case 'ATRASADO':
      case 'PROTESTO':
        return 'bg-red-100 text-red-800';
      case 'A_RECEBER':
      case 'EM_PROCESSAMENTO':
      case 'EMITIDO':
        return 'bg-blue-100 text-blue-800';
      case 'pago':
        return 'bg-green-100 text-green-800';
      case 'vencido':
        return 'bg-red-100 text-red-800';
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Função para mapear status do Inter Bank para texto de exibição
  const getInterBankStatusLabel = (interSituacao?: string, localStatus?: string, vencida?: boolean) => {
    // Priorizar status do Inter Bank se disponível
    if (interSituacao) {
      switch (interSituacao.toUpperCase()) {
        case 'RECEBIDO':
        case 'MARCADO_RECEBIDO':
          return 'Pago';
        case 'CANCELADO':
        case 'EXPIRADO':
        case 'FALHA_EMISSAO':
          return 'Cancelado';
        case 'ATRASADO':
        case 'PROTESTO':
          return 'Vencido';
        case 'A_RECEBER':
        case 'EM_PROCESSAMENTO':
        case 'EMITIDO':
          return 'Pendente';
        default:
          return interSituacao;
      }
    }
    
    // Fallback para status local
    if (localStatus === 'pago') return 'Pago';
    if (vencida) return 'Vencido';
    return 'Pendente';
  };

  // Função para calcular o Status de Vencimento inteligente
  const getStatusVencimento = (proposta: any) => {
    // Se tem situação do Inter Bank, verificar status especiais
    if (proposta.interSituacao) {
      const situacao = proposta.interSituacao.toUpperCase();
      if (situacao === 'RECEBIDO' || situacao === 'MARCADO_RECEBIDO') {
        return { text: 'Pago', color: 'text-green-600' };
      }
      if (situacao === 'CANCELADO' || situacao === 'EXPIRADO' || situacao === 'FALHA_EMISSAO') {
        return { text: 'Cancelado', color: 'text-gray-600' };
      }
    }

    // Se o status local indica pago
    if (proposta.status === 'quitado' || proposta.status === 'pago') {
      return { text: 'Pago', color: 'text-green-600' };
    }

    // Calcular baseado na data de vencimento
    const hoje = new Date();
    const dataVencimento = proposta.dataProximoVencimento ? parseISO(proposta.dataProximoVencimento) : null;
    
    if (!dataVencimento) {
      return { text: 'Sem vencimento', color: 'text-gray-500' };
    }

    // Se já venceu
    if (proposta.diasAtraso > 0) {
      return { text: `Vencido há ${proposta.diasAtraso} dias`, color: 'text-red-600 font-semibold' };
    }

    // Se vence hoje
    if (isToday(dataVencimento)) {
      return { text: 'Vence hoje', color: 'text-orange-600 font-semibold' };
    }

    // Se vence nos próximos 7 dias
    const diasParaVencer = differenceInDays(dataVencimento, hoje);
    if (diasParaVencer > 0 && diasParaVencer <= 7) {
      return { text: `Vence em ${diasParaVencer} dias`, color: 'text-yellow-600' };
    }

    // Para todos os outros casos, mostrar a data de vencimento
    if (isFuture(dataVencimento)) {
      return { text: format(dataVencimento, 'dd/MM/yyyy'), color: 'text-gray-600' };
    }

    return { text: 'Em dia', color: 'text-green-600' };
  };

  return (
    <DashboardLayout title="Cobranças">
      <div className="space-y-6">
        {/* Alerta para usuários de cobrança */}
        {isCobrancaUser && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <div>
                  <h3 className="font-semibold text-orange-800">Modo Cobrança Ativo</h3>
                  <p className="text-sm text-orange-700">
                    Você está visualizando apenas contratos: <strong>inadimplentes</strong>, <strong>em atraso</strong> ou que <strong>vencem nos próximos 3 dias</strong>.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        {/* KPIs Dashboard */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Valor Total em Atraso</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {new Intl.NumberFormat('pt-BR', { 
                  style: 'currency', 
                  currency: 'BRL' 
                }).format(kpis?.valorTotalEmAtraso || 0)}
              </div>
              <div className="text-xs text-muted-foreground">
                {kpis?.quantidadeContratosEmAtraso || 0} contratos inadimplentes
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Inadimplência</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis?.taxaInadimplencia || 0}%</div>
              <Progress value={Number(kpis?.taxaInadimplencia) || 0} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Valor Total da Carteira</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { 
                  style: 'currency', 
                  currency: 'BRL' 
                }).format(kpis?.valorTotalCarteira || 0)}
              </div>
              <div className="text-xs text-muted-foreground">
                {kpis?.quantidadeTotalContratos || 0} contratos ativos
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ações Rápidas</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={exportarInadimplentes}
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar Inadimplentes
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => {
                  console.log('[COBRANÇAS] Atualizando dados da API do Banco Inter...');
                  refetch();
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtros de Pesquisa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CPF, contrato..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-cobrancas"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="inadimplente">Inadimplente</SelectItem>
                  <SelectItem value="em_dia">Em Dia</SelectItem>
                  <SelectItem value="quitado">Quitado</SelectItem>
                </SelectContent>
              </Select>

              <Select value={atrasoFilter} onValueChange={setAtrasoFilter}>
                <SelectTrigger data-testid="select-atraso-filter">
                  <SelectValue placeholder="Dias de Atraso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="1-15">1-15 dias</SelectItem>
                  <SelectItem value="30+">Mais de 30 dias</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() => setShowCpf(!showCpf)}
                data-testid="button-toggle-cpf"
              >
                {showCpf ? (
                  <>
                    <EyeOff className="mr-2 h-4 w-4" />
                    Ocultar CPF
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Mostrar CPF
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Cobranças */}
        <Card>
          <CardHeader>
            <CardTitle>Contratos para Cobrança</CardTitle>
            <CardDescription>
              {propostasFiltradas?.length || 0} contratos encontrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Parcelas</TableHead>
                    <TableHead>Status Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : propostasFiltradas?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center">
                        Nenhum contrato encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    propostasFiltradas?.map((proposta: any) => (
                      <TableRow 
                        key={proposta.id}
                        className={proposta.diasAtraso > 30 ? 'bg-red-50' : ''}
                      >
                        <TableCell className="font-medium">
                          {proposta.numeroContrato}
                        </TableCell>
                        <TableCell>{proposta.nomeCliente}</TableCell>
                        <TableCell>{maskDocument(proposta.cpfCliente)}</TableCell>
                        <TableCell>{proposta.telefoneCliente}</TableCell>
                        <TableCell>
                          {new Intl.NumberFormat('pt-BR', { 
                            style: 'currency', 
                            currency: 'BRL' 
                          }).format(proposta.valorTotal)}
                        </TableCell>
                        <TableCell>
                          {proposta.parcelasPagas}/{proposta.quantidadeParcelas}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const statusInfo = getStatusVencimento(proposta);
                            return (
                              <span className={statusInfo.color}>
                                {statusInfo.text}
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(proposta.status)}>
                            {proposta.status === 'em_dia' ? 'Em Dia' : 
                             proposta.status === 'inadimplente' ? 'Inadimplente' : 
                             'Quitado'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedPropostaId(proposta.id);
                                setShowFichaModal(true);
                              }}
                              data-testid={`button-ficha-${proposta.id}`}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              Ficha
                            </Button>
                            
                            {/* Menu de Ações - Apenas para boletos com status modificável */}
                            {proposta.interCodigoSolicitacao && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" variant="ghost">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      if (!isAdmin) {
                                        toast({
                                          title: "Acesso Negado",
                                          description: "Apenas administradores podem prorrogar vencimentos",
                                          variant: "destructive",
                                        });
                                        return;
                                      }
                                      const canModify = ['A_RECEBER', 'ATRASADO', 'EM_PROCESSAMENTO'].includes(
                                        proposta.interSituacao?.toUpperCase() || ''
                                      );
                                      if (!canModify) {
                                        toast({
                                          title: "Ação não permitida",
                                          description: "Este boleto não pode ser modificado",
                                          variant: "destructive",
                                        });
                                        return;
                                      }
                                      setSelectedBoleto(proposta);
                                      setShowProrrogarModal(true);
                                    }}
                                    disabled={!isAdmin || ['PAGO', 'CANCELADO', 'RECEBIDO'].includes(
                                      proposta.interSituacao?.toUpperCase() || ''
                                    )}
                                  >
                                    <CalendarPlus className="mr-2 h-4 w-4" />
                                    Prorrogar Vencimento
                                  </DropdownMenuItem>
                                  
                                  <DropdownMenuItem
                                    onClick={() => {
                                      if (!isAdmin) {
                                        toast({
                                          title: "Acesso Negado",
                                          description: "Apenas administradores podem aplicar descontos",
                                          variant: "destructive",
                                        });
                                        return;
                                      }
                                      const canModify = ['A_RECEBER', 'ATRASADO', 'EM_PROCESSAMENTO'].includes(
                                        proposta.interSituacao?.toUpperCase() || ''
                                      );
                                      if (!canModify) {
                                        toast({
                                          title: "Ação não permitida",
                                          description: "Este boleto não pode ser modificado",
                                          variant: "destructive",
                                        });
                                        return;
                                      }
                                      setSelectedBoleto(proposta);
                                      setShowDescontoModal(true);
                                    }}
                                    disabled={!isAdmin || ['PAGO', 'CANCELADO', 'RECEBIDO'].includes(
                                      proposta.interSituacao?.toUpperCase() || ''
                                    )}
                                  >
                                    <Percent className="mr-2 h-4 w-4" />
                                    Aplicar Desconto
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
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

        {/* Modal - Prorrogar Vencimento */}
        <Dialog open={showProrrogarModal} onOpenChange={setShowProrrogarModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Prorrogar Vencimento</DialogTitle>
              <DialogDescription>
                Escolha a nova data de vencimento para o boleto
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nova-data">Nova Data de Vencimento</Label>
                <Input
                  id="nova-data"
                  type="date"
                  value={novaDataVencimento}
                  onChange={(e) => setNovaDataVencimento(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              
              {selectedBoleto && (
                <div className="text-sm text-muted-foreground">
                  <p>Contrato: {selectedBoleto.numeroContrato}</p>
                  <p>Cliente: {selectedBoleto.nomeCliente}</p>
                  <p>Valor: {new Intl.NumberFormat('pt-BR', { 
                    style: 'currency', 
                    currency: 'BRL' 
                  }).format(selectedBoleto.valorTotal)}</p>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowProrrogarModal(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (!novaDataVencimento) {
                    toast({
                      title: "Erro",
                      description: "Selecione uma nova data de vencimento",
                      variant: "destructive",
                    });
                    return;
                  }
                  prorrogarMutation.mutate({
                    codigoSolicitacao: selectedBoleto.interCodigoSolicitacao,
                    novaDataVencimento
                  });
                }}
                disabled={prorrogarMutation.isPending}
              >
                {prorrogarMutation.isPending ? "Processando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal - Aplicar Desconto */}
        <Dialog open={showDescontoModal} onOpenChange={setShowDescontoModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aplicar Desconto</DialogTitle>
              <DialogDescription>
                Configure o desconto fixo para o boleto
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="valor-desconto">Valor do Desconto (R$)</Label>
                <Input
                  id="valor-desconto"
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={valorDesconto}
                  onChange={(e) => setValorDesconto(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="data-limite">Data Limite do Desconto</Label>
                <Input
                  id="data-limite"
                  type="date"
                  value={dataLimiteDesconto}
                  onChange={(e) => setDataLimiteDesconto(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              
              {selectedBoleto && (
                <div className="text-sm text-muted-foreground">
                  <p>Contrato: {selectedBoleto.numeroContrato}</p>
                  <p>Cliente: {selectedBoleto.nomeCliente}</p>
                  <p>Valor Original: {new Intl.NumberFormat('pt-BR', { 
                    style: 'currency', 
                    currency: 'BRL' 
                  }).format(selectedBoleto.valorTotal)}</p>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDescontoModal(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (!valorDesconto || !dataLimiteDesconto) {
                    toast({
                      title: "Erro",
                      description: "Preencha todos os campos",
                      variant: "destructive",
                    });
                    return;
                  }
                  descontoMutation.mutate({
                    codigoSolicitacao: selectedBoleto.interCodigoSolicitacao,
                    valor: parseFloat(valorDesconto),
                    dataLimite: dataLimiteDesconto
                  });
                }}
                disabled={descontoMutation.isPending}
              >
                {descontoMutation.isPending ? "Processando..." : "Aplicar Desconto"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal - Ficha do Cliente */}
        <Dialog open={showFichaModal} onOpenChange={setShowFichaModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Ficha do Cliente - Dossiê de Cobrança</DialogTitle>
              <DialogDescription>
                Informações completas do cliente e histórico de cobrança
              </DialogDescription>
            </DialogHeader>
            
            {loadingFicha ? (
              <div className="p-8 text-center">Carregando ficha...</div>
            ) : fichaCliente ? (
              <ScrollArea className="h-[70vh] pr-4">
                <div className="space-y-6">
                  {/* Dados do Cliente */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center">
                        <User className="mr-2 h-4 w-4" />
                        Dados do Cliente
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label className="text-muted-foreground">Nome</Label>
                        <p className="font-medium">{fichaCliente.cliente.nome}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">CPF</Label>
                        <p className="font-medium">{fichaCliente.cliente.cpf}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Telefone</Label>
                        <p className="font-medium flex items-center gap-2">
                          {fichaCliente.cliente.telefone}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(fichaCliente.cliente.telefone, 'Telefone')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Email</Label>
                        <p className="font-medium">{fichaCliente.cliente.email}</p>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-muted-foreground">Endereço</Label>
                        <p className="font-medium">{fichaCliente.cliente.endereco}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Referências */}
                  {fichaCliente.referencias?.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center">
                          <UserCheck className="mr-2 h-4 w-4" />
                          Referências Pessoais
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {fichaCliente.referencias.map((ref, index) => (
                            <div key={ref.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                              <div>
                                <p className="font-medium">{ref.nomeCompleto}</p>
                                <p className="text-sm text-muted-foreground">{ref.grauParentesco}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{ref.telefone}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyToClipboard(ref.telefone, 'Telefone')}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Dados Bancários */}
                  {fichaCliente.dadosBancarios?.banco && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center">
                          <CreditCard className="mr-2 h-4 w-4" />
                          Dados Bancários
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <Label className="text-muted-foreground">Banco</Label>
                          <p className="font-medium">{fichaCliente.dadosBancarios.banco}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Agência</Label>
                          <p className="font-medium">{fichaCliente.dadosBancarios.agencia}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Conta</Label>
                          <p className="font-medium">{fichaCliente.dadosBancarios.conta}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Tipo</Label>
                          <p className="font-medium">{fichaCliente.dadosBancarios.tipoConta}</p>
                        </div>
                        {fichaCliente.dadosBancarios.pix && (
                          <div className="col-span-2">
                            <Label className="text-muted-foreground">Chave PIX</Label>
                            <p className="font-medium flex items-center gap-2">
                              {fichaCliente.dadosBancarios.pix}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(fichaCliente.dadosBancarios.pix, 'PIX')}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Resumo Financeiro */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center">
                        <DollarSign className="mr-2 h-4 w-4" />
                        Resumo Financeiro
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600">
                            {new Intl.NumberFormat('pt-BR', { 
                              style: 'currency', 
                              currency: 'BRL' 
                            }).format(fichaCliente.resumoFinanceiro.valorTotalPago)}
                          </p>
                          <p className="text-sm text-muted-foreground">Total Pago</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-red-600">
                            {new Intl.NumberFormat('pt-BR', { 
                              style: 'currency', 
                              currency: 'BRL' 
                            }).format(fichaCliente.resumoFinanceiro.valorTotalVencido)}
                          </p>
                          <p className="text-sm text-muted-foreground">Total Vencido</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-yellow-600">
                            {new Intl.NumberFormat('pt-BR', { 
                              style: 'currency', 
                              currency: 'BRL' 
                            }).format(fichaCliente.resumoFinanceiro.valorTotalPendente)}
                          </p>
                          <p className="text-sm text-muted-foreground">Total Pendente</p>
                        </div>
                      </div>
                      
                      <div className="mt-4 grid grid-cols-3 gap-4">
                        <div className="text-center p-2 bg-muted rounded">
                          <p className="text-lg font-semibold">{fichaCliente.resumoFinanceiro.parcelasPagas}</p>
                          <p className="text-xs text-muted-foreground">Parcelas Pagas</p>
                        </div>
                        <div className="text-center p-2 bg-muted rounded">
                          <p className="text-lg font-semibold">{fichaCliente.resumoFinanceiro.parcelasVencidas}</p>
                          <p className="text-xs text-muted-foreground">Parcelas Vencidas</p>
                        </div>
                        <div className="text-center p-2 bg-muted rounded">
                          <p className="text-lg font-semibold">{fichaCliente.resumoFinanceiro.parcelasPendentes}</p>
                          <p className="text-xs text-muted-foreground">Parcelas Pendentes</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Parcelas com Boletos */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center">
                        <Receipt className="mr-2 h-4 w-4" />
                        Detalhamento de Parcelas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {fichaCliente.parcelas?.map((parcela) => (
                          <div 
                            key={parcela.id} 
                            className={`p-3 rounded border ${
                              parcela.vencida ? 'border-red-300 bg-red-50' : 
                              parcela.status === 'pago' ? 'border-green-300 bg-green-50' : 
                              'border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">
                                  Parcela {parcela.numeroParcela} - {' '}
                                  {new Intl.NumberFormat('pt-BR', { 
                                    style: 'currency', 
                                    currency: 'BRL' 
                                  }).format(Number(parcela.valorParcela))}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Vencimento: {format(parseISO(parcela.dataVencimento), 'dd/MM/yyyy')}
                                  {parcela.diasAtraso > 0 && (
                                    <span className="text-red-600 font-semibold ml-2">
                                      ({parcela.diasAtraso} dias de atraso)
                                    </span>
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {parcela.interPixCopiaECola && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => copyToClipboard(parcela.interPixCopiaECola!, 'PIX')}
                                  >
                                    <QrCode className="mr-2 h-3 w-3" />
                                    PIX
                                  </Button>
                                )}
                                {parcela.interLinhaDigitavel && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => copyToClipboard(parcela.interLinhaDigitavel!, 'Linha Digitável')}
                                  >
                                    <Barcode className="mr-2 h-3 w-3" />
                                    Boleto
                                  </Button>
                                )}
                                <Badge className={getInterBankStatusColor(parcela.interSituacao || parcela.status)}>
                                  {getInterBankStatusLabel(parcela.interSituacao, parcela.status, parcela.vencida)}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Sistema de Observações */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center">
                        <History className="mr-2 h-4 w-4" />
                        Histórico de Observações
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Adicionar Nova Observação */}
                      <div className="space-y-3 p-3 border rounded bg-muted/30">
                        <Textarea
                          placeholder="Digite uma observação sobre o contato..."
                          value={novaObservacao}
                          onChange={(e) => setNovaObservacao(e.target.value)}
                          className="min-h-[80px]"
                          data-testid="textarea-observacao"
                        />
                        
                        <div className="grid grid-cols-3 gap-2">
                          <Select value={tipoContato} onValueChange={setTipoContato}>
                            <SelectTrigger data-testid="select-tipo-contato">
                              <SelectValue placeholder="Tipo de Contato" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="telefone">Telefone</SelectItem>
                              <SelectItem value="whatsapp">WhatsApp</SelectItem>
                              <SelectItem value="sms">SMS</SelectItem>
                              <SelectItem value="email">E-mail</SelectItem>
                              <SelectItem value="presencial">Presencial</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          <Select value={statusPromessa} onValueChange={setStatusPromessa}>
                            <SelectTrigger data-testid="select-status-promessa">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="promessa_pagamento">Promessa de Pagamento</SelectItem>
                              <SelectItem value="recusa">Recusa</SelectItem>
                              <SelectItem value="sem_contato">Sem Contato</SelectItem>
                              <SelectItem value="negociacao">Em Negociação</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          <Input
                            type="date"
                            value={dataPromessaPagamento}
                            onChange={(e) => setDataPromessaPagamento(e.target.value)}
                            placeholder="Data Promessa"
                            data-testid="input-data-promessa"
                          />
                        </div>
                        
                        <Button
                          onClick={() => {
                            if (novaObservacao.trim()) {
                              adicionarObservacaoMutation.mutate({
                                observacao: novaObservacao,
                                tipoContato,
                                statusPromessa,
                                dataPromessaPagamento: dataPromessaPagamento || null
                              });
                            }
                          }}
                          disabled={!novaObservacao.trim() || adicionarObservacaoMutation.isPending}
                          className="w-full"
                          data-testid="button-adicionar-observacao"
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Adicionar Observação
                        </Button>
                      </div>
                      
                      {/* Lista de Observações */}
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {fichaCliente.observacoes?.length === 0 ? (
                          <p className="text-center text-muted-foreground py-4">
                            Nenhuma observação registrada
                          </p>
                        ) : (
                          fichaCliente.observacoes?.map((obs) => (
                            <div key={obs.id} className="p-3 border rounded bg-background">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{obs.userName}</span>
                                  {obs.tipoContato && (
                                    <Badge variant="outline" className="text-xs">
                                      {obs.tipoContato}
                                    </Badge>
                                  )}
                                  {obs.statusPromessa && (
                                    <Badge variant="secondary" className="text-xs">
                                      {obs.statusPromessa.replace('_', ' ')}
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {format(parseISO(obs.createdAt), "dd/MM/yyyy HH:mm")}
                                </span>
                              </div>
                              <p className="text-sm">{obs.observacao}</p>
                              {obs.dataPromessaPagamento && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Promessa para: {format(parseISO(obs.dataPromessaPagamento), "dd/MM/yyyy")}
                                </p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            ) : (
              <div className="p-8 text-center">Erro ao carregar ficha</div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowFichaModal(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}