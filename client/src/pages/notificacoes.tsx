import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  Search, 
  Filter,
  MoreHorizontal,
  Clock,
  Eye,
  Trash2,
  Check
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Notificacao {
  id: number;
  tipo: string;
  titulo: string;
  mensagem: string;
  prioridade: "CRITICA" | "ALTA" | "MEDIA";
  categoria: string;
  status: "nao_lida" | "lida";
  userId: string;
  origem: string;
  linkRelacionado?: string;
  createdAt: string;
  updatedAt: string;
  dataLeitura?: string;
}

interface NotificacoesResponse {
  notificacoes: Notificacao[];
  totalNaoLidas: number;
}

export default function NotificacoesPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estados para filtros e busca
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 20;

  // Query para buscar notificações
  const { data: notificacoesData, isLoading } = useQuery<NotificacoesResponse>({
    queryKey: ["/api/alertas/notificacoes", { 
      status: filtroStatus === "todos" ? undefined : filtroStatus,
      limite: itensPorPagina * 2 // Buscar mais para permitir filtros locais
    }],
    staleTime: 30000, // 30 segundos
    refetchInterval: 60000, // Auto-refresh a cada minuto
  });

  // Filtrar notificações localmente
  const notificacoesFiltradas = notificacoesData?.notificacoes?.filter(notificacao => {
    const matchStatus = filtroStatus === "todos" || notificacao.status === filtroStatus;
    const matchPrioridade = filtroPrioridade === "todos" || notificacao.prioridade === filtroPrioridade;
    const matchBusca = !busca || 
      notificacao.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      notificacao.mensagem.toLowerCase().includes(busca.toLowerCase());
    
    return matchStatus && matchPrioridade && matchBusca;
  }) || [];

  // Paginação
  const totalItens = notificacoesFiltradas.length;
  const totalPaginas = Math.ceil(totalItens / itensPorPagina);
  const indiceInicio = (paginaAtual - 1) * itensPorPagina;
  const indiceFim = indiceInicio + itensPorPagina;
  const notificacoesPaginadas = notificacoesFiltradas.slice(indiceInicio, indiceFim);

  // Mutações
  const marcarComoLidaMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/alertas/notificacoes/${id}/marcar-lida`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alertas/notificacoes"] });
      toast({
        title: "Notificação marcada como lida",
        description: "Status atualizado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível marcar a notificação como lida.",
        variant: "destructive",
      });
    },
  });

  const marcarTodasComoLidasMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/alertas/notificacoes/marcar-todas-lidas", {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alertas/notificacoes"] });
      toast({
        title: "Todas as notificações foram marcadas como lidas",
        description: "Status atualizado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível marcar todas as notificações como lidas.",
        variant: "destructive",
      });
    },
  });

  // Ícones para prioridade
  const getPriorityIcon = (prioridade: string) => {
    switch (prioridade) {
      case "CRITICA":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "ALTA":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case "MEDIA":
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  // Cor da badge de prioridade
  const getPriorityColor = (prioridade: string) => {
    switch (prioridade) {
      case "CRITICA":
        return "destructive";
      case "ALTA":
        return "secondary";
      case "MEDIA":
        return "default";
      default:
        return "outline";
    }
  };

  const handleNotificacaoClick = (notificacao: Notificacao) => {
    // Marcar como lida se ainda não foi lida
    if (notificacao.status === "nao_lida") {
      marcarComoLidaMutation.mutate(notificacao.id);
    }

    // Navegar para link relacionado se existir
    if (notificacao.linkRelacionado) {
      setLocation(notificacao.linkRelacionado);
    }
  };

  const notificacoesNaoLidas = notificacoesFiltradas.filter(n => n.status === "nao_lida").length;

  return (
    <DashboardLayout title="Central de Notificações">
      <div className="container max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Central de Notificações</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie todas as suas notificações e alertas proativos
            </p>
          </div>
          <div className="flex items-center gap-4">
            {notificacoesNaoLidas > 0 && (
              <Badge variant="destructive" className="px-3 py-1">
                {notificacoesNaoLidas} não lidas
              </Badge>
            )}
            <Button
              onClick={() => marcarTodasComoLidasMutation.mutate()}
              disabled={marcarTodasComoLidasMutation.isPending || notificacoesNaoLidas === 0}
              data-testid="button-mark-all-read-page"
            >
              <Check className="h-4 w-4 mr-2" />
              Marcar todas como lidas
            </Button>
          </div>
        </div>

        {/* Filtros e Busca */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
            <CardDescription>
              Use os filtros abaixo para encontrar notificações específicas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Busca */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar notificações..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-notifications"
                />
              </div>

              {/* Filtro de Status */}
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="nao_lida">Não lidas</SelectItem>
                  <SelectItem value="lida">Lidas</SelectItem>
                </SelectContent>
              </Select>

              {/* Filtro de Prioridade */}
              <Select value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
                <SelectTrigger data-testid="select-priority-filter">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as prioridades</SelectItem>
                  <SelectItem value="CRITICA">Crítica</SelectItem>
                  <SelectItem value="ALTA">Alta</SelectItem>
                  <SelectItem value="MEDIA">Média</SelectItem>
                </SelectContent>
              </Select>

              {/* Reset */}
              <Button 
                variant="outline"
                onClick={() => {
                  setBusca("");
                  setFiltroStatus("todos");
                  setFiltroPrioridade("todos");
                  setPaginaAtual(1);
                }}
                data-testid="button-reset-filters"
              >
                Limpar filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Notificações */}
        <Card>
          <CardHeader>
            <CardTitle>
              Notificações ({notificacoesFiltradas.length} encontradas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">Carregando notificações...</div>
              </div>
            ) : notificacoesPaginadas.length === 0 ? (
              <div className="text-center py-8">
                <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhuma notificação encontrada</h3>
                <p className="text-muted-foreground">
                  Ajuste os filtros ou aguarde novas notificações chegarem
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {notificacoesPaginadas.map((notificacao) => (
                  <div
                    key={notificacao.id}
                    className={`
                      p-4 rounded-lg border cursor-pointer transition-all duration-200
                      ${notificacao.status === "nao_lida" 
                        ? "bg-blue-50 border-blue-200 hover:bg-blue-100" 
                        : "bg-white border-gray-200 hover:bg-gray-50"
                      }
                    `}
                    onClick={() => handleNotificacaoClick(notificacao)}
                    data-testid={`notification-item-${notificacao.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {/* Ícone de Prioridade */}
                        <div className="mt-1">
                          {getPriorityIcon(notificacao.prioridade)}
                        </div>

                        {/* Conteúdo */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-gray-900 truncate">
                              {notificacao.titulo}
                            </h4>
                            <Badge 
                              variant={getPriorityColor(notificacao.prioridade)}
                              className="text-xs"
                            >
                              {notificacao.prioridade}
                            </Badge>
                            {notificacao.status === "nao_lida" && (
                              <Badge variant="outline" className="text-xs bg-blue-100">
                                Nova
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            {notificacao.mensagem}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(notificacao.createdAt), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </span>
                            <span>Categoria: {notificacao.categoria}</span>
                            <span>Origem: {notificacao.origem}</span>
                          </div>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="ml-4">
                        {notificacao.status === "lida" && (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Paginação */}
            {totalPaginas > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-muted-foreground">
                  Mostrando {indiceInicio + 1}-{Math.min(indiceFim, totalItens)} de {totalItens} notificações
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPaginaAtual(paginaAtual - 1)}
                    disabled={paginaAtual === 1}
                    data-testid="button-previous-page"
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Página {paginaAtual} de {totalPaginas}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPaginaAtual(paginaAtual + 1)}
                    disabled={paginaAtual === totalPaginas}
                    data-testid="button-next-page"
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}