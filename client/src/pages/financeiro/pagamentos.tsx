import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  ArrowDownRight
} from "lucide-react";

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
  status: 'aguardando_aprovacao' | 'aprovado' | 'em_processamento' | 'pago' | 'rejeitado' | 'cancelado';
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
  formaPagamento: 'ted' | 'pix' | 'doc';
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
  const [rejectionReason, setRejectionReason] = useState("");
  const [approvalObservation, setApprovalObservation] = useState("");

  // Buscar pagamentos
  const { data: pagamentos = [], isLoading, error } = useQuery({
    queryKey: ['/api/pagamentos', { status: statusFilter, periodo: periodoFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'todos') params.append('status', statusFilter);
      if (periodoFilter !== 'todos') params.append('periodo', periodoFilter);
      
      const response = await apiRequest(`/api/pagamentos?${params.toString()}`, {
        method: 'GET',
      });
      return response as Pagamento[];
    },
    retry: 1,
    initialData: [],
  });

  // Aprovar pagamento
  const aprovarMutation = useMutation({
    mutationFn: async ({ id, observacao }: { id: string; observacao: string }) => {
      return await apiRequest(`/api/pagamentos/${id}/aprovar`, {
        method: 'POST',
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
      queryClient.invalidateQueries({ queryKey: ['/api/pagamentos'] });
    },
    onError: () => {
      toast({
        title: "Erro ao aprovar",
        description: "Não foi possível aprovar o pagamento.",
        variant: "destructive",
      });
    },
  });

  // Rejeitar pagamento
  const rejeitarMutation = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      return await apiRequest(`/api/pagamentos/${id}/rejeitar`, {
        method: 'POST',
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
      queryClient.invalidateQueries({ queryKey: ['/api/pagamentos'] });
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
    const matchesSearch = 
      pagamento.nomeCliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pagamento.numeroContrato.includes(searchTerm) ||
      pagamento.cpfCliente.includes(searchTerm) ||
      pagamento.propostaId.includes(searchTerm);
    
    return matchesSearch;
  });

  // Estatísticas
  const stats = {
    aguardandoAprovacao: pagamentos?.filter(p => p.status === 'aguardando_aprovacao').length || 0,
    aprovados: pagamentos?.filter(p => p.status === 'aprovado').length || 0,
    emProcessamento: pagamentos?.filter(p => p.status === 'em_processamento').length || 0,
    pagos: pagamentos?.filter(p => p.status === 'pago').length || 0,
    rejeitados: pagamentos?.filter(p => p.status === 'rejeitado').length || 0,
    valorTotalAguardando: pagamentos
      ?.filter(p => p.status === 'aguardando_aprovacao')
      .reduce((acc, p) => acc + p.valorLiquido, 0) || 0,
    valorTotalPago: pagamentos
      ?.filter(p => p.status === 'pago')
      .reduce((acc, p) => acc + p.valorLiquido, 0) || 0,
    valorTotalProcessando: pagamentos
      ?.filter(p => p.status === 'em_processamento' || p.status === 'aprovado')
      .reduce((acc, p) => acc + p.valorLiquido, 0) || 0,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aguardando_aprovacao':
        return 'bg-yellow-100 text-yellow-800';
      case 'aprovado':
        return 'bg-blue-100 text-blue-800';
      case 'em_processamento':
        return 'bg-purple-100 text-purple-800';
      case 'pago':
        return 'bg-green-100 text-green-800';
      case 'rejeitado':
        return 'bg-red-100 text-red-800';
      case 'cancelado':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'aguardando_aprovacao':
        return 'Aguardando Aprovação';
      case 'aprovado':
        return 'Aprovado';
      case 'em_processamento':
        return 'Em Processamento';
      case 'pago':
        return 'Pago';
      case 'rejeitado':
        return 'Rejeitado';
      case 'cancelado':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);
  };

  const formatCPF = (cpf: string) => {
    if (!cpf) return '';
    const cleaned = cpf.replace(/\D/g, '');
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
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
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando pagamentos...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title="Pagamentos">
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-red-600">Erro ao carregar pagamentos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Não foi possível carregar os dados de pagamentos. Por favor, tente novamente.
              </p>
              <Button onClick={() => window.location.reload()}>
                Recarregar página
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Pagamentos">
      <div className="space-y-6">
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
              <div className="text-2xl font-bold">
                {stats.aprovados + stats.emProcessamento}
              </div>
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
              <div className="text-xs text-muted-foreground">
                Requerem nova análise
              </div>
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
                    onChange={(e) => setSearchTerm(e.target.value)}
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
              <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/pagamentos'] })}>
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
                      <TableCell colSpan={8} className="text-center py-8">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : pagamentosFiltrados?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhum pagamento encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagamentosFiltrados?.map((pagamento) => (
                      <TableRow key={pagamento.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium">
                          <div className="space-y-1">
                            <div>{pagamento.numeroContrato}</div>
                            <div className="text-xs text-muted-foreground">
                              {pagamento.produto}
                            </div>
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
                            <div className="font-semibold">{formatCurrency(pagamento.valorLiquido)}</div>
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
                              {format(new Date(pagamento.dataRequisicao), 'dd/MM/yyyy')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(pagamento.dataRequisicao), 'HH:mm')}
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
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedPagamento(pagamento)}
                              title="Ver detalhes"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {pagamento.status === 'aguardando_aprovacao' && userHasApprovalPermission() && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-green-600 hover:text-green-700"
                                  onClick={() => {
                                    setSelectedPagamento(pagamento);
                                    setShowApprovalModal(true);
                                  }}
                                  title="Aprovar"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => {
                                    setSelectedPagamento(pagamento);
                                    setShowRejectionModal(true);
                                  }}
                                  title="Rejeitar"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedPagamento(null)}
                >
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
                        <p className="text-sm text-muted-foreground">{selectedPagamento.numeroContrato}</p>
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
                      <p className="text-sm text-muted-foreground">{formatCPF(selectedPagamento.cpfCliente)}</p>
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
                        {selectedPagamento.requisitadoPor.papel} - {format(new Date(selectedPagamento.dataRequisicao), "dd/MM/yyyy 'às' HH:mm")}
                      </p>
                    </div>

                    {selectedPagamento.aprovadoPor && (
                      <div>
                        <Label>Aprovado por</Label>
                        <p className="text-sm">{selectedPagamento.aprovadoPor.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedPagamento.aprovadoPor.papel} - {selectedPagamento.dataAprovacao && format(new Date(selectedPagamento.dataAprovacao), "dd/MM/yyyy 'às' HH:mm")}
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
                        <p className="text-sm text-muted-foreground">{selectedPagamento.observacoes}</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="financeiro" className="space-y-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Valor Financiado</Label>
                        <p className="text-lg font-semibold">{formatCurrency(selectedPagamento.valorFinanciado)}</p>
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
                      <div className="mt-2 p-3 bg-muted rounded-lg space-y-2">
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
                          <strong>Conta:</strong> {selectedPagamento.contaBancaria.conta} ({selectedPagamento.contaBancaria.tipoConta})
                        </p>
                        <p className="text-sm">
                          <strong>Forma de Pagamento:</strong> {selectedPagamento.formaPagamento.toUpperCase()}
                        </p>
                      </div>
                    </div>

                    {selectedPagamento.comprovante && (
                      <div>
                        <Label>Comprovante de Pagamento</Label>
                        <Button
                          variant="outline"
                          className="w-full mt-2"
                          onClick={() => window.open(selectedPagamento.comprovante, '_blank')}
                        >
                          <Download className="h-4 w-4 mr-2" />
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
                          Por {selectedPagamento.requisitadoPor.nome} em {format(new Date(selectedPagamento.dataRequisicao), "dd/MM/yyyy 'às' HH:mm")}
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
                            Por {selectedPagamento.aprovadoPor?.nome} em {format(new Date(selectedPagamento.dataAprovacao), "dd/MM/yyyy 'às' HH:mm")}
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
                            Em {format(new Date(selectedPagamento.dataPagamento), "dd/MM/yyyy 'às' HH:mm")}
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

                  <div className="mt-4 pt-4 border-t">
                    <Button
                      className="w-full"
                      onClick={() => setLocation(`/credito/analise/${selectedPagamento.propostaId}`)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
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
                Você está prestes a aprovar o pagamento de {selectedPagamento && formatCurrency(selectedPagamento.valorLiquido)} para {selectedPagamento?.nomeCliente}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Certifique-se de que todos os dados bancários foram verificados e estão corretos antes de aprovar.
                </AlertDescription>
              </Alert>

              <div>
                <Label>Observações (opcional)</Label>
                <Textarea
                  placeholder="Adicione observações sobre a aprovação..."
                  value={approvalObservation}
                  onChange={(e) => setApprovalObservation(e.target.value)}
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
                      observacao: approvalObservation
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
                  onChange={(e) => setRejectionReason(e.target.value)}
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
                      motivo: rejectionReason
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
      </div>
    </DashboardLayout>
  );
}