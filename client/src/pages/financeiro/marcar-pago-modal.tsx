import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  _CheckCircle,
  _Upload,
  _File,
  _AlertTriangle,
  _Banknote,
  _Loader2,
  _FileText,
  Image as ImageIcon,
  _X,
} from 'lucide-react';

interface MarcarPagoModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposta: unknown;
  onConfirm: () => void;
}

export default function MarcarPagoModal({
  _isOpen,
  _onClose,
  _proposta,
  _onConfirm,
}: MarcarPagoModalProps) {
  const { toast } = useToast();
  const [observacoes, setObservacoes] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Mutation para marcar como pago
  const _marcarPagoMutation = useMutation({
    mutationFn: async () => {
      // BUG CORRIGIDO: Usar endpoint e parâmetros corretos do backend
      // Backend espera: PATCH /api/cobrancas/parcelas/:codigoSolicitacao/marcar-pago
      // Buscar codigoSolicitacao da primeira parcela não paga
      const _parcelaNaoPaga = proposta.parcelas?.find((p) => p.status !== 'pago');

      if (!parcelaNaoPaga?.codigoSolicitacao) {
        throw new Error('Nenhuma parcela elegível encontrada para marcação como paga');
      }

      const _formData = new FormData();
      formData.append('observacoes', observacoes);

      if (arquivo) {
        formData.append('comprovante', arquivo);
      }

      const _response = await fetch(
        `/api/cobrancas/parcelas/${parcelaNaoPaga.codigoSolicitacao}/marcar-pago`,
        {
          method: 'PATCH',
          credentials: 'include',
          body: formData,
        }
      );

      if (!response.ok) {
        const _errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao marcar como pago');
      }

      return response.json(); }
    },
    onSuccess: (_data) => {
      toast({
        title: '✅ Pagamento Confirmado',
        description: 'A proposta foi marcada como paga com sucesso.',
        className: 'bg-green-50 border-green-200',
      });

      // Resetar formulário
      setObservacoes('');
      setArquivo(null);
      setShowConfirmDialog(false);

      // PAM V1.0 FASE 2: Blindagem total - invalidar todos os caches relevantes
      queryClient.invalidateQueries({ queryKey: ['/api/pagamentos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cobrancas'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cobrancas/kpis'] });
      onConfirm();
    },
    onError: (error) => {
      toast({
        title: 'Erro ao marcar como pago',
        description: error.message || 'Não foi possível marcar a proposta como paga.',
        variant: 'destructive',
      });
    },
  });

  const _handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const _file = event.target.files?.[0];
    if (file) {
      // Validar tipo de arquivo
      const _allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: 'Tipo de arquivo inválido',
          description: 'Por favor, selecione um arquivo PDF, JPG ou PNG.',
          variant: 'destructive',
        });
        return;
      }

      // Validar tamanho (máximo 5MB)
      const _maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        toast({
          title: 'Arquivo muito grande',
          description: 'O arquivo deve ter no máximo 5MB.',
          variant: 'destructive',
        });
        return;
      }

      setArquivo(file);
    }
  };

  const _removeFile = () => {
    setArquivo(null);
    // Reset input
    const _input = document.getElementById('comprovante-input') as HTMLInputElement;
    if (input) input.value = '';
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

  const _getFileIcon = (type: string) => {
    if (type == 'application/pdf') return <FileText className="h-6 w-6 text-red-500" />; }
    if (type.startsWith('image/')) return <ImageIcon className="h-6 w-6 text-blue-500" />; }
    return <File className="h-6 w-6 text-gray-500" />; }
  };

  if (!proposta) return null; }

  return (
    <>
      <Dialog open={isOpen && !showConfirmDialog} onOpenChange={onClose}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-green-600" />
              Marcar como Pago
            </DialogTitle>
            <DialogDescription>
              Confirme que o pagamento foi realizado ao cliente e registre o comprovante
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Resumo da Proposta */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resumo do Pagamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Cliente</Label>
                    <p className="text-sm font-medium">{proposta.clienteNome}</p>
                  </div>
                  <div>
                    <Label>CPF</Label>
                    <p className="text-sm font-medium">{formatCPF(proposta.clienteCpf)}</p>
                  </div>
                  <div>
                    <Label>Valor a Pagar</Label>
                    <p className="text-lg font-semibold text-green-600">
                      {formatCurrency(
                        Number(proposta.valor) -
                          Number(proposta.valorTac) -
                          Number(proposta.valorIof)
                      )}
                    </p>
                  </div>
                  <div>
                    <Label>Forma de Pagamento</Label>
                    <p className="text-sm">PIX</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <Label>Chave PIX</Label>
                  <p className="rounded bg-gray-50 p-2 font-mono text-sm">
                    {proposta.dadosPagamentoPix || proposta.clienteCpf}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Alertas Importantes */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Atenção:</strong> Esta ação confirmará que o pagamento foi realizado ao
                cliente e a proposta será removida da lista de pagamentos pendentes. Esta ação é
                irreversível.
              </AlertDescription>
            </Alert>

            {/* Upload de Comprovante */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="comprovante-input">Comprovante de Pagamento (Opcional)</Label>
                <p className="mb-2 text-sm text-muted-foreground">
                  Anexe o comprovante do PIX ou transferência realizada (PDF, JPG ou PNG - máx. 5MB)
                </p>

                {!arquivo ? (
                  <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center transition-colors hover:border-gray-300">
                    <Upload className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                    <div className="mb-2 text-sm text-gray-600">
                      Clique para selecionar um arquivo ou arraste aqui
                    </div>
                    <Input
                      id="comprovante-input"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('comprovante-input')?.click()}
                    >
                      Selecionar Arquivo
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getFileIcon(arquivo.type)}
                        <div>
                          <p className="text-sm font-medium">{arquivo.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(arquivo.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={removeFile}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Observações */}
            <div>
              <Label htmlFor="observacoes">Observações (Opcional)</Label>
              <Textarea
                id="observacoes"
                placeholder="Adicione observações sobre o pagamento realizado..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="mt-2"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={() => setShowConfirmDialog(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Marcar como Pago
            </Button>
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
              Você confirma que o pagamento de{' '}
              <strong>
                {formatCurrency(
                  Number(proposta.valor) - Number(proposta.valorTac) - Number(proposta.valorIof)
                )}
              </strong>{' '}
              foi realizado via PIX para <strong>{proposta.clienteNome}</strong>? Esta ação é
              irreversível e será registrada com seu nome e horário.
            </AlertDescription>
          </Alert>

          {arquivo && (
            <div className="text-sm text-muted-foreground">
              <strong>Comprovante:</strong> {arquivo.name} será anexado ao registro.
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="default"
              onClick={() => marcarPagoMutation.mutate()}
              disabled={marcarPagoMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {marcarPagoMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
  _Sim, Confirmar Pagamento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
