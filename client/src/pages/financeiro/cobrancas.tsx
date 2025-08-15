import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  CalendarPlus,
  Percent,
  CheckSquare,
  XCircle,
  Bell,
} from "lucide-react";
import {
  format,
  addMonths,
  differenceInDays,
  isAfter,
  startOfWeek,
  startOfMonth,
  isBefore,
  addDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";

interface Parcela {
  id: string;
  numero: number;
  valorParcela: number;
  dataVencimento: string;
  dataPagamento?: string;
  codigoBoleto?: string;
  linhaDigitavel?: string;
  codigoBarras?: string;
  status: "pago" | "pendente" | "vencido";
  diasAtraso?: number;
  // Inter Bank fields
  interCodigoSolicitacao?: string;
  interPixCopiaECola?: string;
  interQrCode?: string;
  interCodigoBarras?: string;
  interSituacao?: string;
  interLinkPdf?: string;
}

interface PropostaCobranca {
  id: string;
  numeroContrato: string;
  nomeCliente: string;
  cpfCliente: string;
  telefoneCliente: string;
  emailCliente: string;
  enderecoCliente?: string;
  cepCliente?: string;
  valorTotal: number;
  valorFinanciado: number;
  quantidadeParcelas: number;
  parcelasPagas: number;
  parcelasPendentes: number;
  parcelasVencidas: number;
  valorTotalPago: number;
  valorTotalPendente: number;
  diasAtraso: number;
  status: "em_dia" | "inadimplente" | "quitado";
  dataContrato: string;
  ccbAssinada: boolean;
  parcelas: Parcela[];
  documentos: {
    ccb?: string;
    comprovantes?: string[];
  };
  // PAM V1.0 - Campos do Banco Inter
  interCodigoSolicitacao?: string;
  interSituacao?: string;
  interDataVencimento?: string;
}

export default function Cobrancas() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const userRole = user?.role || "";
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [selectedProposta, setSelectedProposta] = useState<PropostaCobranca | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactType, setContactType] = useState<"whatsapp" | "sms" | "email">("whatsapp");
  const [dateRange, setDateRange] = useState<"todos" | "hoje" | "semana" | "mes">("todos");
  const [showCpf, setShowCpf] = useState(false);
  const [showBoletosModal, setShowBoletosModal] = useState(false);
  const [selectedPropostaForBoletos, setSelectedPropostaForBoletos] =
    useState<PropostaCobranca | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Estados para modais de ação PAM V1.0
  const [showProrrogarModal, setShowProrrogarModal] = useState(false);
  const [showDescontoModal, setShowDescontoModal] = useState(false);
  const [selectedBoleto, setSelectedBoleto] = useState<{ codigoSolicitacao: string; valorNominal: number } | null>(null);
  const [novaDataVencimento, setNovaDataVencimento] = useState("");
  const [tipoDesconto, setTipoDesconto] = useState<"PERCENTUAL" | "FIXO">("PERCENTUAL");
  const [valorDesconto, setValorDesconto] = useState("");
  const [dataLimiteDesconto, setDataLimiteDesconto] = useState("");
  
  // PAM V1.0 Blueprint V2.0 - Estados para observações
  const [observacaoProrrogacao, setObservacaoProrrogacao] = useState("");
  const [observacaoDesconto, setObservacaoDesconto] = useState("");
  
  // PAM V1.0 Blueprint V2.0 - Estados para supervisor
  const [showSolicitacoesModal, setShowSolicitacoesModal] = useState(false);
  const [selectedSolicitacao, setSelectedSolicitacao] = useState<any>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");
  const [observacaoSupervisor, setObservacaoSupervisor] = useState("");

  // Função para copiar PIX ou linha digitável
  const copyPaymentCode = (code: string, type: "pix" | "barcode") => {
    navigator.clipboard.writeText(code);
    toast({
      title: type === "pix" ? "PIX copiado!" : "Linha digitável copiada!",
      description:
        type === "pix"
          ? "Cole no app do seu banco para pagar"
          : "Use no internet banking para pagar",
    });
  };

  // Função para mascarar CPF/CNPJ (LGPD)
  const maskDocument = (doc: string) => {
    if (!doc) return "";
    if (!showCpf) {
      // Mascara mantendo apenas os primeiros 3 e últimos 2 dígitos
      if (doc.length === 11) {
        // CPF
        return `${doc.substring(0, 3)}.***.***-${doc.substring(9)}`;
      } else if (doc.length === 14) {
        // CNPJ
        return `${doc.substring(0, 2)}.****.****/****-${doc.substring(12)}`;
      }
    }
    // Formata o documento completo
    if (doc.length === 11) {
      // CPF
      return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    } else if (doc.length === 14) {
      // CNPJ
      return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    return doc;
  };

  // PAM V1.0 Blueprint V2.0 - Mutation para SOLICITAR prorrogação
  const prorrogarMutation = useMutation({
    mutationFn: async ({ 
      codigoSolicitacao, 
      novaDataVencimento,
      observacao 
    }: { 
      codigoSolicitacao: string; 
      novaDataVencimento: string;
      observacao?: string;
    }) => {
      console.log('[PAM V1.0 Blueprint V2.0] Solicitando prorrogação:', { codigoSolicitacao, novaDataVencimento, observacao });
      return apiRequest(`/api/cobrancas/boletos/${codigoSolicitacao}/solicitar-prorrogacao`, {
        method: "POST",
        body: JSON.stringify({ novaDataVencimento, observacao }),
      });
    },
    onSuccess: (data: any) => {
      console.log('[PAM V1.0 Blueprint V2.0] Solicitação de prorrogação enviada:', data);
      const isAutoApproved = data.autoApproved;
      toast({
        title: isAutoApproved ? "Prorrogação executada" : "Solicitação enviada",
        description: isAutoApproved 
          ? "O vencimento foi prorrogado com sucesso."
          : "Sua solicitação foi enviada para aprovação do supervisor.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cobrancas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cobrancas/solicitacoes"] });
      setShowProrrogarModal(false);
      setSelectedBoleto(null);
      setNovaDataVencimento("");
      setObservacaoProrrogacao("");
    },
    onError: (error: any) => {
      console.error('[PAM V1.0 Blueprint V2.0] Erro ao solicitar prorrogação:', error);
      toast({
        title: "Erro ao solicitar prorrogação",
        description: error.response?.data?.message || "Não foi possível enviar a solicitação.",
        variant: "destructive",
      });
    },
  });

  // PAM V1.0 Blueprint V2.0 - Mutation para SOLICITAR desconto
  const descontoMutation = useMutation({
    mutationFn: async ({ 
      codigoSolicitacao, 
      tipoDesconto, 
      valorDesconto,
      dataLimiteDesconto,
      observacao 
    }: { 
      codigoSolicitacao: string; 
      tipoDesconto: "PERCENTUAL" | "FIXO";
      valorDesconto: number;
      dataLimiteDesconto?: string;
      observacao?: string;
    }) => {
      console.log('[PAM V1.0 Blueprint V2.0] Solicitando desconto:', { codigoSolicitacao, tipoDesconto, valorDesconto, dataLimiteDesconto, observacao });
      return apiRequest(`/api/cobrancas/boletos/${codigoSolicitacao}/solicitar-desconto`, {
        method: "POST",
        body: JSON.stringify({ tipoDesconto, valorDesconto, dataLimiteDesconto, observacao }),
      });
    },
    onSuccess: (data: any) => {
      console.log('[PAM V1.0 Blueprint V2.0] Solicitação de desconto enviada:', data);
      const isAutoApproved = data.autoApproved;
      toast({
        title: isAutoApproved ? "Desconto aplicado" : "Solicitação enviada",
        description: isAutoApproved 
          ? `Desconto de ${tipoDesconto === "PERCENTUAL" ? `${valorDesconto}%` : `R$ ${valorDesconto}`} aplicado com sucesso.`
          : "Sua solicitação foi enviada para aprovação do supervisor.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cobrancas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cobrancas/solicitacoes"] });
      setShowDescontoModal(false);
      setSelectedBoleto(null);
      setValorDesconto("");
      setDataLimiteDesconto("");
      setObservacaoDesconto("");
    },
    onError: (error: any) => {
      console.error('[PAM V1.0 Blueprint V2.0] Erro ao solicitar desconto:', error);
      toast({
        title: "Erro ao solicitar desconto",
        description: error.response?.data?.message || "Não foi possível enviar a solicitação.",
        variant: "destructive",
      });
    },
  });

  // PAM V1.0 Blueprint V2.0 - Query para buscar solicitações pendentes (supervisor)
  const { data: solicitacoesPendentes, refetch: refetchSolicitacoes } = useQuery({
    queryKey: ["/api/cobrancas/solicitacoes"],
    enabled: ["ADMINISTRADOR", "SUPERVISOR_COBRANCA"].includes(userRole),
    queryFn: async () => {
      const response = await apiRequest("/api/cobrancas/solicitacoes?status=pendente", {
        method: "GET",
      }) as any[];
      return response;
    },
  });

  // PAM V1.0 Blueprint V2.0 - Mutation para aprovar solicitação
  const aprovarSolicitacaoMutation = useMutation({
    mutationFn: async ({ 
      id, 
      observacao 
    }: { 
      id: number; 
      observacao?: string;
    }) => {
      return apiRequest(`/api/cobrancas/solicitacoes/${id}/aprovar`, {
        method: "POST",
        body: JSON.stringify({ observacao }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Solicitação aprovada",
        description: "A solicitação foi aprovada e executada com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cobrancas/solicitacoes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cobrancas"] });
      setShowSolicitacoesModal(false);
      setSelectedSolicitacao(null);
      setObservacaoSupervisor("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao aprovar",
        description: error.response?.data?.message || "Não foi possível aprovar a solicitação.",
        variant: "destructive",
      });
    },
  });

  // PAM V1.0 Blueprint V2.0 - Mutation para rejeitar solicitação
  const rejeitarSolicitacaoMutation = useMutation({
    mutationFn: async ({ 
      id, 
      motivo,
      observacao 
    }: { 
      id: number; 
      motivo: string;
      observacao?: string;
    }) => {
      return apiRequest(`/api/cobrancas/solicitacoes/${id}/rejeitar`, {
        method: "POST",
        body: JSON.stringify({ motivo, observacao }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Solicitação rejeitada",
        description: "A solicitação foi rejeitada.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cobrancas/solicitacoes"] });
      setShowSolicitacoesModal(false);
      setSelectedSolicitacao(null);
      setMotivoRejeicao("");
      setObservacaoSupervisor("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao rejeitar",
        description: error.response?.data?.message || "Não foi possível rejeitar a solicitação.",
        variant: "destructive",
      });
    },
  });

  // Buscar propostas em cobrança
  const {
    data: propostas,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/cobrancas"],
    queryFn: async () => {
      // 🔧 PAM V1.0 - INSTRUMENTAÇÃO FRONTEND PONTO 1
      console.log('[DEBUG-FRONTEND-1] Chamando API de cobranças...');
      
      const response = await apiRequest("/api/cobrancas", {
        method: "GET",
      }) as PropostaCobranca[];
      
      return response;
    },
  });

  // 🔧 PAM V1.0 - INSTRUMENTAÇÃO FRONTEND PONTO 2
  React.useEffect(() => {
    if (propostas) {
      console.log('[DEBUG-FRONTEND-2] Dados BRUTOS recebidos da API:', {
        totalRecebidos: propostas?.length || 0,
        primeiroItem: propostas?.[0] || null,
        todosDados: propostas
      });
    }
  }, [propostas]);

  // Buscar sumário do Inter Bank
  const { data: sumarioInter, refetch: refetchSumario } = useQuery({
    queryKey: ["/api/cobrancas/inter-sumario"],
    enabled: !!propostas,
    refetchInterval: 30000, // Atualiza a cada 30 segundos
    queryFn: async () => {
      const response = await apiRequest("/api/cobrancas/inter-sumario", {
        method: "GET",
      }) as any;
      return response;
    },
  });

  // Função para atualizar status do boleto individual
  const atualizarStatusBoleto = async (codigoSolicitacao: string) => {
    try {
      const response = await apiRequest(`/api/cobrancas/inter-status/${codigoSolicitacao}`, {
        method: "GET",
      });
      return response;
    } catch (error) {
      console.error("Erro ao buscar status do boleto:", error);
      return null;
    }
  };

  // Atualizar todos os status do Inter Bank
  const atualizarTodosStatus = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    let totalAtualizados = 0;
    let totalErros = 0;

    toast({
      title: "Sincronizando com Banco Inter...",
      description: "Buscando status real de todos os boletos",
    });

    try {
      // Sincronizar todas as propostas
      if (propostas && propostas.length > 0) {
        for (const proposta of propostas) {
          try {
            const response = await apiRequest("/api/cobrancas/inter-sync-all", {
              method: "POST",
              body: JSON.stringify({ propostaId: proposta.id }),
            }) as any;

            if (response.atualizados) {
              totalAtualizados += response.atualizados;
            }
            if (response.erros) {
              totalErros += response.erros;
            }
          } catch (error) {
            console.error(`Erro ao sincronizar proposta ${proposta.id}:`, error);
            totalErros++;
          }
        }
      }

      // Recarregar dados
      await refetch();
      await refetchSumario();

      toast({
        title: "Sincronização concluída",
        description:
          totalErros > 0
            ? `${totalAtualizados} boletos atualizados, ${totalErros} erros`
            : `${totalAtualizados} boletos sincronizados com sucesso`,
        variant: totalErros > 0 ? "default" : undefined,
      });
    } catch (error) {
      toast({
        title: "Erro ao sincronizar",
        description: "Falha ao conectar com o Banco Inter",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Atualizar status das parcelas via API do Banco Inter
  const atualizarStatusParcelas = async (propostaId: string) => {
    try {
      await apiRequest(`/api/cobrancas/${propostaId}/atualizar-status`, {
        method: "POST",
      });
      toast({
        title: "Status atualizado",
        description: "O status das parcelas foi atualizado com sucesso.",
      });
      refetch();
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar o status das parcelas.",
        variant: "destructive",
      });
    }
  };

  // Gerar mensagem padrão para contato
  const gerarMensagemContato = (proposta: PropostaCobranca, parcela?: Parcela) => {
    const parcelasVencidas = proposta.parcelas.filter(p => p.status === "vencido");
    const valorTotalVencido = parcelasVencidas.reduce((acc, p) => acc + p.valorParcela, 0);

    if (parcela) {
      return `Olá ${proposta.nomeCliente}!\n\nEste é um lembrete sobre a parcela ${parcela.numero} do seu contrato ${proposta.numeroContrato}.\n\nValor: R$ ${parcela.valorParcela.toFixed(2)}\nVencimento: ${format(new Date(parcela.dataVencimento), "dd/MM/yyyy")}\n${parcela.status === "vencido" ? `Dias em atraso: ${parcela.diasAtraso}\n` : ""}\n${parcela.linhaDigitavel ? `Linha digitável: ${parcela.linhaDigitavel}\n` : ""}\nPara sua comodidade, você também pode pagar via PIX usando a chave: contato@simpix.com.br\n\nCaso já tenha efetuado o pagamento, favor desconsiderar esta mensagem.\n\nQualquer dúvida, estamos à disposição!\n\nAtenciosamente,\nEquipe Simpix`;
    } else {
      return `Olá ${proposta.nomeCliente}!\n\nIdentificamos pendências em seu contrato ${proposta.numeroContrato}.\n\nParcelas vencidas: ${parcelasVencidas.length}\nValor total em atraso: R$ ${valorTotalVencido.toFixed(2)}\n\nPara regularizar sua situação, entre em contato conosco ou acesse sua área do cliente.\n\nEstamos à disposição para negociar as melhores condições de pagamento.\n\nAtenciosamente,\nEquipe Simpix`;
    }
  };

  // Enviar mensagem de contato
  const enviarContato = async (proposta: PropostaCobranca, tipo: string, mensagem: string) => {
    try {
      await apiRequest("/api/cobrancas/contato", {
        method: "POST",
        body: JSON.stringify({
          propostaId: proposta.id,
          tipo,
          destinatario:
            tipo === "whatsapp" || tipo === "sms"
              ? proposta.telefoneCliente
              : proposta.emailCliente,
          mensagem,
        }),
      });
      toast({
        title: "Contato enviado",
        description: `Mensagem enviada com sucesso via ${tipo}.`,
      });
      setShowContactModal(false);
    } catch (error) {
      toast({
        title: "Erro ao enviar",
        description: "Não foi possível enviar a mensagem.",
        variant: "destructive",
      });
    }
  };

  // Filtrar propostas
  // 🔧 PAM V1.0 - INSTRUMENTAÇÃO FRONTEND PONTO 3
  console.log('[DEBUG-FRONTEND-3] Dados ANTES do filtro local:', {
    totalPropostas: propostas?.length || 0,
    dadosOriginais: propostas,
    filtrosAtivos: { searchTerm, statusFilter, dateRange }
  });

  const propostasFiltradas = propostas?.filter(proposta => {
    // 🔍 AUDITORIA: Verificar se o campo nomeCliente existe antes de filtrar
    const nomeCliente = proposta.nomeCliente || "";
    const numeroContrato = proposta.numeroContrato || "";
    const cpfCliente = proposta.cpfCliente || "";
    const id = proposta.id || "";

    console.log('🔍 [AUDITORIA FRONTEND] CAMPOS DA PROPOSTA:', {
      id: proposta.id,
      nomeCliente: proposta.nomeCliente,
      cpfCliente: proposta.cpfCliente,
      status: proposta.status,
      camposVazios: {
        nomeVazio: !proposta.nomeCliente,
        cpfVazio: !proposta.cpfCliente,
        contratoVazio: !proposta.numeroContrato
      }
    });

    const matchesSearch =
      nomeCliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      numeroContrato.includes(searchTerm) ||
      cpfCliente.includes(searchTerm) ||
      id.includes(searchTerm);

    let matchesStatus = true;
    if (statusFilter === "adimplente") {
      matchesStatus = proposta.status === "em_dia";
    } else if (statusFilter === "atraso_1_15") {
      matchesStatus =
        proposta.status === "inadimplente" && proposta.diasAtraso >= 1 && proposta.diasAtraso <= 15;
    } else if (statusFilter === "atraso_30_mais") {
      matchesStatus = proposta.status === "inadimplente" && proposta.diasAtraso > 30;
    } else if (statusFilter !== "todos") {
      matchesStatus = proposta.status === statusFilter;
    }

    let matchesDate = true;
    if (dateRange !== "todos") {
      const hoje = new Date();
      const dataContrato = new Date(proposta.dataContrato);

      if (dateRange === "hoje") {
        matchesDate = format(dataContrato, "yyyy-MM-dd") === format(hoje, "yyyy-MM-dd");
      } else if (dateRange === "semana") {
        const inicioSemana = startOfWeek(hoje, { weekStartsOn: 1 });
        matchesDate = isAfter(dataContrato, inicioSemana);
      } else if (dateRange === "mes") {
        const inicioMes = startOfMonth(hoje);
        matchesDate = isAfter(dataContrato, inicioMes);
      }
    }

    const passaFiltro = matchesSearch && matchesStatus && matchesDate;
    console.log('🔍 [AUDITORIA FRONTEND] FILTRO RESULTADO:', {
      propostaId: proposta.id,
      matchesSearch,
      matchesStatus,
      matchesDate,
      passaFiltro
    });

    return passaFiltro;
  });

  // 🔧 PAM V1.0 - INSTRUMENTAÇÃO FRONTEND PONTO 4
  console.log('[DEBUG-FRONTEND-4] Dados DEPOIS do filtro local:', {
    totalOriginal: propostas?.length || 0,
    totalFiltrado: propostasFiltradas?.length || 0,
    dadosFiltrados: propostasFiltradas,
    primeiroDadoFiltrado: propostasFiltradas?.[0] || null
  });

  // Estatísticas gerais
  const estatisticas = {
    totalContratos: propostas?.length || 0,
    contratosEmDia: propostas?.filter(p => p.status === "em_dia").length || 0,
    contratosInadimplentes: propostas?.filter(p => p.status === "inadimplente").length || 0,
    contratosQuitados: propostas?.filter(p => p.status === "quitado").length || 0,
    valorTotalCarteira: propostas?.reduce((acc, p) => acc + p.valorTotal, 0) || 0,
    valorTotalRecebido: propostas?.reduce((acc, p) => acc + p.valorTotalPago, 0) || 0,
    valorTotalPendente: propostas?.reduce((acc, p) => acc + p.valorTotalPendente, 0) || 0,
  };

  const taxaInadimplencia =
    estatisticas.totalContratos > 0
      ? ((estatisticas.contratosInadimplentes / estatisticas.totalContratos) * 100).toFixed(1)
      : "0";

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

  return (
    <DashboardLayout title="Cobranças">
      <div className="space-y-6">
        {/* PAM V1.0 Blueprint V2.0 - Badge para supervisores */}
        {["ADMINISTRADOR", "SUPERVISOR_COBRANCA"].includes(userRole) && solicitacoesPendentes && solicitacoesPendentes.length > 0 && (
          <Card className="mb-4 border-orange-500 bg-orange-50 dark:bg-orange-900/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-orange-600" />
                  <CardTitle className="text-lg">Aprovações Pendentes</CardTitle>
                </div>
                <Badge variant="default" className="bg-orange-600">
                  {solicitacoesPendentes.length} {solicitacoesPendentes.length === 1 ? "solicitação" : "solicitações"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setShowSolicitacoesModal(true)} className="w-full">
                <CheckSquare className="mr-2 h-4 w-4" />
                Revisar Solicitações
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Estatísticas */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Contratos</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{estatisticas.totalContratos}</div>
              <div className="text-xs text-muted-foreground">
                {estatisticas.contratosEmDia} em dia
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Inadimplência</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{taxaInadimplencia}%</div>
              <div className="text-xs text-muted-foreground">
                {estatisticas.contratosInadimplentes} contratos
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Valor Total Recebido</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(estatisticas.valorTotalRecebido)}
              </div>
              <Progress
                value={(estatisticas.valorTotalRecebido / estatisticas.valorTotalCarteira) * 100}
                className="mt-2"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Valor Pendente</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(estatisticas.valorTotalPendente)}
              </div>
              <div className="text-xs text-muted-foreground">A receber</div>
            </CardContent>
          </Card>
        </div>

        {/* Sumário do Banco Inter */}
        {sumarioInter && (
          <Card className="border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Resumo Financeiro - Banco Inter</CardTitle>
                <CardDescription>Últimos 30 dias - Atualizado em tempo real</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={atualizarTodosStatus}
                disabled={isRefreshing}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing ? "Atualizando..." : "Atualizar Status"}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <div className="text-sm text-muted-foreground">Total Recebido</div>
                  <div className="text-xl font-bold text-green-600">
                    R${" "}
                    {(sumarioInter.recebidos?.valor || 0).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {sumarioInter.recebidos?.quantidade || 0} boletos pagos
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">A Receber</div>
                  <div className="text-xl font-bold text-blue-600">
                    R${" "}
                    {(sumarioInter.aReceber?.valor || 0).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {sumarioInter.aReceber?.quantidade || 0} boletos pendentes
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Vencidos</div>
                  <div className="text-xl font-bold text-red-600">
                    R${" "}
                    {(sumarioInter.vencidos?.valor || 0).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {sumarioInter.vencidos?.quantidade || 0} boletos vencidos
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filtros */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Filtros</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={atualizarTodosStatus}
                disabled={isRefreshing}
                className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing ? "Sincronizando..." : "Sincronizar com Banco Inter"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, CPF/CNPJ, número da proposta ou contrato..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCpf(!showCpf)}
                  className="whitespace-nowrap"
                >
                  {showCpf ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                  {showCpf ? "Ocultar CPF" : "Mostrar CPF"}
                </Button>
              </div>
              <div className="flex gap-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Status de Pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="adimplente">Adimplente</SelectItem>
                    <SelectItem value="atraso_1_15">Em Atraso (1-15 dias)</SelectItem>
                    <SelectItem value="atraso_30_mais">Em Atraso (+30 dias)</SelectItem>
                    <SelectItem value="quitado">Quitado</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={dateRange}
                  onValueChange={value =>
                    setDateRange(value as "todos" | "hoje" | "semana" | "mes")
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="hoje">Hoje</SelectItem>
                    <SelectItem value="semana">Esta Semana</SelectItem>
                    <SelectItem value="mes">Este Mês</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Atualizar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Propostas */}
        <Card>
          <CardHeader>
            <CardTitle>Contratos em Cobrança</CardTitle>
            <CardDescription>Gerenciamento completo de cobranças e pagamentos</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">ID/CCB</TableHead>
                    <TableHead>Nome Cliente</TableHead>
                    <TableHead className="w-[140px]">CPF/CNPJ</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Parcelamento</TableHead>
                    <TableHead className="text-center">Status Detalhado</TableHead>
                    <TableHead className="text-center">Dias Atraso</TableHead>
                    <TableHead className="text-center">Próx. Vencimento</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-8 text-center">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : propostasFiltradas?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                        Nenhum contrato encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    propostasFiltradas?.map((proposta, index) => {
                      // 🔧 PAM V1.0 - INSTRUMENTAÇÃO FRONTEND PONTO 5
                      if (index === 0) {
                        console.log('[DEBUG-FRONTEND-5] Dados da primeira proposta a serem renderizados:', proposta);
                      }

                      const parcelasPendentes = proposta.parcelas.filter(
                        p => p.status === "pendente"
                      ).length;
                      const parcelasEmAtraso = proposta.parcelas.filter(
                        p => p.status === "vencido"
                      ).length;
                      const valorPendente = proposta.parcelas
                        .filter(p => p.status === "pendente")
                        .reduce((acc, p) => acc + p.valorParcela, 0);
                      const valorEmAtraso = proposta.parcelas
                        .filter(p => p.status === "vencido")
                        .reduce((acc, p) => acc + p.valorParcela, 0);
                      const proximaParcela = proposta.parcelas
                        .filter(p => p.status === "pendente" || p.status === "vencido")
                        .sort(
                          (a, b) =>
                            new Date(a.dataVencimento).getTime() -
                            new Date(b.dataVencimento).getTime()
                        )[0];

                      return (
                        <TableRow
                          key={proposta.id}
                          className="hover:bg-muted/50 cursor-pointer"
                          onClick={() => setSelectedProposta(proposta)}
                        >
                          <TableCell className="font-medium">
                            <div className="space-y-1">
                              <div className="text-xs text-muted-foreground">
                                {proposta.id.substring(0, 8)}...
                              </div>
                              <div className="text-sm">{proposta.numeroContrato}</div>
                            </div>
                          </TableCell>
                          <TableCell>{proposta.nomeCliente}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {maskDocument(proposta.cpfCliente)}
                          </TableCell>
                          <TableCell className="text-right">
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(proposta.valorTotal)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={getStatusColor(proposta.status)}>
                              {proposta.status === "em_dia"
                                ? "Em dia"
                                : proposta.status === "inadimplente"
                                  ? "Inadimplente"
                                  : "Quitado"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-medium">
                              {proposta.parcelasPagas} de {proposta.quantidadeParcelas}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-green-600">Pagas:</span>
                                <span className="font-medium">{proposta.parcelasPagas}</span>
                              </div>
                              {parcelasPendentes > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-yellow-600">Pendentes:</span>
                                  <span className="font-medium">
                                    {parcelasPendentes} (
                                    {new Intl.NumberFormat("pt-BR", {
                                      style: "currency",
                                      currency: "BRL",
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 0,
                                    }).format(valorPendente)}
                                    )
                                  </span>
                                </div>
                              )}
                              {parcelasEmAtraso > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-red-600">Em Atraso:</span>
                                  <span className="font-medium">
                                    {parcelasEmAtraso} (
                                    {new Intl.NumberFormat("pt-BR", {
                                      style: "currency",
                                      currency: "BRL",
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 0,
                                    }).format(valorEmAtraso)}
                                    )
                                  </span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {proposta.diasAtraso > 0 ? (
                              <span className="font-semibold text-red-600">
                                {proposta.diasAtraso}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {proximaParcela ? (
                              <div className="space-y-1">
                                <div className="text-sm">
                                  {format(new Date(proximaParcela.dataVencimento), "dd/MM/yyyy")}
                                </div>
                                {proximaParcela.status === "vencido" && (
                                  <Badge variant="destructive" className="text-xs">
                                    Vencido
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={e => {
                                  e.stopPropagation();
                                  setSelectedPropostaForBoletos(proposta);
                                  setShowBoletosModal(true);
                                }}
                                title="Visualizar Boletos Inter"
                              >
                                <Barcode className="h-4 w-4" />
                              </Button>
                              {/* PAM V1.0 - Botões de Ação */}
                              {proposta.interCodigoSolicitacao && proposta.interSituacao === "A_RECEBER" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={e => {
                                      e.stopPropagation();
                                      setSelectedBoleto({ 
                                        codigoSolicitacao: proposta.interCodigoSolicitacao!, 
                                        valorNominal: proposta.valorTotalPendente 
                                      });
                                      setShowProrrogarModal(true);
                                    }}
                                    title={["ADMINISTRADOR", "SUPERVISOR_COBRANCA"].includes(userRole) ? "Prorrogar Vencimento" : "Solicitar Prorrogação"}
                                  >
                                    <CalendarPlus className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={e => {
                                      e.stopPropagation();
                                      setSelectedBoleto({ 
                                        codigoSolicitacao: proposta.interCodigoSolicitacao!, 
                                        valorNominal: proposta.valorTotalPendente 
                                      });
                                      setShowDescontoModal(true);
                                    }}
                                    title={["ADMINISTRADOR", "SUPERVISOR_COBRANCA"].includes(userRole) ? "Aplicar Desconto" : "Solicitar Desconto"}
                                  >
                                    <Percent className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={e => {
                                  e.stopPropagation();
                                  setSelectedProposta(proposta);
                                  setShowContactModal(true);
                                }}
                                title="Registrar Contato"
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                              {proposta.documentos.ccb && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={e => {
                                    e.stopPropagation();
                                    window.open(proposta.documentos.ccb, "_blank");
                                  }}
                                  title="Visualizar CCB Assinada"
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Modal de Detalhes da Proposta */}
        {selectedProposta && !showContactModal && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Detalhes do Contrato</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedProposta(null)}>
                  Fechar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="parcelas">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="parcelas">Parcelas</TabsTrigger>
                  <TabsTrigger value="dados">Dados do Cliente</TabsTrigger>
                  <TabsTrigger value="documentos">Documentos</TabsTrigger>
                </TabsList>

                <TabsContent value="parcelas" className="space-y-4">
                  <div className="grid gap-2">
                    {selectedProposta.parcelas.map(parcela => (
                      <Card key={parcela.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  Parcela {parcela.numero}/{selectedProposta.quantidadeParcelas}
                                </span>
                                <Badge className={getParcelaStatusColor(parcela.status)}>
                                  {parcela.status === "pago"
                                    ? "Pago"
                                    : parcela.status === "vencido"
                                      ? "Vencido"
                                      : "Pendente"}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Vencimento: {format(new Date(parcela.dataVencimento), "dd/MM/yyyy")}
                                {parcela.dataPagamento && (
                                  <span className="ml-2">
                                    | Pago em:{" "}
                                    {format(new Date(parcela.dataPagamento), "dd/MM/yyyy")}
                                  </span>
                                )}
                                {parcela.diasAtraso && parcela.diasAtraso > 0 && (
                                  <span className="ml-2 text-red-600">
                                    | {parcela.diasAtraso} dias de atraso
                                  </span>
                                )}
                              </div>
                              {parcela.linhaDigitavel && (
                                <div className="rounded bg-muted p-2 font-mono text-xs">
                                  {parcela.linhaDigitavel}
                                </div>
                              )}

                              {/* Inter Bank Integration */}
                              {parcela.interCodigoSolicitacao && (
                                <div className="mt-3 rounded-lg border border-orange-700/20 bg-orange-900/10 p-3">
                                  <div className="mb-2 flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-orange-500" />
                                    <span className="text-sm font-medium text-orange-400">
                                      Banco Inter
                                    </span>
                                    {parcela.interSituacao && (
                                      <Badge
                                        variant={
                                          parcela.interSituacao === "VENCIDO"
                                            ? "destructive"
                                            : "secondary"
                                        }
                                        className={
                                          parcela.interSituacao === "RECEBIDO"
                                            ? "bg-green-600 text-white"
                                            : ""
                                        }
                                      >
                                        {parcela.interSituacao}
                                      </Badge>
                                    )}
                                  </div>

                                  <div className="space-y-3">
                                    {/* PIX Copia e Cola - prioridade alta */}
                                    {parcela.interPixCopiaECola && (
                                      <div className="rounded border border-green-700 bg-green-900/20 p-3">
                                        <p className="mb-2 text-xs font-medium text-green-300">
                                          <span className="inline-flex items-center gap-1">
                                            <QrCode className="h-3 w-3" />
                                            PIX Copia e Cola (Pagamento Instantâneo)
                                          </span>
                                        </p>
                                        <div className="flex items-center gap-2 rounded bg-gray-900 p-2">
                                          <code className="flex-1 break-all font-mono text-xs text-green-400">
                                            {parcela.interPixCopiaECola}
                                          </code>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() =>
                                              copyPaymentCode(parcela.interPixCopiaECola!, "pix")
                                            }
                                          >
                                            <Copy className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Linha Digitável */}
                                    {(parcela.linhaDigitavel || parcela.codigoBarras) && (
                                      <div className="rounded border border-gray-700 bg-gray-800 p-3">
                                        <p className="mb-2 text-xs font-medium text-gray-300">
                                          <span className="inline-flex items-center gap-1">
                                            <Barcode className="h-3 w-3" />
                                            Linha Digitável do Boleto
                                          </span>
                                        </p>
                                        <div className="flex items-center gap-2 rounded bg-gray-900 p-2">
                                          <code className="flex-1 break-all font-mono text-xs text-orange-400">
                                            {parcela.linhaDigitavel || parcela.codigoBarras}
                                          </code>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                              const codigo =
                                                parcela.linhaDigitavel ||
                                                parcela.codigoBarras ||
                                                "";
                                              copyPaymentCode(codigo, "barcode");
                                            }}
                                          >
                                            <Copy className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Informação sobre PDF */}
                                    <p className="mt-2 text-center text-xs text-gray-500">
                                      Banco Inter não disponibiliza PDF - Use PIX ou linha digitável
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="space-y-2 text-right">
                              <div className="font-semibold">
                                {new Intl.NumberFormat("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                }).format(parcela.valorParcela)}
                              </div>
                              {parcela.status !== "pago" && (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    const mensagem = gerarMensagemContato(
                                      selectedProposta,
                                      parcela
                                    );
                                    navigator.clipboard.writeText(mensagem);
                                    toast({
                                      title: "Mensagem copiada",
                                      description:
                                        "A mensagem foi copiada para a área de transferência.",
                                    });
                                  }}
                                >
                                  <Send className="mr-1 h-4 w-4" />
                                  Copiar Lembrete
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="dados" className="space-y-4">
                  <div className="grid gap-4">
                    <div>
                      <label className="text-sm font-medium">Nome Completo</label>
                      <p className="text-sm text-muted-foreground">
                        {selectedProposta.nomeCliente}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">CPF</label>
                        <p className="text-sm text-muted-foreground">
                          {selectedProposta.cpfCliente}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Telefone</label>
                        <p className="text-sm text-muted-foreground">
                          {selectedProposta.telefoneCliente || "Não informado"}
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">E-mail</label>
                      <p className="text-sm text-muted-foreground">
                        {selectedProposta.emailCliente || "Não informado"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Endereço</label>
                      <p className="text-sm text-muted-foreground">
                        {selectedProposta.enderecoCliente ? (
                          <>
                            {selectedProposta.enderecoCliente}
                            {selectedProposta.cepCliente && (
                              <span className="block">CEP: {selectedProposta.cepCliente}</span>
                            )}
                          </>
                        ) : (
                          "Não informado"
                        )}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Data do Contrato</label>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(selectedProposta.dataContrato), "dd/MM/yyyy")}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Valor Financiado</label>
                        <p className="text-sm text-muted-foreground">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(selectedProposta.valorFinanciado)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (selectedProposta.telefoneCliente) {
                          window.open(
                            `https://wa.me/55${selectedProposta.telefoneCliente.replace(/\D/g, "")}`,
                            "_blank"
                          );
                        } else {
                          toast({
                            title: "Telefone não disponível",
                            description: "O cliente não possui telefone cadastrado.",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <Phone className="mr-2 h-4 w-4" />
                      WhatsApp
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (selectedProposta.telefoneCliente) {
                          window.open(`tel:${selectedProposta.telefoneCliente}`, "_blank");
                        } else {
                          toast({
                            title: "Telefone não disponível",
                            description: "O cliente não possui telefone cadastrado.",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <Phone className="mr-2 h-4 w-4" />
                      Ligar
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="documentos" className="space-y-4">
                  <div className="space-y-2">
                    {selectedProposta.documentos.ccb && (
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => {
                          window.open(selectedProposta.documentos.ccb, "_blank");
                        }}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        CCB - Cédula de Crédito Bancário
                      </Button>
                    )}
                    {selectedProposta.documentos.comprovantes?.map((comp, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => {
                          window.open(comp, "_blank");
                        }}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Comprovante de Pagamento {idx + 1}
                      </Button>
                    ))}
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => {
                      setLocation(`/credito/analise/${selectedProposta.id}`);
                    }}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Ver Proposta Completa
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Modal de Contato */}
        {showContactModal && selectedProposta && (
          <Card>
            <CardHeader>
              <CardTitle>Enviar Lembrete de Cobrança</CardTitle>
              <CardDescription>Escolha o canal e personalize a mensagem</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Canal de Contato</label>
                <Select value={contactType} onValueChange={(value: any) => setContactType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Mensagem</label>
                <textarea
                  className="min-h-[200px] w-full rounded-md border p-3"
                  defaultValue={gerarMensagemContato(selectedProposta)}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowContactModal(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    const textarea = document.querySelector("textarea");
                    if (textarea) {
                      enviarContato(selectedProposta, contactType, textarea.value);
                    }
                  }}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Enviar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modal de Boletos Inter */}
        <Dialog open={showBoletosModal} onOpenChange={setShowBoletosModal}>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Boletos Banco Inter</DialogTitle>
              <DialogDescription>
                {selectedPropostaForBoletos?.nomeCliente} -{" "}
                {selectedPropostaForBoletos?.numeroContrato}
              </DialogDescription>
            </DialogHeader>

            {selectedPropostaForBoletos && (
              <div className="space-y-4">
                {selectedPropostaForBoletos.parcelas
                  .filter(p => p.status !== "pago")
                  .map((parcela, index) => (
                    <Card key={parcela.id} className="p-4">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">Parcela {parcela.numero}</h4>
                            <p className="text-sm text-muted-foreground">
                              Vencimento: {format(new Date(parcela.dataVencimento), "dd/MM/yyyy")}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format(parcela.valorParcela)}
                            </p>
                            <Badge className={getParcelaStatusColor(parcela.status)}>
                              {parcela.status === "pago"
                                ? "Pago"
                                : parcela.status === "vencido"
                                  ? "Vencido"
                                  : "Pendente"}
                            </Badge>
                          </div>
                        </div>

                        {/* PIX Copia e Cola */}
                        {parcela.interPixCopiaECola && (
                          <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-700 dark:bg-green-900/20">
                            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-green-800 dark:text-green-300">
                              <QrCode className="h-4 w-4" />
                              PIX Copia e Cola
                            </p>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 break-all rounded bg-white p-2 font-mono text-xs dark:bg-gray-900">
                                {parcela.interPixCopiaECola}
                              </code>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyPaymentCode(parcela.interPixCopiaECola!, "pix")}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Linha Digitável */}
                        {(parcela.linhaDigitavel || parcela.codigoBarras) && (
                          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-700 dark:bg-orange-900/20">
                            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-orange-800 dark:text-orange-300">
                              <Barcode className="h-4 w-4" />
                              Linha Digitável do Boleto
                            </p>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 break-all rounded bg-white p-2 font-mono text-xs dark:bg-gray-900">
                                {parcela.linhaDigitavel || parcela.codigoBarras}
                              </code>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const codigo =
                                    parcela.linhaDigitavel || parcela.codigoBarras || "";
                                  copyPaymentCode(codigo, "barcode");
                                }}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Status do Banco Inter */}
                        {parcela.interSituacao && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">Status Inter:</span>
                            <Badge
                              variant={
                                parcela.interSituacao === "RECEBIDO" ? "default" : "secondary"
                              }
                            >
                              {parcela.interSituacao}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}

                <div className="border-t pt-4 text-center text-sm text-muted-foreground">
                  <AlertCircle className="mr-2 inline h-4 w-4" />
                  Banco Inter não disponibiliza download de PDF. Use PIX ou linha digitável para
                  pagamento.
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBoletosModal(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* PAM V1.0 - Modal de Prorrogar Vencimento */}
        <Dialog open={showProrrogarModal} onOpenChange={setShowProrrogarModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Prorrogar Vencimento</DialogTitle>
              <DialogDescription>
                Defina uma nova data de vencimento para o boleto selecionado.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="nova-data">Nova Data de Vencimento</Label>
                <Input
                  id="nova-data"
                  type="date"
                  value={novaDataVencimento}
                  onChange={(e) => setNovaDataVencimento(e.target.value)}
                  min={format(new Date(), "yyyy-MM-dd")}
                />
              </div>
              {!["ADMINISTRADOR", "SUPERVISOR_COBRANCA"].includes(userRole) && (
                <div>
                  <Label htmlFor="observacao-prorrogacao">Observação <span className="text-red-500">*</span></Label>
                  <Textarea
                    id="observacao-prorrogacao"
                    value={observacaoProrrogacao}
                    onChange={(e) => setObservacaoProrrogacao(e.target.value)}
                    placeholder="Informe o motivo da solicitação de prorrogação"
                    rows={3}
                    required
                  />
                </div>
              )}
              {selectedBoleto && (
                <div className="rounded-lg border p-3">
                  <p className="text-sm text-muted-foreground">Código do Boleto:</p>
                  <code className="text-xs">{selectedBoleto.codigoSolicitacao}</code>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowProrrogarModal(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (selectedBoleto && novaDataVencimento) {
                    const needsObservation = !["ADMINISTRADOR", "SUPERVISOR_COBRANCA"].includes(userRole);
                    if (needsObservation && !observacaoProrrogacao.trim()) {
                      toast({
                        title: "Observação obrigatória",
                        description: "Por favor, informe o motivo da solicitação.",
                        variant: "destructive",
                      });
                      return;
                    }
                    prorrogarMutation.mutate({
                      codigoSolicitacao: selectedBoleto.codigoSolicitacao,
                      novaDataVencimento,
                      observacao: observacaoProrrogacao || undefined,
                    });
                  }
                }}
                disabled={!novaDataVencimento || prorrogarMutation.isPending}
              >
                {prorrogarMutation.isPending 
                  ? "Processando..." 
                  : ["ADMINISTRADOR", "SUPERVISOR_COBRANCA"].includes(userRole) 
                    ? "Confirmar Prorrogação" 
                    : "Enviar Solicitação"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* PAM V1.0 Blueprint V2.0 - Modal de Aplicar Desconto */}
        <Dialog open={showDescontoModal} onOpenChange={setShowDescontoModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{["ADMINISTRADOR", "SUPERVISOR_COBRANCA"].includes(userRole) ? "Aplicar Desconto" : "Solicitar Desconto"}</DialogTitle>
              <DialogDescription>
                {["ADMINISTRADOR", "SUPERVISOR_COBRANCA"].includes(userRole) 
                  ? "Configure o desconto a ser aplicado no boleto."
                  : "Configure e solicite a aplicação de desconto ao supervisor."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="tipo-desconto">Tipo de Desconto</Label>
                <Select
                  value={tipoDesconto}
                  onValueChange={(value: "PERCENTUAL" | "FIXO") => setTipoDesconto(value)}
                >
                  <SelectTrigger id="tipo-desconto">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTUAL">Percentual (%)</SelectItem>
                    <SelectItem value="FIXO">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="valor-desconto">
                  {tipoDesconto === "PERCENTUAL" ? "Percentual de Desconto" : "Valor do Desconto"}
                </Label>
                <Input
                  id="valor-desconto"
                  type="number"
                  min="0"
                  max={tipoDesconto === "PERCENTUAL" ? "100" : undefined}
                  step={tipoDesconto === "PERCENTUAL" ? "0.01" : "0.01"}
                  value={valorDesconto}
                  onChange={(e) => setValorDesconto(e.target.value)}
                  placeholder={tipoDesconto === "PERCENTUAL" ? "Ex: 10" : "Ex: 50.00"}
                />
              </div>
              <div>
                <Label htmlFor="data-limite">Data Limite do Desconto (Opcional)</Label>
                <Input
                  id="data-limite"
                  type="date"
                  value={dataLimiteDesconto}
                  onChange={(e) => setDataLimiteDesconto(e.target.value)}
                  min={format(new Date(), "yyyy-MM-dd")}
                />
              </div>
              {!["ADMINISTRADOR", "SUPERVISOR_COBRANCA"].includes(userRole) && (
                <div>
                  <Label htmlFor="observacao-desconto">Observação <span className="text-red-500">*</span></Label>
                  <Textarea
                    id="observacao-desconto"
                    value={observacaoDesconto}
                    onChange={(e) => setObservacaoDesconto(e.target.value)}
                    placeholder="Informe o motivo da solicitação de desconto"
                    rows={3}
                    required
                  />
                </div>
              )}
              {selectedBoleto && valorDesconto && (
                <div className="rounded-lg border bg-muted p-3">
                  <p className="text-sm font-medium">Resumo do Desconto:</p>
                  <p className="text-sm text-muted-foreground">
                    Valor Original: {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(selectedBoleto.valorNominal)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Desconto: {tipoDesconto === "PERCENTUAL" ? `${valorDesconto}%` : new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(Number(valorDesconto))}
                  </p>
                  <p className="text-sm font-medium text-green-600">
                    Valor Final: {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(
                      tipoDesconto === "PERCENTUAL" 
                        ? selectedBoleto.valorNominal * (1 - Number(valorDesconto) / 100)
                        : selectedBoleto.valorNominal - Number(valorDesconto)
                    )}
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDescontoModal(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (selectedBoleto && valorDesconto) {
                    const needsObservation = !["ADMINISTRADOR", "SUPERVISOR_COBRANCA"].includes(userRole);
                    if (needsObservation && !observacaoDesconto.trim()) {
                      toast({
                        title: "Observação obrigatória",
                        description: "Por favor, informe o motivo da solicitação.",
                        variant: "destructive",
                      });
                      return;
                    }
                    descontoMutation.mutate({
                      codigoSolicitacao: selectedBoleto.codigoSolicitacao,
                      tipoDesconto,
                      valorDesconto: Number(valorDesconto),
                      dataLimiteDesconto: dataLimiteDesconto || undefined,
                      observacao: observacaoDesconto || undefined,
                    });
                  }
                }}
                disabled={!valorDesconto || descontoMutation.isPending}
              >
                {descontoMutation.isPending 
                  ? "Processando..." 
                  : ["ADMINISTRADOR", "SUPERVISOR_COBRANCA"].includes(userRole) 
                    ? "Confirmar Desconto" 
                    : "Enviar Solicitação"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* PAM V1.0 Blueprint V2.0 - Modal de Solicitações Pendentes (Supervisor) */}
        {["ADMINISTRADOR", "SUPERVISOR_COBRANCA"].includes(userRole) && (
          <Dialog open={showSolicitacoesModal} onOpenChange={setShowSolicitacoesModal}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Solicitações Pendentes de Aprovação</DialogTitle>
                <DialogDescription>
                  Revise e aprove ou rejeite as solicitações de prorrogação e desconto.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {solicitacoesPendentes && solicitacoesPendentes.length > 0 ? (
                  solicitacoesPendentes.map((solicitacao: any) => (
                    <Card key={solicitacao.id} className="p-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <Badge className={solicitacao.tipo === "PRORROGACAO" ? "bg-blue-500" : "bg-green-500"}>
                              {solicitacao.tipo === "PRORROGACAO" ? "Prorrogação" : "Desconto"}
                            </Badge>
                            <p className="text-sm text-muted-foreground mt-1">
                              Solicitado por: {solicitacao.solicitadoPor}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Data: {format(new Date(solicitacao.dataSolicitacao), "dd/MM/yyyy HH:mm")}
                            </p>
                          </div>
                          <Badge variant="outline">#{solicitacao.id}</Badge>
                        </div>
                        
                        <div className="border-t pt-3">
                          <p className="text-sm font-medium">Detalhes da Solicitação:</p>
                          {solicitacao.tipo === "PRORROGACAO" ? (
                            <div className="text-sm text-muted-foreground">
                              <p>Nova Data: {format(new Date(solicitacao.dadosSolicitacao.novaDataVencimento), "dd/MM/yyyy")}</p>
                              <p>Código do Boleto: {solicitacao.codigoSolicitacao}</p>
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">
                              <p>Tipo: {solicitacao.dadosSolicitacao.tipoDesconto}</p>
                              <p>Valor: {solicitacao.dadosSolicitacao.tipoDesconto === "PERCENTUAL" 
                                ? `${solicitacao.dadosSolicitacao.valorDesconto}%` 
                                : `R$ ${solicitacao.dadosSolicitacao.valorDesconto}`}</p>
                              {solicitacao.dadosSolicitacao.dataLimiteDesconto && (
                                <p>Válido até: {format(new Date(solicitacao.dadosSolicitacao.dataLimiteDesconto), "dd/MM/yyyy")}</p>
                              )}
                              <p>Código do Boleto: {solicitacao.codigoSolicitacao}</p>
                            </div>
                          )}
                        </div>
                        
                        {solicitacao.observacao && (
                          <div className="border-t pt-3">
                            <p className="text-sm font-medium">Observação do Solicitante:</p>
                            <p className="text-sm text-muted-foreground">{solicitacao.observacao}</p>
                          </div>
                        )}
                        
                        {selectedSolicitacao?.id === solicitacao.id ? (
                          <div className="border-t pt-3 space-y-3">
                            <div>
                              <Label htmlFor={`obs-supervisor-${solicitacao.id}`}>Observação do Supervisor (Opcional)</Label>
                              <Textarea
                                id={`obs-supervisor-${solicitacao.id}`}
                                value={observacaoSupervisor}
                                onChange={(e) => setObservacaoSupervisor(e.target.value)}
                                placeholder="Adicione uma observação sobre a decisão"
                                rows={2}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => {
                                  aprovarSolicitacaoMutation.mutate({
                                    id: solicitacao.id,
                                    observacao: observacaoSupervisor || undefined,
                                  });
                                }}
                                disabled={aprovarSolicitacaoMutation.isPending}
                              >
                                <CheckSquare className="mr-2 h-4 w-4" />
                                {aprovarSolicitacaoMutation.isPending ? "Aprovando..." : "Aprovar"}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  const motivo = prompt("Motivo da rejeição:");
                                  if (motivo) {
                                    rejeitarSolicitacaoMutation.mutate({
                                      id: solicitacao.id,
                                      motivo,
                                      observacao: observacaoSupervisor || undefined,
                                    });
                                  }
                                }}
                                disabled={rejeitarSolicitacaoMutation.isPending}
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                {rejeitarSolicitacaoMutation.isPending ? "Rejeitando..." : "Rejeitar"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedSolicitacao(null);
                                  setObservacaoSupervisor("");
                                }}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedSolicitacao(solicitacao)}
                            >
                              Revisar
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                    <p>Nenhuma solicitação pendente</p>
                  </div>
                )}
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowSolicitacoesModal(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
}
