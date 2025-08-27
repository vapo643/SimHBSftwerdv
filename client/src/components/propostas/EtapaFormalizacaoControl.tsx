import React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface EtapaFormalizacaoControlProps {
  propostaId: string;
  etapa: 'ccb_gerado' | 'assinatura_eletronica' | 'biometria';
  titulo: string;
  descricao: string;
  concluida: boolean;
  habilitada: boolean;
  onUpdate?: () => void;
}

export const EtapaFormalizacaoControl: React.FC<EtapaFormalizacaoControlProps> = ({
  propostaId,
  etapa,
  titulo,
  descricao,
  concluida,
  habilitada,
  onUpdate,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateEtapa = useMutation({
    mutationFn: async (novaConcluida: boolean) => {
      const response = await api.patch(`/api/propostas/${propostaId}/etapa-formalizacao`, {
        etapa,
        concluida: novaConcluida,
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: 'Etapa atualizada',
        description: `${titulo} foi ${concluida ? 'desmarcada' : 'marcada'} com sucesso`,
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/propostas/${propostaId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/propostas/formalizacao'] });

      if (onUpdate) {
        onUpdate();
      }
    },
    onError: (error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message : 'Ocorreu um erro ao atualizar a etapa';
      toast({
        title: 'Erro ao atualizar etapa',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  const handleToggle = () => {
    if (habilitada) {
      updateEtapa.mutate(!concluida);
    }
  };

  return (
    <Card
      className={`p-4 ${!habilitada ? 'opacity-50' : ''} ${concluida ? 'border-green-700 bg-green-900/20' : 'border-gray-700 bg-gray-800'}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-start space-x-3">
          <div className="mt-1">
            {concluida ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : habilitada ? (
              <Clock className="h-5 w-5 text-blue-400" />
            ) : (
              <AlertCircle className="h-5 w-5 text-gray-500" />
            )}
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-white">{titulo}</h4>
            <p className="mt-1 text-sm text-gray-400">{descricao}</p>
            {!habilitada && !concluida && (
              <p className="mt-2 flex items-center text-xs text-yellow-500">
                <AlertCircle className="mr-1 h-3 w-3" />
                Complete as etapas anteriores primeiro
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Checkbox
            checked={concluida}
            onCheckedChange={handleToggle}
            disabled={!habilitada || updateEtapa.isPending}
            className="data-[state=checked]:border-green-600 data-[state=checked]:bg-green-600"
          />
          <Button
            variant={concluida ? 'secondary' : 'default'}
            size="sm"
            onClick={handleToggle}
            disabled={!habilitada || updateEtapa.isPending}
          >
            {updateEtapa.isPending
              ? 'Atualizando...'
              : concluida
                ? 'Desmarcar'
                : 'Marcar como Concluída'}
          </Button>
        </div>
      </div>

      {/* Additional info for specific steps */}
      {etapa === 'ccb_gerado' && concluida && (
        <div className="mt-3 rounded-md border border-blue-700 bg-blue-900/20 p-3">
          <p className="text-xs text-blue-300">
            ✓ CCB gerada automaticamente. O documento será enviado para assinatura eletrônica.
          </p>
        </div>
      )}

      {etapa === 'assinatura_eletronica' && concluida && (
        <div className="mt-3 rounded-md border border-purple-700 bg-purple-900/20 p-3">
          <p className="text-xs text-purple-300">
            ✓ Documento enviado para ClickSign. Aguardando assinatura do cliente.
          </p>
        </div>
      )}

      {etapa === 'biometria' && concluida && (
        <div className="mt-3 rounded-md border border-green-700 bg-green-900/20 p-3">
          <p className="text-xs text-green-300">
            ✓ Biometria validada. Boletos gerados para pagamento.
          </p>
        </div>
      )}
    </Card>
  );
};
