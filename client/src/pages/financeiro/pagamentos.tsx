import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Search,
  DollarSign,
  Calendar,
  User,
  FileCheck,
  CreditCard,
  Copy,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  Send,
  Eye,
  Filter,
  Download
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PropostaPagamento {
  id: string;
  numeroContrato: string;
  nomeCliente: string;
  cpfCliente: string;
  emailCliente: string;
  telefoneCliente: string;
  valorEmprestimo: number;
  dataFormalizacao: string;
  ccbAssinada: boolean;
  dataAssinaturaCCB: string;
  chavePix: string;
  bancoCliente: string;
  agenciaCliente: string;
  contaCliente: string;
  tipoContaCliente: 'corrente' | 'poupanca';
  status: 'pronto_pagamento' | 'aguardando_dados_bancarios' | 'processando' | 'pago' | 'erro';
  dataProcessamento?: string;
  comprovantePagamento?: string;
  observacoes?: string;
}

export default function Pagamentos() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [selectedPropostas, setSelectedPropostas] = useState<string[]>([]);
  const [showBankData, setShowBankData] = useState<{ [key: string]: boolean }>({});
  
  // Buscar propostas prontas para pagamento
  const { data: propostas, isLoading, refetch } = useQuery({
    queryKey: ['/api/financeiro/pagamentos'],
    queryFn: async () => {
      const response = await apiRequest('/api/financeiro/pagamentos', {
        method: 'GET',
      });
      return response as PropostaPagamento[];
    },
  });

  // Processar pagamentos selecionados
  const processarPagamentosMutation = useMutation({
    mutationFn: async (propostas: string[]) => {
      const response = await apiRequest('/api/financeiro/pagamentos/processar', {
        method: 'POST',
        body: JSON.stringify({ propostas }),
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Pagamentos processados",
        description: "Os pagamentos foram enviados para processamento.",
      });
      setSelectedPropostas([]);
      queryClient.invalidateQueries({ queryKey: ['/api/financeiro/pagamentos'] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao processar pagamentos",
        description: "Não foi possível processar os pagamentos selecionados.",
        variant: "destructive",
      });
    },
  });

  // Filtrar propostas
  const propostasFiltradas = propostas?.filter(proposta => {
    const matchesSearch = proposta.nomeCliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         proposta.numeroContrato.includes(searchTerm) ||
                         proposta.cpfCliente.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'todos' || proposta.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Estatísticas
  const estatisticas = {
    totalPropostas: propostas?.length || 0,
    prontasPagamento: propostas?.filter(p => p.status === 'pronto_pagamento').length || 0,
    aguardandoDados: propostas?.filter(p => p.status === 'aguardando_dados_bancarios').length || 0,
    processando: propostas?.filter(p => p.status === 'processando').length || 0,
    valorTotal: propostas?.reduce((acc, p) => acc + p.valorEmprestimo, 0) || 0,
    valorSelecionado: propostas?.filter(p => selectedPropostas.includes(p.id))
                                .reduce((acc, p) => acc + p.valorEmprestimo, 0) || 0,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pronto_pagamento':
        return 'bg-green-100 text-green-800';
      case 'aguardando_dados_bancarios':
        return 'bg-yellow-100 text-yellow-800';
      case 'processando':
        return 'bg-blue-100 text-blue-800';
      case 'pago':
        return 'bg-emerald-100 text-emerald-800';
      case 'erro':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pronto_pagamento':
        return 'Pronto para Pagamento';
      case 'aguardando_dados_bancarios':
        return 'Aguardando Dados Bancários';
      case 'processando':
        return 'Processando';
      case 'pago':
        return 'Pago';
      case 'erro':
        return 'Erro no Processamento';
      default:
        return status;
    }
  };

  const toggleSelectProposta = (propostaId: string) => {
    setSelectedPropostas(prev => 
      prev.includes(propostaId)
        ? prev.filter(id => id !== propostaId)
        : [...prev, propostaId]
    );
  };

  const toggleSelectAll = () => {
    const prontasPagamento = propostasFiltradas?.filter(p => p.status === 'pronto_pagamento') || [];
    if (selectedPropostas.length === prontasPagamento.length) {
      setSelectedPropostas([]);
    } else {
      setSelectedPropostas(prontasPagamento.map(p => p.id));
    }
  };

  const copiarChavePix = async (chavePix: string) => {
    try {
      await navigator.clipboard.writeText(chavePix);
      toast({
        title: "Chave PIX copiada",
        description: "A chave PIX foi copiada para a área de transferência.",
      });
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar a chave PIX.",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout title="Fila de Pagamentos">
      <div className="space-y-6">
        {/* Header com estatísticas */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Propostas</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{estatisticas.totalPropostas}</div>
              <div className="text-xs text-muted-foreground">
                Com CCB assinada
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Prontas para Pagamento</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{estatisticas.prontasPagamento}</div>
              <div className="text-xs text-muted-foreground">
                Aguardando processamento
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { 
                  style: 'currency', 
                  currency: 'BRL' 
                }).format(estatisticas.valorTotal)}
              </div>
              <div className="text-xs text-muted-foreground">
                Para pagamento
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Valor Selecionado</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {new Intl.NumberFormat('pt-BR', { 
                  style: 'currency', 
                  currency: 'BRL' 
                }).format(estatisticas.valorSelecionado)}
              </div>
              <div className="text-xs text-muted-foreground">
                {selectedPropostas.length} selecionadas
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros e ações */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Controle de Pagamentos</CardTitle>
                <CardDescription>
                  Propostas aprovadas com CCB assinada prontas para pagamento
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => refetch()}
                  disabled={isLoading}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
                <Button
                  onClick={() => processarPagamentosMutation.mutate(selectedPropostas)}
                  disabled={selectedPropostas.length === 0 || processarPagamentosMutation.isPending}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Processar {selectedPropostas.length} Pagamentos
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, CPF ou contrato..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="pronto_pagamento">Pronto para Pagamento</SelectItem>
                  <SelectItem value="aguardando_dados_bancarios">Aguardando Dados</SelectItem>
                  <SelectItem value="processando">Processando</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="erro">Com Erro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Seleção em massa */}
            {propostasFiltradas && propostasFiltradas.filter(p => p.status === 'pronto_pagamento').length > 0 && (
              <div className="flex items-center gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
                <Checkbox
                  checked={selectedPropostas.length === propostasFiltradas.filter(p => p.status === 'pronto_pagamento').length}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm font-medium">
                  Selecionar todas as propostas prontas para pagamento ({propostasFiltradas.filter(p => p.status === 'pronto_pagamento').length})
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lista de propostas */}
        <div className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground">
                  Carregando propostas...
                </div>
              </CardContent>
            </Card>
          ) : propostasFiltradas?.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground">
                  Nenhuma proposta encontrada com os filtros aplicados
                </div>
              </CardContent>
            </Card>
          ) : (
            propostasFiltradas?.map((proposta) => (
              <Card key={proposta.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-4">
                      {proposta.status === 'pronto_pagamento' && (
                        <Checkbox
                          checked={selectedPropostas.includes(proposta.id)}
                          onCheckedChange={() => toggleSelectProposta(proposta.id)}
                        />
                      )}
                      <div className="space-y-1">
                        <div className="flex items-center gap-4">
                          <h3 className="font-semibold text-lg">{proposta.nomeCliente}</h3>
                          <Badge className={getStatusColor(proposta.status)}>
                            {getStatusText(proposta.status)}
                          </Badge>
                          {proposta.ccbAssinada && (
                            <Badge variant="outline" className="gap-1">
                              <FileCheck className="h-3 w-3" />
                              CCB Assinada
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Contrato: {proposta.numeroContrato} | CPF: {proposta.cpfCliente}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Formalizado em: {format(new Date(proposta.dataFormalizacao), 'dd/MM/yyyy', { locale: ptBR })}
                          {proposta.dataAssinaturaCCB && (
                            <span className="ml-2">
                              | CCB assinada em: {format(new Date(proposta.dataAssinaturaCCB), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right space-y-1">
                      <div className="text-2xl font-bold text-green-600">
                        {new Intl.NumberFormat('pt-BR', { 
                          style: 'currency', 
                          currency: 'BRL' 
                        }).format(proposta.valorEmprestimo)}
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowBankData(prev => ({ 
                            ...prev, 
                            [proposta.id]: !prev[proposta.id] 
                          }))}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {proposta.comprovantePagamento && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(proposta.comprovantePagamento, '_blank')}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Dados bancários expandidos */}
                  {showBankData[proposta.id] && (
                    <div className="border-t bg-muted/20 p-6">
                      <Tabs defaultValue="pix" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="pix">PIX</TabsTrigger>
                          <TabsTrigger value="conta">Dados Bancários</TabsTrigger>
                        </TabsList>

                        <TabsContent value="pix" className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Chave PIX</label>
                            <div className="flex items-center gap-2">
                              <Input
                                value={proposta.chavePix || 'Chave PIX não informada'}
                                readOnly
                                className="bg-background"
                              />
                              {proposta.chavePix && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => copiarChavePix(proposta.chavePix)}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="conta" className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium">Banco</label>
                              <p className="text-sm text-muted-foreground">
                                {proposta.bancoCliente || 'Não informado'}
                              </p>
                            </div>
                            <div>
                              <label className="text-sm font-medium">Agência</label>
                              <p className="text-sm text-muted-foreground">
                                {proposta.agenciaCliente || 'Não informado'}
                              </p>
                            </div>
                            <div>
                              <label className="text-sm font-medium">Conta</label>
                              <p className="text-sm text-muted-foreground">
                                {proposta.contaCliente || 'Não informado'}
                              </p>
                            </div>
                            <div>
                              <label className="text-sm font-medium">Tipo de Conta</label>
                              <p className="text-sm text-muted-foreground">
                                {proposta.tipoContaCliente === 'corrente' ? 'Conta Corrente' : 
                                 proposta.tipoContaCliente === 'poupanca' ? 'Poupança' : 'Não informado'}
                              </p>
                            </div>
                          </div>
                          
                          {proposta.observacoes && (
                            <div>
                              <label className="text-sm font-medium">Observações</label>
                              <p className="text-sm text-muted-foreground">
                                {proposta.observacoes}
                              </p>
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
