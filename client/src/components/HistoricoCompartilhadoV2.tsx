import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { api } from '@/lib/apiClient';

interface HistoricoCompartilhadoV2Props {
  propostaId: string;
  context?: 'analise' | 'edicao';
}

const HistoricoCompartilhadoV2: React.FC<HistoricoCompartilhadoV2Props> = ({
  _propostaId,
  context = 'analise',
}) => {
  // Query para buscar dados da proposta - APENAS reativa (sem polling)
  const { data: proposta, isLoading } = useQuery({
    queryKey: [`/api/propostas/${propostaId}`],
    queryFn: async () => {
      const _response = await api.get(`/api/propostas/${propostaId}`);
      return response.data; }
    },
    enabled: !!propostaId,
    refetchOnWindowFocus: false, // Desabilitado para evitar requests desnecessários
    refetchOnReconnect: true,
    staleTime: 5 * 60 * 1000, // 5 minutos - dados ficam válidos por mais tempo
  });

  // Query para buscar logs de auditoria - APENAS reativa (sem polling)
  const { data: auditLogs } = useQuery({
    queryKey: [`/api/propostas/${propostaId}/observacoes`],
    queryFn: async () => {
      try {
        const _response = await api.get(`/api/propostas/${propostaId}/observacoes`);
        return response.data; }
      } catch (error) {
        console.warn('Erro ao buscar logs de auditoria:', error: unknown);
        return { logs: [] }; }
      }
    },
    enabled: !!propostaId,
    refetchOnWindowFocus: false, // Desabilitado para evitar requests desnecessários
    refetchOnReconnect: true,
    staleTime: 2 * 60 * 1000, // 2 minutos - dados ficam válidos por mais tempo
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
          <div className="py-4 text-center text-gray-400">Carregando histórico...</div>
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
          <div className="flex items-start gap-3 rounded-lg bg-gray-800 p-3">
            <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-green-500"></div>
            <div className="flex-1">
              <p className="text-sm font-medium text-green-400">✅ Proposta Criada</p>
              <p className="text-xs text-gray-400">
                {proposta?.createdAt
                  ? new Date(proposta.createdAt).toLocaleString('pt-BR')
                  : 'Data não disponível'}
              </p>
              <p className="mt-1 text-sm text-gray-300">
                Proposta criada pelo atendente da loja {proposta?.loja?.nomeLoja || 'N/A'}
              </p>
            </div>
          </div>

          {/* Pendência (fallback se não houver logs) */}
          {(!auditLogs?.logs || auditLogs.logs.length == 0) && proposta?.motivoPendencia && (
            <div className="flex items-start gap-3 rounded-lg border border-yellow-600 bg-yellow-900/30 p-3">
              <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-yellow-500"></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-400">⚠️ Proposta Pendenciada</p>
                <p className="text-xs text-gray-400">
                  {proposta?.dataAnalise
                    ? new Date(proposta.dataAnalise).toLocaleString('pt-BR')
                    : 'Data não disponível'}
                </p>
                <p className="mt-1 text-sm text-gray-300">
                  <strong>Analista:</strong> {proposta?.analistaId || 'Sistema'}
                </p>
                <div className="mt-2 rounded border-l-2 border-yellow-500 bg-yellow-900/30 p-2 text-sm text-yellow-200">
                  "{proposta.motivoPendencia}"
                </div>
              </div>
            </div>
          )}

          {/* Logs de auditoria em tempo real */}
          {auditLogs?.logs &&
            auditLogs.logs.length > 0 &&
            auditLogs.logs.map(
              (
                log: {
                  created_at: string;
                  descricao: string;
                  usuario_nome?: string;
                  tipo?: string;
                  detalhes?: string;
                  status_novo?: string;
                  status_anterior?: string;
                  profiles?: { role?: string };
                },
                index: number
              ) => {
                // Determine user type from log data
                const _isAtendente = log.profiles?.role == 'ATENDENTE';

                // Determine action type from status changes
                const _isResubmit =
                  log.status_anterior == 'pendenciado' && log.status_novo == 'aguardando_analise';
                const _isPendency = log.status_novo == 'pendenciado';
                const _isApproval = log.status_novo == 'aprovado';
                const _isRejection = log.status_novo == 'rejeitado';

                let _bgColor = 'bg-gray-800';
                let _borderColor = '';
                let _dotColor = 'bg-blue-500';
                let _textColor = 'text-blue-400';
                let _icon = '📝';

                // Special styling for ATENDENTE actions
                if (isAtendente) {
                  bgColor = 'bg-indigo-900/40';
                  borderColor = 'border border-indigo-500/50';
                  dotColor = 'bg-indigo-400';
                  textColor = 'text-indigo-300';
                  icon = '👤';
                }

                if (isPendency) {
                  bgColor = isAtendente ? 'bg-indigo-900/40' : 'bg-yellow-900/30';
                  borderColor = isAtendente
                    ? 'border border-indigo-500/50'
                    : 'border border-yellow-600';
                  dotColor = 'bg-yellow-500';
                  textColor = 'text-yellow-400';
                  icon = '⚠️';
                } else if (isResubmit) {
                  bgColor = 'bg-blue-900/30';
                  borderColor = 'border border-blue-600';
                  dotColor = 'bg-blue-500';
                  textColor = 'text-blue-400';
                  icon = '🔄';
                } else if (isApproval) {
                  bgColor = 'bg-green-900/30';
                  borderColor = 'border border-green-600';
                  dotColor = 'bg-green-500';
                  textColor = 'text-green-400';
                  icon = '✅';
                } else if (isRejection) {
                  bgColor = 'bg-red-900/30';
                  borderColor = 'border border-red-600';
                  dotColor = 'bg-red-500';
                  textColor = 'text-red-400';
                  icon = '❌';
                }

                return (
                  <div
                    key={`${index}-${log.created_at || 'unknown'}`}
                    className={`flex items-start gap-3 p-3 ${bgColor} ${borderColor} rounded-lg`}
                  >
                    <div className={`h-2 w-2 ${dotColor} mt-2 flex-shrink-0 rounded-full`}></div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${textColor}`}>
                        {icon}{' '}
                        {isResubmit
                          ? 'Proposta reenviada para análise'
                          : isPendency
                            ? 'Proposta pendenciada'
                            : isApproval
                              ? 'Proposta aprovada'
                              : isRejection
                                ? 'Proposta rejeitada'
                                : 'Status alterado'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {log.created_at
                          ? new Date(log.created_at).toLocaleString('pt-BR')
                          : 'Data não disponível'}
                      </p>
                      {log.profiles && (log.profiles as unknown).fullName && (
                        <p className="mt-1 text-sm text-gray-300">
                          <strong>Por:</strong> {(log.profiles as unknown).fullName} (
                          {log.profiles.role || 'Usuário'})
                        </p>
                      )}

                      {/* Destacar observação do ATENDENTE */}
                      {(log as unknown).observacao && (
                        <div
                          className={`mt-2 rounded border-l-2 p-2 text-sm ${
                            isAtendente
                              ? 'border-indigo-400 bg-indigo-900/30 text-indigo-100'
                              : 'border-gray-500 bg-gray-700/50 text-gray-200'
                          }`}
                        >
                          {isAtendente && (
                            <span className="font-medium text-indigo-300">
                              💬 Observação do Atendente:
                            </span>
                          )}
                          <div className={isAtendente ? 'mt-1 italic' : 'mt-1'}>
                            "{(log as unknown).observacao}"
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
            )}

          {/* Status atual com indicador dinâmico */}
          <div className="flex items-start gap-3 rounded-lg border border-gray-600 bg-gray-700/50 p-3">
            <div className="mt-2 h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-gray-400"></div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-300">
                {context == 'edicao' ? '🔄 Em Correção' : '📋 Status Atual'}
              </p>
              <p className="text-xs text-gray-400">
                Atualizado em {new Date().toLocaleString('pt-BR')}
              </p>
              <p className="mt-1 text-sm text-gray-300">
                {context == 'edicao'
                  ? 'Atendente corrigindo dados conforme solicitação do analista'
                  : `Status: ${proposta?.status || 'Carregando...'}`}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HistoricoCompartilhadoV2;
