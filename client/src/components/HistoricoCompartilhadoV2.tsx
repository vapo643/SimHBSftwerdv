import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { api } from "@/lib/apiClient";

interface HistoricoCompartilhadoV2Props {
  propostaId: string;
  context?: 'analise' | 'edicao';
}

const HistoricoCompartilhadoV2: React.FC<HistoricoCompartilhadoV2Props> = ({ 
  propostaId, 
  context = 'analise' 
}) => {
  // Query para buscar dados da proposta com auto-refresh
  const { data: proposta, isLoading } = useQuery({
    queryKey: [`/api/propostas/${propostaId}`],
    queryFn: async () => {
      const response = await api.get(`/api/propostas/${propostaId}`);
      return response.data;
    },
    enabled: !!propostaId,
    refetchInterval: 12000, // Refetch a cada 12 segundos
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0, // Always fresh data
  });

  // Query para buscar observações adicionais com auto-refresh mais frequente
  const { data: observacoes } = useQuery({
    queryKey: [`/api/propostas/${propostaId}/observacoes`],
    queryFn: async () => {
      try {
        const response = await api.get(`/api/propostas/${propostaId}/observacoes`);
        return response.data;
      } catch (error) {
        return { observacoes: [] };
      }
    },
    enabled: !!propostaId,
    refetchInterval: 8000, // Refetch mais frequente para observações
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-400" />
            Histórico de Comunicação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-gray-400">
            Carregando histórico...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-blue-400" />
          Histórico de Comunicação
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Criação da proposta */}
          <div className="flex items-start gap-3 p-3 bg-gray-800 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
            <div className="flex-1">
              <p className="text-sm font-medium text-green-400">✅ Proposta Criada</p>
              <p className="text-xs text-gray-400">
                {proposta?.createdAt ? new Date(proposta.createdAt).toLocaleString('pt-BR') : 'Data não disponível'}
              </p>
              <p className="text-sm text-gray-300 mt-1">
                Proposta criada pelo atendente da loja {proposta?.loja?.nomeLoja || 'N/A'}
              </p>
            </div>
          </div>

          {/* Pendência (se existir) */}
          {proposta?.motivoPendencia && (
            <div className="flex items-start gap-3 p-3 bg-yellow-900/30 border border-yellow-600 rounded-lg">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-400">⚠️ Proposta Pendenciada</p>
                <p className="text-xs text-gray-400">
                  {proposta?.dataAnalise ? new Date(proposta.dataAnalise).toLocaleString('pt-BR') : 'Data não disponível'}
                </p>
                <p className="text-sm text-gray-300 mt-1">
                  <strong>Analista:</strong> {proposta?.analistaId || 'Sistema'}
                </p>
                <div className="text-sm text-yellow-200 mt-2 p-2 bg-yellow-900/30 rounded border-l-2 border-yellow-500">
                  "{proposta.motivoPendencia}"
                </div>
              </div>
            </div>
          )}

          {/* Observações do atendente (futuro) */}
          {observacoes?.observacoes && observacoes.observacoes.length > 0 && (
            <div className="space-y-2">
              {observacoes.observacoes.map((obs: any, index: number) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-blue-900/30 border border-blue-600 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-400">💬 Observação do Atendente</p>
                    <p className="text-xs text-gray-400">
                      {obs.createdAt ? new Date(obs.createdAt).toLocaleString('pt-BR') : 'Agora'}
                    </p>
                    <div className="text-sm text-blue-200 mt-2 p-2 bg-blue-900/30 rounded border-l-2 border-blue-500">
                      "{obs.texto}"
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Status atual com indicador dinâmico */}
          <div className="flex items-start gap-3 p-3 bg-gray-700/50 border border-gray-600 rounded-lg">
            <div className="w-2 h-2 bg-gray-400 rounded-full mt-2 flex-shrink-0 animate-pulse"></div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-300">
                {context === 'edicao' ? '🔄 Em Correção' : '📋 Status Atual'}
              </p>
              <p className="text-xs text-gray-400">
                Atualizado em {new Date().toLocaleString('pt-BR')}
              </p>
              <p className="text-sm text-gray-300 mt-1">
                {context === 'edicao' 
                  ? 'Atendente corrigindo dados conforme solicitação do analista'
                  : `Status: ${proposta?.status || 'Carregando...'}`
                }
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HistoricoCompartilhadoV2;