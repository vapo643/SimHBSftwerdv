import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { getSupabase } from '@/lib/supabase';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Calendar,
  Search,
  Phone,
  MessageSquare,
  Eye,
  EyeOff,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Receipt,
  DollarSign,
  FileText,
  Send,
  Filter,
  QrCode,
  Copy,
  Building2,
  RefreshCw,
  User,
  Mail,
  MapPin,
  CreditCard,
  UserCheck,
  History,
  AlertTriangle,
  X,
  MoreVertical,
  CheckCircle,
  CalendarPlus,
  Percent,
  CheckSquare,
  Loader2,
} from 'lucide-react';
import { format, parseISO, differenceInDays, isToday, isFuture, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';

// Importar todas as interfaces necessárias
import type {
  FichaCliente,
  PropostaCobranca,
  KPIsCobranca,
  ObservacaoCobranca,
  DebtInfo,
  ExportacaoInadimplentes,
  ProrrogacaoData,
  DescontoQuitacaoData,
  MutationResponse,
  StatusVencimento,
  StatusFilter,
  AtrasoFilter,
  StatusObservacao,
} from '@shared/types/cobrancas';

// Interfaces removidas - usando as importadas de @shared/types/cobrancas

export default function CobrancasPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [atrasoFilter, setAtrasoFilter] = useState<AtrasoFilter>('todos');
  const [showCpf, setShowCpf] = useState(false);
  const [selectedPropostaId, setSelectedPropostaId] = useState<string | null>(null);
  const [showFichaModal, setShowFichaModal] = useState(false);
  const [novaObservacao, setNovaObservacao] = useState('');
  const [tipoContato, setTipoContato] = useState('');
  const [statusPromessa, setStatusPromessa] = useState('');
  const [dataPromessaPagamento, setDataPromessaPagamento] = useState('');

  // Estados para modais de modificação de boletos
  const [showProrrogarModal, setShowProrrogarModal] = useState(false);
  const [showDescontoModal, setShowDescontoModal] = useState(false);
  const [selectedBoleto, setSelectedBoleto] = useState<PropostaCobranca | null>(null);
  const [novaDataVencimento, setNovaDataVencimento] = useState('');
  const [valorDesconto, setValorDesconto] = useState('');
  const [dataLimiteDesconto, setDataLimiteDesconto] = useState('');

  // PAM V1.0 - Estados para polling inteligente de sincronização
  const [syncStatus, setSyncStatus] = useState<
    'nao_iniciado' | 'em_andamento' | 'concluido' | 'falhou' | null
  >(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  // Estados para Desconto de Quitação (multi-etapas)
  const [etapaDesconto, setEtapaDesconto] = useState(1);
  const [debtInfo, setDebtInfo] = useState<DebtInfo | null>(null);
  const [novoValorQuitacao, setNovoValorQuitacao] = useState(0);
  const [quantidadeParcelas, setQuantidadeParcelas] = useState(1);
  const [novasParcelas, setNovasParcelas] = useState<
    Array<{ valor: number; dataVencimento: string }>
  >([]);

  // Estados para Prorrogar Vencimento (seleção múltipla)
  const [boletosParaProrrogar, setBoletosParaProrrogar] = useState<string[]>([]);
  const [todosBoletosAtivos, setTodosBoletosAtivos] = useState<PropostaCobranca[]>([]);

  // Estados para Histórico de Observações
  const [observacoes, setObservacoes] = useState<ObservacaoCobranca[]>([]);
  const [loadingObservacoes, setLoadingObservacoes] = useState(false);
  const [salvandoObservacao, setSalvandoObservacao] = useState(false);
  const [statusObservacao, setStatusObservacao] = useState<StatusObservacao>('Outros');

  // Verificar se o usuário tem role de cobrança
  const isCobrancaUser = user?.role === 'COBRANÇA';
  const isAdmin = user?.role === 'ADMINISTRADOR';
  const isFinanceiro = user?.role === 'FINANCEIRO';
  const canModifyBoletos = isAdmin || isFinanceiro; // ADMIN ou FINANCEIRO podem modificar boletos

  // Buscar informações de dívida para desconto de quitação
  const {
    data: debtData,
    isLoading: loadingDebt,
    refetch: refetchDebt,
  } = useQuery<DebtInfo>({
    queryKey: ['/api/inter/collections/proposal', selectedPropostaId],
    enabled: !!selectedPropostaId && showDescontoModal,
    queryFn: async () => {
      return apiRequest(
        `/api/inter/collections/proposal/${selectedPropostaId}`
      ) as Promise<DebtInfo>;
    },
  });

  // Mutation para prorrogar vencimento em lote
  const prorrogarMutation = useMutation<MutationResponse, Error, ProrrogacaoData>({
    mutationFn: async (data: ProrrogacaoData) => {
      return apiRequest('/api/inter/collections/batch-extend', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }) as Promise<MutationResponse>;
    },
    onSuccess: (result: MutationResponse) => {
      toast({
        title: 'Sucesso',
        description: result.message || 'Vencimento(s) prorrogado(s) com sucesso',
      });
      setShowProrrogarModal(false);
      setBoletosParaProrrogar([]);
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao prorrogar vencimento',
        variant: 'destructive',
      });
    },
  });

  // Mutation para aplicar desconto de quitação
  const descontoQuitacaoMutation = useMutation<MutationResponse, Error, DescontoQuitacaoData>({
    mutationFn: async (data: DescontoQuitacaoData) => {
      return apiRequest('/api/inter/collections/settlement-discount', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<MutationResponse>;
    },
    onSuccess: (result: MutationResponse) => {
      toast({
        title: 'Sucesso',
        description: result.message || 'Desconto de quitação aplicado com sucesso',
      });
      setShowDescontoModal(false);
      setEtapaDesconto(1);
      setNovasParcelas([]);
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao aplicar desconto de quitação',
        variant: 'destructive',
      });
    },
  });

  // Buscar propostas de cobrança
  const {
    data: propostas,
    isLoading,
    refetch,
  } = useQuery<PropostaCobranca[]>({
    queryKey: ['/api/cobrancas', statusFilter, atrasoFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'todos') params.append('status', statusFilter);
      if (atrasoFilter !== 'todos') params.append('atraso', atrasoFilter);

      return apiRequest(`/api/cobrancas?${params.toString()}`) as Promise<PropostaCobranca[]>;
    },
  });

  // Função para atualizar sem precisar recarregar a página
  const handleRefresh = () => {
    console.log('[COBRANÇAS] Atualizando dados da API do Banco Inter...');
    refetch();
  };

  // Buscar KPIs
  const { data: kpis } = useQuery<KPIsCobranca>({
    queryKey: ['/api/cobrancas/kpis'],
    queryFn: () => apiRequest('/api/cobrancas/kpis') as Promise<KPIsCobranca>,
  });

  // 🔄 REALTIME: Escutar mudanças nas tabelas propostas e inter_collections
  useEffect(() => {
    console.log('🔄 [REALTIME] Configurando escuta para atualizações de cobranças');

    const supabase = getSupabase();
    const channel = supabase
      .channel('cobrancas-realtime-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'propostas',
        },
        (payload) => {
          console.log('📡 [REALTIME] Evento de UPDATE recebido em propostas:', payload);
          console.log('📡 [REALTIME] Dados alterados:', {
            id: payload.new?.id,
            assinaturaEletronicaConcluida: payload.new?.assinatura_eletronica_concluida,
            ccbGerado: payload.new?.ccb_gerado,
          });

          // Invalidar as queries para forçar um refetch
          queryClient.invalidateQueries({ queryKey: ['/api/cobrancas'] });
          queryClient.invalidateQueries({ queryKey: ['/api/cobrancas/kpis'] });

          // Se uma assinatura foi concluída, notificar
          if (
            payload.new?.assinatura_eletronica_concluida === true &&
            payload.old?.assinatura_eletronica_concluida !== true
          ) {
            toast({
              title: 'Nova proposta assinada',
              description: 'Uma nova proposta foi assinada e pode aparecer na lista',
              duration: 3000,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*', // Escutar todos os eventos (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'inter_collections',
        },
        (payload) => {
          console.log('📡 [REALTIME] Evento recebido em inter_collections:', payload);
          console.log('📡 [REALTIME] Tipo de evento:', payload.eventType);
          console.log('📡 [REALTIME] Dados do boleto:', {
            propostaId: payload.new?.proposta_id || payload.old?.proposta_id,
            situacao: payload.new?.situacao || payload.old?.situacao,
            isActive: payload.new?.is_active,
          });

          // Invalidar as queries para forçar um refetch
          queryClient.invalidateQueries({ queryKey: ['/api/cobrancas'] });
          queryClient.invalidateQueries({ queryKey: ['/api/cobrancas/kpis'] });

          // Notificações específicas por tipo de evento
          if (payload.eventType === 'INSERT') {
            console.log('📡 [REALTIME] Novo boleto inserido - atualizando lista');
            toast({
              title: 'Novos boletos gerados',
              description: 'A lista de cobranças foi atualizada com novos boletos',
              duration: 2000,
            });
          } else if (payload.eventType === 'UPDATE') {
            // Se o boleto foi cancelado
            if (payload.new?.situacao === 'CANCELADO' && payload.old?.situacao !== 'CANCELADO') {
              console.log(
                '📡 [REALTIME] Boleto cancelado - verificando se proposta deve sair da lista'
              );
              toast({
                title: 'Boleto cancelado',
                description: 'Um boleto foi cancelado e a lista foi atualizada',
                duration: 2000,
              });
            }
            // Se foi um pagamento
            else if (payload.new?.situacao === 'RECEBIDO') {
              toast({
                title: '✅ Pagamento recebido',
                description: `Boleto ${payload.new?.seu_numero || ''} foi pago`,
                duration: 3000,
              });
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [REALTIME] Conectado ao canal de atualizações de cobranças');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [REALTIME] Erro ao conectar ao canal');
        } else if (status === 'TIMED_OUT') {
          console.error('⏱️ [REALTIME] Timeout ao conectar');
        } else if (status === 'CLOSED') {
          console.log('🔌 [REALTIME] Canal fechado');
        }
      });

    // Cleanup ao desmontar o componente
    return () => {
      console.log('🧹 [REALTIME] Removendo canal de escuta de cobranças');
      supabase.removeChannel(channel);
    };
  }, [queryClient, toast]);

  // Buscar ficha do cliente
  const { data: fichaCliente, isLoading: loadingFicha } = useQuery<FichaCliente>({
    queryKey: ['/api/cobrancas/ficha', selectedPropostaId],
    queryFn: () =>
      apiRequest(`/api/cobrancas/${selectedPropostaId}/ficha`) as Promise<FichaCliente>,
    enabled: !!selectedPropostaId && showFichaModal,
  });

  // PAM V1.0 - Polling inteligente para status de sincronização
  useEffect(() => {
    if (!showFichaModal || !selectedPropostaId) {
      setSyncStatus(null);
      setIsPolling(false);
      setPollCount(0);
      return;
    }

    const checkSyncStatus = async () => {
      try {
        console.log(
          `[PAM V1.0 POLLING] Verificando status de sincronização para proposta ${selectedPropostaId}`
        );
        const response = (await apiRequest(`/api/propostas/${selectedPropostaId}/sync-status`, {
          method: 'GET',
        })) as {
          success: boolean;
          syncStatus: 'nao_iniciado' | 'em_andamento' | 'concluido' | 'falhou';
          totalBoletos: number;
          boletosSincronizados: number;
        };

        if (response.success) {
          setSyncStatus(response.syncStatus);
          console.log(
            `[PAM V1.0 POLLING] Status: ${response.syncStatus} (${response.boletosSincronizados}/${response.totalBoletos})`
          );

          // Se está em andamento e não atingiu limite, continuar polling
          if (response.syncStatus === 'em_andamento' && pollCount < 20) {
            setIsPolling(true);
            setPollCount((prev) => prev + 1);
          } else {
            setIsPolling(false);
            if (pollCount >= 20) {
              console.log(`[PAM V1.0 POLLING] Limite de tentativas atingido (20)`);
              toast({
                title: 'Sincronização demorada',
                description:
                  'A sincronização está demorando mais que o esperado. Tente novamente em alguns instantes.',
                variant: 'destructive',
              });
            }
          }
        }
      } catch (error) {
        console.error('[PAM V1.0 POLLING] Erro ao verificar status:', error);
        setSyncStatus('falhou');
        setIsPolling(false);
      }
    };

    // Verificar imediatamente ao abrir
    checkSyncStatus();

    // Configurar polling se necessário
    let intervalId: NodeJS.Timeout | null = null;
    if (isPolling) {
      intervalId = setInterval(checkSyncStatus, 3000); // 3 segundos
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [showFichaModal, selectedPropostaId, isPolling, pollCount, toast]);

  // As observações agora vêm diretamente da ficha do cliente

  // Função para salvar nova observação
  const handleSalvarObservacao = async () => {
    if (!selectedPropostaId || !novaObservacao.trim() || !statusObservacao) return;

    setSalvandoObservacao(true);
    try {
      await apiRequest(`/api/propostas/${selectedPropostaId}/observacoes`, {
        method: 'POST',
        body: JSON.stringify({
          mensagem: novaObservacao,
          tipo_acao: statusObservacao,
        }),
      });

      // Limpar formulário
      setNovaObservacao('');

      // Recarregar ficha para atualizar observações
      queryClient.invalidateQueries({ queryKey: ['/api/cobrancas/ficha', selectedPropostaId] });

      toast({
        title: 'Sucesso',
        description: 'Observação salva com sucesso',
      });
    } catch (error) {
      console.error('Erro ao salvar observação:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar a observação',
        variant: 'destructive',
      });
    } finally {
      setSalvandoObservacao(false);
    }
  };

  // Mutation para adicionar observação
  const adicionarObservacaoMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest(`/api/cobrancas/${selectedPropostaId}/observacao`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({
        title: 'Observação adicionada',
        description: 'A observação foi registrada com sucesso.',
      });
      setNovaObservacao('');
      setTipoContato('');
      setStatusPromessa('');
      setDataPromessaPagamento('');
      queryClient.invalidateQueries({ queryKey: ['/api/cobrancas/ficha'] });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível adicionar a observação.',
        variant: 'destructive',
      });
    },
  });

  // Função para copiar texto
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: `${label} copiado!`,
      description: 'Código copiado para a área de transferência.',
    });
  };

  // Função para mascarar CPF/CNPJ
  const maskDocument = (doc: string) => {
    if (!doc) return '';
    if (!showCpf) {
      if (doc.length === 11) {
        // CPF
        return `${doc.substring(0, 3)}.***.***-${doc.substring(9)}`;
      } else if (doc.length === 14) {
        // CNPJ
        return `${doc.substring(0, 2)}.****.****/****-${doc.substring(12)}`;
      }
    }
    return doc;
  };

  // Função para exportar inadimplentes
  const exportarInadimplentes = async () => {
    try {
      const data = (await apiRequest(
        '/api/cobrancas/exportar/inadimplentes'
      )) as ExportacaoInadimplentes;

      // Verificar se há dados
      if (!data || !data.inadimplentes || data.inadimplentes.length === 0) {
        toast({
          title: 'Sem dados para exportar',
          description: 'Não há inadimplentes para exportar.',
        });
        return;
      }

      // Criar CSV manualmente
      const headers = Object.keys(data.inadimplentes[0] || {});
      const csv = [
        headers.join(','),
        ...data.inadimplentes.map((row: any) =>
          headers.map((header) => `"${row[header] || ''}"`).join(',')
        ),
      ].join('\n');

      // Download do CSV
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `inadimplentes_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();

      toast({
        title: 'Exportação concluída',
        description: `${data.total} registros exportados com sucesso.`,
      });
    } catch (error) {
      toast({
        title: 'Erro na exportação',
        description: 'Não foi possível exportar os dados.',
        variant: 'destructive',
      });
    }
  };

  // Filtrar propostas localmente pela busca (lógica robusta para campos vazios)
  const propostasFiltradas =
    propostas?.filter((proposta: PropostaCobranca) => {
      if (!searchTerm) return true; // Sem busca = mostrar todas

      const search = searchTerm.toLowerCase();

      // Cria lista de campos pesquisáveis, removendo valores vazios/null/undefined
      const searchableFields = [
        proposta.nomeCliente,
        proposta.cpfCliente,
        proposta.numeroContrato,
        proposta.id,
        proposta.numero_proposta, // Adicionar campo de número da proposta
      ].filter(Boolean); // Remove valores falsy (null, undefined, "", 0, false)

      // Verifica se algum dos campos válidos contém o termo de busca
      return searchableFields.some((field) => String(field).toLowerCase().includes(search));
    }) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'em_dia':
        return 'bg-green-100 text-green-800';
      case 'inadimplente':
        return 'bg-red-100 text-red-800';
      case 'quitado':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getParcelaStatusColor = (status: string) => {
    switch (status) {
      case 'pago':
        return 'bg-green-100 text-green-800';
      case 'vencido':
        return 'bg-red-100 text-red-800';
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Função para mapear status do Inter Bank para cores
  const getInterBankStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'RECEBIDO':
      case 'MARCADO_RECEBIDO':
        return 'bg-green-100 text-green-800';
      case 'CANCELADO':
      case 'EXPIRADO':
      case 'FALHA_EMISSAO':
        return 'bg-gray-100 text-gray-800';
      case 'ATRASADO':
      case 'PROTESTO':
        return 'bg-red-100 text-red-800';
      case 'A_RECEBER':
      case 'EM_PROCESSAMENTO':
      case 'EMITIDO':
        return 'bg-blue-100 text-blue-800';
      case 'pago':
        return 'bg-green-100 text-green-800';
      case 'vencido':
        return 'bg-red-100 text-red-800';
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Função para mapear status do Inter Bank para texto de exibição
  const getInterBankStatusLabel = (
    interSituacao?: string,
    localStatus?: string,
    vencida?: boolean
  ) => {
    // Priorizar status do Inter Bank se disponível
    if (interSituacao) {
      switch (interSituacao.toUpperCase()) {
        case 'RECEBIDO':
        case 'MARCADO_RECEBIDO':
        case 'PAGO': // PAM V1.0 - FASE 1: Reconhecer "PAGO" como status válido
          return 'Pago';
        case 'CANCELADO':
        case 'EXPIRADO':
        case 'FALHA_EMISSAO':
          return 'Cancelado';
        case 'ATRASADO':
        case 'PROTESTO':
          return 'Vencido';
        case 'A_RECEBER':
        case 'EM_PROCESSAMENTO':
        case 'EMITIDO':
          return 'Pendente';
        default:
          return interSituacao;
      }
    }

    // Fallback para status local
    if (localStatus === 'pago') return 'Pago';
    if (vencida) return 'Vencido';
    return 'Pendente';
  };

  // Função para calcular o Status de Vencimento inteligente
  const getStatusVencimento = (proposta: any) => {
    // Se tem situação do Inter Bank, verificar status especiais
    if (proposta.interSituacao) {
      const situacao = proposta.interSituacao.toUpperCase();
      if (situacao === 'RECEBIDO' || situacao === 'MARCADO_RECEBIDO') {
        return { text: 'Pago', color: 'text-green-600' };
      }
      if (situacao === 'CANCELADO' || situacao === 'EXPIRADO' || situacao === 'FALHA_EMISSAO') {
        return { text: 'Cancelado', color: 'text-gray-600' };
      }
    }

    // Se o status local indica pago
    if (proposta.status === 'quitado' || proposta.status === 'pago') {
      return { text: 'Pago', color: 'text-green-600' };
    }

    // Calcular baseado na data de vencimento
    const hoje = new Date();
    const dataVencimento = proposta.dataProximoVencimento
      ? parseISO(proposta.dataProximoVencimento)
      : null;

    if (!dataVencimento) {
      return { text: 'Sem vencimento', color: 'text-gray-500' };
    }

    // Se já venceu
    if (proposta.diasAtraso > 0) {
      return {
        text: `Vencido há ${proposta.diasAtraso} dias`,
        color: 'text-red-600 font-semibold',
      };
    }

    // Se vence hoje
    if (isToday(dataVencimento)) {
      return { text: 'Vence hoje', color: 'text-orange-600 font-semibold' };
    }

    // Se vence nos próximos 7 dias
    const diasParaVencer = differenceInDays(dataVencimento, hoje);
    if (diasParaVencer > 0 && diasParaVencer <= 7) {
      return { text: `Vence em ${diasParaVencer} dias`, color: 'text-yellow-600' };
    }

    // Para todos os outros casos, mostrar a data de vencimento
    if (isFuture(dataVencimento)) {
      return { text: format(dataVencimento, 'dd/MM/yyyy'), color: 'text-gray-600' };
    }

    return { text: 'Em dia', color: 'text-green-600' };
  };

  return (
    <DashboardLayout title="Cobranças">
      <div className="space-y-6">
        {/* Alerta para usuários de cobrança */}
        {isCobrancaUser && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <div>
                  <h3 className="font-semibold text-orange-800">Modo Cobrança Ativo</h3>
                  <p className="text-sm text-orange-700">
                    Você está visualizando apenas contratos: <strong>inadimplentes</strong>,{' '}
                    <strong>em atraso</strong> ou que <strong>vencem nos próximos 3 dias</strong>.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        {/* KPIs Dashboard */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Valor Total em Atraso</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(kpis?.valorTotalEmAtraso || 0)}
              </div>
              <div className="text-xs text-muted-foreground">
                {kpis?.quantidadeContratosEmAtraso || 0} contratos inadimplentes
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Inadimplência</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis?.taxaInadimplencia || 0}%</div>
              <Progress value={Number(kpis?.taxaInadimplencia) || 0} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Valor Total da Carteira</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(kpis?.valorTotalCarteira || 0)}
              </div>
              <div className="text-xs text-muted-foreground">
                {kpis?.quantidadeTotalContratos || 0} contratos ativos
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ações Rápidas</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={exportarInadimplentes}
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar Inadimplentes
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  console.log('[COBRANÇAS] Atualizando dados da API do Banco Inter...');
                  refetch();
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtros de Pesquisa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CPF, contrato..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-cobrancas"
                />
              </div>

              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              >
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="inadimplente">Inadimplente</SelectItem>
                  <SelectItem value="em_dia">Em Dia</SelectItem>
                  <SelectItem value="quitado">Quitado</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={atrasoFilter}
                onValueChange={(value) => setAtrasoFilter(value as AtrasoFilter)}
              >
                <SelectTrigger data-testid="select-atraso-filter">
                  <SelectValue placeholder="Dias de Atraso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="1-15">1-15 dias</SelectItem>
                  <SelectItem value="30+">Mais de 30 dias</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() => setShowCpf(!showCpf)}
                data-testid="button-toggle-cpf"
              >
                {showCpf ? (
                  <>
                    <EyeOff className="mr-2 h-4 w-4" />
                    Ocultar CPF
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Mostrar CPF
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Cobranças */}
        <Card>
          <CardHeader>
            <CardTitle>Contratos para Cobrança</CardTitle>
            <CardDescription>
              {propostasFiltradas?.length || 0} contratos encontrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Parcelas</TableHead>
                    <TableHead>Status Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : propostasFiltradas?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center">
                        Nenhum contrato encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    propostasFiltradas?.map((proposta: any) => (
                      <TableRow
                        key={proposta.id}
                        className={proposta.diasAtraso > 30 ? 'bg-red-50' : ''}
                      >
                        <TableCell className="font-medium">{proposta.numeroContrato}</TableCell>
                        <TableCell>{proposta.nomeCliente}</TableCell>
                        <TableCell>{maskDocument(proposta.cpfCliente)}</TableCell>
                        <TableCell>{proposta.telefoneCliente}</TableCell>
                        <TableCell>
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(proposta.valorTotal)}
                        </TableCell>
                        <TableCell>
                          {proposta.parcelasPagas}/{proposta.quantidadeParcelas}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const statusInfo = getStatusVencimento(proposta);
                            return <span className={statusInfo.color}>{statusInfo.text}</span>;
                          })()}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(proposta.status)}>
                            {proposta.status === 'em_dia'
                              ? 'Em Dia'
                              : proposta.status === 'inadimplente'
                                ? 'Inadimplente'
                                : 'Quitado'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedPropostaId(proposta.id);
                                setShowFichaModal(true);
                              }}
                              data-testid={`button-ficha-${proposta.id}`}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              Ficha
                            </Button>

                            {/* Menu de Ações - Apenas para boletos com status modificável */}
                            {proposta.interCodigoSolicitacao && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" variant="ghost">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      if (!canModifyBoletos) {
                                        toast({
                                          title: 'Acesso Negado',
                                          description:
                                            'Apenas administradores e equipe financeira podem prorrogar vencimentos',
                                          variant: 'destructive',
                                        });
                                        return;
                                      }
                                      const canModify = [
                                        'A_RECEBER',
                                        'ATRASADO',
                                        'EM_PROCESSAMENTO',
                                      ].includes(proposta.interSituacao?.toUpperCase() || '');
                                      if (!canModify) {
                                        toast({
                                          title: 'Ação não permitida',
                                          description: 'Este boleto não pode ser modificado',
                                          variant: 'destructive',
                                        });
                                        return;
                                      }
                                      setSelectedBoleto(proposta);
                                      setSelectedPropostaId(proposta.id);
                                      // Buscar boletos ativos da proposta
                                      apiRequest(
                                        `/api/inter/collections/proposal/${proposta.id}`
                                      ).then((data) => {
                                        setTodosBoletosAtivos(data.boletosAtivos || []);
                                      });
                                      setShowProrrogarModal(true);
                                    }}
                                    disabled={
                                      !canModifyBoletos ||
                                      ['PAGO', 'CANCELADO', 'RECEBIDO'].includes(
                                        proposta.interSituacao?.toUpperCase() || ''
                                      )
                                    }
                                  >
                                    <CalendarPlus className="mr-2 h-4 w-4" />
                                    Prorrogar Vencimento
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    onClick={() => {
                                      if (!canModifyBoletos) {
                                        toast({
                                          title: 'Acesso Negado',
                                          description:
                                            'Apenas administradores e equipe financeira podem aplicar descontos',
                                          variant: 'destructive',
                                        });
                                        return;
                                      }
                                      const canModify = [
                                        'A_RECEBER',
                                        'ATRASADO',
                                        'EM_PROCESSAMENTO',
                                      ].includes(proposta.interSituacao?.toUpperCase() || '');
                                      if (!canModify) {
                                        toast({
                                          title: 'Ação não permitida',
                                          description: 'Este boleto não pode ser modificado',
                                          variant: 'destructive',
                                        });
                                        return;
                                      }
                                      setSelectedBoleto(proposta);
                                      setSelectedPropostaId(proposta.id);
                                      // Buscar informações de dívida
                                      apiRequest(
                                        `/api/inter/collections/proposal/${proposta.id}`
                                      ).then((data) => {
                                        setDebtInfo(data);
                                        setNovoValorQuitacao(data.valorRestante * 0.5); // Sugerir 50% de desconto inicial
                                      });
                                      setShowDescontoModal(true);
                                    }}
                                    disabled={
                                      !canModifyBoletos ||
                                      ['PAGO', 'CANCELADO', 'RECEBIDO'].includes(
                                        proposta.interSituacao?.toUpperCase() || ''
                                      )
                                    }
                                  >
                                    <Percent className="mr-2 h-4 w-4" />
                                    Aplicar Desconto
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Modal - Prorrogar Vencimento (Seleção Múltipla) */}
        <Dialog
          open={showProrrogarModal}
          onOpenChange={(open) => {
            setShowProrrogarModal(open);
            if (!open) {
              setBoletosParaProrrogar([]);
              setNovaDataVencimento('');
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Prorrogar Vencimento de Boletos</DialogTitle>
              <DialogDescription>
                Selecione os boletos e escolha a nova data de vencimento
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Lista de boletos para seleção */}
              <div className="space-y-2">
                <Label>Boletos Disponíveis</Label>
                <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border p-2">
                  {todosBoletosAtivos.length > 0 ? (
                    todosBoletosAtivos.map((boleto) => (
                      <div
                        key={boleto.codigoSolicitacao}
                        className="flex cursor-pointer items-center space-x-3 rounded-lg p-2 hover:bg-muted"
                        onClick={() => {
                          if (boletosParaProrrogar.includes(boleto.codigoSolicitacao)) {
                            setBoletosParaProrrogar((prev) =>
                              prev.filter((c) => c !== boleto.codigoSolicitacao)
                            );
                          } else {
                            setBoletosParaProrrogar((prev) => [...prev, boleto.codigoSolicitacao]);
                          }
                        }}
                      >
                        <div className="flex h-5 w-5 items-center justify-center">
                          {boletosParaProrrogar.includes(boleto.codigoSolicitacao) ? (
                            <CheckSquare className="h-5 w-5 text-primary" />
                          ) : (
                            <div className="h-5 w-5 rounded border-2 border-gray-300" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            Parcela {boleto.numeroParcela} -{' '}
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(boleto.valor)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Vencimento atual:{' '}
                            {new Date(boleto.dataVencimento).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="p-4 text-center text-sm text-muted-foreground">
                      Carregando boletos ativos...
                    </p>
                  )}
                </div>
              </div>

              {/* Campo de nova data */}
              <div className="space-y-2">
                <Label htmlFor="nova-data">Nova Data de Vencimento</Label>
                <Input
                  id="nova-data"
                  type="date"
                  value={novaDataVencimento}
                  onChange={(e) => setNovaDataVencimento(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* Resumo da seleção */}
              {boletosParaProrrogar.length > 0 && (
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-sm font-medium">
                    {boletosParaProrrogar.length} boleto(s) selecionado(s)
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowProrrogarModal(false);
                  setBoletosParaProrrogar([]);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (boletosParaProrrogar.length === 0) {
                    toast({
                      title: 'Erro',
                      description: 'Selecione pelo menos um boleto',
                      variant: 'destructive',
                    });
                    return;
                  }
                  if (!novaDataVencimento) {
                    toast({
                      title: 'Erro',
                      description: 'Selecione uma nova data de vencimento',
                      variant: 'destructive',
                    });
                    return;
                  }
                  prorrogarMutation.mutate({
                    codigosSolicitacao: boletosParaProrrogar,
                    novaDataVencimento,
                  });
                }}
                disabled={prorrogarMutation.isPending || boletosParaProrrogar.length === 0}
              >
                {prorrogarMutation.isPending
                  ? 'Processando...'
                  : `Prorrogar ${boletosParaProrrogar.length} Boleto(s)`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal - Aplicar Desconto de Quitação (Multi-etapas) */}
        <Dialog
          open={showDescontoModal}
          onOpenChange={(open) => {
            setShowDescontoModal(open);
            if (!open) {
              setEtapaDesconto(1);
              setDebtInfo(null);
              setNovasParcelas([]);
            }
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Desconto para Quitação - Etapa {etapaDesconto} de 3</DialogTitle>
              <DialogDescription>
                {etapaDesconto === 1 && 'Análise da dívida atual'}
                {etapaDesconto === 2 && 'Configurar novo valor e parcelamento'}
                {etapaDesconto === 3 && 'Confirmar operação'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Etapa 1: Análise da Dívida */}
              {etapaDesconto === 1 && (
                <div className="space-y-4">
                  {loadingDebt || !debtInfo ? (
                    <div className="flex items-center justify-center p-8">
                      <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 rounded-lg bg-muted p-4">
                        <h3 className="text-lg font-semibold">Resumo da Dívida</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Valor Total Financiado</p>
                            <p className="text-lg font-bold">
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(debtInfo.valorTotal)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Valor Já Pago</p>
                            <p className="text-lg font-bold text-green-600">
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(debtInfo.valorPago)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Valor Restante</p>
                            <p className="text-lg font-bold text-orange-600">
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(debtInfo.valorRestante)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Boletos Ativos</p>
                            <p className="text-lg font-bold">{debtInfo.totalBoletosAtivos}</p>
                          </div>
                        </div>
                      </div>

                      {debtInfo.boletosAtivos?.length > 0 && (
                        <div className="rounded-lg border p-4">
                          <h4 className="mb-2 font-medium">Boletos Ativos</h4>
                          <div className="max-h-40 space-y-2 overflow-y-auto">
                            {debtInfo.boletosAtivos.map((b: any, idx: number) => (
                              <div
                                key={idx}
                                className="flex justify-between rounded bg-muted p-2 text-sm"
                              >
                                <span>Parcela {b.numeroParcela}</span>
                                <span>
                                  {new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  }).format(b.valor)}
                                </span>
                                <span>
                                  Venc: {new Date(b.dataVencimento).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Etapa 2: Configurar Novo Valor */}
              {etapaDesconto === 2 && debtInfo && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="novo-valor">Novo Valor para Quitação (R$)</Label>
                    <Input
                      id="novo-valor"
                      type="number"
                      step="0.01"
                      value={novoValorQuitacao}
                      onChange={(e) => {
                        const valor = parseFloat(e.target.value);
                        setNovoValorQuitacao(valor);
                        // Recalcular parcelas
                        if (valor > 0 && quantidadeParcelas > 0) {
                          const valorParcela = valor / quantidadeParcelas;
                          const parcelas = [];
                          for (let i = 0; i < quantidadeParcelas; i++) {
                            const dataVenc = new Date();
                            dataVenc.setMonth(dataVenc.getMonth() + i + 1);
                            parcelas.push({
                              valor: valorParcela,
                              dataVencimento: dataVenc.toISOString().split('T')[0],
                            });
                          }
                          setNovasParcelas(parcelas);
                        }
                      }}
                      placeholder="0.00"
                      max={debtInfo.valorRestante}
                    />
                    <p className="text-xs text-muted-foreground">
                      Máximo:{' '}
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(debtInfo.valorRestante)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="parcelas">Quantidade de Parcelas</Label>
                    <Select
                      value={quantidadeParcelas.toString()}
                      onValueChange={(value) => {
                        const qtd = parseInt(value);
                        setQuantidadeParcelas(qtd);
                        // Recalcular parcelas
                        if (novoValorQuitacao > 0) {
                          const valorParcela = novoValorQuitacao / qtd;
                          const parcelas = [];
                          for (let i = 0; i < qtd; i++) {
                            const dataVenc = new Date();
                            dataVenc.setMonth(dataVenc.getMonth() + i + 1);
                            parcelas.push({
                              valor: valorParcela,
                              dataVencimento: dataVenc.toISOString().split('T')[0],
                            });
                          }
                          setNovasParcelas(parcelas);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 12, 24].map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {n} {n === 1 ? 'parcela' : 'parcelas'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {novoValorQuitacao > 0 && (
                    <div className="rounded-lg bg-green-50 p-3">
                      <p className="text-sm font-medium text-green-800">
                        Desconto aplicado:{' '}
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(debtInfo.valorRestante - novoValorQuitacao)}
                      </p>
                      <p className="text-xs text-green-600">
                        ({((1 - novoValorQuitacao / debtInfo.valorRestante) * 100).toFixed(1)}% de
                        desconto)
                      </p>
                    </div>
                  )}

                  {novasParcelas.length > 0 && (
                    <div className="rounded-lg border p-3">
                      <h4 className="mb-2 font-medium">Novas Parcelas</h4>
                      <div className="max-h-40 space-y-1 overflow-y-auto">
                        {novasParcelas.map((p, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>Parcela {idx + 1}</span>
                            <span>
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(p.valor)}
                            </span>
                            <span>{new Date(p.dataVencimento).toLocaleDateString('pt-BR')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Etapa 3: Confirmação */}
              {etapaDesconto === 3 && debtInfo && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
                      <div className="flex-1">
                        <h4 className="font-medium text-amber-900">Atenção!</h4>
                        <p className="mt-1 text-sm text-amber-700">Esta operação irá:</p>
                        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-700">
                          <li>Cancelar {debtInfo.totalBoletosAtivos} boleto(s) ativo(s)</li>
                          <li>Criar {quantidadeParcelas} novo(s) boleto(s)</li>
                          <li>
                            Aplicar desconto de{' '}
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(debtInfo.valorRestante - novoValorQuitacao)}
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg bg-muted p-4">
                    <h4 className="font-semibold">Resumo Final</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Dívida Anterior</p>
                        <p className="font-medium">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(debtInfo.valorRestante)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Novo Valor</p>
                        <p className="font-medium text-green-600">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(novoValorQuitacao)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Desconto Total</p>
                        <p className="font-medium">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(debtInfo.valorRestante - novoValorQuitacao)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Nova Quantidade de Parcelas</p>
                        <p className="font-medium">{quantidadeParcelas}x</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              {etapaDesconto > 1 && (
                <Button variant="outline" onClick={() => setEtapaDesconto(etapaDesconto - 1)}>
                  Voltar
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setShowDescontoModal(false);
                  setEtapaDesconto(1);
                }}
              >
                Cancelar
              </Button>
              {etapaDesconto < 3 ? (
                <Button
                  onClick={() => {
                    if (etapaDesconto === 1 && debtInfo) {
                      setEtapaDesconto(2);
                    } else if (
                      etapaDesconto === 2 &&
                      novoValorQuitacao > 0 &&
                      novasParcelas.length > 0
                    ) {
                      setEtapaDesconto(3);
                    } else {
                      toast({
                        title: 'Erro',
                        description: 'Configure todos os campos necessários',
                        variant: 'destructive',
                      });
                    }
                  }}
                  disabled={
                    (etapaDesconto === 1 && !debtInfo) ||
                    (etapaDesconto === 2 && (!novoValorQuitacao || novasParcelas.length === 0))
                  }
                >
                  Próximo
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    descontoQuitacaoMutation.mutate({
                      propostaId: selectedPropostaId,
                      desconto: debtInfo.valorRestante - novoValorQuitacao,
                      novasParcelas,
                    });
                  }}
                  disabled={descontoQuitacaoMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {descontoQuitacaoMutation.isPending ? 'Processando...' : 'Confirmar Quitação'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal - Ficha do Cliente */}
        <Dialog open={showFichaModal} onOpenChange={setShowFichaModal}>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
            <DialogHeader>
              <DialogTitle>Ficha do Cliente - Dossiê de Cobrança</DialogTitle>
              <DialogDescription>
                Informações completas do cliente e histórico de cobrança
              </DialogDescription>
            </DialogHeader>

            {loadingFicha ? (
              <div className="p-8 text-center">Carregando ficha...</div>
            ) : fichaCliente ? (
              <ScrollArea className="h-[70vh] pr-4">
                <div className="space-y-6">
                  {/* Dados do Cliente */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center text-base">
                        <User className="mr-2 h-4 w-4" />
                        Dados do Cliente
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label className="text-muted-foreground">Nome</Label>
                        <p className="font-medium">{fichaCliente.cliente.nome}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">CPF</Label>
                        <p className="font-medium">{fichaCliente.cliente.cpf}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Telefone</Label>
                        <p className="flex items-center gap-2 font-medium">
                          {fichaCliente.cliente.telefone}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              copyToClipboard(fichaCliente.cliente.telefone, 'Telefone')
                            }
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Email</Label>
                        <p className="font-medium">{fichaCliente.cliente.email}</p>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-muted-foreground">Endereço</Label>
                        <p className="font-medium">{fichaCliente.cliente.endereco}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Referências */}
                  {fichaCliente.referencias?.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center text-base">
                          <UserCheck className="mr-2 h-4 w-4" />
                          Referências Pessoais
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {fichaCliente.referencias.map((ref, index) => (
                            <div
                              key={ref.id}
                              className="bg-muted/50 flex items-center justify-between rounded p-2"
                            >
                              <div>
                                <p className="font-medium">{ref.nomeCompleto}</p>
                                <p className="text-sm text-muted-foreground">
                                  {ref.grauParentesco}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{ref.telefone}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyToClipboard(ref.telefone, 'Telefone')}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* PAM V1.0 FASE 3 - Seção "Dados Bancários" removida conforme especificação */}

                  {/* Resumo Financeiro */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center text-base">
                        <DollarSign className="mr-2 h-4 w-4" />
                        Resumo Financeiro
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(fichaCliente.resumoFinanceiro.totalPago || 0)}
                          </p>
                          <p className="text-sm text-muted-foreground">Total Pago</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-red-600">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(fichaCliente.resumoFinanceiro.totalVencido || 0)}
                          </p>
                          <p className="text-sm text-muted-foreground">Total Vencido</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-yellow-600">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(fichaCliente.resumoFinanceiro.totalPendente || 0)}
                          </p>
                          <p className="text-sm text-muted-foreground">Total Pendente</p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-4">
                        <div className="rounded bg-muted p-2 text-center">
                          <p className="text-lg font-semibold">
                            {fichaCliente.parcelas?.filter((p: any) => p.status === 'pago')
                              .length || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">Parcelas Pagas</p>
                        </div>
                        <div className="rounded bg-muted p-2 text-center">
                          <p className="text-lg font-semibold">
                            {fichaCliente.parcelas?.filter((p: any) => p.vencida).length || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">Parcelas Vencidas</p>
                        </div>
                        <div className="rounded bg-muted p-2 text-center">
                          <p className="text-lg font-semibold">
                            {fichaCliente.parcelas?.filter(
                              (p: any) => p.status === 'pendente' && !p.vencida
                            ).length || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">Parcelas Pendentes</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Histórico de Observações */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center text-base">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Histórico de Observações
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Formulário para adicionar nova observação */}
                        <div className="border-b pb-4">
                          <div className="space-y-3">
                            <div>
                              <Label htmlFor="observacao-text">Nova Observação</Label>
                              <Textarea
                                id="observacao-text"
                                placeholder="Digite sua observação sobre este cliente ou proposta..."
                                value={novaObservacao}
                                onChange={(e) => setNovaObservacao(e.target.value)}
                                className="min-h-[80px]"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Select value={statusObservacao} onValueChange={setStatusObservacao}>
                                <SelectTrigger className="w-[250px]">
                                  <SelectValue placeholder="Selecione o status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Contato Realizado">
                                    Contato Realizado
                                  </SelectItem>
                                  <SelectItem value="Negociação em Andamento">
                                    Negociação em Andamento
                                  </SelectItem>
                                  <SelectItem value="Acordo Fechado">Acordo Fechado</SelectItem>
                                  <SelectItem value="Monitoramento">Monitoramento</SelectItem>
                                  <SelectItem value="Outros">Outros</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                onClick={handleSalvarObservacao}
                                disabled={
                                  !novaObservacao.trim() || !statusObservacao || salvandoObservacao
                                }
                              >
                                {salvandoObservacao ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Salvando...
                                  </>
                                ) : (
                                  'Salvar Observação'
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Lista de observações existentes */}
                        {loadingFicha ? (
                          <div className="py-4 text-center">
                            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                            <p className="mt-2 text-sm text-muted-foreground">
                              Carregando histórico...
                            </p>
                          </div>
                        ) : !fichaCliente.observacoes || fichaCliente.observacoes.length === 0 ? (
                          <div className="py-4 text-center text-muted-foreground">
                            Nenhuma observação registrada ainda.
                          </div>
                        ) : (
                          <ScrollArea className="h-[300px]">
                            <div className="space-y-3 pr-4">
                              {fichaCliente.observacoes.map((obs) => (
                                <div key={obs.id} className="space-y-2 rounded-lg border p-3">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <Badge
                                          variant={
                                            obs.tipoContato === 'Acordo Fechado'
                                              ? 'default'
                                              : obs.tipoContato === 'Contato Realizado'
                                                ? 'secondary'
                                                : obs.tipoContato === 'Negociação em Andamento'
                                                  ? 'outline'
                                                  : 'secondary'
                                          }
                                        >
                                          {obs.tipoContato}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                          {format(new Date(obs.createdAt), "dd/MM/yyyy 'às' HH:mm")}
                                        </span>
                                      </div>
                                      <p className="mt-2 text-sm">{obs.observacao}</p>
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        Por: {obs.userName}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Parcelas com Boletos */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center text-base">
                          <Receipt className="mr-2 h-4 w-4" />
                          Detalhamento de Parcelas
                        </CardTitle>
                        <div className="flex gap-2">
                          {/* PAM V1.0 RESTAURAÇÃO - Carnê movido para posição secundária */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                toast({
                                  title: 'Gerando carnê...',
                                  description: 'Compilando carnê consolidado de boletos',
                                });

                                // Chamar endpoint de geração de carnê consolidado
                                const response = (await apiRequest(
                                  `/api/propostas/${selectedPropostaId}/gerar-carne`,
                                  { method: 'POST' }
                                )) as {
                                  success: boolean;
                                  message?: string;
                                  existingFile?: boolean;
                                  jobId?: string;
                                  status?: string;
                                  data?: {
                                    url?: string;
                                    fileName?: string;
                                    propostaId?: string;
                                  };
                                };

                                // PAM V1.0: Lógica inteligente de dois estágios
                                if (response.success) {
                                  if (response.existingFile && response.data?.url) {
                                    // CENÁRIO 1: O carnê já existe. Iniciar download imediato.
                                    console.log(
                                      '[CARNE] Carnê já existente encontrado. Iniciando download...'
                                    );
                                    window.open(response.data.url, '_blank');
                                    toast({
                                      title: 'Download iniciado',
                                      description: 'O carnê já estava pronto.',
                                    });
                                  } else if (response.jobId) {
                                    // CENÁRIO 2: Novo carnê está a ser gerado. Iniciar polling.
                                    console.log(
                                      '[CARNE] Geração de novo carnê iniciada. Job ID:',
                                      response.jobId
                                    );
                                    toast({
                                      title: 'Carnê em processamento',
                                      description:
                                        'Gerando carnê consolidado... Aguarde a conclusão.',
                                    });

                                    // TODO: Implementar polling para aguardar conclusão
                                    // (Polling será implementado em iteração futura conforme necessário)
                                  } else {
                                    // CENÁRIO DE ERRO: Resposta inesperada
                                    throw new Error(
                                      'Resposta da API inválida - sem data.url nem jobId.'
                                    );
                                  }
                                } else {
                                  toast({
                                    title: 'Erro na geração',
                                    description:
                                      response.message || 'Falha ao gerar carnê consolidado',
                                    variant: 'destructive',
                                  });
                                }
                              } catch (error) {
                                toast({
                                  title: 'Erro ao gerar carnê',
                                  description: 'Não foi possível gerar o carnê consolidado',
                                  variant: 'destructive',
                                });
                              }
                            }}
                            title="Gerar e baixar carnê consolidado de todos os boletos (ação secundária)"
                          >
                            <FileText className="mr-2 h-3 w-3" />
                            Carnê Consolidado
                          </Button>

                          {/* Botão de Atualização de Status */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                toast({
                                  title: 'Sincronizando...',
                                  description: 'Atualizando status das parcelas com o Banco Inter',
                                });

                                const response = (await apiRequest(
                                  `/api/cobrancas/sincronizar/${selectedPropostaId}`,
                                  { method: 'POST' }
                                )) as { updated: number; message: string };

                                toast({
                                  title: 'Sincronização concluída',
                                  description: `${response.updated || 0} parcelas atualizadas`,
                                });

                                // Invalidar a query para forçar recarregar a ficha do cliente
                                queryClient.invalidateQueries({
                                  queryKey: ['/api/cobrancas/ficha', selectedPropostaId],
                                });
                              } catch (error) {
                                toast({
                                  title: 'Erro na sincronização',
                                  description: 'Não foi possível sincronizar com o Banco Inter',
                                  variant: 'destructive',
                                });
                              }
                            }}
                            title="Sincronizar status das parcelas com o Banco Inter"
                          >
                            <RefreshCw className="mr-2 h-3 w-3" />
                            Atualizar Status
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {fichaCliente.parcelas?.map((parcela) => (
                          <div
                            key={parcela.id}
                            className={`rounded border p-3 ${
                              (parcela as any).vencida
                                ? 'border-red-300 bg-red-50'
                                : parcela.status === 'pago'
                                  ? 'border-green-300 bg-green-50'
                                  : 'border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">
                                  Parcela {parcela.numeroParcela} -{' '}
                                  {new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  }).format(Number(parcela.valorParcela))}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Vencimento:{' '}
                                  {format(parseISO(parcela.dataVencimento), 'dd/MM/yyyy')}
                                  {parcela.diasAtraso && parcela.diasAtraso > 0 && (
                                    <span className="ml-2 font-semibold text-red-600">
                                      ({parcela.diasAtraso} dias de atraso)
                                    </span>
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {/* PAM V1.0 FASE 2 - Botão Copiar PIX com Tooltip Melhorado */}
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={!parcela.pixCopiaECola}
                                        onClick={() => {
                                          if (parcela.pixCopiaECola) {
                                            copyToClipboard(parcela.pixCopiaECola, 'PIX');
                                          } else {
                                            toast({
                                              title: 'PIX não disponível',
                                              description:
                                                'PIX não fornecido pelo banco para esta parcela',
                                              variant: 'destructive',
                                            });
                                          }
                                        }}
                                      >
                                        <QrCode className="mr-2 h-3 w-3" />
                                        Copiar PIX
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>
                                        {parcela.pixCopiaECola
                                          ? 'Copiar código PIX para pagamento'
                                          : 'PIX não fornecido pelo banco para esta parcela'}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>

                                {/* PAM V1.0 RESTAURAÇÃO - Botão Download PDF Individual */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!parcela.codigoSolicitacao}
                                  onClick={async () => {
                                    if (!parcela.codigoSolicitacao) {
                                      toast({
                                        title: 'PDF não disponível',
                                        description:
                                          'Código de solicitação não encontrado para esta parcela',
                                        variant: 'destructive',
                                      });
                                      return;
                                    }

                                    try {
                                      toast({
                                        title: 'Abrindo PDF...',
                                        description: `Abrindo boleto da parcela ${parcela.numeroParcela} em nova guia`,
                                      });

                                      // PAM V1.0 CORRIGIDO: URL autenticada sem responseType blob
                                      // BUG CORRIGIDO: responseType blob interferia com autenticação JWT
                                      const pdfUrl = `/api/inter/collections/${selectedPropostaId}/${parcela.codigoSolicitacao}/pdf`;

                                      // Abrir diretamente - o servidor retorna o PDF com headers corretos
                                      window.open(pdfUrl, '_blank');

                                      toast({
                                        title: 'PDF aberto',
                                        description: `Boleto da parcela ${parcela.numeroParcela} aberto em nova guia`,
                                      });
                                    } catch (error: any) {
                                      console.error(
                                        '[PDF VIEW] Erro ao abrir PDF individual:',
                                        error
                                      );

                                      if (
                                        error?.message?.includes('PDF_NOT_AVAILABLE') ||
                                        error?.message?.includes('404')
                                      ) {
                                        toast({
                                          title: 'PDF não sincronizado',
                                          description:
                                            "O PDF ainda não foi sincronizado. Tente 'Atualizar Status' primeiro.",
                                          variant: 'destructive',
                                        });
                                      } else if (error?.message?.includes('BOLETO_NOT_FOUND')) {
                                        toast({
                                          title: 'Boleto não encontrado',
                                          description: 'Boleto não encontrado no sistema do banco.',
                                          variant: 'destructive',
                                        });
                                      } else if (
                                        error?.message?.includes('401') ||
                                        error?.message?.includes('Token')
                                      ) {
                                        toast({
                                          title: 'Erro de autenticação',
                                          description: 'Sessão expirada. Faça login novamente.',
                                          variant: 'destructive',
                                        });
                                      } else {
                                        toast({
                                          title: 'Erro ao abrir PDF',
                                          description: 'Não foi possível abrir o PDF do boleto.',
                                          variant: 'destructive',
                                        });
                                      }
                                    }
                                  }}
                                  title={`Visualizar PDF do boleto da parcela ${parcela.numeroParcela} em nova guia`}
                                >
                                  <Eye className="mr-1.5 h-3 w-3" />
                                  Visualizar PDF
                                </Button>

                                {/* Badge de Status - Usando status REAL do Inter */}
                                <Badge
                                  className={getInterBankStatusColor(
                                    parcela.interSituacao || parcela.status
                                  )}
                                  title={`Status no Banco Inter: ${parcela.interSituacao || 'Não sincronizado'}`}
                                >
                                  {getInterBankStatusLabel(
                                    parcela.interSituacao,
                                    parcela.status,
                                    (parcela as any).vencida
                                  )}
                                </Badge>

                                {/* PAM V1.0 - FASE 3: Botão Marcar como Pago */}
                                {parcela.interSituacao !== 'PAGO' && parcela.codigoSolicitacao && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={async () => {
                                      try {
                                        // PAM V1.0 - FASE 3: Tipagem correta da resposta
                                        const response = (await apiRequest(
                                          `/api/cobrancas/parcelas/${parcela.codigoSolicitacao}/marcar-pago`,
                                          { method: 'PATCH' }
                                        )) as {
                                          success: boolean;
                                          message: string;
                                          codigoSolicitacao: string;
                                          numeroParcela: number;
                                        };

                                        if (response.success) {
                                          toast({
                                            title: 'Parcela marcada como paga',
                                            description: `Parcela ${parcela.numeroParcela} foi marcada como paga com sucesso`,
                                          });

                                          // PAM V1.0 FASE 2: Blindagem total - invalidar todos os caches relevantes
                                          queryClient.invalidateQueries({
                                            queryKey: ['/api/cobrancas/ficha', selectedPropostaId],
                                          });
                                          queryClient.invalidateQueries({
                                            queryKey: ['/api/cobrancas'],
                                          });
                                          queryClient.invalidateQueries({
                                            queryKey: ['/api/cobrancas/kpis'],
                                          });
                                        }
                                      } catch (error) {
                                        console.error('Erro ao marcar como pago:', error);
                                        toast({
                                          title: 'Erro',
                                          description:
                                            'Não foi possível marcar a parcela como paga',
                                          variant: 'destructive',
                                        });
                                      }
                                    }}
                                    title="Marcar esta parcela como paga manualmente"
                                  >
                                    <CheckCircle className="mr-1.5 h-3 w-3" />
                                    Marcar Pago
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            ) : (
              <div className="p-8 text-center">Erro ao carregar ficha</div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowFichaModal(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
