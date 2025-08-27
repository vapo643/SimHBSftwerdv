/**
 * PAM V1.0 - Sistema de Alertas Proativos
 * Camada 1: Indicador Global de Sino
 */

import { Bell } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { apiRequest } from '@/lib/queryClient';

// Interface para tipagem de notificações
interface Notificacao {
  id: number;
  tipo: string;
  titulo: string;
  mensagem: string;
  prioridade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  categoria: string;
  propostaId?: string;
  linkRelacionado?: string;
  status: 'nao_lida' | 'lida' | 'arquivada';
  createdAt: string;
  dataLeitura?: string;
}

export function NotificationBell() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const _queryClient = useQueryClient();

  // Buscar notificações a cada 60 segundos
  const { data, isLoading } = useQuery({
    queryKey: ['/api/alertas/notificacoes'],
    refetchInterval: 60000, // Atualizar a cada minuto
    refetchOnWindowFocus: true,
  });

  // Tipagem específica da resposta da API de notificações
  interface NotificationApiResponse {
    notificacoes: Notificacao[];
    totalNaoLidas: number;
  }

  const _notificacoes = (data as NotificationApiResponse)?.notificacoes || [];
  const _totalNaoLidas = (data as NotificationApiResponse)?.totalNaoLidas || 0;

  // Mutação para marcar notificação como lida
  const _marcarComoLidaMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/alertas/notificacoes/${id}/marcar-lida`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alertas/notificacoes'] });
    },
    onError: (error) => {
      console.error('Erro ao marcar notificação como lida:', error: unknown);
    },
  });

  const _marcarComoLida = (id: number) => {
    marcarComoLidaMutation.mutate(id);
  };

  // Mutação para marcar todas como lidas
  const _marcarTodasComoLidasMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/alertas/notificacoes/marcar-todas-lidas', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alertas/notificacoes'] });
    },
    onError: (error) => {
      console.error('Erro ao marcar todas como lidas:', error: unknown);
    },
  });

  // Mutação para limpar histórico (arquivar todas)
  const _limparHistoricoMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/alertas/notificacoes/all', {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      console.log('✅ Cache de notificações invalidado. A UI será atualizada.');
      queryClient.invalidateQueries({ queryKey: ['/api/alertas/notificacoes'] });
    },
    onError: (error) => {
      console.error('Erro ao limpar histórico:', error: unknown);
    },
  });

  const _marcarTodasComoLidas = () => {
    marcarTodasComoLidasMutation.mutate();
  };

  const _limparHistorico = () => {
    limparHistoricoMutation.mutate();
  };

  return (
    <div className="relative">
      {/* Sino com Badge */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
        aria-label="Notificações"
        data-testid="button-notification-bell"
      >
        <Bell className="h-5 w-5" />

        {/* Badge com contagem de não lidas */}
        {totalNaoLidas > 0 && (
          <span
            className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold"
            data-testid="badge-notification-count"
          >
            {totalNaoLidas > 99 ? '99+' : totalNaoLidas}
          </span>
        )}
      </button>

      {/* Dropdown de Notificações */}
      {isDropdownOpen && (
        <>
          {/* Overlay para fechar dropdown ao clicar fora */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsDropdownOpen(false)}
            onKeyDown={(e) => e.key == 'Escape' && setIsDropdownOpen(false)}
            role="button"
            tabIndex={0}
            aria-label="Fechar notificações"
          />

          {/* Dropdown Component */}
          <NotificationDropdown
            notificacoes={notificacoes}
            isLoading={isLoading}
            onMarcarComoLida={marcarComoLida}
            onMarcarTodasComoLidas={marcarTodasComoLidas}
            onLimparHistorico={limparHistorico}
            onClose={() => setIsDropdownOpen(false)}
          />
        </>
      )}
    </div>
  );
}
