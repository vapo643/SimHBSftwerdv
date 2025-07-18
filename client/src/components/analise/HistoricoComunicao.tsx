import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Log {
    id: number;
    status_novo: string;
    observacao: string | null;
    user_id: string; // No futuro, buscaríamos o nome do usuário
    created_at: string;
}

const fetchLogs = async (propostaId: string | undefined) => {
    if (!propostaId) return [];
    const response = await fetch(`/api/propostas/${propostaId}/logs`);
    if (!response.ok) {
        throw new Error('Erro ao carregar histórico');
    }
    return response.json();
}

const HistoricoComunicao: React.FC<{ propostaId: string | undefined }> = ({ propostaId }) => {
  const { data: logs, isLoading, isError } = useQuery<Log[]>(
      ['proposta_logs', propostaId], 
      () => fetchLogs(propostaId), 
      { enabled: !!propostaId }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico e Comunicação</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Carregando histórico...</p>}
        {isError && <p className="text-sm text-red-500">Erro ao carregar histórico.</p>}
        {!isLoading && !isError && (
          <ul className="space-y-4">
            {logs && logs.length > 0 ? logs.map(log => (
              <li key={log.id} className="text-sm border-b pb-2">
                <p><strong>Status:</strong> <span className="font-semibold">{log.status_novo}</span></p>
                <p><strong>Observação:</strong> {log.observacao || "Nenhuma observação."}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  por: {log.user_id.substring(0, 8)}... em {new Date(log.created_at).toLocaleString('pt-BR')}
                </p>
              </li>
            )) : <p className="text-sm text-muted-foreground">Nenhum histórico para esta proposta.</p>}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default HistoricoComunicao;