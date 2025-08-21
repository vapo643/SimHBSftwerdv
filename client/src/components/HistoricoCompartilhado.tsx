import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  AlertCircle,
  MessageCircle,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Send,
} from "lucide-react";
import { api } from "@/lib/apiClient";

interface HistoricoCompartilhadoProps {
  propostaId: string;
  context?: "analise" | "edicao";
}

const HistoricoCompartilhado: React.FC<HistoricoCompartilhadoProps> = ({ propostaId }) => {
  // Query para buscar dados da proposta - APENAS reativa (sem polling)
  const { data: proposta, isLoading } = useQuery({
    queryKey: [`/api/propostas/${propostaId}`],
    queryFn: async () => {
      const response = await api.get(`/api/propostas/${propostaId}`);
      return response.data;
    },
    enabled: !!propostaId,
    refetchOnWindowFocus: false, // Desabilitado para evitar rate limiting
    refetchOnReconnect: true,
    staleTime: 5 * 60 * 1000, // 5 minutos - dados ficam válidos por mais tempo
  });

  // Query para buscar logs de auditoria - APENAS reativa (sem polling)
  const { data: auditLogs } = useQuery({
    queryKey: [`/api/propostas/${propostaId}/observacoes`],
    queryFn: async () => {
      try {
        const response = await api.get(`/api/propostas/${propostaId}/observacoes`);
        return response.data;
      } catch (error) {
        console.warn("Erro ao buscar logs de auditoria:", error);
        return { logs: [] };
      }
    },
    enabled: !!propostaId,
    refetchOnWindowFocus: false, // Desabilitado para evitar rate limiting
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

  // Processar logs para extrair eventos significativos
  const logs = auditLogs?.logs || [];

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
              <p className="text-sm font-medium text-green-400">
                <CheckCircle className="mr-1 inline h-4 w-4" />
                Proposta Criada
              </p>
              <p className="text-xs text-gray-400">
                {proposta?.created_at
                  ? new Date(proposta.created_at).toLocaleString("pt-BR")
                  : "Data não disponível"}
              </p>
              <p className="mt-1 text-sm text-gray-300">
                Proposta criada pelo atendente da loja {proposta?.loja?.nome_loja || "N/A"}
              </p>
            </div>
          </div>

          {/* Logs de auditoria em ordem cronológica */}
          {logs.length > 0 ? (
            logs.map(
              (
                log: {
                  id?: string;
                  created_at: string;
                  descricao: string;
                  usuario_nome?: string;
                  tipo?: string;
                  detalhes?: string;
                  observacao?: string;
                  status_novo?: string;
                  status_anterior?: string;
                  profiles?: { role?: string };
                },
                index: number
              ) => {
                const isPendency = log.status_novo === "pendenciado";
                const isResubmit =
                  log.status_novo === "aguardando_analise" && log.status_anterior === "pendenciado";
                const isApproval = log.status_novo === "aprovado";
                const isRejection = log.status_novo === "rejeitado";

                // Verificar autoria baseada no role do perfil do autor
                const autorRole = log.profiles?.role;
                const isAtendente = autorRole === "ATENDENTE";
                const isAnalista = autorRole === "ANALISTA";

                // Definir cores e ícones baseado no tipo
                let bgColor = "bg-gray-800";
                let borderColor = "";
                let textColor = "text-gray-300";
                let dotColor = "bg-gray-500";
                let icon = <Clock className="mr-1 inline h-4 w-4" />;

                if (isPendency) {
                  bgColor = "bg-yellow-900/20";
                  borderColor = "border border-yellow-600";
                  textColor = "text-yellow-400";
                  dotColor = "bg-yellow-500";
                  icon = <AlertTriangle className="mr-1 inline h-4 w-4" />;
                } else if (isResubmit) {
                  bgColor = "bg-indigo-900/20";
                  borderColor = "border border-indigo-600";
                  textColor = "text-indigo-400";
                  dotColor = "bg-indigo-500";
                  icon = <Send className="mr-1 inline h-4 w-4" />;
                } else if (isApproval) {
                  bgColor = "bg-green-900/20";
                  borderColor = "border border-green-600";
                  textColor = "text-green-400";
                  dotColor = "bg-green-500";
                  icon = <CheckCircle className="mr-1 inline h-4 w-4" />;
                } else if (isRejection) {
                  bgColor = "bg-red-900/20";
                  borderColor = "border border-red-600";
                  textColor = "text-red-400";
                  dotColor = "bg-red-500";
                  icon = <XCircle className="mr-1 inline h-4 w-4" />;
                }

                return (
                  <div
                    key={`${log.id}-${index}`}
                    className={`flex items-start gap-3 p-3 ${bgColor} ${borderColor} rounded-lg`}
                  >
                    <div className={`h-2 w-2 ${dotColor} mt-2 flex-shrink-0 rounded-full`}></div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${textColor}`}>
                        {icon}{" "}
                        {isResubmit
                          ? "Proposta reenviada para análise"
                          : isPendency
                            ? "Proposta pendenciada"
                            : isApproval
                              ? "Proposta aprovada"
                              : isRejection
                                ? "Proposta rejeitada"
                                : "Status alterado"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {log.created_at
                          ? new Date(log.created_at).toLocaleString("pt-BR")
                          : "Data não disponível"}
                      </p>

                      {/* Destacar observação baseado no tipo de usuário e ação */}
                      {(log.observacao || log.detalhes) && (
                        <div
                          className={`mt-2 rounded border-l-2 p-2 text-sm ${
                            isAtendente
                              ? "border-indigo-400 bg-indigo-900/30 text-indigo-100"
                              : isPendency
                                ? "border-yellow-400 bg-yellow-900/30 text-yellow-100"
                                : "border-gray-500 bg-gray-700/50 text-gray-200"
                          }`}
                        >
                          {isAtendente && (
                            <span className="font-medium text-indigo-300">
                              💬 Observação do Atendente:
                            </span>
                          )}
                          {isAnalista && isPendency && (
                            <span className="font-medium text-yellow-300">
                              ⚠️ Motivo da Pendência:
                            </span>
                          )}
                          {isAnalista && isApproval && (
                            <span className="font-medium text-green-300">
                              ✅ Observação da Aprovação:
                            </span>
                          )}
                          {isAnalista && isRejection && (
                            <span className="font-medium text-red-300">❌ Motivo da Rejeição:</span>
                          )}
                          {isAnalista && !isPendency && !isApproval && !isRejection && (
                            <span className="font-medium text-gray-300">
                              📝 Observação do Analista:
                            </span>
                          )}
                          <div className={isAtendente ? "mt-1 italic" : "mt-1"}>
                            "{log.detalhes || log.observacao}"
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
            )
          ) : (
            <div className="py-4 text-center text-gray-400">
              <MessageCircle className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>Nenhuma comunicação registrada ainda</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default HistoricoCompartilhado;
