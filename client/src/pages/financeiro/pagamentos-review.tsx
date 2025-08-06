import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { 
  AlertTriangle, 
  CheckCircle, 
  Eye, 
  FileText, 
  Shield, 
  User, 
  CreditCard,
  Copy,
  ExternalLink,
  Loader2,
  Key,
  AlertCircle,
  Check
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PaymentReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposta: any;
  onConfirm: () => void;
}

export default function PaymentReviewModal({ isOpen, onClose, proposta, onConfirm }: PaymentReviewModalProps) {
  const { toast } = useToast();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [pixKeyVisible, setPixKeyVisible] = useState(false);
  const [ccbUrl, setCcbUrl] = useState<string | null>(null);
  
  // Buscar dados completos da proposta quando o modal abrir
  const { data: propostaCompleta, isLoading: isLoadingProposta } = useQuery({
    queryKey: ['/api/pagamentos', proposta?.propostaId || proposta?.id, 'detalhes'],
    queryFn: async () => {
      const propostaId = proposta?.propostaId || proposta?.id;
      if (!propostaId) return null;
      
      console.log('[REVIEW MODAL] Buscando dados completos da proposta:', propostaId);
      const response = await apiRequest(`/api/pagamentos/${propostaId}/detalhes`, {
        method: 'GET',
      });
      console.log('[REVIEW MODAL] Dados recebidos:', response);
      return response;
    },
    enabled: isOpen && !!proposta,
  });
  
  // Buscar status da CCB no Storage
  const { data: ccbStatus, isLoading: isLoadingCcbStatus } = useQuery({
    queryKey: ['/api/pagamentos', propostaCompleta?.id, 'ccb-storage-status'],
    queryFn: async () => {
      if (!propostaCompleta?.id) return null;
      return await apiRequest(`/api/pagamentos/${propostaCompleta.id}/ccb-storage-status`, {
        method: 'GET',
      });
    },
    enabled: isOpen && !!propostaCompleta?.id,
  });

  // Buscar URL da CCB quando necessário
  const { data: ccbUrlData, isLoading: isLoadingCcbUrl, refetch: refetchCcbUrl } = useQuery({
    queryKey: ['/api/pagamentos', propostaCompleta?.id, 'ccb-url'],
    queryFn: async () => {
      if (!propostaCompleta?.id) return null;
      return await apiRequest(`/api/pagamentos/${propostaCompleta.id}/ccb-url`, {
        method: 'GET',
      });
    },
    enabled: false, // Só buscar quando solicitado
  });

  // Confirmar veracidade
  const confirmarVeracidadeMutation = useMutation({
    mutationFn: async () => {
      const propostaId = proposta?.propostaId || proposta?.id;
      return await apiRequest(`/api/pagamentos/${propostaId}/confirmar-veracidade`, {
        method: 'POST',
        body: JSON.stringify({ observacoes }),
      });
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Veracidade Confirmada",
        description: "Pagamento autorizado com sucesso. Chave PIX liberada.",
        className: "bg-green-50 border-green-200",
      });
      setPixKeyVisible(true);
      setShowConfirmDialog(false);
      queryClient.invalidateQueries({ queryKey: ['/api/pagamentos'] });
      onConfirm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao confirmar veracidade",
        description: error.message || "Não foi possível confirmar a veracidade.",
        variant: "destructive",
      });
    },
  });

  // Função para copiar PIX
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Chave PIX copiada para a área de transferência.",
    });
  };

  // Função para visualizar CCB
  const handleViewCCB = async () => {
    const result = await refetchCcbUrl();
    if (result.data?.url) {
      window.open(result.data.url, '_blank');
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

  // Use os dados completos da proposta, ou os dados básicos se ainda estiver carregando
  const dadosProposta = propostaCompleta || proposta;
  
  if (!proposta) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Revisão e Confirmação de Pagamento
            </DialogTitle>
            <DialogDescription>
              {isLoadingProposta ? "Carregando dados..." : "Verifique todos os dados antes de autorizar o pagamento"}
            </DialogDescription>
          </DialogHeader>
          
          {/* Mostrar loading spinner enquanto carrega dados */}
          {isLoadingProposta ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2">Carregando dados da proposta...</span>
            </div>
          ) : (
          <Tabs defaultValue="dados" className="mt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="dados">Dados do Cliente</TabsTrigger>
              <TabsTrigger value="financeiro">Dados Financeiros</TabsTrigger>
              <TabsTrigger value="documentos">Documentos</TabsTrigger>
              <TabsTrigger value="pagamento">Pagamento</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informações do Cliente</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Nome Completo</Label>
                      <p className="text-sm font-medium">{dadosProposta.clienteNome || dadosProposta.nomeCliente}</p>
                    </div>
                    <div>
                      <Label>CPF</Label>
                      <p className="text-sm font-medium">{formatCPF(dadosProposta.clienteCpf || dadosProposta.cpfCliente)}</p>
                    </div>
                    <div>
                      <Label>E-mail</Label>
                      <p className="text-sm">{dadosProposta.clienteEmail || 'Não informado'}</p>
                    </div>
                    <div>
                      <Label>Telefone</Label>
                      <p className="text-sm">{dadosProposta.clienteTelefone || 'Não informado'}</p>
                    </div>
                    <div>
                      <Label>Data de Nascimento</Label>
                      <p className="text-sm">{dadosProposta.clienteDataNascimento || 'Não informado'}</p>
                    </div>
                    <div>
                      <Label>Renda</Label>
                      <p className="text-sm">{dadosProposta.clienteRenda ? formatCurrency(Number(dadosProposta.clienteRenda)) : 'Não informado'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="financeiro" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Detalhes Financeiros</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Valor Solicitado</Label>
                      <p className="text-lg font-semibold text-green-600">
                        {formatCurrency(Number(dadosProposta.valor || dadosProposta.valorFinanciado || 0))}
                      </p>
                    </div>
                    <div>
                      <Label>Valor Total Financiado</Label>
                      <p className="text-lg font-semibold">
                        {formatCurrency(Number(dadosProposta.valorTotalFinanciado || dadosProposta.valorFinanciado || 0))}
                      </p>
                    </div>
                    <div>
                      <Label>Prazo</Label>
                      <p className="text-sm">{dadosProposta.prazo || dadosProposta.numeroParcelas || 0} parcelas</p>
                    </div>
                    <div>
                      <Label>Taxa de Juros</Label>
                      <p className="text-sm">{dadosProposta.taxaJuros || '0'}% ao mês</p>
                    </div>
                    <div>
                      <Label>IOF</Label>
                      <p className="text-sm">{formatCurrency(Number(dadosProposta.valorIof || dadosProposta.valorIOF || 0))}</p>
                    </div>
                    <div>
                      <Label>TAC</Label>
                      <p className="text-sm">{formatCurrency(Number(dadosProposta.valorTac || dadosProposta.valorTAC || 0))}</p>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <Label>Finalidade</Label>
                    <p className="text-sm">{dadosProposta.finalidade || 'Não informado'}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documentos" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Documentação</CardTitle>
                  <CardDescription>
                    Verifique se todos os documentos estão corretos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status da CCB */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-medium">CCB - Cédula de Crédito Bancário</p>
                          <p className="text-sm text-muted-foreground">
                            {dadosProposta.ccbGerado ? 'Gerada' : 'Não gerada'} | 
                            {dadosProposta.assinaturaEletronicaConcluida ? ' Assinada' : ' Não assinada'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {dadosProposta.assinaturaEletronicaConcluida ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Assinada
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pendente</Badge>
                        )}
                        {dadosProposta.assinaturaEletronicaConcluida && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleViewCCB}
                            disabled={isLoadingCcbUrl}
                          >
                            {isLoadingCcbUrl ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Ver CCB Assinada
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Informações do Storage */}
                    {ccbStatus && (
                      <div className="text-sm text-muted-foreground pl-12">
                        {ccbStatus.status?.salvaNoStorage ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <Check className="h-3 w-3" />
                            CCB armazenada no sistema
                          </span>
                        ) : (
                          <span>CCB será baixada do ClickSign quando visualizada</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Status de Formalização */}
                  <div className="space-y-2">
                    <Label>Status de Formalização</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2">
                        {dadosProposta.ccbGerado ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-gray-400" />
                        )}
                        <span className="text-sm">CCB Gerada</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {dadosProposta.assinaturaEletronicaConcluida ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-gray-400" />
                        )}
                        <span className="text-sm">Assinatura Eletrônica</span>
                      </div>
                    </div>
                  </div>

                  {/* Alerta se documentos não estiverem completos */}
                  {(!dadosProposta.ccbGerado || !dadosProposta.assinaturaEletronicaConcluida) && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        A documentação não está completa. Todos os documentos devem estar assinados antes de autorizar o pagamento.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pagamento" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Dados para Pagamento</CardTitle>
                  <CardDescription>
                    Informações bancárias do cliente para recebimento
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!pixKeyVisible ? (
                    <>
                      <Alert>
                        <Key className="h-4 w-4" />
                        <AlertDescription>
                          A chave PIX será liberada após a confirmação de veracidade dos documentos.
                        </AlertDescription>
                      </Alert>

                      <div className="space-y-3">
                        <div>
                          <Label>Banco</Label>
                          <p className="text-sm">{dadosProposta.dadosPagamentoBanco || dadosProposta.contaBancaria?.banco || 'Não informado'}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Agência</Label>
                            <p className="text-sm">{dadosProposta.dadosPagamentoAgencia || dadosProposta.contaBancaria?.agencia || '****'}</p>
                          </div>
                          <div>
                            <Label>Conta</Label>
                            <p className="text-sm">{dadosProposta.dadosPagamentoConta || dadosProposta.contaBancaria?.conta || '****'}</p>
                          </div>
                        </div>
                        <div>
                          <Label>Titular</Label>
                          <p className="text-sm">{dadosProposta.clienteNome || dadosProposta.nomeCliente || dadosProposta.contaBancaria?.titular}</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <Alert className="bg-green-50 border-green-200">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                          Pagamento autorizado! Chave PIX liberada para transferência.
                        </AlertDescription>
                      </Alert>

                      <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Chave PIX</Label>
                            <p className="text-lg font-mono font-semibold">
                              {dadosProposta.dadosPagamentoPix || dadosProposta.clienteCpf || dadosProposta.cpfCliente}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(dadosProposta.dadosPagamentoPix || dadosProposta.clienteCpf || dadosProposta.cpfCliente)}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Copiar
                          </Button>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <Label>Banco</Label>
                            <p>{dadosProposta.dadosPagamentoBanco || dadosProposta.contaBancaria?.banco}</p>
                          </div>
                          <div>
                            <Label>Titular</Label>
                            <p>{dadosProposta.clienteNome || dadosProposta.nomeCliente || dadosProposta.contaBancaria?.titular}</p>
                          </div>
                          <div>
                            <Label>Agência</Label>
                            <p>{dadosProposta.dadosPagamentoAgencia || dadosProposta.contaBancaria?.agencia}</p>
                          </div>
                          <div>
                            <Label>Conta</Label>
                            <p>{dadosProposta.dadosPagamentoConta || dadosProposta.contaBancaria?.conta}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {!pixKeyVisible && (dadosProposta.status === 'pronto_pagamento' || dadosProposta.status === 'em_processamento') && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                      Confirmação de Veracidade
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert variant="default">
                      <AlertDescription>
                        Ao confirmar a veracidade, você atesta que:
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>Todos os documentos foram verificados e estão corretos</li>
                          <li>Os dados do cliente foram validados</li>
                          <li>A CCB foi devidamente assinada</li>
                          <li>O pagamento está autorizado para liberação</li>
                        </ul>
                      </AlertDescription>
                    </Alert>

                    <div>
                      <Label>Observações (opcional)</Label>
                      <Textarea
                        placeholder="Adicione observações sobre a verificação..."
                        value={observacoes}
                        onChange={(e) => setObservacoes(e.target.value)}
                        className="mt-2"
                      />
                    </div>

                    <Button
                      className="w-full"
                      size="lg"
                      onClick={() => setShowConfirmDialog(true)}
                      disabled={!dadosProposta.assinaturaEletronicaConcluida}
                    >
                      <Shield className="h-5 w-5 mr-2" />
                      Confirmar Veracidade e Liberar Pagamento
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
          )}  {/* Fechamento do condicional de loading */}

          <DialogFooter>
            {!isLoadingProposta && !pixKeyVisible && (dadosProposta.status === 'pronto_pagamento' || dadosProposta.status === 'em_processamento') ? (
              <>
                <Button variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button
                  size="lg"
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={!dadosProposta.assinaturaEletronicaConcluida}
                >
                  <Shield className="h-5 w-5 mr-2" />
                  Confirmar e Liberar PIX
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação Final */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Confirmação Final
            </DialogTitle>
            <DialogDescription>
              Esta ação é irreversível e será registrada no sistema.
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Você confirma que todos os dados e documentos desta proposta são autênticos e autoriza a liberação do pagamento? 
              Esta ação é irreversível e será registrada com seu nome e horário.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancelar
            </Button>
            <Button 
              variant="default"
              onClick={() => confirmarVeracidadeMutation.mutate()}
              disabled={confirmarVeracidadeMutation.isPending}
            >
              {confirmarVeracidadeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Confirmando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Sim, Confirmar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}