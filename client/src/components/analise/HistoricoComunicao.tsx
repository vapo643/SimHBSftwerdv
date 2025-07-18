import React, { useEffect, useState } from 'react';

interface Log {
  id: number;
  status_novo: string;
  observacao: string;
  user_id: string; // No futuro, buscaríamos o nome do usuário
  created_at: string;
}

const HistoricoComunicao: React.FC<{ propostaId: string | undefined }> = ({ propostaId }) => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!propostaId) return;

    const fetchLogs = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/propostas/${propostaId}/logs`);
        if (!response.ok) throw new Error('Erro ao buscar histórico');
        const data = await response.json();
        setLogs(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [propostaId]);

  if (loading) return <div className="p-4 text-center">Carregando histórico...</div>;

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold mb-4">Histórico e Comunicação</h2>
      <div className="space-y-4">
        {logs.length > 0 ? logs.map(log => (
          <div key={log.id} className="p-3 border rounded-md bg-secondary/50">
            <p><strong>Status:</strong> <span className="font-semibold">{log.status_novo}</span></p>
            <p><strong>Observação:</strong> {log.observacao || "Nenhuma observação."}</p>
            <p className="text-xs text-muted-foreground mt-2">
              por: {log.user_id.substring(0, 8)}... em {new Date(log.created_at).toLocaleString('pt-BR')}
            </p>
          </div>
        )) : <p>Nenhum histórico para esta proposta.</p>}
      </div>
    </div>
  );
};

export default HistoricoComunicao;