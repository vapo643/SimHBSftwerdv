import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getSupabase } from "@/lib/supabase";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Percent,
  CheckSquare,
  Loader2,
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

interface Observacao {
  id: string;
  mensagem: string;
  tipo_acao: string;
  criado_por: string;
  created_at: string;
  dados_acao?: any;
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

  // Estados para Desconto de Quitação (multi-etapas)
  const [etapaDesconto, setEtapaDesconto] = useState(1);
  const [debtInfo, setDebtInfo] = useState<any>(null);
  const [novoValorQuitacao, setNovoValorQuitacao] = useState(0);
  const [quantidadeParcelas, setQuantidadeParcelas] = useState(1);
  const [novasParcelas, setNovasParcelas] = useState<
    Array<{ valor: number; dataVencimento: string }>
  >([]);

  // Estados para Prorrogar Vencimento (seleção múltipla)
  const [boletosParaProrrogar, setBoletosParaProrrogar] = useState<string[]>([]);
  const [todosBoletosAtivos, setTodosBoletosAtivos] = useState<any[]>([]);

  // Estados para Histórico de Observações
  const [observacoes, setObservacoes] = useState<Observacao[]>([]);
  const [loadingObservacoes, setLoadingObservacoes] = useState(false);
  const [salvandoObservacao, setSalvandoObservacao] = useState(false);
  const [statusObservacao, setStatusObservacao] = useState("Outros");

  // Verificar se o usuário tem role de cobrança
  const isCobrancaUser = user?.role === "COBRANÇA";
  const isAdmin = user?.role === "ADMINISTRADOR";

  // Buscar informações de dívida para desconto de quitação
  const {
    data: debtData,
    isLoading: loadingDebt,
    refetch: refetchDebt,
  } = useQuery({
    queryKey: ["/api/inter/collections/proposal", selectedPropostaId],
    enabled: !!selectedPropostaId && showDescontoModal,
    queryFn: async () => {
      return apiRequest(`/api/inter/collections/proposal/${selectedPropostaId}`);
    },
  });

  // Mutation para prorrogar vencimento em lote
  const prorrogarMutation = useMutation({
    mutationFn: async (data: { codigosSolicitacao: string[]; novaDataVencimento: string }) => {
      return apiRequest("/api/inter/collections/batch-extend", {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: result => {
      toast({
        title: "Sucesso",
        description: result.message || "Vencimento(s) prorrogado(s) com sucesso",
      });
      setShowProrrogarModal(false);
      setBoletosParaProrrogar([]);
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao prorrogar vencimento",
        variant: "destructive",
      });
    },
  });

  // Mutation para aplicar desconto de quitação
  const descontoQuitacaoMutation = useMutation({
    mutationFn: async (data: {
      propostaId: string;
      desconto: number;
      novasParcelas: Array<{ valor: number; dataVencimento: string }>;
    }) => {
      return apiRequest("/api/inter/collections/settlement-discount", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: result => {
      toast({
        title: "Sucesso",
        description: result.message || "Desconto de quitação aplicado com sucesso",
      });
      setShowDescontoModal(false);
      setEtapaDesconto(1);
      setNovasParcelas([]);
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao aplicar desconto de quitação",
        variant: "destructive",
      });
    },
  });

  // Buscar propostas de cobrança
  const {
    data: propostas,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/cobrancas", statusFilter, atrasoFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "todos") params.append("status", statusFilter);
      if (atrasoFilter !== "todos") params.append("atraso", atrasoFilter);

      return apiRequest(`/api/cobrancas?${params.toString()}`);
    },
  });

  // Função para atualizar sem precisar recarregar a página
  const handleRefresh = () => {
    console.log("[COBRANÇAS] Atualizando dados da API do Banco Inter...");
    refetch();
  };

  // Buscar KPIs
  const { data: kpis } = useQuery({
    queryKey: ["/api/cobrancas/kpis"],
    queryFn: () => apiRequest("/api/cobrancas/kpis"),
  });

  // 🔄 REALTIME: Escutar mudanças nas tabelas propostas e inter_collections
  useEffect(() => {
    console.log("🔄 [REALTIME] Configurando escuta para atualizações de cobranças");
    
    const supabase = getSupabase();
    const channel = supabase
      .channel('cobrancas-realtime-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'propostas'
        },
        (payload) => {
          console.log("📡 [REALTIME] Evento de UPDATE recebido em propostas:", payload);
          
          // Invalidar as queries para forçar um refetch
          queryClient.invalidateQueries({ queryKey: ['/api/cobrancas'] });
          queryClient.invalidateQueries({ queryKey: ['/api/cobrancas/kpis'] });
          
          // Mostrar notificação suave
          toast({
            title: "Atualização recebida",
            description: "A tabela de cobranças foi atualizada automaticamente",
            duration: 2000,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*', // Escutar todos os eventos (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'inter_collections'
        },
        (payload) => {
          console.log("📡 [REALTIME] Evento recebido em inter_collections:", payload);
          
          // Invalidar as queries para forçar um refetch
          queryClient.invalidateQueries({ queryKey: ['/api/cobrancas'] });
          queryClient.invalidateQueries({ queryKey: ['/api/cobrancas/kpis'] });
          
          // Se foi um pagamento (UPDATE com situacao = RECEBIDO)
          if (payload.eventType === 'UPDATE' && payload.new?.situacao === 'RECEBIDO') {
            toast({
              title: "✅ Pagamento recebido",
              description: `Boleto ${payload.new?.seuNumero || ''} foi pago`,
              duration: 3000,
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log("✅ [REALTIME] Conectado ao canal de atualizações de cobranças");
        } else if (status === 'CHANNEL_ERROR') {
          console.error("❌ [REALTIME] Erro ao conectar ao canal");
        } else if (status === 'TIMED_OUT') {
          console.error("⏱️ [REALTIME] Timeout ao conectar");
        } else if (status === 'CLOSED') {
          console.log("🔌 [REALTIME] Canal fechado");
        }
      });

    // Cleanup ao desmontar o componente
    return () => {
      console.log("🧹 [REALTIME] Removendo canal de escuta de cobranças");
      supabase.removeChannel(channel);
    };
  }, [queryClient, toast]);

  // Buscar ficha do cliente
  const { data: fichaCliente, isLoading: loadingFicha } = useQuery<FichaCliente>({
    queryKey: ["/api/cobrancas/ficha", selectedPropostaId],
    queryFn: () => apiRequest(`/api/cobrancas/${selectedPropostaId}/ficha`),
    enabled: !!selectedPropostaId && showFichaModal,
  });

  // As observações agora vêm diretamente da ficha do cliente

  // Função para salvar nova observação
  const handleSalvarObservacao = async () => {
    if (!selectedPropostaId || !novaObservacao.trim() || !statusObservacao) return;

    setSalvandoObservacao(true);
    try {
      await apiRequest(`/api/propostas/${selectedPropostaId}/observacoes`, {
        method: "POST",
        body: JSON.stringify({
          mensagem: novaObservacao,
          tipo_acao: statusObservacao,
        }),
      });

      // Limpar formulário
      setNovaObservacao("");

      // Recarregar ficha para atualizar observações
      queryClient.invalidateQueries({ queryKey: ["/api/cobrancas/ficha", selectedPropostaId] });

      toast({
        title: "Sucesso",
        description: "Observação salva com sucesso",
      });
    } catch (error) {
      console.error("Erro ao salvar observação:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a observação",
        variant: "destructive",
      });
    } finally {
      setSalvandoObservacao(false);
    }
  };

  // Mutation para adicionar observação
  const adicionarObservacaoMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest(`/api/cobrancas/${selectedPropostaId}/observacao`, {
        method: "POST",
        body: JSON.stringify(data),
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
      queryClient.invalidateQueries({ queryKey: ["/api/cobrancas/ficha"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a observação.",
        variant: "destructive",
      });
    },
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
    if (!doc) return "";
    if (!showCpf) {
      if (doc.length === 11) {
        // CPF
        return `${doc.substring(0, 3)}.***.***-${doc.substring(9)}`;
      } else if (doc.length === 14) {
        // CNPJ
        return `${doc.substring(0, 2)}.****.****/****-${doc.substring(12)}`;
      }
    }
    return doc;
  };

  // Função para exportar inadimplentes
  const exportarInadimplentes = async () => {
    try {
      const data = await apiRequest("/api/cobrancas/exportar/inadimplentes");

      // Criar CSV manualmente
      const headers = Object.keys(data.inadimplentes[0] || {});
      const csv = [
        headers.join(","),
        ...data.inadimplentes.map((row: any) =>
          headers.map(header => `"${row[header] || ""}"`).join(",")
        ),
      ].join("\n");

      // Download do CSV
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `inadimplentes_${format(new Date(), "yyyy-MM-dd")}.csv`;
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
      case "em_dia":
        return "bg-green-100 text-green-800";
      case "inadimplente":
        return "bg-red-100 text-red-800";
      case "quitado":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getParcelaStatusColor = (status: string) => {
    switch (status) {
      case "pago":
        return "bg-green-100 text-green-800";
      case "vencido":
        return "bg-red-100 text-red-800";
      case "pendente":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Função para mapear status do Inter Bank para cores
  const getInterBankStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case "RECEBIDO":
      case "MARCADO_RECEBIDO":
        return "bg-green-100 text-green-800";
      case "CANCELADO":
      case "EXPIRADO":
      case "FALHA_EMISSAO":
        return "bg-gray-100 text-gray-800";
      case "ATRASADO":
      case "PROTESTO":
        return "bg-red-100 text-red-800";
      case "A_RECEBER":
      case "EM_PROCESSAMENTO":
      case "EMITIDO":
        return "bg-blue-100 text-blue-800";
      case "pago":
        return "bg-green-100 text-green-800";
      case "vencido":
        return "bg-red-100 text-red-800";
      case "pendente":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Função para mapear status do Inter Bank para texto de exibição
  const getInterBankStatusLabel = (
    interSituacao?: string,
    localStatus?: string,
    vencida?: boolean
  ) => {
    // Priorizar status do Inter Bank se disponível
    if (interSituacao) {
      switch (interSituacao.toUpperCase()) {
        case "RECEBIDO":
        case "MARCADO_RECEBIDO":
          return "Pago";
        case "CANCELADO":
        case "EXPIRADO":
        case "FALHA_EMISSAO":
          return "Cancelado";
        case "ATRASADO":
        case "PROTESTO":
          return "Vencido";
        case "A_RECEBER":
        case "EM_PROCESSAMENTO":
        case "EMITIDO":
          return "Pendente";
        default:
          return interSituacao;
      }
    }

    // Fallback para status local
    if (localStatus === "pago") return "Pago";
    if (vencida) return "Vencido";
    return "Pendente";
  };

  // Função para calcular o Status de Vencimento inteligente
  const getStatusVencimento = (proposta: any) => {
    // Se tem situação do Inter Bank, verificar status especiais
    if (proposta.interSituacao) {
      const situacao = proposta.interSituacao.toUpperCase();
      if (situacao === "RECEBIDO" || situacao === "MARCADO_RECEBIDO") {
        return { text: "Pago", color: "text-green-600" };
      }
      if (situacao === "CANCELADO" || situacao === "EXPIRADO" || situacao === "FALHA_EMISSAO") {
        return { text: "Cancelado", color: "text-gray-600" };
      }
    }

    // Se o status local indica pago
    if (proposta.status === "quitado" || proposta.status === "pago") {
      return { text: "Pago", color: "text-green-600" };
    }

    // Calcular baseado na data de vencimento
    const hoje = new Date();
    const dataVencimento = proposta.dataProximoVencimento
      ? parseISO(proposta.dataProximoVencimento)
      : null;

    if (!dataVencimento) {
      return { text: "Sem vencimento", color: "text-gray-500" };
    }

    // Se já venceu
    if (proposta.diasAtraso > 0) {
      return {
        text: `Vencido há ${proposta.diasAtraso} dias`,
        color: "text-red-600 font-semibold",
      };
    }

    // Se vence hoje
    if (isToday(dataVencimento)) {
      return { text: "Vence hoje", color: "text-orange-600 font-semibold" };
    }

    // Se vence nos próximos 7 dias
    const diasParaVencer = differenceInDays(dataVencimento, hoje);
    if (diasParaVencer > 0 && diasParaVencer <= 7) {
      return { text: `Vence em ${diasParaVencer} dias`, color: "text-yellow-600" };
    }

    // Para todos os outros casos, mostrar a data de vencimento
    if (isFuture(dataVencimento)) {
      return { text: format(dataVencimento, "dd/MM/yyyy"), color: "text-gray-600" };
    }

    return { text: "Em dia", color: "text-green-600" };
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
                    Você está visualizando apenas contratos: <strong>inadimplentes</strong>,{" "}
                    <strong>em atraso</strong> ou que <strong>vencem nos próximos 3 dias</strong>.
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
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
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
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
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
                  console.log("[COBRANÇAS] Atualizando dados da API do Banco Inter...");
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
                  onChange={e => setSearchTerm(e.target.value)}
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
                        className={proposta.diasAtraso > 30 ? "bg-red-50" : ""}
                      >
                        <TableCell className="font-medium">{proposta.numeroContrato}</TableCell>
                        <TableCell>{proposta.nomeCliente}</TableCell>
                        <TableCell>{maskDocument(proposta.cpfCliente)}</TableCell>
                        <TableCell>{proposta.telefoneCliente}</TableCell>
                        <TableCell>
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(proposta.valorTotal)}
                        </TableCell>
                        <TableCell>
                          {proposta.parcelasPagas}/{proposta.quantidadeParcelas}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const statusInfo = getStatusVencimento(proposta);
                            return <span className={statusInfo.color}>{statusInfo.text}</span>;
                          })()}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(proposta.status)}>
                            {proposta.status === "em_dia"
                              ? "Em Dia"
                              : proposta.status === "inadimplente"
                                ? "Inadimplente"
                                : "Quitado"}
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

                            {/* Botão de Download do Boleto */}
                            {proposta.interCodigoSolicitacao && (
                              <a
                                href={`/api/inter/collections/${proposta.interCodigoSolicitacao}/pdf`}
                                download
                                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                data-testid={`button-download-boleto-${proposta.id}`}
                                title="Baixar boleto em PDF"
                              >
                                <Download className="mr-1.5 h-3.5 w-3.5" />
                                Boleto
                              </a>
                            )}

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
                                          description:
                                            "Apenas administradores podem prorrogar vencimentos",
                                          variant: "destructive",
                                        });
                                        return;
                                      }
                                      const canModify = [
                                        "A_RECEBER",
                                        "ATRASADO",
                                        "EM_PROCESSAMENTO",
                                      ].includes(proposta.interSituacao?.toUpperCase() || "");
                                      if (!canModify) {
                                        toast({
                                          title: "Ação não permitida",
                                          description: "Este boleto não pode ser modificado",
                                          variant: "destructive",
                                        });
                                        return;
                                      }
                                      setSelectedBoleto(proposta);
                                      setSelectedPropostaId(proposta.id);
                                      // Buscar boletos ativos da proposta
                                      apiRequest(
                                        `/api/inter/collections/proposal/${proposta.id}`
                                      ).then(data => {
                                        setTodosBoletosAtivos(data.boletosAtivos || []);
                                      });
                                      setShowProrrogarModal(true);
                                    }}
                                    disabled={
                                      !isAdmin ||
                                      ["PAGO", "CANCELADO", "RECEBIDO"].includes(
                                        proposta.interSituacao?.toUpperCase() || ""
                                      )
                                    }
                                  >
                                    <CalendarPlus className="mr-2 h-4 w-4" />
                                    Prorrogar Vencimento
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    onClick={() => {
                                      if (!isAdmin) {
                                        toast({
                                          title: "Acesso Negado",
                                          description:
                                            "Apenas administradores podem aplicar descontos",
                                          variant: "destructive",
                                        });
                                        return;
                                      }
                                      const canModify = [
                                        "A_RECEBER",
                                        "ATRASADO",
                                        "EM_PROCESSAMENTO",
                                      ].includes(proposta.interSituacao?.toUpperCase() || "");
                                      if (!canModify) {
                                        toast({
                                          title: "Ação não permitida",
                                          description: "Este boleto não pode ser modificado",
                                          variant: "destructive",
                                        });
                                        return;
                                      }
                                      setSelectedBoleto(proposta);
                                      setSelectedPropostaId(proposta.id);
                                      // Buscar informações de dívida
                                      apiRequest(
                                        `/api/inter/collections/proposal/${proposta.id}`
                                      ).then(data => {
                                        setDebtInfo(data);
                                        setNovoValorQuitacao(data.valorRestante * 0.5); // Sugerir 50% de desconto inicial
                                      });
                                      setShowDescontoModal(true);
                                    }}
                                    disabled={
                                      !isAdmin ||
                                      ["PAGO", "CANCELADO", "RECEBIDO"].includes(
                                        proposta.interSituacao?.toUpperCase() || ""
                                      )
                                    }
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

        {/* Modal - Prorrogar Vencimento (Seleção Múltipla) */}
        <Dialog
          open={showProrrogarModal}
          onOpenChange={open => {
            setShowProrrogarModal(open);
            if (!open) {
              setBoletosParaProrrogar([]);
              setNovaDataVencimento("");
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Prorrogar Vencimento de Boletos</DialogTitle>
              <DialogDescription>
                Selecione os boletos e escolha a nova data de vencimento
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Lista de boletos para seleção */}
              <div className="space-y-2">
                <Label>Boletos Disponíveis</Label>
                <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border p-2">
                  {todosBoletosAtivos.length > 0 ? (
                    todosBoletosAtivos.map(boleto => (
                      <div
                        key={boleto.codigoSolicitacao}
                        className="flex cursor-pointer items-center space-x-3 rounded-lg p-2 hover:bg-muted"
                        onClick={() => {
                          if (boletosParaProrrogar.includes(boleto.codigoSolicitacao)) {
                            setBoletosParaProrrogar(prev =>
                              prev.filter(c => c !== boleto.codigoSolicitacao)
                            );
                          } else {
                            setBoletosParaProrrogar(prev => [...prev, boleto.codigoSolicitacao]);
                          }
                        }}
                      >
                        <div className="flex h-5 w-5 items-center justify-center">
                          {boletosParaProrrogar.includes(boleto.codigoSolicitacao) ? (
                            <CheckSquare className="h-5 w-5 text-primary" />
                          ) : (
                            <div className="h-5 w-5 rounded border-2 border-gray-300" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            Parcela {boleto.numeroParcela} -{" "}
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(boleto.valor)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Vencimento atual:{" "}
                            {new Date(boleto.dataVencimento).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="p-4 text-center text-sm text-muted-foreground">
                      Carregando boletos ativos...
                    </p>
                  )}
                </div>
              </div>

              {/* Campo de nova data */}
              <div className="space-y-2">
                <Label htmlFor="nova-data">Nova Data de Vencimento</Label>
                <Input
                  id="nova-data"
                  type="date"
                  value={novaDataVencimento}
                  onChange={e => setNovaDataVencimento(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>

              {/* Resumo da seleção */}
              {boletosParaProrrogar.length > 0 && (
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-sm font-medium">
                    {boletosParaProrrogar.length} boleto(s) selecionado(s)
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowProrrogarModal(false);
                  setBoletosParaProrrogar([]);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (boletosParaProrrogar.length === 0) {
                    toast({
                      title: "Erro",
                      description: "Selecione pelo menos um boleto",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (!novaDataVencimento) {
                    toast({
                      title: "Erro",
                      description: "Selecione uma nova data de vencimento",
                      variant: "destructive",
                    });
                    return;
                  }
                  prorrogarMutation.mutate({
                    codigosSolicitacao: boletosParaProrrogar,
                    novaDataVencimento,
                  });
                }}
                disabled={prorrogarMutation.isPending || boletosParaProrrogar.length === 0}
              >
                {prorrogarMutation.isPending
                  ? "Processando..."
                  : `Prorrogar ${boletosParaProrrogar.length} Boleto(s)`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal - Aplicar Desconto de Quitação (Multi-etapas) */}
        <Dialog
          open={showDescontoModal}
          onOpenChange={open => {
            setShowDescontoModal(open);
            if (!open) {
              setEtapaDesconto(1);
              setDebtInfo(null);
              setNovasParcelas([]);
            }
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Desconto para Quitação - Etapa {etapaDesconto} de 3</DialogTitle>
              <DialogDescription>
                {etapaDesconto === 1 && "Análise da dívida atual"}
                {etapaDesconto === 2 && "Configurar novo valor e parcelamento"}
                {etapaDesconto === 3 && "Confirmar operação"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Etapa 1: Análise da Dívida */}
              {etapaDesconto === 1 && (
                <div className="space-y-4">
                  {loadingDebt || !debtInfo ? (
                    <div className="flex items-center justify-center p-8">
                      <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 rounded-lg bg-muted p-4">
                        <h3 className="text-lg font-semibold">Resumo da Dívida</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Valor Total Financiado</p>
                            <p className="text-lg font-bold">
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format(debtInfo.valorTotal)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Valor Já Pago</p>
                            <p className="text-lg font-bold text-green-600">
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format(debtInfo.valorPago)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Valor Restante</p>
                            <p className="text-lg font-bold text-orange-600">
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format(debtInfo.valorRestante)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Boletos Ativos</p>
                            <p className="text-lg font-bold">{debtInfo.totalBoletosAtivos}</p>
                          </div>
                        </div>
                      </div>

                      {debtInfo.boletosAtivos?.length > 0 && (
                        <div className="rounded-lg border p-4">
                          <h4 className="mb-2 font-medium">Boletos Ativos</h4>
                          <div className="max-h-40 space-y-2 overflow-y-auto">
                            {debtInfo.boletosAtivos.map((b: any, idx: number) => (
                              <div
                                key={idx}
                                className="flex justify-between rounded bg-muted p-2 text-sm"
                              >
                                <span>Parcela {b.numeroParcela}</span>
                                <span>
                                  {new Intl.NumberFormat("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  }).format(b.valor)}
                                </span>
                                <span>
                                  Venc: {new Date(b.dataVencimento).toLocaleDateString("pt-BR")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Etapa 2: Configurar Novo Valor */}
              {etapaDesconto === 2 && debtInfo && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="novo-valor">Novo Valor para Quitação (R$)</Label>
                    <Input
                      id="novo-valor"
                      type="number"
                      step="0.01"
                      value={novoValorQuitacao}
                      onChange={e => {
                        const valor = parseFloat(e.target.value);
                        setNovoValorQuitacao(valor);
                        // Recalcular parcelas
                        if (valor > 0 && quantidadeParcelas > 0) {
                          const valorParcela = valor / quantidadeParcelas;
                          const parcelas = [];
                          for (let i = 0; i < quantidadeParcelas; i++) {
                            const dataVenc = new Date();
                            dataVenc.setMonth(dataVenc.getMonth() + i + 1);
                            parcelas.push({
                              valor: valorParcela,
                              dataVencimento: dataVenc.toISOString().split("T")[0],
                            });
                          }
                          setNovasParcelas(parcelas);
                        }
                      }}
                      placeholder="0.00"
                      max={debtInfo.valorRestante}
                    />
                    <p className="text-xs text-muted-foreground">
                      Máximo:{" "}
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(debtInfo.valorRestante)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="parcelas">Quantidade de Parcelas</Label>
                    <Select
                      value={quantidadeParcelas.toString()}
                      onValueChange={value => {
                        const qtd = parseInt(value);
                        setQuantidadeParcelas(qtd);
                        // Recalcular parcelas
                        if (novoValorQuitacao > 0) {
                          const valorParcela = novoValorQuitacao / qtd;
                          const parcelas = [];
                          for (let i = 0; i < qtd; i++) {
                            const dataVenc = new Date();
                            dataVenc.setMonth(dataVenc.getMonth() + i + 1);
                            parcelas.push({
                              valor: valorParcela,
                              dataVencimento: dataVenc.toISOString().split("T")[0],
                            });
                          }
                          setNovasParcelas(parcelas);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 12, 24].map(n => (
                          <SelectItem key={n} value={n.toString()}>
                            {n} {n === 1 ? "parcela" : "parcelas"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {novoValorQuitacao > 0 && (
                    <div className="rounded-lg bg-green-50 p-3">
                      <p className="text-sm font-medium text-green-800">
                        Desconto aplicado:{" "}
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(debtInfo.valorRestante - novoValorQuitacao)}
                      </p>
                      <p className="text-xs text-green-600">
                        ({((1 - novoValorQuitacao / debtInfo.valorRestante) * 100).toFixed(1)}% de
                        desconto)
                      </p>
                    </div>
                  )}

                  {novasParcelas.length > 0 && (
                    <div className="rounded-lg border p-3">
                      <h4 className="mb-2 font-medium">Novas Parcelas</h4>
                      <div className="max-h-40 space-y-1 overflow-y-auto">
                        {novasParcelas.map((p, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>Parcela {idx + 1}</span>
                            <span>
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format(p.valor)}
                            </span>
                            <span>{new Date(p.dataVencimento).toLocaleDateString("pt-BR")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Etapa 3: Confirmação */}
              {etapaDesconto === 3 && debtInfo && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
                      <div className="flex-1">
                        <h4 className="font-medium text-amber-900">Atenção!</h4>
                        <p className="mt-1 text-sm text-amber-700">Esta operação irá:</p>
                        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-700">
                          <li>Cancelar {debtInfo.totalBoletosAtivos} boleto(s) ativo(s)</li>
                          <li>Criar {quantidadeParcelas} novo(s) boleto(s)</li>
                          <li>
                            Aplicar desconto de{" "}
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(debtInfo.valorRestante - novoValorQuitacao)}
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg bg-muted p-4">
                    <h4 className="font-semibold">Resumo Final</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Dívida Anterior</p>
                        <p className="font-medium">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(debtInfo.valorRestante)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Novo Valor</p>
                        <p className="font-medium text-green-600">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(novoValorQuitacao)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Desconto Total</p>
                        <p className="font-medium">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(debtInfo.valorRestante - novoValorQuitacao)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Nova Quantidade de Parcelas</p>
                        <p className="font-medium">{quantidadeParcelas}x</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              {etapaDesconto > 1 && (
                <Button variant="outline" onClick={() => setEtapaDesconto(etapaDesconto - 1)}>
                  Voltar
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setShowDescontoModal(false);
                  setEtapaDesconto(1);
                }}
              >
                Cancelar
              </Button>
              {etapaDesconto < 3 ? (
                <Button
                  onClick={() => {
                    if (etapaDesconto === 1 && debtInfo) {
                      setEtapaDesconto(2);
                    } else if (
                      etapaDesconto === 2 &&
                      novoValorQuitacao > 0 &&
                      novasParcelas.length > 0
                    ) {
                      setEtapaDesconto(3);
                    } else {
                      toast({
                        title: "Erro",
                        description: "Configure todos os campos necessários",
                        variant: "destructive",
                      });
                    }
                  }}
                  disabled={
                    (etapaDesconto === 1 && !debtInfo) ||
                    (etapaDesconto === 2 && (!novoValorQuitacao || novasParcelas.length === 0))
                  }
                >
                  Próximo
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    descontoQuitacaoMutation.mutate({
                      propostaId: selectedPropostaId,
                      desconto: debtInfo.valorRestante - novoValorQuitacao,
                      novasParcelas,
                    });
                  }}
                  disabled={descontoQuitacaoMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {descontoQuitacaoMutation.isPending ? "Processando..." : "Confirmar Quitação"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal - Ficha do Cliente */}
        <Dialog open={showFichaModal} onOpenChange={setShowFichaModal}>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
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
                      <CardTitle className="flex items-center text-base">
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
                        <p className="flex items-center gap-2 font-medium">
                          {fichaCliente.cliente.telefone}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              copyToClipboard(fichaCliente.cliente.telefone, "Telefone")
                            }
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
                        <CardTitle className="flex items-center text-base">
                          <UserCheck className="mr-2 h-4 w-4" />
                          Referências Pessoais
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {fichaCliente.referencias.map((ref, index) => (
                            <div
                              key={ref.id}
                              className="bg-muted/50 flex items-center justify-between rounded p-2"
                            >
                              <div>
                                <p className="font-medium">{ref.nomeCompleto}</p>
                                <p className="text-sm text-muted-foreground">
                                  {ref.grauParentesco}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{ref.telefone}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyToClipboard(ref.telefone, "Telefone")}
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
                        <CardTitle className="flex items-center text-base">
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
                            <p className="flex items-center gap-2 font-medium">
                              {fichaCliente.dadosBancarios.pix}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  copyToClipboard(fichaCliente.dadosBancarios.pix, "PIX")
                                }
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
                      <CardTitle className="flex items-center text-base">
                        <DollarSign className="mr-2 h-4 w-4" />
                        Resumo Financeiro
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600">
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(fichaCliente.resumoFinanceiro.valorTotalPago)}
                          </p>
                          <p className="text-sm text-muted-foreground">Total Pago</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-red-600">
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(fichaCliente.resumoFinanceiro.valorTotalVencido)}
                          </p>
                          <p className="text-sm text-muted-foreground">Total Vencido</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-yellow-600">
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(fichaCliente.resumoFinanceiro.valorTotalPendente)}
                          </p>
                          <p className="text-sm text-muted-foreground">Total Pendente</p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-4">
                        <div className="rounded bg-muted p-2 text-center">
                          <p className="text-lg font-semibold">
                            {fichaCliente.resumoFinanceiro.parcelasPagas}
                          </p>
                          <p className="text-xs text-muted-foreground">Parcelas Pagas</p>
                        </div>
                        <div className="rounded bg-muted p-2 text-center">
                          <p className="text-lg font-semibold">
                            {fichaCliente.resumoFinanceiro.parcelasVencidas}
                          </p>
                          <p className="text-xs text-muted-foreground">Parcelas Vencidas</p>
                        </div>
                        <div className="rounded bg-muted p-2 text-center">
                          <p className="text-lg font-semibold">
                            {fichaCliente.resumoFinanceiro.parcelasPendentes}
                          </p>
                          <p className="text-xs text-muted-foreground">Parcelas Pendentes</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Histórico de Observações */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center text-base">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Histórico de Observações
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Formulário para adicionar nova observação */}
                        <div className="border-b pb-4">
                          <div className="space-y-3">
                            <div>
                              <Label htmlFor="observacao-text">Nova Observação</Label>
                              <Textarea
                                id="observacao-text"
                                placeholder="Digite sua observação sobre este cliente ou proposta..."
                                value={novaObservacao}
                                onChange={e => setNovaObservacao(e.target.value)}
                                className="min-h-[80px]"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Select value={statusObservacao} onValueChange={setStatusObservacao}>
                                <SelectTrigger className="w-[250px]">
                                  <SelectValue placeholder="Selecione o status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Contato Realizado">
                                    Contato Realizado
                                  </SelectItem>
                                  <SelectItem value="Negociação em Andamento">
                                    Negociação em Andamento
                                  </SelectItem>
                                  <SelectItem value="Acordo Fechado">Acordo Fechado</SelectItem>
                                  <SelectItem value="Monitoramento">Monitoramento</SelectItem>
                                  <SelectItem value="Outros">Outros</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                onClick={handleSalvarObservacao}
                                disabled={
                                  !novaObservacao.trim() || !statusObservacao || salvandoObservacao
                                }
                              >
                                {salvandoObservacao ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Salvando...
                                  </>
                                ) : (
                                  "Salvar Observação"
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Lista de observações existentes */}
                        {loadingFicha ? (
                          <div className="py-4 text-center">
                            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                            <p className="mt-2 text-sm text-muted-foreground">
                              Carregando histórico...
                            </p>
                          </div>
                        ) : !fichaCliente.observacoes || fichaCliente.observacoes.length === 0 ? (
                          <div className="py-4 text-center text-muted-foreground">
                            Nenhuma observação registrada ainda.
                          </div>
                        ) : (
                          <ScrollArea className="h-[300px]">
                            <div className="space-y-3 pr-4">
                              {fichaCliente.observacoes.map(obs => (
                                <div key={obs.id} className="space-y-2 rounded-lg border p-3">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <Badge
                                          variant={
                                            obs.tipoContato === "Acordo Fechado"
                                              ? "default"
                                              : obs.tipoContato === "Contato Realizado"
                                                ? "secondary"
                                                : obs.tipoContato === "Negociação em Andamento"
                                                  ? "outline"
                                                  : "secondary"
                                          }
                                        >
                                          {obs.tipoContato}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                          {format(new Date(obs.createdAt), "dd/MM/yyyy 'às' HH:mm")}
                                        </span>
                                      </div>
                                      <p className="mt-2 text-sm">{obs.observacao}</p>
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        Por: {obs.userName}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Parcelas com Boletos */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center text-base">
                        <Receipt className="mr-2 h-4 w-4" />
                        Detalhamento de Parcelas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {fichaCliente.parcelas?.map(parcela => (
                          <div
                            key={parcela.id}
                            className={`rounded border p-3 ${
                              parcela.vencida
                                ? "border-red-300 bg-red-50"
                                : parcela.status === "pago"
                                  ? "border-green-300 bg-green-50"
                                  : "border-gray-200"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">
                                  Parcela {parcela.numeroParcela} -{" "}
                                  {new Intl.NumberFormat("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  }).format(Number(parcela.valorParcela))}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Vencimento:{" "}
                                  {format(parseISO(parcela.dataVencimento), "dd/MM/yyyy")}
                                  {parcela.diasAtraso > 0 && (
                                    <span className="ml-2 font-semibold text-red-600">
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
                                    onClick={() =>
                                      copyToClipboard(parcela.interPixCopiaECola!, "PIX")
                                    }
                                  >
                                    <QrCode className="mr-2 h-3 w-3" />
                                    PIX
                                  </Button>
                                )}
                                {parcela.interLinhaDigitavel && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      copyToClipboard(
                                        parcela.interLinhaDigitavel!,
                                        "Linha Digitável"
                                      )
                                    }
                                  >
                                    <Barcode className="mr-2 h-3 w-3" />
                                    Boleto
                                  </Button>
                                )}
                                {/* Botão de Download do PDF do Boleto */}
                                {parcela.interCodigoSolicitacao && (
                                  <a
                                    href={`/api/inter/collections/${parcela.interCodigoSolicitacao}/pdf`}
                                    download
                                    className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                    data-testid={`button-download-pdf-${parcela.id}`}
                                    title="Baixar PDF do boleto"
                                  >
                                    <Download className="mr-1.5 h-3 w-3" />
                                    PDF
                                  </a>
                                )}
                                <Badge
                                  className={getInterBankStatusColor(
                                    parcela.interSituacao || parcela.status
                                  )}
                                >
                                  {getInterBankStatusLabel(
                                    parcela.interSituacao,
                                    parcela.status,
                                    parcela.vencida
                                  )}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
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
