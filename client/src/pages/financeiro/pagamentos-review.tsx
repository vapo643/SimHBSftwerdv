import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  CheckCircle,
  FileText,
  Shield,
  CreditCard,
  Copy,
  ExternalLink,
  Key,
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
      
      // Verificar se foi uma resposta idempotente
      if ((data as any).idempotent) {
        toast({
          title: "Pagamento já autorizado",
          description: "Este pagamento já foi autorizado anteriormente.",
          className: "bg-blue-50 border-blue-200",
        });
      } else {
        toast({
          title: "✅ Veracidade Confirmada",
          description: "Pagamento autorizado com sucesso. Chave PIX liberada.",
          className: "bg-green-50 border-green-200",
        });
      }
      
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

  // Função para visualizar CCB com autenticação JWT
  const handleViewCCB = async () => {
    try {
      const ccbPath = proposta.caminhoCcbAssinado || proposta.ccb_documento_url;
      
      if (ccbPath) {
        // Usar apiRequest com blob para incluir JWT token
        const blob = await apiRequest(
          `/api/documentos/download?path=${encodeURIComponent(ccbPath)}`,
          { method: "GET", responseType: "blob" }
        ) as Blob;
        
        // Criar URL temporária e fazer download
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = `CCB-${proposta.id}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(downloadUrl);
        
        toast({
          title: "CCB baixada com sucesso",
          description: "O documento foi salvo no seu computador.",
        });
      } else if (proposta.clicksign_document_key) {
        // Fallback para ClickSign (não precisa de JWT)
        window.open(`https://app.clicksign.com/documents/${proposta.clicksign_document_key}`, "_blank");
      } else {
        toast({
          title: "CCB não disponível",
          description: "Documento ainda não foi gerado.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("❌ [CCB DOWNLOAD] Erro:", error);
      toast({
        title: "Erro ao baixar CCB",
        description: error.message || "Não foi possível baixar o documento.",
        variant: "destructive",
      });
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

  if (!proposta) {
    return null;
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Confirmação de Pagamento
            </DialogTitle>
            <DialogDescription>
              Verifique os dados essenciais antes de autorizar o pagamento
            </DialogDescription>
          </DialogHeader>

          {/* PRINCÍPIO DO MINIMALISMO CRÍTICO - Apenas 5 campos essenciais */}
          <div className="space-y-4 mt-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                {/* Campo 1: Valor Solicitado */}
                <div>
                  <Label>Valor Solicitado</Label>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(Number(proposta.valor || 0))}
                  </p>
                </div>

                <Separator />

                {/* Campo 2 e 3: Nome e CPF */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nome do Cliente</Label>
                    <p className="font-medium">{proposta.cliente_nome || proposta.clienteNome}</p>
                  </div>
                  <div>
                    <Label>CPF</Label>
                    <p className="font-medium">{formatCPF(proposta.cliente_cpf || proposta.clienteCpf)}</p>
                  </div>
                </div>

                <Separator />

                {/* Campo 4: Dados Bancários */}
                <div>
                  <Label>Dados Bancários para Pagamento</Label>
                  <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-1">
                    <p className="text-sm">
                      <span className="font-medium">Banco:</span>{" "}
                      {proposta.dados_pagamento_banco || proposta.dadosPagamentoBanco || "Não informado"}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Agência:</span>{" "}
                      {proposta.dados_pagamento_agencia || proposta.dadosPagamentoAgencia || "Não informado"}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Conta:</span>{" "}
                      {proposta.dados_pagamento_conta || proposta.dadosPagamentoConta || "Não informado"}
                    </p>
                    {(proposta.dados_pagamento_pix || proposta.dadosPagamentoPix) && (
                      <p className="text-sm">
                        <span className="font-medium">PIX:</span>{" "}
                        {proposta.dados_pagamento_pix || proposta.dadosPagamentoPix}
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Campo 5: CCB Assinada */}
                <div>
                  <Label>Documento CCB</Label>
                  <div className="mt-2 flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <span className="text-sm">
                        {proposta.assinatura_eletronica_concluida || proposta.assinaturaEletronicaConcluida
                          ? "CCB Assinada Eletronicamente"
                          : "CCB Pendente de Assinatura"}
                      </span>
                    </div>
                    {(proposta.assinatura_eletronica_concluida || proposta.assinaturaEletronicaConcluida) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleViewCCB}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Ver CCB
                      </Button>
                    )}
                  </div>
                </div>

                {/* Verificação de Segurança */}
                {(!proposta.assinatura_eletronica_concluida && !proposta.assinaturaEletronicaConcluida) && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      A CCB deve estar assinada antes de autorizar o pagamento.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Área de PIX após confirmação */}
                {pixKeyVisible && (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      <div className="space-y-2">
                        <p>Pagamento autorizado! Chave PIX liberada:</p>
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-lg font-bold">
                            {proposta.dados_pagamento_pix || proposta.dadosPagamentoPix || proposta.cliente_cpf || proposta.clienteCpf}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(proposta.dados_pagamento_pix || proposta.dadosPagamentoPix || proposta.cliente_cpf || proposta.clienteCpf)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Observações (opcional) */}
                {!pixKeyVisible && (proposta.status === "pronto_pagamento" || proposta.status === "em_processamento") && (
                  <div>
                    <Label>Observações (opcional)</Label>
                    <Textarea
                      placeholder="Adicione observações sobre a verificação..."
                      value={observacoes}
                      onChange={e => setObservacoes(e.target.value)}
                      className="mt-2"
                      rows={3}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            {!pixKeyVisible && (proposta.status === "pronto_pagamento" || proposta.status === "em_processamento") ? (
              <>
                <Button variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={!proposta.assinatura_eletronica_concluida && !proposta.assinaturaEletronicaConcluida}
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Confirmar Veracidade
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
              Esta ação autorizará o pagamento. Tem certeza?
            </DialogDescription>
          </DialogHeader>

          <Alert>
            <Key className="h-4 w-4" />
            <AlertDescription>
              Ao confirmar, você atesta que todos os documentos foram verificados e o pagamento está autorizado.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                confirmarVeracidadeMutation.mutate();
              }}
              disabled={confirmarVeracidadeMutation.isPending}
            >
              {confirmarVeracidadeMutation.isPending ? (
                "Confirmando..."
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Autorizar Pagamento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
