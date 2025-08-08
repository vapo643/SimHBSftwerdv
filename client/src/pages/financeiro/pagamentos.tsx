import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { api } from "@/lib/apiClient";
import { format, isToday, isThisWeek, isThisMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search,
  DollarSign,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  FileText,
  Send,
  Building2,
  Calendar,
  CreditCard,
  Shield,
  UserCheck,
  Banknote,
  History,
  Filter,
  Download,
  RefreshCw,
  ChevronRight,
  PiggyBank,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
} from "lucide-react";
import PaymentReviewModal from "./pagamentos-review";
import MarcarPagoModal from "./marcar-pago-modal";

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
  status:
    | "aguardando_aprovacao"
    | "aprovado"
    | "em_processamento"
    | "pago"
    | "rejeitado"
    | "cancelado";
  dataRequisicao: string;
  dataAprovacao?: string;
  dataPagamento?: string;
  requisitadoPor: {
    id: string;
    nome: string;
    papel: string;
  };
  aprovadoPor?: {
    id: string;
    nome: string;
    papel: string;
  };
  motivoRejeicao?: string;
  observacoes?: string;
  comprovante?: string;
  formaPagamento: "ted" | "pix" | "doc";
  loja: string;
  produto: string;
}

export default function Pagamentos() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [periodoFilter, setPeriodoFilter] = useState("todos");
  const [selectedPagamento, setSelectedPagamento] = useState<Pagamento | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [showSecurityVerificationModal, setShowSecurityVerificationModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedPropostaForReview, setSelectedPropostaForReview] = useState<any>(null);
  const [showMarcarPagoModal, setShowMarcarPagoModal] = useState(false);
  const [selectedPropostaForPago, setSelectedPropostaForPago] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approvalObservation, setApprovalObservation] = useState("");
  const [verificationData, setVerificationData] = useState<any>(null);
  const [paymentPassword, setPaymentPassword] = useState("");
  const [paymentObservation, setPaymentObservation] = useState("");

  // Buscar pagamentos
  const {
    data: pagamentos = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["/api/pagamentos", { status: statusFilter, periodo: periodoFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "todos") params.append("status", statusFilter);
      if (periodoFilter !== "todos") params.append("periodo", periodoFilter);

      console.log("[PAGAMENTOS] Buscando pagamentos com filtros:", { statusFilter, periodoFilter });

      try {
        const response = await apiRequest(`/api/pagamentos?${params.toString()}`, {
          method: "GET",
        });
        console.log("[PAGAMENTOS] Resposta recebida:", response);
        return response as Pagamento[];
      } catch (err) {
        console.error("[PAGAMENTOS] Erro ao buscar:", err);
        throw err;
      }
    },
    retry: 2,
    staleTime: 1000, // 1 segundo
    refetchOnWindowFocus: false,
    enabled: true,
  });

  // Buscar dados de verificação quando modal abrir
  const { data: verificacoes, isLoading: isLoadingVerificacao } = useQuery({
    queryKey: ["/api/pagamentos", selectedPagamento?.id, "verificar-documentos"],
    queryFn: async () => {
      if (!selectedPagamento?.id) return null;
      return await apiRequest(`/api/pagamentos/${selectedPagamento.id}/verificar-documentos`, {
        method: "GET",
      });
    },
    enabled: showSecurityVerificationModal && !!selectedPagamento?.id,
  });

  // Aprovar pagamento
  const aprovarMutation = useMutation({
    mutationFn: async ({ id, observacao }: { id: string; observacao: string }) => {
      return await apiRequest(`/api/pagamentos/${id}/aprovar`, {
        method: "POST",
        body: JSON.stringify({ observacao }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Pagamento aprovado",
        description: "O pagamento foi aprovado e será processado em breve.",
      });
      setShowApprovalModal(false);
      setApprovalObservation("");
      queryClient.invalidateQueries({ queryKey: ["/api/pagamentos"] });
    },
    onError: () => {
      toast({
        title: "Erro ao aprovar",
        description: "Não foi possível aprovar o pagamento.",
        variant: "destructive",
      });
    },
  });

  // Confirmar desembolso com segurança
  const confirmarDesembolsoMutation = useMutation({
    mutationFn: async ({
      id,
      senha,
      observacoes,
    }: {
      id: string;
      senha: string;
      observacoes: string;
    }) => {
      return await apiRequest(`/api/pagamentos/${id}/confirmar-desembolso`, {
        method: "POST",
        body: JSON.stringify({ senha, observacoes }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Desembolso confirmado",
        description: "O pagamento foi realizado com sucesso ao cliente.",
        className: "bg-green-50 border-green-200",
      });
      setShowSecurityVerificationModal(false);
      setPaymentPassword("");
      setPaymentObservation("");
      queryClient.invalidateQueries({ queryKey: ["/api/pagamentos"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao confirmar desembolso",
        description: error.message || "Verifique as validações de segurança.",
        variant: "destructive",
      });
    },
  });

  // Rejeitar pagamento
  const rejeitarMutation = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      return await apiRequest(`/api/pagamentos/${id}/rejeitar`, {
        method: "POST",
        body: JSON.stringify({ motivo }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Pagamento rejeitado",
        description: "O pagamento foi rejeitado com sucesso.",
      });
      setShowRejectionModal(false);
      setRejectionReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/pagamentos"] });
    },
    onError: () => {
      toast({
        title: "Erro ao rejeitar",
        description: "Não foi possível rejeitar o pagamento.",
        variant: "destructive",
      });
    },
  });

  // Filtrar pagamentos
  const pagamentosFiltrados = pagamentos?.filter(pagamento => {
    // Se não há termo de busca, retorna todos
    if (!searchTerm || searchTerm.trim() === "") {
      return true;
    }

    const matchesSearch =
      pagamento.nomeCliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pagamento.numeroContrato.includes(searchTerm) ||
      pagamento.cpfCliente.includes(searchTerm) ||
      pagamento.propostaId.includes(searchTerm);

    return matchesSearch;
  });

  // Debug para ver o que está acontecendo
  console.log("[PAGAMENTOS FRONTEND] Dados recebidos:", pagamentos?.length);
  console.log("[PAGAMENTOS FRONTEND] Termo de busca:", searchTerm);
  console.log("[PAGAMENTOS FRONTEND] Dados filtrados:", pagamentosFiltrados?.length);
  if (pagamentos?.length > 0) {
    console.log("[PAGAMENTOS FRONTEND] Primeiro pagamento:", pagamentos[0]);
  }

  // Estatísticas
  const stats = {
    aguardandoAprovacao: pagamentos?.filter(p => p.status === "aguardando_aprovacao").length || 0,
    aprovados: pagamentos?.filter(p => p.status === "aprovado").length || 0,
    emProcessamento: pagamentos?.filter(p => p.status === "em_processamento").length || 0,
    pagos: pagamentos?.filter(p => p.status === "pago").length || 0,
    rejeitados: pagamentos?.filter(p => p.status === "rejeitado").length || 0,
    valorTotalAguardando:
      pagamentos
        ?.filter(p => p.status === "aguardando_aprovacao")
        .reduce((acc, p) => acc + p.valorLiquido, 0) || 0,
    valorTotalPago:
      pagamentos?.filter(p => p.status === "pago").reduce((acc, p) => acc + p.valorLiquido, 0) || 0,
    valorTotalProcessando:
      pagamentos
        ?.filter(p => p.status === "em_processamento" || p.status === "aprovado")
        .reduce((acc, p) => acc + p.valorLiquido, 0) || 0,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "aguardando_aprovacao":
        return "bg-yellow-100 text-yellow-800";
      case "aprovado":
        return "bg-blue-100 text-blue-800";
      case "em_processamento":
        return "bg-purple-100 text-purple-800";
      case "pronto_pagamento":
        return "bg-indigo-100 text-indigo-800";
      case "pagamento_autorizado":
        return "bg-emerald-100 text-emerald-800";
      case "pago":
        return "bg-green-100 text-green-800";
      case "rejeitado":
        return "bg-red-100 text-red-800";
      case "cancelado":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "aguardando_aprovacao":
        return "Aguardando Aprovação";
      case "aprovado":
        return "Aprovado";
      case "em_processamento":
        return "Em Processamento";
      case "pronto_pagamento":
        return "Pronto para Pagamento";
      case "pagamento_autorizado":
        return "Pagamento Autorizado";
      case "pago":
        return "Pago";
      case "rejeitado":
        return "Rejeitado";
      case "cancelado":
        return "Cancelado";
      default:
        return status;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatCPF = (cpf: string) => {
    if (!cpf) return "";
    const cleaned = cpf.replace(/\D/g, "");
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const formatBankAccount = (conta: any) => {
    return `${conta.banco} | Ag: ${conta.agencia} | Conta: ${conta.conta} (${conta.tipoConta})`;
  };

  const userHasApprovalPermission = () => {
    // In a real app, this would check the user's role/permissions
    // For now, we'll assume certain roles can approve
    return true; // Replace with actual permission check
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Pagamentos">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
            <p className="text-muted-foreground">Carregando pagamentos...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title="Pagamentos">
        <div className="flex min-h-[400px] items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-red-600">Erro ao carregar pagamentos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground">
                Não foi possível carregar os dados de pagamentos. Por favor, tente novamente.
              </p>
              <div className="flex gap-2">
                <Button onClick={() => refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Tentar novamente
                </Button>
                <Button variant="outline" onClick={() => setLocation("/dashboard")}>
                  Voltar ao Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Pagamentos">
      <div className="space-y-6">
        {/* Modal de Revisão e Confirmação de Veracidade */}
        <PaymentReviewModal
          isOpen={showReviewModal}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedPropostaForReview(null);
          }}
          proposta={selectedPropostaForReview}
          onConfirm={() => {
            refetch();
            setShowReviewModal(false);
            setSelectedPropostaForReview(null);
          }}
        />

        {/* Modal de Marcar como Pago */}
        <MarcarPagoModal
          isOpen={showMarcarPagoModal}
          onClose={() => {
            setShowMarcarPagoModal(false);
            setSelectedPropostaForPago(null);
          }}
          proposta={selectedPropostaForPago}
          onConfirm={() => {
            refetch();
            setShowMarcarPagoModal(false);
            setSelectedPropostaForPago(null);
          }}
        />
        {/* KPIs Dashboard */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Aguardando Aprovação</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.aguardandoAprovacao}</div>
              <div className="text-xs text-muted-foreground">
                {formatCurrency(stats.valorTotalAguardando)}
              </div>
              <Progress value={20} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Em Processamento</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.aprovados + stats.emProcessamento}</div>
              <div className="text-xs text-muted-foreground">
                {formatCurrency(stats.valorTotalProcessando)}
              </div>
              <Progress value={50} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pagamentos Realizados</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pagos}</div>
              <div className="text-xs text-muted-foreground">
                {formatCurrency(stats.valorTotalPago)}
              </div>
              <Progress value={100} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Rejeitados</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.rejeitados}</div>
              <div className="text-xs text-muted-foreground">Requerem nova análise</div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, CPF, contrato ou proposta..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="aguardando_aprovacao">Aguardando Aprovação</SelectItem>
                  <SelectItem value="aprovado">Aprovado</SelectItem>
                  <SelectItem value="em_processamento">Em Processamento</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="rejeitado">Rejeitado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
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
          </CardContent>
        </Card>

        {/* Tabela de Pagamentos */}
        <Card>
          <CardHeader>
            <CardTitle>Solicitações de Pagamento</CardTitle>
            <CardDescription>
              Gestão de liberação de crédito para propostas aprovadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Valor Líquido</TableHead>
                    <TableHead>Conta Destino</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Solicitado em</TableHead>
                    <TableHead>Solicitado por</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : pagamentosFiltrados?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center">
                        <div className="space-y-3">
                          <div className="mb-4 flex justify-center">
                            <AlertCircle className="text-muted-foreground/50 h-12 w-12" />
                          </div>
                          <h3 className="text-lg font-medium">Nenhum pagamento disponível</h3>
                          <p className="mx-auto max-w-md text-sm text-muted-foreground">
                            Para que uma proposta apareça aqui, ela precisa ter:
                          </p>
                          <ul className="mx-auto max-w-sm space-y-1 text-left text-sm text-muted-foreground">
                            <li className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              CCB assinada eletronicamente
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              Boletos de cobrança gerados no Inter
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              Status "Pronto para Pagamento"
                            </li>
                          </ul>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetch()}
                            className="mt-4"
                          >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Verificar novamente
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagamentosFiltrados?.map(pagamento => (
                      <TableRow key={pagamento.id} className="hover:bg-muted/50 cursor-pointer">
                        <TableCell className="font-medium">
                          <div className="space-y-1">
                            <div>{pagamento.numeroContrato}</div>
                            <div className="text-xs text-muted-foreground">{pagamento.produto}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div>{pagamento.nomeCliente}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatCPF(pagamento.cpfCliente)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="space-y-1">
                            <div className="font-semibold">
                              {formatCurrency(pagamento.valorLiquido)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Financ.: {formatCurrency(pagamento.valorFinanciado)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm">{pagamento.contaBancaria.titular}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatBankAccount(pagamento.contaBancaria)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={getStatusColor(pagamento.status)}>
                            {getStatusLabel(pagamento.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="space-y-1">
                            <div className="text-sm">
                              {format(new Date(pagamento.dataRequisicao), "dd/MM/yyyy")}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(pagamento.dataRequisicao), "HH:mm")}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm">{pagamento.requisitadoPor.nome}</div>
                            <div className="text-xs text-muted-foreground">
                              {pagamento.requisitadoPor.papel}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedPagamento(pagamento)}
                              title="Ver detalhes"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {(pagamento.status === "em_processamento" ||
                              pagamento.status === "pronto_pagamento") &&
                              userHasApprovalPermission() && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="gap-2"
                                  onClick={() => {
                                    setSelectedPropostaForReview(pagamento);
                                    setShowReviewModal(true);
                                  }}
                                  title="Confirmar Veracidade"
                                >
                                  <ShieldCheck className="h-4 w-4" />
                                  Confirmar Veracidade
                                </Button>
                              )}
                            {pagamento.status === "pagamento_autorizado" &&
                              userHasApprovalPermission() && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="gap-2 bg-green-600 hover:bg-green-700"
                                  onClick={() => {
                                    setSelectedPropostaForPago(pagamento);
                                    setShowMarcarPagoModal(true);
                                  }}
                                  title="Marcar como Pago"
                                >
                                  <Banknote className="h-4 w-4" />
                                  Marcar como Pago
                                </Button>
                              )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Modal de Detalhes */}
        {selectedPagamento && !showApprovalModal && !showRejectionModal && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Detalhes do Pagamento</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPagamento(null)}>
                  Fechar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="geral">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="geral">Informações Gerais</TabsTrigger>
                  <TabsTrigger value="financeiro">Detalhes Financeiros</TabsTrigger>
                  <TabsTrigger value="historico">Histórico</TabsTrigger>
                </TabsList>

                <TabsContent value="geral" className="space-y-4">
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Número do Contrato</Label>
                        <p className="text-sm text-muted-foreground">
                          {selectedPagamento.numeroContrato}
                        </p>
                      </div>
                      <div>
                        <Label>Status</Label>
                        <Badge className={getStatusColor(selectedPagamento.status)}>
                          {getStatusLabel(selectedPagamento.status)}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <Label>Cliente</Label>
                      <p className="text-sm">{selectedPagamento.nomeCliente}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCPF(selectedPagamento.cpfCliente)}
                      </p>
                    </div>

                    <div>
                      <Label>Produto / Loja</Label>
                      <p className="text-sm">{selectedPagamento.produto}</p>
                      <p className="text-sm text-muted-foreground">{selectedPagamento.loja}</p>
                    </div>

                    <div>
                      <Label>Solicitado por</Label>
                      <p className="text-sm">{selectedPagamento.requisitadoPor.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedPagamento.requisitadoPor.papel} -{" "}
                        {format(
                          new Date(selectedPagamento.dataRequisicao),
                          "dd/MM/yyyy 'às' HH:mm"
                        )}
                      </p>
                    </div>

                    {selectedPagamento.aprovadoPor && (
                      <div>
                        <Label>Aprovado por</Label>
                        <p className="text-sm">{selectedPagamento.aprovadoPor.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedPagamento.aprovadoPor.papel} -{" "}
                          {selectedPagamento.dataAprovacao &&
                            format(
                              new Date(selectedPagamento.dataAprovacao),
                              "dd/MM/yyyy 'às' HH:mm"
                            )}
                        </p>
                      </div>
                    )}

                    {selectedPagamento.motivoRejeicao && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Motivo da Rejeição:</strong> {selectedPagamento.motivoRejeicao}
                        </AlertDescription>
                      </Alert>
                    )}

                    {selectedPagamento.observacoes && (
                      <div>
                        <Label>Observações</Label>
                        <p className="text-sm text-muted-foreground">
                          {selectedPagamento.observacoes}
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="financeiro" className="space-y-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Valor Financiado</Label>
                        <p className="text-lg font-semibold">
                          {formatCurrency(selectedPagamento.valorFinanciado)}
                        </p>
                      </div>
                      <div>
                        <Label>Valor Líquido</Label>
                        <p className="text-lg font-semibold text-green-600">
                          {formatCurrency(selectedPagamento.valorLiquido)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>IOF</Label>
                        <p className="text-sm">{formatCurrency(selectedPagamento.valorIOF)}</p>
                      </div>
                      <div>
                        <Label>TAC</Label>
                        <p className="text-sm">{formatCurrency(selectedPagamento.valorTAC)}</p>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <Label>Dados Bancários para Pagamento</Label>
                      <div className="mt-2 space-y-2 rounded-lg bg-muted p-3">
                        <p className="text-sm">
                          <strong>Titular:</strong> {selectedPagamento.contaBancaria.titular}
                        </p>
                        <p className="text-sm">
                          <strong>Banco:</strong> {selectedPagamento.contaBancaria.banco}
                        </p>
                        <p className="text-sm">
                          <strong>Agência:</strong> {selectedPagamento.contaBancaria.agencia}
                        </p>
                        <p className="text-sm">
                          <strong>Conta:</strong> {selectedPagamento.contaBancaria.conta} (
                          {selectedPagamento.contaBancaria.tipoConta})
                        </p>
                        <p className="text-sm">
                          <strong>Forma de Pagamento:</strong>{" "}
                          {selectedPagamento.formaPagamento.toUpperCase()}
                        </p>
                      </div>
                    </div>

                    {selectedPagamento.comprovante && (
                      <div>
                        <Label>Comprovante de Pagamento</Label>
                        <Button
                          variant="outline"
                          className="mt-2 w-full"
                          onClick={() => window.open(selectedPagamento.comprovante, "_blank")}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Baixar Comprovante
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="historico" className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Solicitação Criada</p>
                        <p className="text-sm text-muted-foreground">
                          Por {selectedPagamento.requisitadoPor.nome} em{" "}
                          {format(
                            new Date(selectedPagamento.dataRequisicao),
                            "dd/MM/yyyy 'às' HH:mm"
                          )}
                        </p>
                      </div>
                    </div>

                    {selectedPagamento.dataAprovacao && (
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">Pagamento Aprovado</p>
                          <p className="text-sm text-muted-foreground">
                            Por {selectedPagamento.aprovadoPor?.nome} em{" "}
                            {format(
                              new Date(selectedPagamento.dataAprovacao),
                              "dd/MM/yyyy 'às' HH:mm"
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    {selectedPagamento.dataPagamento && (
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          <Banknote className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">Pagamento Realizado</p>
                          <p className="text-sm text-muted-foreground">
                            Em{" "}
                            {format(
                              new Date(selectedPagamento.dataPagamento),
                              "dd/MM/yyyy 'às' HH:mm"
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    {selectedPagamento.motivoRejeicao && (
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          <XCircle className="h-4 w-4 text-red-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">Pagamento Rejeitado</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedPagamento.motivoRejeicao}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 border-t pt-4">
                    <Button
                      className="w-full"
                      onClick={() =>
                        setLocation(`/credito/analise/${selectedPagamento.propostaId}`)
                      }
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Ver Proposta Completa
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Modal de Aprovação */}
        <Dialog open={showApprovalModal} onOpenChange={setShowApprovalModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aprovar Pagamento</DialogTitle>
              <DialogDescription>
                Você está prestes a aprovar o pagamento de{" "}
                {selectedPagamento && formatCurrency(selectedPagamento.valorLiquido)} para{" "}
                {selectedPagamento?.nomeCliente}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Certifique-se de que todos os dados bancários foram verificados e estão corretos
                  antes de aprovar.
                </AlertDescription>
              </Alert>

              <div>
                <Label>Observações (opcional)</Label>
                <Textarea
                  placeholder="Adicione observações sobre a aprovação..."
                  value={approvalObservation}
                  onChange={e => setApprovalObservation(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowApprovalModal(false);
                  setApprovalObservation("");
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (selectedPagamento) {
                    aprovarMutation.mutate({
                      id: selectedPagamento.id,
                      observacao: approvalObservation,
                    });
                  }
                }}
                disabled={aprovarMutation.isPending}
              >
                {aprovarMutation.isPending ? "Aprovando..." : "Aprovar Pagamento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Rejeição */}
        <Dialog open={showRejectionModal} onOpenChange={setShowRejectionModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejeitar Pagamento</DialogTitle>
              <DialogDescription>
                Informe o motivo da rejeição do pagamento para {selectedPagamento?.nomeCliente}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Motivo da Rejeição*</Label>
                <Textarea
                  placeholder="Descreva o motivo da rejeição..."
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  className="mt-2"
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectionModal(false);
                  setRejectionReason("");
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedPagamento && rejectionReason.trim()) {
                    rejeitarMutation.mutate({
                      id: selectedPagamento.id,
                      motivo: rejectionReason,
                    });
                  }
                }}
                disabled={!rejectionReason.trim() || rejeitarMutation.isPending}
              >
                {rejeitarMutation.isPending ? "Rejeitando..." : "Rejeitar Pagamento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Verificação de Segurança para Desembolso */}
        <Dialog
          open={showSecurityVerificationModal}
          onOpenChange={setShowSecurityVerificationModal}
        >
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Verificação de Segurança - Pagamento
              </DialogTitle>
              <DialogDescription>
                Revise todos os detalhes antes de confirmar o pagamento do empréstimo ao cliente.
              </DialogDescription>
            </DialogHeader>

            {isLoadingVerificacao ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin" />
              </div>
            ) : verificacoes && selectedPagamento ? (
              <div className="space-y-4">
                {/* Dados do Cliente e Valor */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Informações do Pagamento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <Label className="text-sm">Cliente</Label>
                        <p className="text-sm font-semibold">{selectedPagamento.nomeCliente}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCPF(selectedPagamento.cpfCliente)}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm">Valor a Pagar</Label>
                        <p className="text-xl font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(selectedPagamento.valorLiquido)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Valor Financiado: {formatCurrency(selectedPagamento.valorFinanciado)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Checklist de Verificação */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Checklist de Verificação</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        {verificacoes.ccbAssinada ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span
                          className={verificacoes.ccbAssinada ? "text-green-700" : "text-red-700"}
                        >
                          CCB Assinada e Localizada
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {verificacoes.boletosGerados ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span
                          className={
                            verificacoes.boletosGerados ? "text-green-700" : "text-red-700"
                          }
                        >
                          Boletos Registrados no Inter
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {verificacoes.titularidadeConta ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-yellow-600" />
                        )}
                        <span
                          className={
                            verificacoes.titularidadeConta ? "text-green-700" : "text-yellow-700"
                          }
                        >
                          Titularidade da Conta
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Documentação e Conta em duas colunas */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Documentação */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Documentação</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {verificacoes.documentosCcb?.urlCcb ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={async () => {
                            try {
                              console.log(
                                "[CCB] Buscando CCB assinada para proposta:",
                                selectedPagamento.id
                              );

                              // Fazer a requisição para baixar a CCB assinada usando api diretamente
                              const response = await api.get(
                                `/api/pagamentos/${selectedPagamento.id}/ccb-assinada`,
                                {
                                  responseType: "blob",
                                }
                              );

                              console.log("[CCB] Resposta recebida:", response);

                              // Verificar se recebemos um blob
                              if (response.data instanceof Blob) {
                                const blob = response.data;
                                const url = window.URL.createObjectURL(blob);
                                window.open(url, "_blank");

                                // Limpar a URL após um tempo
                                setTimeout(() => window.URL.revokeObjectURL(url), 1000);

                                toast({
                                  title: "CCB aberta",
                                  description: "O documento foi aberto em uma nova aba",
                                });
                              } else {
                                // Se não for um blob, pode ser um erro
                                console.error("[CCB] Resposta não é um blob:", response);
                                toast({
                                  title: "Erro ao abrir CCB",
                                  description: "Formato de resposta inesperado",
                                  variant: "destructive",
                                });
                              }
                            } catch (error: any) {
                              console.error("[CCB] Erro ao buscar CCB assinada:", error);

                              // Tratar erros específicos
                              let errorMessage = "Erro ao carregar documento assinado";

                              if (error.response?.data?.error) {
                                errorMessage = error.response.data.error;
                              } else if (error.message) {
                                errorMessage = error.message;
                              }

                              toast({
                                title: "Erro ao buscar CCB",
                                description: errorMessage,
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Ver CCB Assinada
                        </Button>
                      ) : (
                        <Alert variant="destructive" className="text-xs">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            CCB não encontrada. Verifique se foi assinada no ClickSign.
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>

                  {/* Conta de Destino */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Conta de Destino</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1 rounded bg-gray-50 p-3 text-xs dark:bg-gray-800">
                        {selectedPagamento.contaBancaria.banco !== "N/A" ? (
                          <>
                            <p>
                              <strong>Banco:</strong> {selectedPagamento.contaBancaria.banco}
                            </p>
                            <p>
                              <strong>Ag:</strong> {selectedPagamento.contaBancaria.agencia} |{" "}
                              <strong>Conta:</strong> {selectedPagamento.contaBancaria.conta}
                            </p>
                            <p>
                              <strong>Titular:</strong> {selectedPagamento.contaBancaria.titular}
                            </p>
                          </>
                        ) : verificacoes.dadosPagamento?.destino?.pix ? (
                          <>
                            <p>
                              <strong>Tipo:</strong> PIX
                            </p>
                            <p>
                              <strong>Chave:</strong> {verificacoes.dadosPagamento.destino.pix}
                            </p>
                          </>
                        ) : (
                          <Alert variant="destructive" className="text-xs">
                            <AlertDescription>
                              Dados bancários não informados. Configure na proposta.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Confirmação Final */}
                <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-red-800 dark:text-red-200">
                      Confirmação de Segurança
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-sm">Senha de Confirmação* (Segurança Adicional)</Label>
                      <Input
                        type="password"
                        placeholder="Digite sua senha de segurança para pagamentos"
                        value={paymentPassword}
                        onChange={e => setPaymentPassword(e.target.value)}
                        className="mt-1"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Esta é uma senha adicional de segurança para pagamentos, pode ser diferente
                        da sua senha de login.
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm">Observações (opcional)</Label>
                      <Textarea
                        placeholder="Observações sobre o desembolso"
                        value={paymentObservation}
                        onChange={e => setPaymentObservation(e.target.value)}
                        className="mt-1 h-20"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            <DialogFooter className="flex flex-col gap-2 pt-4 sm:flex-row">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowSecurityVerificationModal(false);
                  setPaymentPassword("");
                  setPaymentObservation("");
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setSelectedPagamento(null);
                  setShowSecurityVerificationModal(false);
                  setShowRejectionModal(true);
                }}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reprovar
              </Button>
              <Button
                variant="default"
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  if (selectedPagamento && paymentPassword) {
                    confirmarDesembolsoMutation.mutate({
                      id: selectedPagamento.id,
                      senha: paymentPassword,
                      observacoes: paymentObservation,
                    });
                  }
                }}
                disabled={
                  !paymentPassword ||
                  !verificacoes?.ccbAssinada ||
                  !verificacoes?.boletosGerados ||
                  confirmarDesembolsoMutation.isPending
                }
              >
                {confirmarDesembolsoMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Confirmar Desembolso
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
