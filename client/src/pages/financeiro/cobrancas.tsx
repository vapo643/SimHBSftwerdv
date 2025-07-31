import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Calendar,
  Search,
  Phone,
  MessageSquare,
  Eye,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Receipt,
  DollarSign,
  FileText,
  Send,
  Filter
} from "lucide-react";
import { format, addMonths, differenceInDays, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Parcela {
  id: string;
  numero: number;
  valorParcela: number;
  dataVencimento: string;
  dataPagamento?: string;
  codigoBoleto?: string;
  linhaDigitavel?: string;
  status: 'pago' | 'pendente' | 'vencido';
  diasAtraso?: number;
}

interface PropostaCobranca {
  id: string;
  numeroContrato: string;
  nomeCliente: string;
  cpfCliente: string;
  telefoneCliente: string;
  emailCliente: string;
  valorTotal: number;
  valorFinanciado: number;
  quantidadeParcelas: number;
  parcelasPagas: number;
  parcelasPendentes: number;
  parcelasVencidas: number;
  valorTotalPago: number;
  valorTotalPendente: number;
  diasAtraso: number;
  status: 'em_dia' | 'inadimplente' | 'quitado';
  dataContrato: string;
  ccbAssinada: boolean;
  parcelas: Parcela[];
  documentos: {
    ccb?: string;
    comprovantes?: string[];
  };
}

export default function Cobrancas() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [selectedProposta, setSelectedProposta] = useState<PropostaCobranca | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactType, setContactType] = useState<'whatsapp' | 'sms' | 'email'>('whatsapp');
  
  // Buscar propostas em cobrança
  const { data: propostas, isLoading, refetch } = useQuery({
    queryKey: ['/api/cobrancas'],
    queryFn: async () => {
      const response = await apiRequest('/api/cobrancas', {
        method: 'GET',
      });
      return response as PropostaCobranca[];
    },
  });

  // Atualizar status das parcelas via API do Banco Inter
  const atualizarStatusParcelas = async (propostaId: string) => {
    try {
      await apiRequest(`/api/cobrancas/${propostaId}/atualizar-status`, {
        method: 'POST',
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
    const parcelasVencidas = proposta.parcelas.filter(p => p.status === 'vencido');
    const valorTotalVencido = parcelasVencidas.reduce((acc, p) => acc + p.valorParcela, 0);
    
    if (parcela) {
      return `Olá ${proposta.nomeCliente}!\n\nEste é um lembrete sobre a parcela ${parcela.numero} do seu contrato ${proposta.numeroContrato}.\n\nValor: R$ ${parcela.valorParcela.toFixed(2)}\nVencimento: ${format(new Date(parcela.dataVencimento), 'dd/MM/yyyy')}\n${parcela.status === 'vencido' ? `Dias em atraso: ${parcela.diasAtraso}\n` : ''}\n${parcela.linhaDigitavel ? `Linha digitável: ${parcela.linhaDigitavel}\n` : ''}\nPara sua comodidade, você também pode pagar via PIX usando a chave: contato@simpix.com.br\n\nCaso já tenha efetuado o pagamento, favor desconsiderar esta mensagem.\n\nQualquer dúvida, estamos à disposição!\n\nAtenciosamente,\nEquipe Simpix`;
    } else {
      return `Olá ${proposta.nomeCliente}!\n\nIdentificamos pendências em seu contrato ${proposta.numeroContrato}.\n\nParcelas vencidas: ${parcelasVencidas.length}\nValor total em atraso: R$ ${valorTotalVencido.toFixed(2)}\n\nPara regularizar sua situação, entre em contato conosco ou acesse sua área do cliente.\n\nEstamos à disposição para negociar as melhores condições de pagamento.\n\nAtenciosamente,\nEquipe Simpix`;
    }
  };

  // Enviar mensagem de contato
  const enviarContato = async (proposta: PropostaCobranca, tipo: string, mensagem: string) => {
    try {
      await apiRequest('/api/cobrancas/contato', {
        method: 'POST',
        body: JSON.stringify({
          propostaId: proposta.id,
          tipo,
          destinatario: tipo === 'whatsapp' || tipo === 'sms' ? proposta.telefoneCliente : proposta.emailCliente,
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
  const propostasFiltradas = propostas?.filter(proposta => {
    const matchesSearch = proposta.nomeCliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         proposta.numeroContrato.includes(searchTerm) ||
                         proposta.cpfCliente.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'todos' || proposta.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Estatísticas gerais
  const estatisticas = {
    totalContratos: propostas?.length || 0,
    contratosEmDia: propostas?.filter(p => p.status === 'em_dia').length || 0,
    contratosInadimplentes: propostas?.filter(p => p.status === 'inadimplente').length || 0,
    contratosQuitados: propostas?.filter(p => p.status === 'quitado').length || 0,
    valorTotalCarteira: propostas?.reduce((acc, p) => acc + p.valorTotal, 0) || 0,
    valorTotalRecebido: propostas?.reduce((acc, p) => acc + p.valorTotalPago, 0) || 0,
    valorTotalPendente: propostas?.reduce((acc, p) => acc + p.valorTotalPendente, 0) || 0,
  };

  const taxaInadimplencia = estatisticas.totalContratos > 0 
    ? (estatisticas.contratosInadimplentes / estatisticas.totalContratos * 100).toFixed(1)
    : '0';

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

  return (
    <DashboardLayout title="Cobranças">
      <div className="space-y-6">
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
                {new Intl.NumberFormat('pt-BR', { 
                  style: 'currency', 
                  currency: 'BRL' 
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
                {new Intl.NumberFormat('pt-BR', { 
                  style: 'currency', 
                  currency: 'BRL' 
                }).format(estatisticas.valorTotalPendente)}
              </div>
              <div className="text-xs text-muted-foreground">
                A receber
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
                    placeholder="Buscar por nome, CPF ou contrato..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="em_dia">Em dia</SelectItem>
                  <SelectItem value="inadimplente">Inadimplente</SelectItem>
                  <SelectItem value="quitado">Quitado</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => refetch()}>
                <Filter className="mr-2 h-4 w-4" />
                Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Propostas */}
        <Card>
          <CardHeader>
            <CardTitle>Contratos em Cobrança</CardTitle>
            <CardDescription>
              Clique em um contrato para ver detalhes e parcelas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isLoading ? (
                <div>Carregando...</div>
              ) : propostasFiltradas?.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Nenhum contrato encontrado
                </div>
              ) : (
                propostasFiltradas?.map((proposta) => (
                  <Card 
                    key={proposta.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedProposta(proposta)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-4">
                            <h3 className="font-semibold">{proposta.nomeCliente}</h3>
                            <Badge className={getStatusColor(proposta.status)}>
                              {proposta.status === 'em_dia' ? 'Em dia' : 
                               proposta.status === 'inadimplente' ? 'Inadimplente' : 'Quitado'}
                            </Badge>
                            {proposta.ccbAssinada && (
                              <Badge variant="outline" className="gap-1">
                                <FileText className="h-3 w-3" />
                                CCB Assinada
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Contrato: {proposta.numeroContrato} | CPF: {proposta.cpfCliente}
                          </div>
                          <div className="text-sm">
                            Parcelas: {proposta.parcelasPagas}/{proposta.quantidadeParcelas} pagas
                            {proposta.parcelasVencidas > 0 && (
                              <span className="text-red-600 ml-2">
                                ({proposta.parcelasVencidas} vencidas - {proposta.diasAtraso} dias)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="font-semibold">
                            {new Intl.NumberFormat('pt-BR', { 
                              style: 'currency', 
                              currency: 'BRL' 
                            }).format(proposta.valorTotal)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Pendente: {new Intl.NumberFormat('pt-BR', { 
                              style: 'currency', 
                              currency: 'BRL' 
                            }).format(proposta.valorTotalPendente)}
                          </div>
                          <div className="flex gap-2 justify-end mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                atualizarStatusParcelas(proposta.id);
                              }}
                            >
                              <Clock className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProposta(proposta);
                                setShowContactModal(true);
                              }}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Modal de Detalhes da Proposta */}
        {selectedProposta && !showContactModal && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Detalhes do Contrato</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedProposta(null)}
                >
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
                    {selectedProposta.parcelas.map((parcela) => (
                      <Card key={parcela.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  Parcela {parcela.numero}/{selectedProposta.quantidadeParcelas}
                                </span>
                                <Badge className={getParcelaStatusColor(parcela.status)}>
                                  {parcela.status === 'pago' ? 'Pago' : 
                                   parcela.status === 'vencido' ? 'Vencido' : 'Pendente'}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Vencimento: {format(new Date(parcela.dataVencimento), 'dd/MM/yyyy')}
                                {parcela.dataPagamento && (
                                  <span className="ml-2">
                                    | Pago em: {format(new Date(parcela.dataPagamento), 'dd/MM/yyyy')}
                                  </span>
                                )}
                                {parcela.diasAtraso && parcela.diasAtraso > 0 && (
                                  <span className="text-red-600 ml-2">
                                    | {parcela.diasAtraso} dias de atraso
                                  </span>
                                )}
                              </div>
                              {parcela.linhaDigitavel && (
                                <div className="text-xs font-mono bg-muted p-2 rounded">
                                  {parcela.linhaDigitavel}
                                </div>
                              )}
                            </div>
                            <div className="text-right space-y-2">
                              <div className="font-semibold">
                                {new Intl.NumberFormat('pt-BR', { 
                                  style: 'currency', 
                                  currency: 'BRL' 
                                }).format(parcela.valorParcela)}
                              </div>
                              {parcela.status !== 'pago' && (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    const mensagem = gerarMensagemContato(selectedProposta, parcela);
                                    navigator.clipboard.writeText(mensagem);
                                    toast({
                                      title: "Mensagem copiada",
                                      description: "A mensagem foi copiada para a área de transferência.",
                                    });
                                  }}
                                >
                                  <Send className="h-4 w-4 mr-1" />
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
                      <p className="text-sm text-muted-foreground">{selectedProposta.nomeCliente}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">CPF</label>
                        <p className="text-sm text-muted-foreground">{selectedProposta.cpfCliente}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Telefone</label>
                        <p className="text-sm text-muted-foreground">{selectedProposta.telefoneCliente}</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">E-mail</label>
                      <p className="text-sm text-muted-foreground">{selectedProposta.emailCliente}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Data do Contrato</label>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(selectedProposta.dataContrato), 'dd/MM/yyyy')}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Valor Financiado</label>
                        <p className="text-sm text-muted-foreground">
                          {new Intl.NumberFormat('pt-BR', { 
                            style: 'currency', 
                            currency: 'BRL' 
                          }).format(selectedProposta.valorFinanciado)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        window.open(`https://wa.me/55${selectedProposta.telefoneCliente.replace(/\D/g, '')}`, '_blank');
                      }}
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      WhatsApp
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        window.open(`tel:${selectedProposta.telefoneCliente}`, '_blank');
                      }}
                    >
                      <Phone className="h-4 w-4 mr-2" />
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
                          window.open(selectedProposta.documentos.ccb, '_blank');
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        CCB - Cédula de Crédito Bancário
                      </Button>
                    )}
                    {selectedProposta.documentos.comprovantes?.map((comp, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => {
                          window.open(comp, '_blank');
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
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
                    <Eye className="h-4 w-4 mr-2" />
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
              <CardDescription>
                Escolha o canal e personalize a mensagem
              </CardDescription>
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
                  className="w-full min-h-[200px] p-3 border rounded-md"
                  defaultValue={gerarMensagemContato(selectedProposta)}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowContactModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    const textarea = document.querySelector('textarea');
                    if (textarea) {
                      enviarContato(selectedProposta, contactType, textarea.value);
                    }
                  }}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Enviar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}