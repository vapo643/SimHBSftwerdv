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
  DialogTitle,
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
  Check,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PaymentReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposta: any;
  onConfirm: () => void;
}

export default function PaymentReviewModal({
  isOpen,
  onClose,
  proposta,
  onConfirm,
}: PaymentReviewModalProps) {
  const { toast } = useToast();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [pixKeyVisible, setPixKeyVisible] = useState(false);
  const [ccbUrl, setCcbUrl] = useState<string | null>(null);

  // Debug: log when modal opens or props change
  useEffect(() => {
    if (isOpen) {
      console.log("🔍 [REVIEW MODAL DEBUG] Modal opened with proposta:", proposta);
      console.log("🔍 [REVIEW MODAL DEBUG] Proposta ID:", proposta?.id);
      console.log("🔍 [REVIEW MODAL DEBUG] All proposta keys:", Object.keys(proposta || {}));
    }
  }, [isOpen, proposta]);

  // Buscar dados completos da proposta quando o modal abrir
  const { data: propostaCompleta, isLoading: isLoadingProposta } = useQuery({
    queryKey: ["/api/pagamentos", proposta?.id, "detalhes-completos"],
    queryFn: async () => {
      const propostaId = proposta?.id;
      if (!propostaId) return null;

      console.log("[REVIEW MODAL] Proposta recebida:", proposta);
      console.log("[REVIEW MODAL] Buscando dados completos da proposta:", propostaId);
      const response = await apiRequest(`/api/pagamentos/${propostaId}/detalhes-completos`, {
        method: "GET",
      });
      console.log("[REVIEW MODAL] Dados recebidos do backend:", response);
      console.log("[REVIEW MODAL] Campos importantes:", {
        clienteEmail: response?.clienteEmail,
        clienteTelefone: response?.clienteTelefone,
        clienteDataNascimento: response?.clienteDataNascimento,
        clienteRenda: response?.clienteRenda,
        prazo: response?.prazo,
        taxaJuros: response?.taxaJuros,
        finalidade: response?.finalidade,
        ccbGerado: response?.ccbGerado,
        caminhoCcbAssinado: response?.caminhoCcbAssinado,
      });
      return response;
    },
    enabled: isOpen && !!proposta?.id,
  });

  // Buscar status da CCB no Storage
  const { data: ccbStatus, isLoading: isLoadingCcbStatus } = useQuery({
    queryKey: ["/api/pagamentos", propostaCompleta?.id, "ccb-storage-status"],
    queryFn: async () => {
      if (!propostaCompleta?.id) return null;
      return await apiRequest(`/api/pagamentos/${propostaCompleta.id}/ccb-storage-status`, {
        method: "GET",
      });
    },
    enabled: isOpen && !!propostaCompleta?.id,
  });

  // Buscar URL da CCB quando necessário
  const {
    data: ccbUrlData,
    isLoading: isLoadingCcbUrl,
    refetch: refetchCcbUrl,
  } = useQuery({
    queryKey: ["/api/pagamentos", propostaCompleta?.id, "ccb-url"],
    queryFn: async () => {
      if (!propostaCompleta?.id) return null;
      return await apiRequest(`/api/pagamentos/${propostaCompleta.id}/ccb-url`, {
        method: "GET",
      });
    },
    enabled: false, // Só buscar quando solicitado
  });

  // Confirmar veracidade
  const confirmarVeracidadeMutation = useMutation({
    mutationFn: async () => {
      const propostaId = proposta?.id;
      console.log("[REVIEW MODAL] Confirmando veracidade para proposta:", propostaId);
      return await apiRequest(`/api/pagamentos/${propostaId}/confirmar-veracidade`, {
        method: "POST",
        body: JSON.stringify({ observacoes }),
      });
    },
    onSuccess: data => {
      console.log("✅ [REVIEW MODAL] Veracidade confirmada com sucesso:", data);
      toast({
        title: "✅ Veracidade Confirmada",
        description: "Pagamento autorizado com sucesso. Chave PIX liberada.",
        className: "bg-green-50 border-green-200",
      });
      setPixKeyVisible(true);
      setShowConfirmDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/pagamentos"] });
      onConfirm();
    },
    onError: (error: any) => {
      console.error("❌ [REVIEW MODAL] Erro ao confirmar veracidade:", error);
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
      window.open(result.data.url, "_blank");
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

  // Use os dados completos da proposta, ou os dados básicos se ainda estiver carregando
  const dadosProposta = propostaCompleta || proposta;

  console.log("🔍 [REVIEW MODAL DEBUG] dadosProposta final:", dadosProposta);
  console.log("🔍 [REVIEW MODAL DEBUG] isLoadingProposta:", isLoadingProposta);
  console.log("🔍 [REVIEW MODAL DEBUG] propostaCompleta:", propostaCompleta);

  if (!proposta) {
    console.log("⚠️ [REVIEW MODAL DEBUG] Proposta não encontrada, fechando modal");
    return null;
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Revisão e Confirmação de Pagamento
            </DialogTitle>
            <DialogDescription>
              {isLoadingProposta
                ? "Carregando dados..."
                : "Verifique todos os dados antes de autorizar o pagamento"}
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
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {dadosProposta.cliente_nome ||
                            dadosProposta.clienteNome ||
                            dadosProposta.nomeCliente}
                        </p>
                      </div>
                      <div>
                        <Label>CPF</Label>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {formatCPF(
                            dadosProposta.cliente_cpf ||
                              dadosProposta.clienteCpf ||
                              dadosProposta.cpfCliente
                          )}
                        </p>
                      </div>
                      <div>
                        <Label>E-mail</Label>
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          {dadosProposta.cliente_email ||
                            dadosProposta.clienteEmail ||
                            "Não informado"}
                        </p>
                      </div>
                      <div>
                        <Label>Telefone</Label>
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          {dadosProposta.cliente_telefone ||
                            dadosProposta.clienteTelefone ||
                            "Não informado"}
                        </p>
                      </div>
                      <div>
                        <Label>Data de Nascimento</Label>
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          {dadosProposta.cliente_data_nascimento ||
                          dadosProposta.clienteDataNascimento
                            ? format(
                                new Date(
                                  dadosProposta.cliente_data_nascimento ||
                                    dadosProposta.clienteDataNascimento
                                ),
                                "dd/MM/yyyy",
                                { locale: ptBR }
                              )
                            : "Não informado"}
                        </p>
                      </div>
                      <div>
                        <Label>Renda</Label>
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          {dadosProposta.cliente_renda || dadosProposta.clienteRenda
                            ? formatCurrency(
                                Number(dadosProposta.cliente_renda || dadosProposta.clienteRenda)
                              )
                            : "Não informado"}
                        </p>
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
                          {formatCurrency(
                            Number(dadosProposta.valor || dadosProposta.valorFinanciado || 0)
                          )}
                        </p>
                      </div>
                      <div>
                        <Label>Valor Total Financiado</Label>
                        <p className="text-lg font-semibold">
                          {formatCurrency(
                            Number(
                              dadosProposta.valorTotalFinanciado ||
                                dadosProposta.valorFinanciado ||
                                0
                            )
                          )}
                        </p>
                      </div>
                      <div>
                        <Label>Prazo</Label>
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          {dadosProposta.prazo || dadosProposta.numeroParcelas || "Não informado"}{" "}
                          {dadosProposta.prazo ? "parcelas" : ""}
                        </p>
                      </div>
                      <div>
                        <Label>Taxa de Juros</Label>
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          {dadosProposta.taxa_juros || dadosProposta.taxaJuros || "Não informado"}
                          {dadosProposta.taxa_juros || dadosProposta.taxaJuros ? "% ao mês" : ""}
                        </p>
                      </div>
                      <div>
                        <Label>IOF</Label>
                        <p className="text-sm">
                          {formatCurrency(
                            Number(dadosProposta.valorIof || dadosProposta.valorIOF || 0)
                          )}
                        </p>
                      </div>
                      <div>
                        <Label>TAC</Label>
                        <p className="text-sm">
                          {formatCurrency(
                            Number(dadosProposta.valorTac || dadosProposta.valorTAC || 0)
                          )}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <Label>Finalidade</Label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {dadosProposta.finalidade || "Não informado"}
                      </p>
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
                      <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-blue-600" />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              CCB - Cédula de Crédito Bancário
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {dadosProposta.ccbGerado ? "Gerada" : "Não gerada"} |
                              {dadosProposta.assinaturaEletronicaConcluida
                                ? " Assinada"
                                : " Não assinada"}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {dadosProposta.assinaturaEletronicaConcluida ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Assinada
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="dark:bg-gray-700 dark:text-gray-200"
                            >
                              Pendente
                            </Badge>
                          )}
                          {dadosProposta.assinaturaEletronicaConcluida && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                // First check if CCB is stored locally
                                const ccbPath =
                                  dadosProposta.caminho_ccb_assinado ||
                                  dadosProposta.ccb_documento_url;
                                console.log("🔍 [CCB DEBUG] CCB Path encontrado:", ccbPath);

                                if (ccbPath) {
                                  // Open CCB from local storage
                                  const ccbUrl = `/api/documentos/download?path=${encodeURIComponent(ccbPath)}`;
                                  console.log("🔍 [CCB DEBUG] Abrindo CCB local:", ccbUrl);
                                  window.open(ccbUrl, "_blank");
                                } else {
                                  // Fallback to ClickSign
                                  console.log(
                                    "🔍 [CCB DEBUG] CCB local não encontrada, tentando ClickSign..."
                                  );
                                  handleViewCCB();
                                }
                              }}
                              disabled={isLoadingCcbUrl}
                            >
                              {isLoadingCcbUrl ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  Ver CCB Assinada
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Informações do Storage */}
                      <div className="pl-12 text-sm text-muted-foreground">
                        {dadosProposta.caminho_ccb_assinado || dadosProposta.ccb_documento_url ? (
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <Check className="h-3 w-3" />
                            CCB armazenada no sistema:{" "}
                            {dadosProposta.caminho_ccb_assinado || dadosProposta.ccb_documento_url}
                          </span>
                        ) : ccbStatus?.status?.salvaNoStorage ? (
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <Check className="h-3 w-3" />
                            CCB armazenada no sistema
                          </span>
                        ) : (
                          <span className="text-gray-600 dark:text-gray-400">
                            CCB será baixada do ClickSign quando visualizada
                          </span>
                        )}
                      </div>
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
                          A documentação não está completa. Todos os documentos devem estar
                          assinados antes de autorizar o pagamento.
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
                            A chave PIX será liberada após a confirmação de veracidade dos
                            documentos.
                          </AlertDescription>
                        </Alert>

                        <div className="space-y-3">
                          <div>
                            <Label>Banco</Label>
                            <p className="text-sm">
                              {dadosProposta.dadosPagamentoBanco ||
                                dadosProposta.contaBancaria?.banco ||
                                "Não informado"}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Agência</Label>
                              <p className="text-sm">
                                {dadosProposta.dadosPagamentoAgencia ||
                                  dadosProposta.contaBancaria?.agencia ||
                                  "****"}
                              </p>
                            </div>
                            <div>
                              <Label>Conta</Label>
                              <p className="text-sm">
                                {dadosProposta.dadosPagamentoConta ||
                                  dadosProposta.contaBancaria?.conta ||
                                  "****"}
                              </p>
                            </div>
                          </div>
                          <div>
                            <Label>Titular</Label>
                            <p className="text-sm">
                              {dadosProposta.clienteNome ||
                                dadosProposta.nomeCliente ||
                                dadosProposta.contaBancaria?.titular}
                            </p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-4">
                        <Alert className="border-green-200 bg-green-50">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <AlertDescription className="text-green-800">
                            Pagamento autorizado! Chave PIX liberada para transferência.
                          </AlertDescription>
                        </Alert>

                        <div className="space-y-3 rounded-lg bg-gray-50 p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Chave PIX</Label>
                              <p className="font-mono text-lg font-semibold">
                                {dadosProposta.dadosPagamentoPix ||
                                  dadosProposta.clienteCpf ||
                                  dadosProposta.cpfCliente}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                copyToClipboard(
                                  dadosProposta.dadosPagamentoPix ||
                                    dadosProposta.clienteCpf ||
                                    dadosProposta.cpfCliente
                                )
                              }
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              Copiar
                            </Button>
                          </div>

                          <Separator />

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <Label>Banco</Label>
                              <p>
                                {dadosProposta.dadosPagamentoBanco ||
                                  dadosProposta.contaBancaria?.banco}
                              </p>
                            </div>
                            <div>
                              <Label>Titular</Label>
                              <p>
                                {dadosProposta.clienteNome ||
                                  dadosProposta.nomeCliente ||
                                  dadosProposta.contaBancaria?.titular}
                              </p>
                            </div>
                            <div>
                              <Label>Agência</Label>
                              <p>
                                {dadosProposta.dadosPagamentoAgencia ||
                                  dadosProposta.contaBancaria?.agencia}
                              </p>
                            </div>
                            <div>
                              <Label>Conta</Label>
                              <p>
                                {dadosProposta.dadosPagamentoConta ||
                                  dadosProposta.contaBancaria?.conta}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {!pixKeyVisible &&
                  (dadosProposta.status === "pronto_pagamento" ||
                    dadosProposta.status === "em_processamento") && (
                    <Card className="border-orange-200 bg-orange-50">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <AlertTriangle className="h-5 w-5 text-orange-600" />
                          Confirmação de Veracidade
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Alert variant="default">
                          <AlertDescription>
                            Ao confirmar a veracidade, você atesta que:
                            <ul className="mt-2 list-inside list-disc space-y-1">
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
                            onChange={e => setObservacoes(e.target.value)}
                            className="mt-2"
                          />
                        </div>

                        <Button
                          className="w-full"
                          size="lg"
                          onClick={() => setShowConfirmDialog(true)}
                          disabled={!dadosProposta.assinaturaEletronicaConcluida}
                        >
                          <Shield className="mr-2 h-5 w-5" />
                          Confirmar Veracidade e Liberar Pagamento
                        </Button>
                      </CardContent>
                    </Card>
                  )}
              </TabsContent>
            </Tabs>
          )}{" "}
          {/* Fechamento do condicional de loading */}
          <DialogFooter>
            {!isLoadingProposta &&
            !pixKeyVisible &&
            (dadosProposta.status === "pronto_pagamento" ||
              dadosProposta.status === "em_processamento") ? (
              <>
                <Button variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button
                  size="lg"
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={!dadosProposta.assinaturaEletronicaConcluida}
                >
                  <Shield className="mr-2 h-5 w-5" />
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
              Você confirma que todos os dados e documentos desta proposta são autênticos e autoriza
              a liberação do pagamento? Esta ação é irreversível e será registrada com seu nome e
              horário.
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirmando...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
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
