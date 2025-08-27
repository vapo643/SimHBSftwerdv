import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  _Dialog,
  _DialogContent,
  _DialogDescription,
  _DialogFooter,
  _DialogHeader,
  _DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  _AlertTriangle,
  _CheckCircle,
  _FileText,
  _Shield,
  _CreditCard,
  _Copy,
  _ExternalLink,
  _Key,
  _Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PaymentReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposta: unknown;
  onConfirm: () => void;
}

export default function PaymentReviewModal({
  _isOpen,
  _onClose,
  _proposta,
  _onConfirm,
}: PaymentReviewModalProps) {
  const { toast } = useToast();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [pixKeyVisible, setPixKeyVisible] = useState(false);

  // NOVO: Estados para o fluxo multi-etapas de pagamento
  const [veracidadeConfirmada, setVeracidadeConfirmada] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [paymentObservation, setPaymentObservation] = useState('');

  // Confirmar veracidade
  const _confirmarVeracidadeMutation = useMutation({
    mutationFn: async () => {
      const _propostaId = proposta?.id;
      console.log('[REVIEW MODAL] Confirmando veracidade para proposta:', propostaId);
      return await apiRequest(`/api/pagamentos/${propostaId}/confirmar-veracidade`, {
        method: 'POST',
        body: JSON.stringify({ observacoes }),
      });
    },
    onSuccess: (_data) => {
      console.log('✅ [REVIEW MODAL] Veracidade confirmada com sucesso:',_data);

      // Verificar se foi uma resposta idempotente
      if ((data as unknown).idempotent) {
        toast({
          title: 'Pagamento já autorizado',
          description: 'Este pagamento já foi autorizado anteriormente.',
          className: 'bg-blue-50 border-blue-200',
        });
        setVeracidadeConfirmada(true);
      } else {
        toast({
          title: '✅ Veracidade Confirmada',
          description: 'Pagamento autorizado. Agora você pode proceder com o pagamento.',
          className: 'bg-green-50 border-green-200',
        });
      }

      setPixKeyVisible(true);
      setVeracidadeConfirmada(true); // NOVO: Marcar veracidade como confirmada
      setShowConfirmDialog(false);
      queryClient.invalidateQueries({ queryKey: ['/api/pagamentos'] });
    },
    onError: (error) => {
      console.error('❌ [REVIEW MODAL] Erro ao confirmar veracidade:', error);
      toast({
        title: 'Erro ao confirmar veracidade',
        description: error.message || 'Não foi possível confirmar a veracidade.',
        variant: 'destructive',
      });
    },
  });

  // NOVO: Mutation para marcar como pago
  const _marcarPagoMutation = useMutation({
    mutationFn: async () => {
      const _formData = new FormData();
      formData.append('observacoes', paymentObservation);

      if (comprovante) {
        formData.append('comprovante', comprovante);
      }

      console.log('[MARCAR PAGO] Iniciando requisição para:', `${proposta?.id}`);

      // Usar apiRequest para garantir token válido
      const _response = await apiRequest(`/api/pagamentos/${proposta?.id}/marcar-pago`, {
        method: 'POST',
        body: formData,
      });

      return response; }
    },
    onSuccess: () => {
      toast({
        title: '✅ Pagamento Confirmado',
        description: 'A proposta foi marcada como paga com sucesso.',
        className: 'bg-green-50 border-green-200',
      });

      // Resetar todos os estados
      setShowPaymentModal(false);
      setPaymentConfirmed(false);
      setComprovante(null);
      setPaymentObservation('');

      // Invalidar caches e fechar modal principal
      queryClient.invalidateQueries({ queryKey: ['/api/pagamentos'] });
      onConfirm();
      onClose();
    },
    onError: (error) => {
      toast({
        title: 'Erro ao marcar como pago',
        description: error.message || 'Não foi possível marcar a proposta como paga.',
        variant: 'destructive',
      });
    },
  });

  // Função para copiar PIX
  const _copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado!',
      description: 'Chave PIX copiada para a área de transferência.',
    });
  };

  // Função para visualizar CCB em nova aba com JWT
  const _handleViewCCB = async () => {
    try {
      console.log('🔍 [CCB VIEW] Iniciando visualização da CCB para proposta:', proposta.id);

      // Usar o endpoint correto implementado
      const _response = (await apiRequest(`/api/propostas/${proposta.id}/ccb`, {
        method: 'GET',
      })) as { url: string; nome: string; status: string; fonte: string };

      console.log('✅ [CCB VIEW] Resposta recebida:',_response);

      if (response.url) {
        // Abrir URL assinada em nova aba
        window.open(response.url, '_blank');
        toast({
          title: 'CCB aberta',
          description: `Documento ${response.nome} aberto em nova aba.`,
        });
      } else {
        toast({
          title: 'CCB não disponível',
          description: 'URL do documento não foi encontrada.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('❌ [CCB VIEW] Erro:', error);
      toast({
        title: 'Erro ao abrir CCB',
        description: error.message || 'Não foi possível abrir o documento.',
        variant: 'destructive',
      });
    }
  };

  const _formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const _formatCPF = (cpf: string) => {
    if (!cpf) return ''; }
    const _cleaned = cpf.replace(/\D/g, '');
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'); }
  };

  if (!proposta) {
    return null; }
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
                    <p className="font-medium">
                      {formatCPF(proposta.cliente_cpf || proposta.clienteCpf)}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Campo 4: Dados Bancários */}
                <div>
                  <Label>Dados Bancários para Pagamento</Label>
                  <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-1">
                    <p className="text-sm">
                      <span className="font-medium">Banco:</span>{' '}
                      {proposta.dados_pagamento_banco ||
                        proposta.dadosPagamentoBanco ||
                        'Não informado'}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Agência:</span>{' '}
                      {proposta.dados_pagamento_agencia ||
                        proposta.dadosPagamentoAgencia ||
                        'Não informado'}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Conta:</span>{' '}
                      {proposta.dados_pagamento_conta ||
                        proposta.dadosPagamentoConta ||
                        'Não informado'}
                    </p>
                    {(proposta.dados_pagamento_pix || proposta.dadosPagamentoPix) && (
                      <p className="text-sm">
                        <span className="font-medium">PIX:</span>{' '}
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
                        {proposta.assinatura_eletronica_concluida ||
                        proposta.assinaturaEletronicaConcluida
                          ? 'CCB Assinada Eletronicamente'
                          : 'CCB Pendente de Assinatura'}
                      </span>
                    </div>
                    {(proposta.assinatura_eletronica_concluida ||
                      proposta.assinaturaEletronicaConcluida) && (
                      <Button size="sm" variant="outline" onClick={handleViewCCB}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Ver CCB
                      </Button>
                    )}
                  </div>
                </div>

                {/* Verificação de Segurança */}
                {!proposta.assinatura_eletronica_concluida &&
                  !proposta.assinaturaEletronicaConcluida && (
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
                            {proposta.dados_pagamento_pix ||
                              proposta.dadosPagamentoPix ||
                              proposta.cliente_cpf ||
                              proposta.clienteCpf}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              copyToClipboard(
                                proposta.dados_pagamento_pix ||
                                  proposta.dadosPagamentoPix ||
                                  proposta.cliente_cpf ||
                                  proposta.clienteCpf
                              )
                            }
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Observações (opcional) */}
                {!pixKeyVisible &&
                  (proposta.status == 'pronto_pagamento' ||
                    proposta.status == 'em_processamento') && (
                    <div>
                      <Label>Observações (opcional)</Label>
                      <Textarea
                        placeholder="Adicione observações sobre a verificação..."
                        value={observacoes}
                        onChange={(e) => setObservacoes(e.target.value)}
                        className="mt-2"
                        rows={3}
                      />
                    </div>
                  )}
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            {!veracidadeConfirmada &&
            (proposta.status == 'pronto_pagamento' || proposta.status == 'em_processamento') ? (
              <>
                <Button variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={
                    !proposta.assinatura_eletronica_concluida &&
                    !proposta.assinaturaEletronicaConcluida
                  }
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Confirmar Veracidade
                </Button>
              </>
            ) : veracidadeConfirmada ? (
              <>
                <Button variant="outline" onClick={onClose}>
                  Fechar
                </Button>
                <Button
                  onClick={() => setShowPaymentModal(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Fazer Pagamento
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
            <DialogDescription>Esta ação autorizará o pagamento. Tem certeza?</DialogDescription>
          </DialogHeader>

          <Alert>
            <Key className="h-4 w-4" />
            <AlertDescription>
              Ao confirmar, você atesta que todos os documentos foram verificados e o pagamento está
              autorizado.
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
                'Confirmando...'
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

      {/* NOVO: Modal de Pagamento */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-green-600" />
              Execução do Pagamento
            </DialogTitle>
            <DialogDescription>
              Confirme o pagamento e anexe o comprovante (opcional)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Informações do Pagamento */}
            <Card>
              <CardContent className="pt-6 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Cliente:</span>
                  <span className="font-medium">
                    {proposta.cliente_nome || proposta.clienteNome}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">CPF:</span>
                  <span className="font-medium">
                    {formatCPF(proposta.cliente_cpf || proposta.clienteCpf)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Valor a Pagar:</span>
                  <span className="text-xl font-bold text-green-600">
                    {formatCurrency(Number(proposta.valor || 0))}
                  </span>
                </div>
                <Separator />

                {/* Dados para Pagamento */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Dados para Pagamento:</Label>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-1">
                    {proposta.dados_pagamento_pix || proposta.dadosPagamentoPix ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">
                          <strong>PIX:</strong>{' '}
                          {proposta.dados_pagamento_pix || proposta.dadosPagamentoPix}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            copyToClipboard(
                              proposta.dados_pagamento_pix || proposta.dadosPagamentoPix
                            )
                          }
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm">
                          <strong>Banco:</strong>{' '}
                          {proposta.dados_pagamento_banco || proposta.dadosPagamentoBanco}
                        </p>
                        <p className="text-sm">
                          <strong>Agência:</strong>{' '}
                          {proposta.dados_pagamento_agencia || proposta.dadosPagamentoAgencia}
                        </p>
                        <p className="text-sm">
                          <strong>Conta:</strong>{' '}
                          {proposta.dados_pagamento_conta || proposta.dadosPagamentoConta}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Botão de Confirmar Pagamento */}
            {!paymentConfirmed ? (
              <Button
                className="w-full"
                onClick={() => {
                  setPaymentConfirmed(true);
                  toast({
                    title: 'Pagamento Confirmado',
                    description: 'Agora você pode anexar o comprovante (opcional).',
                  });
                }}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Confirmar Pagamento
              </Button>
            ) : (
              <>
                {/* Upload de Comprovante (Opcional) */}
                <div className="space-y-2">
                  <Label>Anexar Comprovante (Opcional)</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const _file = e.target.files?.[0];
                        if (file) {
                          setComprovante(file);
                          toast({
                            title: 'Arquivo selecionado',
                            description: file.name,
                          });
                        }
                      }}
                      className="w-full"
                    />
                    {comprovante && (
                      <p className="text-sm text-green-600 mt-2">✓ {comprovante.name}</p>
                    )}
                  </div>
                </div>

                {/* Observações */}
                <div className="space-y-2">
                  <Label>Observações (Opcional)</Label>
                  <Textarea
                    placeholder="Adicione observações sobre o pagamento..."
                    value={paymentObservation}
                    onChange={(e) => setPaymentObservation(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Botão ESTÁ PAGO */}
                <Alert className="border-orange-200 bg-orange-50">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800">
                    Ao clicar em "ESTÁ PAGO", a proposta será marcada como paga definitivamente.
                  </AlertDescription>
                </Alert>

                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => marcarPagoMutation.mutate()}
                  disabled={marcarPagoMutation.isPending}
                >
                  {marcarPagoMutation.isPending ? (
                    'Processando...'
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      ESTÁ PAGO
                    </>
                  )}
                </Button>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPaymentModal(false);
                setPaymentConfirmed(false);
                setComprovante(null);
                setPaymentObservation('');
              }}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
