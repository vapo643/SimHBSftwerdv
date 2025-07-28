import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { fetchWithToken } from "@/lib/apiClient";

interface HistoricoCompartilhadoProps {
  propostaId: string;
  context?: 'analise' | 'edicao';
}

const HistoricoCompartilhado: React.FC<HistoricoCompartilhadoProps> = ({ 
  propostaId, 
  context = 'analise' 
}) => {
  // Query para buscar dados da proposta - APENAS reativa (sem polling)
  const { data: proposta } = useQuery({
    queryKey: [`/api/propostas/${propostaId}`],
    queryFn: async () => {
      const response = await fetchWithToken(`/api/propostas/${propostaId}`);
      return response;
    },
    enabled: !!propostaId,
    refetchOnWindowFocus: false, // Desabilitado para evitar rate limiting
    refetchOnReconnect: true,
    staleTime: 5 * 60 * 1000, // 5 minutos - dados ficam válidos por mais tempo
  });

  // Query para buscar observações - APENAS reativa (sem polling)
  const { data: observacoes } = useQuery({
    queryKey: [`/api/propostas/${propostaId}/observacoes`],
    queryFn: async () => {
      try {
        const response = await fetchWithToken(`/api/propostas/${propostaId}/observacoes`);
        return response;
      } catch (error) {
        return { observacoes: [] };
      }
    },
    enabled: !!propostaId,
    refetchOnWindowFocus: false, // Desabilitado para evitar rate limiting
    refetchOnReconnect: true,
    staleTime: 2 * 60 * 1000, // 2 minutos - dados ficam válidos por mais tempo
  });

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
            <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
            <div>
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
            <div className="flex items-start gap-3 p-3 bg-yellow-900/20 border border-yellow-600 rounded-lg">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
              <div>
                <p className="text-sm font-medium text-yellow-400">⚠️ Proposta Pendenciada</p>
                <p className="text-xs text-gray-400">
                  {proposta?.dataAnalise ? new Date(proposta.dataAnalise).toLocaleString('pt-BR') : 'Data não disponível'}
                </p>
                <p className="text-sm text-gray-300 mt-1">
                  <strong>Analista:</strong> {proposta?.analistaId || 'N/A'}
                </p>
                <p className="text-sm text-yellow-200 mt-2 p-2 bg-yellow-900/30 rounded">
                  "{proposta.motivoPendencia}"
                </p>
              </div>
            </div>
          )}

          {/* Observações do atendente (se existirem) */}
          {observacoes?.observacoes && observacoes.observacoes.length > 0 && (
            <div className="space-y-2">
              {observacoes.observacoes.map((obs: any, index: number) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-blue-900/20 border border-blue-600 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-blue-400">💬 Observação do Atendente</p>
                    <p className="text-xs text-gray-400">
                      {obs.createdAt ? new Date(obs.createdAt).toLocaleString('pt-BR') : 'Agora'}
                    </p>
                    <p className="text-sm text-blue-200 mt-2 p-2 bg-blue-900/30 rounded">
                      "{obs.texto}"
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Status atual */}
          <div className="flex items-start gap-3 p-3 bg-gray-700 rounded-lg">
            <div className="w-2 h-2 bg-gray-400 rounded-full mt-2"></div>
            <div>
              <p className="text-sm font-medium text-gray-300">
                {context === 'edicao' ? '🔄 Em Correção' : '📋 Status Atual'}
              </p>
              <p className="text-xs text-gray-400">
                {new Date().toLocaleString('pt-BR')}
              </p>
              <p className="text-sm text-gray-300 mt-1">
                {context === 'edicao' 
                  ? 'Atendente está corrigindo os dados conforme solicitado pelo analista'
                  : `Proposta está ${proposta?.status || 'N/A'}`
                }
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HistoricoCompartilhado;