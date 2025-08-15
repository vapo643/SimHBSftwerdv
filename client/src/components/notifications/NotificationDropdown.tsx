/**
 * PAM V1.0 - Sistema de Alertas Proativos
 * Camada 2: Dropdown de Notificações
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "wouter";
import { 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  CheckCircle,
  Clock,
  X
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

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

interface NotificationDropdownProps {
  notificacoes: Notificacao[];
  isLoading: boolean;
  onMarcarComoLida: (id: number) => void;
  onMarcarTodasComoLidas: () => void;
  onClose: () => void;
}

export function NotificationDropdown({
  notificacoes,
  isLoading,
  onMarcarComoLida,
  onMarcarTodasComoLidas,
  onClose,
}: NotificationDropdownProps) {
  // Ícone baseado na prioridade
  const getIcon = (prioridade: string) => {
    switch (prioridade) {
      case "CRITICA":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "ALTA":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case "MEDIA":
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  // Cor de fundo baseada na prioridade
  const getBgColor = (prioridade: string, status: string) => {
    if (status === "lida") return "bg-gray-50";
    
    switch (prioridade) {
      case "CRITICA":
        return "bg-red-50 hover:bg-red-100";
      case "ALTA":
        return "bg-orange-50 hover:bg-orange-100";
      case "MEDIA":
        return "bg-blue-50 hover:bg-blue-100";
      default:
        return "bg-white hover:bg-gray-50";
    }
  };

  // Filtrar apenas não lidas para exibição inicial
  const notificacoesVisiveis = notificacoes.slice(0, 10);
  const temNaoLidas = notificacoes.some(n => n.status === "nao_lida");

  return (
    <div 
      className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50"
      data-testid="dropdown-notifications"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="text-lg font-semibold">Notificações</h3>
        <div className="flex items-center gap-2">
          {temNaoLidas && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarcarTodasComoLidas}
              data-testid="button-mark-all-read"
            >
              Marcar todas como lidas
            </Button>
          )}
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            data-testid="button-close-notifications"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Lista de Notificações */}
      <ScrollArea className="h-96">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">
            Carregando notificações...
          </div>
        ) : notificacoesVisiveis.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhuma notificação</p>
            <p className="text-sm text-gray-400 mt-1">
              Você será notificado sobre eventos importantes aqui
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notificacoesVisiveis.map((notificacao) => (
              <div
                key={notificacao.id}
                className={`p-4 cursor-pointer transition-colors ${getBgColor(
                  notificacao.prioridade,
                  notificacao.status
                )}`}
                onClick={() => {
                  // Marcar como lida
                  if (notificacao.status === "nao_lida") {
                    onMarcarComoLida(notificacao.id);
                  }
                  
                  // Navegar para o link se existir
                  if (notificacao.linkRelacionado) {
                    window.location.href = notificacao.linkRelacionado;
                    onClose();
                  }
                }}
                data-testid={`notification-item-${notificacao.id}`}
              >
                <div className="flex items-start gap-3">
                  {/* Ícone */}
                  <div className="mt-1">
                    {getIcon(notificacao.prioridade)}
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <p className="font-medium text-sm text-gray-900">
                        {notificacao.titulo}
                      </p>
                      {notificacao.status === "nao_lida" && (
                        <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full ml-2" />
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {notificacao.mensagem}
                    </p>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <Clock className="h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-500">
                        {format(new Date(notificacao.createdAt), "dd 'de' MMM 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </span>
                      
                      {notificacao.categoria && (
                        <>
                          <span className="text-gray-400">•</span>
                          <span className="text-xs text-gray-500 capitalize">
                            {notificacao.categoria}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      {notificacoesVisiveis.length > 0 && (
        <div className="p-3 border-t bg-gray-50">
          <Link href="/notificacoes">
            <a 
              className="text-sm text-blue-600 hover:text-blue-700 font-medium text-center block"
              onClick={onClose}
              data-testid="link-all-notifications"
            >
              Ver todas as notificações
            </a>
          </Link>
        </div>
      )}
    </div>
  );
}

// Importação necessária que estava faltando
import { Bell } from "lucide-react";