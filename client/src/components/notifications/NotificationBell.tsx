/**
 * PAM V1.0 - Sistema de Alertas Proativos
 * Camada 1: Indicador Global de Sino
 */

import { Bell } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
import { queryClient } from "@/lib/queryClient";

interface Notificacao {
  id: number;
  tipo: string;
  titulo: string;
  mensagem: string;
  prioridade: "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
  categoria: string;
  propostaId?: string;
  linkRelacionado?: string;
  status: "nao_lida" | "lida" | "arquivada";
  createdAt: string;
  dataLeitura?: string;
}

export function NotificationBell() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Buscar notificações a cada 60 segundos
  const { data, isLoading } = useQuery({
    queryKey: ["/api/alertas/notificacoes"],
    refetchInterval: 60000, // Atualizar a cada minuto
    refetchOnWindowFocus: true,
  });

  const notificacoes = (data as any)?.notificacoes || [];
  const totalNaoLidas = (data as any)?.totalNaoLidas || 0;

  // Marcar notificação como lida
  const marcarComoLida = async (id: number) => {
    try {
      const response = await fetch(`/api/alertas/notificacoes/${id}/marcar-lida`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (response.ok) {
        // Invalidar cache para atualizar contagem
        queryClient.invalidateQueries({ queryKey: ["/api/alertas/notificacoes"] });
      }
    } catch (error) {
      console.error("Erro ao marcar notificação como lida:", error);
    }
  };

  // Marcar todas como lidas
  const marcarTodasComoLidas = async () => {
    try {
      const response = await fetch("/api/alertas/notificacoes/marcar-todas-lidas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/alertas/notificacoes"] });
      }
    } catch (error) {
      console.error("Erro ao marcar todas como lidas:", error);
    }
  };

  // Limpar histórico (arquivar todas)
  const limparHistorico = async () => {
    try {
      const response = await fetch("/api/alertas/notificacoes/all", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/alertas/notificacoes"] });
      }
    } catch (error) {
      console.error("Erro ao limpar histórico:", error);
    }
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
            {totalNaoLidas > 99 ? "99+" : totalNaoLidas}
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