import { useRoute, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getSupabase } from '@/lib/supabase';
import {
  CheckCircle,
  Clock,
  FileText,
  AlertCircle,
  User,
  CreditCard,
  Download,
  Edit,
  Send,
  ArrowLeft,
  Calendar,
  Shield,
  Percent,
  Activity,
  Eye,
  FileCheck,
  Signature,
  TrendingUp,
  Building2,
  Printer,
  Copy,
  QrCode,
  Barcode,
  RefreshCw,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { robustApiClient } from '@/lib/apiClient';
import { useToast } from '@/hooks/use-toast';
import RefreshButton from '@/components/RefreshButton';
import { PropostaMapper } from '@/mappers/proposta.mapper';
import { useAuth } from '@/contexts/AuthContext';
import { queryKeys } from '@/hooks/queries/queryKeys';
import { EtapaFormalizacaoControl } from '@/components/propostas/EtapaFormalizacaoControl';
import { DocumentViewer } from '@/components/DocumentViewer';
import { CCBViewer } from '@/components/CCBViewer';

interface Proposta {
  id: string;
  status: string;
  // Direct fields from backend (NEW - corrected data contract)
  valor?: number;
  valorAprovado?: number;
  prazo?: number;
  taxaJuros?: number;
  cliente_data: {
    nome: string;
    cpf: string;
    email: string;
    telefone: string;
    dataNascimento: string;
    renda: number;
    endereco?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
  };
  condicoes_data: {
    valor: number;
    prazo: number;
    finalidade: string;
    garantia: string;
  };
  lojas?: {
    id: number;
    nome_loja: string;
    parceiros: {
      id: number;
      razao_social: string;
    };
  };
  loja_id: number;
  created_at: string;
  updated_at: string;
  data_aprovacao?: string;
  clicksignSignUrl?: string;
  documentos_adicionais?: string[];
  contrato_gerado?: boolean;
  contrato_assinado?: boolean;
  data_assinatura?: string;
  data_pagamento?: string;
  observacoes_formalizacao?: string;
  // Novos campos de formalização
  biometriaConcluida: boolean;
  caminhoCcbAssinado?: string;
  // Backend fields (camelCase)
  lojaId: number;
  createdAt: string;
  updatedAt: string;
  dataAprovacao?: string;
  documentosAdicionais?: string[];
  contratoGerado?: boolean;
  contratoAssinado?: boolean;
  dataAssinatura?: string;
  dataPagamento?: string;
  observacoesFormalização?: string;
  // ClickSign fields
  clicksignDocumentKey?: string;
  clicksignSignerKey?: string;
  clicksignStatus?: string;
  clicksignSentAt?: string;
  clicksignSignedAt?: string;
  // Campos de tracking do Banco Inter
  interBoletoGerado?: boolean;
  interBoletoGeradoEm?: string;
  interCodigoSolicitacao?: string;
}

// PAM V1.0 - Usando Sistema de Status V2.0
// Mapeamento: ASSINATURA_CONCLUIDA → ASSINATURA_CONCLUIDA
//            CCB_GERADA → CCB_GERADA
//            BOLETOS_EMITIDOS → BOLETOS_EMITIDOS
//            pago → PAGAMENTO_CONFIRMADO

const updateFormalizacaoSchema = z.object({
  status: z
    .enum([
      'aprovado',
      'documentos_enviados',
      'CCB_GERADA',
      'AGUARDANDO_ASSINATURA',
      'ASSINATURA_PENDENTE',
      'ASSINATURA_CONCLUIDA',
      'BOLETOS_EMITIDOS',
      'PAGAMENTO_PENDENTE',
      'PAGAMENTO_PARCIAL',
      'PAGAMENTO_CONFIRMADO',
    ])
    .optional(),
  documentosAdicionais: z.array(z.string()).optional(),
  contratoGerado: z.boolean().optional(),
  contratoAssinado: z.boolean().optional(),
  observacoesFormalização: z.string().optional(),
});

type UpdateFormalizacaoForm = z.infer<typeof updateFormalizacaoSchema>;

function FormalizacaoList() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // 🚀 PAM V1.0: SSE connection for real-time updates with JWT authentication
  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connectSSE = async () => {
      try {
        // Importar TokenManager dinamicamente
        const { TokenManager } = await import('@/lib/apiClient');
        const tokenManager = TokenManager.getInstance();
        const token = await tokenManager.getValidToken();

        if (!token) {
          console.warn('[SSE] ⚠️ Não foi possível obter token JWT para SSE');
          return;
        }

        // Conectar SSE com token JWT via query parameter
        eventSource = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);

        eventSource.onopen = () => {
          console.log('[SSE] 📡 ✅ Conectado ao servidor de eventos em tempo real');
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[SSE] 📨 Evento recebido:', data);

            if (data.type === 'PROPOSAL_SIGNED' && data.proposalId) {
              // Invalidate formalizacao queries to refresh data
              queryClient.invalidateQueries({ queryKey: queryKeys.propostas.formalizacao() });
              console.log('[SSE] 🔄 Proposta atualizada em tempo real:', data.proposalId);
            }
          } catch (error) {
            console.error('[SSE] ❌ Erro ao processar evento:', error);
          }
        };

        eventSource.onerror = (error) => {
          console.error('[SSE] ❌ Erro de conexão:', error);
          // Eventualmente pode tentar reconectar aqui
        };

      } catch (error) {
        console.error('[SSE] ❌ Erro ao configurar conexão SSE:', error);
      }
    };

    // Conectar SSE
    connectSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
        console.log('[SSE] 🔌 Conexão fechada');
      }
    };
  }, [queryClient]);

  // Função para parsing defensivo de dados JSONB
  const parseJsonbField = (field: any, fieldName: string, propostaId: string) => {
    // Se é null, undefined ou vazio, retornar objeto vazio
    if (!field || field === 'null' || field === 'undefined') {
      return {};
    }

    if (typeof field === 'string' && field.trim() !== '') {
      try {
        return JSON.parse(field);
      } catch (e) {
        console.warn(`Erro ao fazer parse de ${fieldName} para proposta ${propostaId}:`, e);
        return {};
      }
    }

    // Se já é um objeto, retornar como está
    if (typeof field === 'object') {
      return field || {};
    }

    return {};
  };

  const {
    data: propostas,
    isLoading,
    error,
  } = useQuery<Proposta[]>({
    queryKey: queryKeys.propostas.formalizacao(),
    queryFn: async () => {
      console.log('Fazendo requisição para /api/propostas/formalizacao');
      const response = await apiRequest('/api/propostas/formalizacao');
      console.log('Resposta do endpoint formalizacao:', response);

      // ✅ PAM V1.0 - APLICANDO MAPPER DE NORMALIZAÇÃO
      const normalizedPropostas = (response as any[]).map((row: any) => {
        console.log('🔧 [MAPPER] Antes:', row);
        const normalized = PropostaMapper.mapFormalizacaoProps(row);
        console.log('✅ [MAPPER] Depois:', normalized);
        return normalized;
      });

      console.log('✅ [MAPPER] Propostas normalizadas:', normalizedPropostas);
      return normalizedPropostas;
    },
  });

  // Debug: log error if any
  if (error) {
    console.error('Erro na query de formalização:', error);
  }

  const formatCurrency = (value: string | number) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(numValue);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getStatusColor = (status: string) => {
    const statusColors = {
      aprovado: 'bg-green-500',
      documentos_enviados: 'bg-blue-500',
      CCB_GERADA: 'bg-purple-500',
      AGUARDANDO_ASSINATURA: 'bg-yellow-500',
      ASSINATURA_PENDENTE: 'bg-amber-500',
      ASSINATURA_CONCLUIDA: 'bg-indigo-500',
      BOLETOS_EMITIDOS: 'bg-orange-500',
      PAGAMENTO_PENDENTE: 'bg-blue-600',
      PAGAMENTO_PARCIAL: 'bg-yellow-600',
      PAGAMENTO_CONFIRMADO: 'bg-green-600',
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-500';
  };

  const getStatusText = (status: string) => {
    const statusTexts = {
      aprovado: 'Aprovado',
      documentos_enviados: 'Documentos Enviados',
      CCB_GERADA: 'CCB Gerada',
      AGUARDANDO_ASSINATURA: 'Aguardando Assinatura',
      ASSINATURA_PENDENTE: 'Assinatura Pendente',
      ASSINATURA_CONCLUIDA: 'Assinatura Concluída',
      BOLETOS_EMITIDOS: 'Boletos Emitidos',
      PAGAMENTO_PENDENTE: 'Pagamento Pendente',
      PAGAMENTO_PARCIAL: 'Pagamento Parcial',
      PAGAMENTO_CONFIRMADO: 'Pagamento Confirmado',
    };
    return statusTexts[status as keyof typeof statusTexts] || status;
  };

  // Backend already handles all permission filtering
  const formalizacaoPropostas = propostas || [];

  // 🔍 PAM V1.0 - LOG DE DIAGNÓSTICO #1: Dados recebidos
  console.log('🔍 [PAM V1.0 DIAGNÓSTICO] FormalizacaoList - Estado atual:', {
    isLoading,
    hasError: !!error,
    totalPropostas: formalizacaoPropostas.length,
    propostas: formalizacaoPropostas,
    primeiraPropostaStatus: formalizacaoPropostas[0]?.status || 'NENHUMA',
  });

  if (isLoading) {
    return (
      <DashboardLayout title="Formalização">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, index) => (
            <Card
              key={index}
              className="animate-pulse border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
            >
              <CardContent className="p-6">
                <div className="mb-4 h-6 rounded bg-gray-300 dark:bg-gray-700"></div>
                <div className="mb-2 h-4 rounded bg-gray-300 dark:bg-gray-700"></div>
                <div className="h-4 w-3/4 rounded bg-gray-300 dark:bg-gray-700"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DashboardLayout>
    );
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.propostas.formalizacao() });
  };

  const getTitle = () => {
    return 'Propostas em Formalização';
  };

  const getDescription = () => {
    return 'Acompanhe o processo de formalização das propostas aprovadas';
  };

  return (
    <DashboardLayout
      title={getTitle()}
      actions={<RefreshButton onRefresh={handleRefresh} isLoading={isLoading} variant="ghost" />}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{getTitle()}</h1>
            <p className="text-gray-600 dark:text-gray-400">{getDescription()}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total em Formalização</p>
              <p className="text-2xl font-bold text-blue-400">{formalizacaoPropostas.length}</p>
            </div>
          </div>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {[
            { status: 'aprovado', label: 'Aprovado', color: 'bg-green-400' },
            { status: 'documentos_enviados', label: 'Documentos Enviados', color: 'bg-blue-500' },
            { status: 'CCB_GERADA', label: 'CCB Gerada', color: 'bg-purple-500' },
            { status: 'ASSINATURA_CONCLUIDA', label: 'Assinatura Concluída', color: 'bg-indigo-500' },
            { status: 'BOLETOS_EMITIDOS', label: 'Boletos Emitidos', color: 'bg-orange-500' },
          ].map((item) => {
            const count = formalizacaoPropostas.filter((p) => p.status === item.status).length;
            return (
              <Card
                key={item.status}
                className="border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className={`h-3 w-3 rounded-full ${item.color}`}></div>
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {count}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{item.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Propostas List */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {formalizacaoPropostas.map((proposta) => {
            // 🔍 PAM V1.0 - LOG DE DIAGNÓSTICO #2: Renderização de cada proposta
            console.log('🔍 [PAM V1.0 DIAGNÓSTICO] Renderizando proposta:', {
              id: proposta.id,
              status: proposta.status,
              statusColor: getStatusColor(proposta.status),
              statusText: getStatusText(proposta.status),
              clienteData: proposta.cliente_data,
              userRole: user?.role,
            });
            return (
              <Card
                key={proposta.id}
                className="cursor-pointer border-gray-200 bg-white transition-shadow hover:shadow-lg dark:border-gray-700 dark:bg-gray-800"
              >
                <CardContent className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      #{proposta.id}
                    </h3>
                    <Badge className={`${getStatusColor(proposta.status)} text-white`}>
                      {getStatusText(proposta.status)}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Cliente</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {parseJsonbField(proposta.cliente_data, 'cliente_data', proposta.id)
                          ?.nome || 'Nome não informado'}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Valor Aprovado</p>
                      <p className="font-bold text-green-400">
                        {formatCurrency(proposta.valorAprovado || proposta.valor || 0)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Data da Aprovação</p>
                      <p className="text-gray-900 dark:text-white">
                        {formatDate(proposta.data_aprovacao || proposta.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 border-t pt-4">
                    <Button
                      onClick={() => setLocation(`/formalizacao/acompanhamento/${proposta.id}`)}
                      className="w-full"
                      variant={
                        user?.role === 'ATENDENTE' &&
                        (proposta.status === 'aprovado' ||
                          proposta.status === 'documentos_enviados')
                          ? 'default'
                          : 'outline'
                      }
                    >
                      {user?.role === 'ATENDENTE' &&
                      (proposta.status === 'aprovado' || proposta.status === 'documentos_enviados')
                        ? 'Ação Necessária'
                        : 'Acompanhar'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {formalizacaoPropostas.length === 0 && (
          <div className="py-12 text-center">
            <FileText className="mx-auto mb-4 h-16 w-16 text-gray-400" />
            <p className="text-lg text-gray-500">Nenhuma proposta em formalização</p>
            <p className="mt-2 text-gray-400">Propostas aprovadas aparecerão aqui</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function Formalizacao() {
  // 🔧 CORREÇÃO CRÍTICA: TODOS os hooks devem estar ANTES de qualquer lógica condicional ou return
  const [, params] = useRoute('/formalizacao/acompanhamento/:id');
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'timeline' | 'documents' | 'contracts'>('timeline');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [ccbUrl, setCcbUrl] = useState<string | null>(null);
  const [showCcbViewer, setShowCcbViewer] = useState(false);
  // 🎯 TIPAGEM CORRIGIDA: Interfaces para dados das APIs
  interface ClickSignData {
    signUrl?: string;
    envelopeId?: string;
    status?: string;
    success?: boolean;
  }

  interface InterBoletoResponse {
    totalCriados?: number;
    codigoSolicitacao?: string;
    boletos?: any[];
  }

  interface CCBResponse {
    status?: string;
    publicUrl?: string;
  }

  const [clickSignData, setClickSignData] = useState<ClickSignData | null>(null);
  // ✅ REMOVIDO: loadingClickSign - usar enviarClickSignMutation.isPending
  const [useBiometricAuth, setUseBiometricAuth] = useState(false);
  const [interBoletoData, setInterBoletoData] = useState<{ codigoSolicitacao?: string } | null>(
    null
  );
  const [loadingInter, setLoadingInter] = useState(false);
  const [loadingCarne, setLoadingCarne] = useState(false);
  const [carneUrl, setCarneUrl] = useState<string | null>(null);
  const [carneTotalBoletos, setCarneTotalBoletos] = useState<number>(0);
  const [boletosGerados, setBoletosGerados] = useState<any[]>([]);
  const [existingCarne, setExistingCarne] = useState<{
    hasCarnet: boolean;
    url: string | null;
    fileName: string | null;
    totalBoletos: number | null;
  } | null>(null);
  const [regenerateBoletos, setRegenerateBoletos] = useState<number | null>(null);

  // Estado para Storage Status - Consciência de Storage
  const [storageStatus, setStorageStatus] = useState<{
    totalBoletos: number;
    boletosInStorage: number;
    missingBoletos: string[];
    hasCarnet: boolean;
    carnetUrl: string | null;
    needsSync: boolean;
    needsCorrection: boolean;
  } | null>(null);
  const [checkingStorage, setCheckingStorage] = useState(false);

  // Estado para carnê status automático
  const [carneStatus, setCarneStatus] = useState<{
    exists: boolean;
    url: string | null;
    fileName: string | null;
    isLoading: boolean;
  }>({
    exists: false,
    url: null,
    fileName: null,
    isLoading: true,
  });

  const propostaId = params?.id;
  
  // 🚨 DEBUG CRÍTICO - ROTEAMENTO
  console.log('🔍 [FORMALIZACAO DEBUG] Route parsing', {
    params,
    propostaId,
    window_location: window.location.href,
    window_pathname: window.location.pathname
  });

  // Função para verificar automaticamente status do carnê
  const checkCarneStatus = async () => {
    if (!propostaId) return;

    setCarneStatus((prev) => ({ ...prev, isLoading: true }));

    try {
      const response = (await apiRequest(`/api/propostas/${propostaId}/carne-status`)) as {
        carneExists: boolean;
        url?: string;
        fileName?: string;
        createdAt?: string;
        size?: number;
        error?: string;
      };

      setCarneStatus({
        exists: response.carneExists || false,
        url: response.url || null,
        fileName: response.fileName || null,
        isLoading: false,
      });

      // Se carnê existe, atualizar outros estados relacionados
      if (response.carneExists && response.url) {
        setCarneUrl(response.url);
        setExistingCarne({
          hasCarnet: true,
          url: response.url,
          fileName: response.fileName || null,
          totalBoletos: collectionsData?.length || 0,
        });
      }
    } catch (error) {
      console.error('Erro ao verificar status do carnê:', error);
      setCarneStatus({
        exists: false,
        url: null,
        fileName: null,
        isLoading: false,
      });
    }
  };

  const {
    data: proposta,
    isLoading,
    refetch,
  } = useQuery<Proposta>({
    queryKey: queryKeys.proposta.formalizacao(propostaId || ''),
    queryFn: async (): Promise<Proposta> => {
      const response = (await apiRequest(`/api/propostas/${propostaId}/formalizacao`)) as Proposta;
      return response;
    },
    enabled: !!propostaId,
    staleTime: 1 * 60 * 1000, // Cache por 1 minuto
    refetchOnWindowFocus: false, // Não refetch quando janela ganha foco
  });

  // Função para verificar status do Storage
  const checkStorageStatus = async () => {
    if (!propostaId) return;

    setCheckingStorage(true);
    try {
      const response = (await apiRequest(`/api/propostas/${propostaId}/storage-status`)) as any;

      // Mapear resposta da API para o formato esperado
      const totalBoletos = response.totalParcelas || 0;
      const boletosInStorage = response.fileCount || 0;
      const hasCarnet = response.carneExists || false;
      const carnetUrl = response.carneUrl || null;

      // Determinar estados baseados no syncStatus
      const needsSync = response.syncStatus === 'nenhum';
      const needsCorrection = response.syncStatus === 'incompleto';

      // Calcular boletos faltantes
      const missingBoletos: string[] = [];
      if (response.boletosNoStorage && totalBoletos > 0) {
        for (let i = 1; i <= totalBoletos; i++) {
          const boletoId = `boleto-${i}`;
          if (!response.boletosNoStorage.includes(boletoId)) {
            missingBoletos.push(boletoId);
          }
        }
      }

      setStorageStatus({
        totalBoletos,
        boletosInStorage,
        missingBoletos,
        hasCarnet,
        carnetUrl,
        needsSync,
        needsCorrection,
      });

      // Se carnê existe, atualizar estado
      if (hasCarnet && carnetUrl) {
        setExistingCarne({
          hasCarnet: true,
          url: carnetUrl,
          fileName: response.carneFileName || null,
          totalBoletos: totalBoletos,
        });
        setCarneUrl(carnetUrl);
        setCarneTotalBoletos(totalBoletos);
      }

      return response;
    } catch (error) {
      console.error('[STORAGE STATUS] Erro ao verificar status:', error);
      return null;
    } finally {
      setCheckingStorage(false);
    }
  };

  // Query para buscar boletos gerados - OTIMIZADA (após proposta carregar)
  const { data: collectionsData } = useQuery<any[]>({
    queryKey: queryKeys.inter.collections(propostaId || ''),
    queryFn: async (): Promise<any[]> => {
      if (!propostaId) return [];
      console.log(`[INTER QUERY] Buscando boletos para proposta: ${propostaId}`);
      const response = (await apiRequest(`/api/inter/collections/${propostaId}`)) as any[];
      console.log(
        `[INTER QUERY] Boletos encontrados: ${Array.isArray(response) ? response.length : 0}`
      );
      return Array.isArray(response) ? response : [];
    },
    enabled:
      !!propostaId &&
      !!proposta &&
      (proposta?.status === 'ASSINATURA_CONCLUIDA' || proposta?.interBoletoGerado),
    staleTime: 2 * 60 * 1000, // Cache por 2 minutos para evitar chamadas excessivas
    refetchOnWindowFocus: false, // Não refetch quando janela ganha foco
    retry: 1, // Reduzir tentativas de retry
  });

  // Verificar status do storage quando boletos mudam
  useEffect(() => {
    if (propostaId && collectionsData && collectionsData.length > 0) {
      checkStorageStatus();
    }
  }, [propostaId, collectionsData, checkStorageStatus]);

  // Auto-verificar status do carnê quando proposta carrega
  useEffect(() => {
    if (proposta && propostaId && collectionsData && collectionsData.length > 0) {
      checkCarneStatus();
    }
  }, [proposta, propostaId, collectionsData, checkCarneStatus]);

  const form = useForm<UpdateFormalizacaoForm>({
    resolver: zodResolver(updateFormalizacaoSchema),
    defaultValues: {
      status: proposta?.status as
        | 'aprovado'
        | 'documentos_enviados'
        | 'CCB_GERADA'
        | 'AGUARDANDO_ASSINATURA'
        | 'ASSINATURA_PENDENTE'
        | 'ASSINATURA_CONCLUIDA'
        | 'BOLETOS_EMITIDOS'
        | 'PAGAMENTO_PENDENTE'
        | 'PAGAMENTO_PARCIAL'
        | 'PAGAMENTO_CONFIRMADO'
        | undefined,
      documentosAdicionais: proposta?.documentosAdicionais || [],
      contratoGerado: proposta?.contratoGerado || false,
      contratoAssinado: proposta?.contratoAssinado || false,
      observacoesFormalização: proposta?.observacoesFormalização || '',
    },
  });

  // Ensure form resets when proposta loads asynchronously to guarantee preselection
  useEffect(() => {
    if (proposta) {
      form.reset({
        status: proposta.status as
          | 'aprovado'
          | 'documentos_enviados'
          | 'CCB_GERADA'
          | 'AGUARDANDO_ASSINATURA'
          | 'ASSINATURA_PENDENTE'
          | 'ASSINATURA_CONCLUIDA'
          | 'BOLETOS_EMITIDOS'
          | 'PAGAMENTO_PENDENTE'
          | 'PAGAMENTO_PARCIAL'
          | 'PAGAMENTO_CONFIRMADO'
          | undefined,
        documentosAdicionais: proposta.documentosAdicionais || [],
        contratoGerado: proposta.contratoGerado || false,
        contratoAssinado: proposta.contratoAssinado || false,
        observacoesFormalização: proposta.observacoesFormalização || '',
      });
    }
  }, [proposta, form]);

  const updateFormalizacao = useMutation({
    mutationFn: async (data: UpdateFormalizacaoForm) => {
      const response = await apiRequest(`/api/propostas/${propostaId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: 'Sucesso',
        description: 'Formalização atualizada com sucesso',
      });
      if (propostaId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.proposta.all(propostaId),
        });
      }
      // Also invalidate the formalization list
      queryClient.invalidateQueries({
        queryKey: queryKeys.propostas.formalizacao(),
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar formalização',
        variant: 'destructive',
      });
    },
  });

  // 🎯 PAM V1.0: Nova mutation para orquestração manual de boletos
  const marcarComoConcluida = useMutation({
    mutationFn: async () => {
      console.log('🎯 [MUTATION] Starting marcarComoConcluida for proposta:', propostaId);
      
      // Valida estado atual antes de enviar
      const currentProposta = queryClient.getQueryData(['/api/propostas', propostaId]);
      if (!currentProposta) {
        throw new Error('Proposta não encontrada no cache local');
      }
      
      const response = await robustApiClient.request(
        `/api/propostas/${propostaId}/marcar-concluida`,
        { 
          method: 'PUT',
          body: JSON.stringify({
            // Envia estado atual para validação no backend
            currentStatus: (currentProposta as any)?.status,
            timestamp: new Date().toISOString()
          })
        }
      );
      
      const result = await response.json();
      console.log('✅ [MUTATION] marcarComoConcluida response:', result);
      return result;
    },
    
    onMutate: async () => {
      if (!propostaId) {
        throw new Error('ID da proposta não encontrado');
      }
      
      // Cancela queries em andamento para evitar race conditions
      await queryClient.cancelQueries({ queryKey: queryKeys.proposta.all(propostaId) });
      
      // Snapshot do estado anterior para rollback
      const previousProposta = queryClient.getQueryData(['/api/propostas', propostaId]);
      
      // Optimistic update
      queryClient.setQueryData(['/api/propostas', propostaId], (old: any) => ({
        ...old,
        status: 'CONCLUIDA',
        _optimistic: true
      }));
      
      return { previousProposta };
    },
    
    onError: (error, variables, context) => {
      console.error('❌ [MUTATION] marcarComoConcluida failed:', error);
      
      // Rollback em caso de erro
      if (context?.previousProposta && propostaId) {
        queryClient.setQueryData(['/api/propostas', propostaId], context.previousProposta);
      }
      
      // Notifica usuário com detalhes do erro
      toast({
        title: 'Erro ao marcar como concluída',
        description: `${error.message}. Por favor, recarregue a página e tente novamente.`,
        variant: 'destructive',
      });
    },
    
    onSuccess: (data) => {
      console.log('🎉 [MUTATION] marcarComoConcluida succeeded');
      
      // Invalida TODAS as queries relacionadas
      if (propostaId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.proposta.all(propostaId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.inter.collections(propostaId) });
        queryClient.refetchQueries({ queryKey: queryKeys.proposta.all(propostaId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.propostas.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.propostas.formalizacao() });
      
      toast({
        title: 'Sucesso',
        description: 'Proposta marcada como concluída! Processo de geração de boletos iniciado.',
      });
    },
    
    onSettled: () => {
      // Sempre refetch após mutation (sucesso ou erro)
      if (propostaId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.proposta.all(propostaId) });
      }
    }
  });

  // 🎯 PAM V1.0: Mutação robusta para ClickSign conforme DeepThink
  const enviarClickSignMutation = useMutation({
    mutationFn: async () => {
      console.log('📝 [MUTATION] Sending to ClickSign...');
      
      // Verifica pré-condições
      if (proposta?.status !== 'CCB_GERADA' && proposta?.status !== 'AGUARDANDO_ASSINATURA') {
        throw new Error('Proposta precisa estar com CCB gerada antes do envio');
      }
      
      const response = await robustApiClient.request(
        `/api/propostas/${propostaId}/clicksign/enviar`,
        {
          method: 'POST',
          body: JSON.stringify({
            forceStatusUpdate: true, // Flag para forçar atualização de status
            targetStatus: 'AGUARDANDO_ASSINATURA'
          })
        }
      );
      
      return response.json();
    },
    
    onSuccess: (data) => {
      console.log('✅ [MUTATION] ClickSign sent successfully:', data);
      
      // Atualiza cache local imediatamente
      queryClient.setQueryData(['/api/propostas', propostaId], (old: any) => ({
        ...old,
        status: 'AGUARDANDO_ASSINATURA',
        clicksignDocumentId: data.documentId
      }));
      
      // Atualiza dados ClickSign locais
      setClickSignData(data);
      
      // Invalida e refetch
      if (propostaId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.proposta.all(propostaId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.clicksign.status(propostaId) });
      }
      
      toast({
        title: 'Sucesso',
        description: 'Documento enviado para assinatura!',
      });
    },
    
    onError: (error) => {
      console.error('❌ [MUTATION] ClickSign failed:', error);
      toast({
        title: 'Erro',
        description: `Erro ao enviar para ClickSign: ${error.message}`,
        variant: 'destructive',
      });
    }
  });

  const formatCurrency = (value: string | number) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(numValue);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  // Função para gerar CCB
  const generateCCB = async (propostaId: string) => {
    try {
      toast({
        title: 'Gerando CCB',
        description: 'Aguarde, gerando CCB com todos os dados da proposta...',
      });

      const response = (await apiRequest(`/api/propostas/${propostaId}/gerar-ccb`, {
        method: 'POST',
      })) as { success?: boolean; message?: string };

      if (response.success) {
        toast({
          title: 'Sucesso',
          description: response.message || 'CCB gerada com sucesso',
        });
        // Recarregar dados para atualizar status ccbGerado
        refetch();
      }
    } catch (error) {
      console.error('Erro ao gerar CCB:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao gerar CCB. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  // Função para visualizar CCB
  const viewCCB = async (propostaId: string) => {
    try {
      // ✅ CORREÇÃO: Usar endpoint de formalização padrão
      const response = (await apiRequest(`/api/formalizacao/${propostaId}/ccb`)) as {
        status?: string;
        publicUrl?: string;
      };
      if (!response.publicUrl) {
        toast({
          title: 'CCB não disponível',
          description: 'A CCB ainda não foi gerada para esta proposta',
          variant: 'destructive',
        });
        return;
      }
      if (response.publicUrl) {
        // Abrir em nova aba
        window.open(response.publicUrl, '_blank');
      }
    } catch (error) {
      console.error('Erro ao visualizar CCB:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao visualizar CCB. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  // ✅ FUNÇÃO REMOVIDA: sendToClickSign duplicada - usar apenas enviarClickSignMutation

  // Função para consultar status ClickSign
  const checkClickSignStatus = async (propostaId: string): Promise<ClickSignData | null> => {
    try {
      console.log('🔍 [CLICKSIGN] Consultando status para proposta:', propostaId);
      const response = (await apiRequest(`/api/clicksign/status/${propostaId}`)) as ClickSignData;
      console.log('📡 [CLICKSIGN] Status retornado:', response);
      setClickSignData(response);
      return response;
    } catch (error) {
      console.error('❌ [CLICKSIGN] Erro ao consultar status:', error);
      return null;
    }
  };

  // Carregar status ClickSign na inicialização - OTIMIZADA (após proposta carregar)
  const { data: initialClickSignData } = useQuery({
    queryKey: queryKeys.clicksign.status(propostaId || ''),
    queryFn: () => checkClickSignStatus(propostaId!),
    enabled:
      !!propostaId &&
      !!proposta &&
      (proposta?.status === 'CCB_GERADA' || proposta?.status === 'AGUARDANDO_ASSINATURA'),
    staleTime: 2 * 60 * 1000, // Cache por 2 minutos
    refetchOnWindowFocus: false, // Não refetch quando janela ganha foco
    retry: 1, // Reduzir tentativas
  });

  // Atualizar clickSignData quando initialClickSignData mudar
  React.useEffect(() => {
    if (initialClickSignData?.signUrl) {
      setClickSignData(initialClickSignData as ClickSignData);
    } else if (!clickSignData?.signUrl) {
      // 🛡️ PROTEÇÃO: Só reseta se não tem link local
      setClickSignData(null);
    }
  }, [initialClickSignData, clickSignData?.signUrl]);

  // 🔄 REALTIME: Escutar mudanças na tabela propostas
  useEffect(() => {
    if (!propostaId) return;

    console.log('🔄 [REALTIME] Configurando escuta para proposta:', propostaId);

    const supabase = getSupabase();
    const channel = supabase
      .channel(`propostas-changes-${propostaId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Escutar todos os eventos (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'propostas',
          filter: `id=eq.${propostaId}`, // Filtrar apenas esta proposta
        },
        (payload: any) => {
          console.log('📡 [REALTIME] Evento recebido:', payload);

          if (payload.eventType === 'UPDATE') {
            console.log('✅ [REALTIME] Proposta atualizada, analisando mudanças...');

            // Atualizar dados da proposta (sempre necessário)
            queryClient.invalidateQueries({
              queryKey: queryKeys.proposta.formalizacao(propostaId),
            });

            // 🎯 CORREÇÃO: Só invalidar ClickSign se status realmente mudou
            const oldData = payload.old;
            const newData = payload.new;

            if (oldData?.status !== newData?.status && newData?.status === 'ASSINATURA_CONCLUIDA') {
              console.log('🔄 [REALTIME] Contrato foi assinado, atualizando timeline');
              queryClient.invalidateQueries({
                queryKey: queryKeys.clicksign.status(propostaId),
              });
            }

            // Atualizar boletos APENAS se status mudou para ASSINATURA_CONCLUIDA ou Inter foi ativado
            if (
              newData?.status === 'ASSINATURA_CONCLUIDA' ||
              newData?.interBoletoGerado !== oldData?.interBoletoGerado
            ) {
              console.log('🔄 [REALTIME] Atualizando boletos Inter devido a mudança relevante');
              queryClient.invalidateQueries({
                queryKey: queryKeys.inter.collections(propostaId),
              });
            }

            console.log('🔄 [REALTIME] Proposta atualizada silenciosamente');
          }
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [REALTIME] Conectado ao canal de atualizações');
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
      console.log('🧹 [REALTIME] Removendo canal de escuta');
      supabase.removeChannel(channel);
    };
  }, [propostaId, queryClient, toast]);

  const getStatusProgress = (status: string) => {
    const statusMap = {
      aprovado: 20,
      documentos_enviados: 40,
      CCB_GERADA: 60,
      ASSINATURA_CONCLUIDA: 80,
      BOLETOS_EMITIDOS: 90,
      pago: 100,
    };
    return statusMap[status as keyof typeof statusMap] || 0;
  };

  const getStatusColor = (status: string) => {
    const statusColors = {
      aprovado: 'bg-green-500',
      documentos_enviados: 'bg-blue-500',
      CCB_GERADA: 'bg-purple-500',
      AGUARDANDO_ASSINATURA: 'bg-yellow-500',
      ASSINATURA_PENDENTE: 'bg-amber-500',
      ASSINATURA_CONCLUIDA: 'bg-indigo-500',
      BOLETOS_EMITIDOS: 'bg-orange-500',
      PAGAMENTO_PENDENTE: 'bg-blue-600',
      PAGAMENTO_PARCIAL: 'bg-yellow-600',
      PAGAMENTO_CONFIRMADO: 'bg-green-600',
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-500';
  };

  const getStatusText = (status: string) => {
    const statusTexts = {
      aprovado: 'Aprovado',
      documentos_enviados: 'Documentos Enviados',
      CCB_GERADA: 'CCB Gerada',
      AGUARDANDO_ASSINATURA: 'Aguardando Assinatura',
      ASSINATURA_PENDENTE: 'Assinatura Pendente',
      ASSINATURA_CONCLUIDA: 'Assinatura Concluída',
      BOLETOS_EMITIDOS: 'Boletos Emitidos',
      PAGAMENTO_PENDENTE: 'Pagamento Pendente',
      PAGAMENTO_PARCIAL: 'Pagamento Parcial',
      PAGAMENTO_CONFIRMADO: 'Pagamento Confirmado',
    };
    return statusTexts[status as keyof typeof statusTexts] || status;
  };

  // ✅ PAM V1.0: ENHANCED CCB DETECTION LOGIC - TODOS OS HOOKS ANTES DE QUALQUER RETURN
  const hasCCB = useMemo(() => {
    if (!proposta) return false;
    
    // ✅ CRITICAL FIX: Comprehensive CCB detection using all mapped fields
    const result = Boolean(
      // Primary CCB flags
      (proposta as any).ccbGerado || 
      (proposta as any).ccb_gerado ||
      
      // CCB file paths (most reliable indicator)
      (proposta as any).caminho_ccb ||
      (proposta as any).caminhoCcb ||
      proposta.caminhoCcbAssinado ||
      (proposta as any).caminho_ccb_assinado ||
      
      // Status-based detection
      proposta.status === 'CCB_GERADA' ||
      proposta.status === 'AGUARDANDO_ASSINATURA' ||
      proposta.status === 'ASSINATURA_CONCLUIDA' ||
      proposta.status === 'BOLETOS_EMITIDOS' ||
      
      // ClickSign integration (indicates CCB was sent)
      proposta.clicksignSignUrl ||
      (proposta as any).clicksign_sign_url ||
      (proposta as any).clicksignDocumentKey ||
      
      // Contract generation flags
      proposta.contratoGerado ||
      (proposta as any).contrato_gerado ||
      
      // Timestamp indicators
      (proposta as any).ccb_gerado_em ||
      (proposta as any).ccbGeradoEm
    );
    
    console.log('🔍 [hasCCB] Enhanced CCB Detection Results:', {
      propostaId: proposta?.id,
      status: proposta?.status,
      ccbGerado: (proposta as any)?.ccbGerado,
      ccb_gerado: (proposta as any)?.ccb_gerado,
      caminho_ccb: (proposta as any)?.caminho_ccb,
      caminhoCcb: (proposta as any)?.caminhoCcb,
      caminhoCcbAssinado: proposta?.caminhoCcbAssinado,
      clicksignSignUrl: proposta?.clicksignSignUrl,
      contratoGerado: proposta?.contratoGerado,
      result: result
    });
    
    return result;
  }, [
    proposta?.id, 
    proposta?.status, 
    (proposta as any)?.ccbGerado, 
    (proposta as any)?.ccb_gerado,
    (proposta as any)?.caminho_ccb,
    (proposta as any)?.caminhoCcb,
    proposta?.caminhoCcbAssinado,
    proposta?.clicksignSignUrl,
    proposta?.contratoGerado
  ]);

  // 🔍 LOGS DE DEBUG CONECTADOS AO LIFECYCLE
  useEffect(() => {
    console.log('🔍 [FORMALIZACAO] Mount/Update Detection', {
      propostaId: proposta?.id,
      status: proposta?.status,
      ccbGerado: (proposta as any)?.ccbGerado,
      ccb_gerado: (proposta as any)?.ccb_gerado,
      hasCCB_computed: hasCCB,
      proposta_completa: proposta
    });
  }, [hasCCB, proposta?.id]);

  // ✅ AGORA toda a lógica condicional pode vir aqui, APÓS todos os hooks
  // 🔧 CORREÇÃO CRÍTICA: Lógica condicional APÓS todos os hooks
  // Se não tem ID, mostrar lista de propostas
  if (!propostaId) {
    return <FormalizacaoList />;
  }

  const getFormalizationSteps = (proposta: Proposta) => [
    {
      id: 1,
      title: 'Proposta Aprovada',
      description: 'Proposta foi aprovada pela equipe de crédito',
      icon: CheckCircle,
      status: 'completed',
      date: formatDate(proposta.dataAprovacao || proposta.createdAt),
      completed: true,
    },
    {
      id: 2,
      title: 'CCB Gerada',
      description: 'Cédula de Crédito Bancário gerada automaticamente',
      icon: FileText,
      status: hasCCB ? 'completed' : 'current',
      date: hasCCB ? formatDate(proposta.createdAt) : 'Pendente',
      completed: hasCCB,
      interactive: true,
      etapa: 'ccb_gerado' as const,
    },
    {
      id: 3,
      title: 'Assinatura Eletrônica',
      description: 'Documento enviado para ClickSign para assinatura',
      icon: Signature,
      status:
        proposta.status === 'ASSINATURA_CONCLUIDA' ||
        proposta.status === 'BOLETOS_EMITIDOS' ||
        proposta.status === 'ASSINATURA_CONCLUIDA'
          ? 'completed'
          : proposta.status === 'CCB_GERADA' ||
              proposta.status === 'AGUARDANDO_ASSINATURA' ||
              proposta.status === 'ASSINATURA_CONCLUIDA' ||
              proposta.status === 'BOLETOS_EMITIDOS'
            ? 'current'
            : 'pending',
      date:
        proposta.status === 'ASSINATURA_CONCLUIDA' ||
        proposta.status === 'BOLETOS_EMITIDOS' ||
        proposta.status === 'ASSINATURA_CONCLUIDA'
          ? formatDate(proposta.dataAssinatura || proposta.createdAt)
          : 'Pendente',
      completed:
        proposta.status === 'ASSINATURA_CONCLUIDA' ||
        proposta.status === 'BOLETOS_EMITIDOS' ||
        proposta.status === 'ASSINATURA_CONCLUIDA',
      interactive:
        proposta.status === 'CCB_GERADA' ||
        proposta.status === 'AGUARDANDO_ASSINATURA' ||
        proposta.status === 'ASSINATURA_CONCLUIDA' ||
        proposta.status === 'BOLETOS_EMITIDOS',
      etapa: 'assinatura_eletronica' as const,
    },
    {
      id: 4,
      title: 'Biometria Validada',
      description: 'Validação biométrica concluída',
      icon: Shield,
      status:
        proposta.biometriaConcluida || proposta.status === 'ASSINATURA_CONCLUIDA'
          ? 'completed'
          : proposta.status === 'ASSINATURA_CONCLUIDA' || proposta.status === 'BOLETOS_EMITIDOS'
            ? 'current'
            : 'pending',
      date:
        proposta.biometriaConcluida || proposta.status === 'ASSINATURA_CONCLUIDA'
          ? formatDate(proposta.dataAssinatura || proposta.createdAt)
          : 'Pendente',
      completed: proposta.biometriaConcluida || proposta.status === 'ASSINATURA_CONCLUIDA',
      interactive:
        proposta.status === 'ASSINATURA_CONCLUIDA' || proposta.status === 'BOLETOS_EMITIDOS',
      etapa: 'biometria' as const,
    },
    {
      id: 5,
      title: 'Banco Inter - Boletos',
      description: 'Boletos gerados automaticamente pelo Banco Inter para pagamento',
      icon: Building2,
      status: proposta.interBoletoGerado
        ? 'completed'
        : proposta.status === 'ASSINATURA_CONCLUIDA' ||
            proposta.status === 'BOLETOS_EMITIDOS' ||
            proposta.status === 'ASSINATURA_CONCLUIDA'
          ? 'current'
          : 'pending',
      date: proposta.interBoletoGerado ? formatDate(proposta.createdAt) : 'Pendente',
      completed: proposta.interBoletoGerado || false,
      interactive:
        proposta.status === 'ASSINATURA_CONCLUIDA' ||
        proposta.status === 'BOLETOS_EMITIDOS' ||
        proposta.status === 'ASSINATURA_CONCLUIDA',
      etapa: 'banco_inter' as const,
    },
    {
      id: 6,
      title: 'Liberação do Pagamento',
      description: 'Valor liberado e disponível para transferência',
      icon: CreditCard,
      status:
        proposta.status === 'BOLETOS_EMITIDOS'
          ? 'current'
          : proposta.status === 'PAGAMENTO_CONFIRMADO'
            ? 'completed'
            : 'pending',
      date: proposta.dataPagamento ? formatDate(proposta.dataPagamento) : 'Pendente',
      completed: proposta.status === 'PAGAMENTO_CONFIRMADO',
    },
  ];

  const onSubmit = (data: UpdateFormalizacaoForm) => {
    updateFormalizacao.mutate(data);
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Acompanhamento da Formalização">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {[...Array(6)].map((_, index) => (
            <Card key={index} className="animate-pulse border-gray-700 bg-gray-800">
              <CardContent className="p-6">
                <div className="mb-4 h-32 rounded bg-gray-700"></div>
                <div className="mb-2 h-4 rounded bg-gray-700"></div>
                <div className="h-4 w-3/4 rounded bg-gray-700"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DashboardLayout>
    );
  }

  if (!proposta) {
    return (
      <DashboardLayout title="Acompanhamento da Formalização">
        <div className="py-12 text-center">
          <FileText className="mx-auto mb-4 h-16 w-16 text-gray-400" />
          <p className="text-lg text-gray-500">Proposta não encontrada</p>
          <Button onClick={() => setLocation('/credito/fila')} className="mt-4">
            Voltar para Fila de Análise
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const formalizationSteps = getFormalizationSteps(proposta);

  // Título unificado para todos os roles
  const getTitle = () => {
    return `Formalização - Proposta #${proposta.id}`;
  };

  // Destino unificado do botão voltar
  const getBackLocation = () => {
    return '/formalizacao';
  };

  // 🔧 SEGURANÇA: Verificação de permissão agora é feita no BACKEND via RLS
  // Se chegou até aqui, o usuário tem permissão para ver a proposta

  return (
    <DashboardLayout title={getTitle()}>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => setLocation(getBackLocation())}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para Formalização
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`${getStatusColor(proposta.status)} text-white`}>
              {getStatusText(proposta.status)}
            </Badge>
            <span className="text-sm text-gray-600">
              {getStatusProgress(proposta.status)}% concluído
            </span>
          </div>
        </div>

        {/* Progress Overview */}
        <Card className="border-gray-700 bg-gray-800">
          <CardContent className="p-6">
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                  <TrendingUp className="h-5 w-5 text-blue-400" />
                  Progresso da Formalização
                </h3>
                <span className="text-sm font-medium text-gray-400">
                  {getStatusProgress(proposta.status)}% concluído
                </span>
              </div>
              <Progress value={getStatusProgress(proposta.status)} className="h-3" />
            </div>
          </CardContent>
        </Card>

        {/* Tabs Navigation */}
        <Card className="border-gray-700 bg-gray-800">
          <CardContent className="p-0">
            <div className="border-b border-gray-600">
              <div className="flex space-x-8 px-6 py-4">
                <button
                  onClick={() => setActiveTab('timeline')}
                  className={`flex items-center gap-2 border-b-2 pb-2 text-sm font-medium ${
                    activeTab === 'timeline'
                      ? 'border-blue-400 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Activity className="h-4 w-4" />
                  {user?.role === 'ATENDENTE' ? 'Progresso' : 'Timeline'}
                </button>
                <button
                  onClick={() => setActiveTab('documents')}
                  className={`flex items-center gap-2 border-b-2 pb-2 text-sm font-medium ${
                    activeTab === 'documents'
                      ? 'border-blue-400 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  Documentos
                </button>
                {/* ANALISTA vê todas as tabs, ATENDENTE pode ter acesso limitado */}
                {user?.role !== 'ATENDENTE' && (
                  <button
                    onClick={() => setActiveTab('contracts')}
                    className={`flex items-center gap-2 border-b-2 pb-2 text-sm font-medium ${
                      activeTab === 'contracts'
                        ? 'border-blue-400 text-blue-400'
                        : 'border-transparent text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <FileCheck className="h-4 w-4" />
                    Contratos
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Timeline Tab */}
            {activeTab === 'timeline' && (
              <Card className="border-gray-700 bg-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Activity className="h-5 w-5 text-blue-400" />
                    Timeline de Formalização
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {formalizationSteps.map((step, index) => {
                      const Icon = step.icon;
                      const isCompleted = step.completed;
                      const isCurrent = step.status === 'current';

                      // Se é uma etapa interativa, mostra o controle (independente do role)
                      if (step.interactive && step.etapa) {
                        // Para a etapa de CCB, mostrar o CCBViewer
                        if (step.etapa === 'ccb_gerado') {
                          return (
                            <div key={step.id} className="mb-4">
                              <CCBViewer
                                proposalId={proposta.id}
                                onCCBGenerated={() => refetch()}
                              />
                            </div>
                          );
                        }

                        // Para a etapa de assinatura eletrônica, mostrar interface customizada
                        if (
                          step.etapa === 'assinatura_eletronica' &&
                          (proposta.status === 'CCB_GERADA' ||
                            proposta.status === 'AGUARDANDO_ASSINATURA' ||
                            proposta.status === 'ASSINATURA_CONCLUIDA' ||
                            proposta.status === 'BOLETOS_EMITIDOS')
                        ) {
                          return (
                            <div key={step.id} className="mb-4">
                              <div className="space-y-4">
                                {/* Controle padrão da etapa */}
                                <EtapaFormalizacaoControl
                                  propostaId={proposta.id}
                                  etapa={
                                    step.etapa as
                                      | 'ccb_gerado'
                                      | 'assinatura_eletronica'
                                      | 'biometria'
                                  }
                                  titulo={step.title}
                                  descricao={step.description}
                                  concluida={isCompleted}
                                  habilitada={step.interactive}
                                  onUpdate={() => refetch()}
                                />

                                {/* 🎯 ESTADO INICIAL: Botão azul quando CCB gerada mas sem assinatura */}
                                {(proposta.status === 'CCB_GERADA' ||
                                  proposta.status === 'AGUARDANDO_ASSINATURA') &&
                                  !clickSignData?.signUrl &&
                                  !initialClickSignData?.signUrl && (
                                    <div className="mt-3 rounded-lg border border-blue-700 bg-blue-900/20 p-4">
                                      <div className="mb-3 flex items-center justify-between">
                                        <h5 className="font-medium text-blue-300">
                                          Enviar para Assinatura Eletrônica
                                        </h5>
                                        <Signature className="h-5 w-5 text-blue-400" />
                                      </div>
                                      <p className="mb-4 text-sm text-blue-200">
                                        CCB foi gerada com sucesso! Clique no botão para enviar ao
                                        ClickSign e gerar o link de assinatura para o cliente.
                                      </p>
                                      <Button
                                        onClick={() => enviarClickSignMutation.mutate()}
                                        disabled={enviarClickSignMutation.isPending}
                                        className="w-full bg-blue-600 hover:bg-blue-700"
                                        data-testid="button-clicksign-enviar"
                                      >
                                        {enviarClickSignMutation.isPending ? (
                                          <div className="flex items-center">
                                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                                            Enviando para ClickSign...
                                          </div>
                                        ) : (
                                          <div className="flex items-center">
                                            <Signature className="mr-2 h-4 w-4" />
                                            Enviar Contrato para Assinatura (ClickSign)
                                          </div>
                                        )}
                                      </Button>
                                    </div>
                                  )}

                                {/* ✅ CONTRATO ASSINADO: Mostrar confirmação */}
                                {(proposta.status === 'ASSINATURA_CONCLUIDA' ||
                                  proposta.status === 'BOLETOS_EMITIDOS') && (
                                  <div className="mt-3 rounded-lg border border-green-700 bg-green-900/20 p-4">
                                    <div className="mb-3 flex items-center">
                                      <CheckCircle className="mr-2 h-5 w-5 text-green-400" />
                                      <h5 className="font-medium text-green-300">
                                        Contrato Assinado + Biometria Validada
                                      </h5>
                                    </div>
                                    <p className="text-sm text-green-200">
                                      O cliente assinou digitalmente o contrato via ClickSign com
                                      validação biométrica. Próximo passo: geração automática dos
                                      boletos de pagamento pelo Banco Inter.
                                    </p>
                                  </div>
                                )}

                                {/* 🎯 ESTADO POSTERIOR: Link existe (novo ou antigo) - manter fixo até assinatura */}
                                {(clickSignData?.signUrl ||
                                  initialClickSignData?.signUrl ||
                                  proposta.clicksignSignUrl) &&
                                  (proposta.status === 'CCB_GERADA' ||
                                    proposta.status === 'AGUARDANDO_ASSINATURA') && (
                                    <div className="mt-3 rounded-lg border border-green-700 bg-green-900/20 p-4">
                                      <div className="mb-3 flex items-center">
                                        <CheckCircle className="mr-2 h-5 w-5 text-green-400" />
                                        <h5 className="font-medium text-green-300">
                                          Link de Assinatura Disponível
                                        </h5>
                                      </div>
                                      <p className="mb-3 text-sm text-green-200">
                                        Compartilhe o link abaixo com o cliente para assinatura
                                        digital:
                                      </p>
                                      <div className="flex items-center gap-2 rounded border bg-gray-800 p-3">
                                        <input
                                          type="text"
                                          value={
                                            clickSignData?.signUrl ||
                                            initialClickSignData?.signUrl ||
                                            proposta.clicksignSignUrl ||
                                            ''
                                          }
                                          readOnly
                                          className="flex-1 bg-transparent text-sm text-white"
                                        />
                                        <Button
                                          size="sm"
                                          onClick={() => {
                                            const linkUrl =
                                              clickSignData?.signUrl ||
                                              initialClickSignData?.signUrl ||
                                              proposta.clicksignSignUrl ||
                                              '';
                                            navigator.clipboard.writeText(linkUrl);
                                            toast({
                                              title: 'Copiado!',
                                              description:
                                                'Link de assinatura copiado para a área de transferência',
                                            });
                                          }}
                                        >
                                          Copiar
                                        </Button>
                                      </div>
                                      {clickSignData?.envelopeId && (
                                        <p className="mt-2 text-xs text-gray-400">
                                          Envelope ID: {clickSignData.envelopeId}
                                        </p>
                                      )}

                                      {/* Botão para regenerar link */}
                                      <div className="mt-3 border-t border-gray-700 pt-3">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={async () => {
                                            // ✅ REMOVIDO: setLoadingClickSign - usar enviarClickSignMutation
                                            try {
                                              console.log(
                                                '🔄 [CLICKSIGN] Regenerando link para proposta:',
                                                proposta.id
                                              );
                                              console.log(
                                                '📊 [CLICKSIGN] Estado atual:',
                                                clickSignData
                                              );

                                              const response = (await apiRequest(
                                                `/api/propostas/${proposta.id}/clicksign/regenerar`,
                                                {
                                                  method: 'POST',
                                                }
                                              )) as ClickSignData;

                                              console.log(
                                                '✅ [CLICKSIGN] Novo link gerado:',
                                                response
                                              );

                                              // 🎯 CORREÇÃO CRÍTICA: Preservar o link na tela
                                              setClickSignData(response);

                                              toast({
                                                title: '✅ Link Regenerado',
                                                description:
                                                  'Novo link de assinatura disponível para o cliente!',
                                                duration: 4000,
                                              });

                                              // 🔄 Atualizar cache sem refetch para evitar flickering
                                              queryClient.setQueryData(
                                                ['/api/clicksign/status', propostaId],
                                                response
                                              );
                                            } catch (error: any) {
                                              console.error(
                                                '❌ [CLICKSIGN] Erro ao regenerar:',
                                                error
                                              );
                                              toast({
                                                title: 'Erro',
                                                description:
                                                  error.response?.data?.error ||
                                                  'Erro ao regenerar link',
                                                variant: 'destructive',
                                              });
                                            } finally {
                                              // ✅ REMOVIDO: setLoadingClickSign - usar enviarClickSignMutation
                                            }
                                          }}
                                          disabled={enviarClickSignMutation.isPending}
                                          className="border-yellow-600 text-yellow-400 hover:bg-yellow-600/10"
                                        >
                                          {enviarClickSignMutation.isPending ? (
                                            <div className="flex items-center">
                                              <div className="mr-2 h-3 w-3 animate-spin rounded-full border-b-2 border-yellow-400"></div>
                                              Regenerando...
                                            </div>
                                          ) : (
                                            <div className="flex items-center">
                                              <Signature className="mr-2 h-3 w-3" />
                                              Gerar Novo Link
                                            </div>
                                          )}
                                        </Button>
                                        <p className="mt-1 text-xs text-gray-500">
                                          Use caso o link anterior não esteja funcionando
                                        </p>
                                      </div>
                                    </div>
                                  )}
                              </div>
                            </div>
                          );
                        }

                        // Para a etapa do Banco Inter, mostrar interface customizada
                        if (
                          step.etapa === 'banco_inter' &&
                          (proposta.status === 'ASSINATURA_CONCLUIDA' ||
                            proposta.status === 'BOLETOS_EMITIDOS' ||
                            proposta.status === 'ASSINATURA_CONCLUIDA')
                        ) {
                          return (
                            <div key={step.id} className="mb-4">
                              <div className="space-y-4">
                                {/* Interface do Banco Inter */}
                                <div className="mt-3 rounded-lg border border-orange-700 bg-orange-900/20 p-4">
                                  <div className="mb-3 flex items-center justify-between">
                                    <h5 className="flex items-center gap-2 font-medium text-orange-300">
                                      <Building2 className="h-5 w-5" />
                                      Banco Inter - Boletos de Pagamento
                                    </h5>
                                  </div>

                                  <p className="mb-4 text-sm text-orange-200">
                                    Após a assinatura do contrato, os boletos são gerados
                                    automaticamente pelo Banco Inter para processamento do pagamento
                                    ao cliente.
                                  </p>

                                  {(!collectionsData || collectionsData.length === 0) &&
                                  !interBoletoData &&
                                  !proposta.interBoletoGerado ? (
                                    // Botão para gerar boletos
                                    <Button
                                      onClick={async () => {
                                        setLoadingInter(true);
                                        try {
                                          // Preparar dados para a API do Inter
                                          const dataVencimento = new Date();
                                          dataVencimento.setDate(dataVencimento.getDate() + 5); // Vencimento em 5 dias

                                          // Aviso se dados de endereço estão incompletos
                                          const enderecoIncompleto =
                                            !proposta.cliente_data?.endereco ||
                                            !proposta.cliente_data?.numero ||
                                            !proposta.cliente_data?.bairro ||
                                            !proposta.cliente_data?.cidade ||
                                            !proposta.cliente_data?.uf ||
                                            !proposta.cliente_data?.cep;

                                          if (enderecoIncompleto) {
                                            console.warn(
                                              '[INTER] Dados de endereço incompletos, usando valores padrão temporários'
                                            );
                                          }

                                          const requestData = {
                                            proposalId: proposta.id,
                                            valorTotal: proposta.valorAprovado || proposta.valor || 0,
                                            dataVencimento: dataVencimento
                                              .toISOString()
                                              .split('T')[0],
                                            clienteData: {
                                              nome: proposta.cliente_data?.nome || '',
                                              cpf: proposta.cliente_data?.cpf || '',
                                              email: proposta.cliente_data?.email || '',
                                              telefone:
                                                proposta.cliente_data?.telefone || '00000000000',
                                              endereco:
                                                proposta.cliente_data?.endereco || 'Rua Principal',
                                              numero: proposta.cliente_data?.numero || '100',
                                              complemento: proposta.cliente_data?.complemento || '',
                                              bairro: proposta.cliente_data?.bairro || 'Centro',
                                              cidade: proposta.cliente_data?.cidade || 'São Paulo',
                                              uf: proposta.cliente_data?.uf || 'SP',
                                              cep:
                                                proposta.cliente_data?.cep?.replace(/\D/g, '') ||
                                                '00000000',
                                            },
                                          };

                                          console.log(
                                            '[INTER] Enviando dados para gerar boleto:',
                                            requestData
                                          );

                                          const response = (await apiRequest(
                                            '/api/inter/collections',
                                            {
                                              method: 'POST',
                                              body: JSON.stringify(requestData),
                                            }
                                          )) as InterBoletoResponse;

                                          console.log('[INTER] Resposta da API:', response);

                                          toast({
                                            title: 'Sucesso',
                                            description: `${response.totalCriados || 0} boleto(s) gerado(s) com sucesso!`,
                                          });

                                          // Atualizar estado local para mostrar os boletos
                                          setInterBoletoData(
                                            response as { codigoSolicitacao?: string }
                                          );

                                          // 🔥 IMPORTANTE: Recarregar dados da proposta e timeline
                                          await Promise.all([
                                            refetch(), // Recarregar dados da proposta para atualizar timeline
                                            queryClient.invalidateQueries({
                                              queryKey: queryKeys.inter.collections(proposta.id),
                                            }),
                                            queryClient.invalidateQueries({
                                              queryKey: queryKeys.proposta.formalizacao(proposta.id),
                                            }),
                                          ]);
                                        } catch (error: any) {
                                          console.error('[INTER] Erro ao gerar boleto:', error);

                                          // Verificar se é erro de boleto duplicado
                                          if (
                                            error.status === 409 ||
                                            error.response?.status === 409
                                          ) {
                                            const existingCollections =
                                              error.response?.data?.existingCollections || [];
                                            toast({
                                              title: 'Boletos já existentes',
                                              description:
                                                error.response?.data?.message ||
                                                'Já existem boletos ativos para esta proposta. Verifique na lista abaixo.',
                                              variant: 'default',
                                            });

                                            // Recarregar para mostrar os boletos existentes
                                            queryClient.invalidateQueries({
                                              queryKey: queryKeys.inter.collections(proposta.id),
                                            });
                                          } else {
                                            toast({
                                              title: 'Erro',
                                              description:
                                                error.response?.data?.message ||
                                                error.response?.data?.details ||
                                                error.response?.data?.error ||
                                                'Erro ao gerar boletos',
                                              variant: 'destructive',
                                            });
                                          }
                                        } finally {
                                          setLoadingInter(false);
                                        }
                                      }}
                                      disabled={loadingInter}
                                      className="w-full bg-orange-600 hover:bg-orange-700"
                                    >
                                      {loadingInter ? (
                                        <div className="flex items-center">
                                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                                          Gerando boleto...
                                        </div>
                                      ) : (
                                        <div className="flex items-center">
                                          <Building2 className="mr-2 h-4 w-4" />
                                          Gerar Boletos via Banco Inter
                                        </div>
                                      )}
                                    </Button>
                                  ) : (
                                    // Boletos já gerados - mostrar lista
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between rounded border border-green-700 bg-green-900/20 p-3">
                                        <div className="flex items-center gap-2">
                                          <CheckCircle className="h-5 w-5 text-green-400" />
                                          <span className="font-medium text-green-300">
                                            {collectionsData && collectionsData.length > 0
                                              ? `${collectionsData.length} boleto(s) gerado(s) com sucesso`
                                              : 'Boletos gerados com sucesso'}
                                          </span>
                                        </div>

                                        {/* MÁQUINA DE ESTADOS UI - CONSCIÊNCIA DE STORAGE */}
                                        {collectionsData && collectionsData.length > 1 && (
                                          <div className="space-y-2">
                                            {/* Indicador de status do Storage */}
                                            {storageStatus && (
                                              <div className="text-xs text-gray-400">
                                                {storageStatus.boletosInStorage} de{' '}
                                                {storageStatus.totalBoletos} boletos no storage
                                                {storageStatus.hasCarnet && ' | Carnê disponível'}
                                              </div>
                                            )}

                                            {/* Botões condicionais baseados no estado automático */}
                                            {(() => {
                                              // Estado 1: Carnê já existe
                                              if (carneStatus.exists && carneStatus.url) {
                                                return (
                                                  <Button
                                                    size="sm"
                                                    variant="default"
                                                    className="bg-green-600 hover:bg-green-700"
                                                    onClick={() => {
                                                      window.open(carneStatus.url!, '_blank');
                                                      toast({
                                                        title: 'Download iniciado',
                                                        description: `Carnê com ${collectionsData?.length || 0} boletos`,
                                                      });
                                                    }}
                                                  >
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Baixar Carnê ({collectionsData?.length ||
                                                      0}{' '}
                                                    boletos)
                                                  </Button>
                                                );
                                              }

                                              // Estado alternativo: usar storageStatus se carneStatus ainda carregando
                                              if (
                                                !carneStatus.isLoading &&
                                                storageStatus?.hasCarnet &&
                                                storageStatus?.carnetUrl
                                              ) {
                                                return (
                                                  <Button
                                                    size="sm"
                                                    variant="default"
                                                    className="bg-green-600 hover:bg-green-700"
                                                    onClick={() => {
                                                      window.open(
                                                        storageStatus.carnetUrl!,
                                                        '_blank'
                                                      );
                                                    }}
                                                  >
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Baixar Carnê ({storageStatus.totalBoletos}{' '}
                                                    boletos)
                                                  </Button>
                                                );
                                              }

                                              // Estado 2: Sincronização incompleta - botão de correção
                                              if (storageStatus?.needsCorrection) {
                                                return (
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="border-yellow-600 text-yellow-600 hover:bg-yellow-600 hover:text-white"
                                                    onClick={async () => {
                                                      try {
                                                        setLoadingCarne(true);
                                                        toast({
                                                          title: 'Corrigindo sincronização',
                                                          description:
                                                            'Removendo dados incompletos e reiniciando...',
                                                        });

                                                        // Chamar endpoint de correção
                                                        const response = await apiRequest(
                                                          `/api/propostas/${proposta.id}/corrigir-sincronizacao`,
                                                          { method: 'POST' }
                                                        );

                                                        const data = response as any;
                                                        if (data.success) {
                                                          toast({
                                                            title: 'Correção iniciada',
                                                            description: `Re-sincronização em andamento. Job ID: ${data.jobId}`,
                                                          });

                                                          // Aguardar um pouco e recarregar status
                                                          setTimeout(async () => {
                                                            await checkStorageStatus();
                                                          }, 3000);
                                                        }
                                                      } catch (error: any) {
                                                        toast({
                                                          title: 'Erro',
                                                          description:
                                                            error.message ||
                                                            'Erro ao corrigir sincronização',
                                                          variant: 'destructive',
                                                        });
                                                      } finally {
                                                        setLoadingCarne(false);
                                                      }
                                                    }}
                                                    disabled={loadingCarne}
                                                  >
                                                    {loadingCarne ? (
                                                      <div className="flex items-center">
                                                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2"></div>
                                                        Corrigindo...
                                                      </div>
                                                    ) : (
                                                      <>
                                                        <AlertCircle className="mr-2 h-4 w-4" />
                                                        Corrigir Sincronização
                                                      </>
                                                    )}
                                                  </Button>
                                                );
                                              }

                                              // Estado 3: Boletos sincronizados, gerar carnê (PAM V1.0 - verificação automática)
                                              if (
                                                !carneStatus.exists &&
                                                !carneStatus.isLoading &&
                                                storageStatus?.boletosInStorage ===
                                                  storageStatus?.totalBoletos
                                              ) {
                                                return (
                                                  <Button
                                                    size="sm"
                                                    variant="default"
                                                    className="bg-blue-600 hover:bg-blue-700"
                                                    onClick={async () => {
                                                      try {
                                                        setLoadingCarne(true);
                                                        toast({
                                                          title: 'Gerando carnê',
                                                          description:
                                                            'Consolidando todos os boletos em um único PDF...',
                                                        });

                                                        // Chamar endpoint de geração de carnê
                                                        const response = await apiRequest(
                                                          `/api/propostas/${proposta.id}/gerar-carne`,
                                                          { method: 'POST' }
                                                        );

                                                        const data = response as any;
                                                        if (data.success) {
                                                          toast({
                                                            title: 'Carnê gerado!',
                                                            description:
                                                              'Carnê consolidado disponível para download',
                                                          });

                                                          // Recarregar status automático PAM V1.0
                                                          await checkCarneStatus();
                                                          await checkStorageStatus();
                                                        }
                                                      } catch (error: any) {
                                                        toast({
                                                          title: 'Erro',
                                                          description:
                                                            error.message || 'Erro ao gerar carnê',
                                                          variant: 'destructive',
                                                        });
                                                      } finally {
                                                        setLoadingCarne(false);
                                                      }
                                                    }}
                                                    disabled={loadingCarne || carneStatus.isLoading}
                                                  >
                                                    {loadingCarne ? (
                                                      <div className="flex items-center">
                                                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2"></div>
                                                        Gerando carnê...
                                                      </div>
                                                    ) : carneStatus.isLoading ? (
                                                      <div className="flex items-center">
                                                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2"></div>
                                                        Verificando status...
                                                      </div>
                                                    ) : (
                                                      <>
                                                        <Printer className="mr-2 h-4 w-4" />
                                                        Gerar Carnê para Impressão
                                                      </>
                                                    )}
                                                  </Button>
                                                );
                                              }

                                              // Estado 4: Precisa sincronizar
                                              return (
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={async () => {
                                                    try {
                                                      setLoadingCarne(true);
                                                      toast({
                                                        title: 'Sincronizando boletos',
                                                        description: `Baixando ${collectionsData.length} boletos do Banco Inter...`,
                                                      });

                                                      // Sincronizar boletos
                                                      const response = await apiRequest(
                                                        `/api/propostas/${proposta.id}/sincronizar-boletos`,
                                                        {
                                                          method: 'POST',
                                                          body: JSON.stringify({
                                                            numeroBoletos: collectionsData.length,
                                                          }),
                                                        }
                                                      );

                                                      const data = response as any;
                                                      if (data.success) {
                                                        toast({
                                                          title: 'Sincronização concluída',
                                                          description: `${data.sucessos} boletos sincronizados com sucesso`,
                                                        });

                                                        // Recarregar status
                                                        await checkStorageStatus();
                                                      }
                                                    } catch (error: any) {
                                                      toast({
                                                        title: 'Erro',
                                                        description:
                                                          error.message ||
                                                          'Erro ao sincronizar boletos',
                                                        variant: 'destructive',
                                                      });
                                                    } finally {
                                                      setLoadingCarne(false);
                                                    }
                                                  }}
                                                  disabled={loadingCarne || checkingStorage}
                                                >
                                                  {loadingCarne ? (
                                                    <div className="flex items-center">
                                                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2"></div>
                                                      Sincronizando...
                                                    </div>
                                                  ) : (
                                                    <>
                                                      <RefreshCw className="mr-2 h-4 w-4" />
                                                      Sincronizar Boletos
                                                    </>
                                                  )}
                                                </Button>
                                              );
                                            })()}
                                          </div>
                                        )}

                                        {/* Botão para baixar carnê após geração */}
                                        {carneUrl && !existingCarne?.hasCarnet && (
                                          <Button
                                            size="sm"
                                            onClick={() => {
                                              // Download do carnê via URL assinada
                                              const link = document.createElement('a');
                                              link.href = carneUrl;
                                              link.download = `carne-proposta-${proposta.id}.pdf`;
                                              link.target = '_blank';
                                              document.body.appendChild(link);
                                              link.click();
                                              document.body.removeChild(link);

                                              toast({
                                                title: 'Download iniciado',
                                                description: `Carnê com ${carneTotalBoletos} boletos`,
                                              });
                                            }}
                                            className="border-green-600 text-green-400 hover:bg-green-600/10 bg-green-900/20"
                                          >
                                            <div className="flex items-center">
                                              <Download className="mr-2 h-4 w-4" />
                                              Baixar Carnê ({carneTotalBoletos} boletos)
                                            </div>
                                          </Button>
                                        )}
                                      </div>

                                      {/* Listar todos os boletos gerados */}
                                      {collectionsData && collectionsData.length > 0 ? (
                                        <div className="space-y-3">
                                          {collectionsData.map((boleto: any, index: number) => (
                                            <div
                                              key={boleto.id || index}
                                              className="rounded-lg border border-gray-700 bg-gray-800 p-4"
                                            >
                                              <div className="mb-3 flex items-start justify-between">
                                                <div>
                                                  <h6 className="mb-1 font-medium text-orange-300">
                                                    {boleto.numeroParcela && boleto.totalParcelas
                                                      ? `Parcela ${boleto.numeroParcela}/${boleto.totalParcelas}`
                                                      : boleto.seuNumero ||
                                                        boleto.codigoSolicitacao}
                                                  </h6>
                                                  <div className="flex items-center gap-4 text-sm text-gray-400">
                                                    <span>Valor: R$ {boleto.valorNominal}</span>
                                                    <span>
                                                      Venc:{' '}
                                                      {new Date(
                                                        boleto.dataVencimento
                                                      ).toLocaleDateString('pt-BR')}
                                                    </span>
                                                  </div>
                                                </div>
                                                <Badge
                                                  variant={
                                                    boleto.situacao === 'RECEBIDO'
                                                      ? 'default'
                                                      : boleto.situacao === 'VENCIDO'
                                                        ? 'destructive'
                                                        : 'secondary'
                                                  }
                                                  className={
                                                    boleto.situacao === 'RECEBIDO'
                                                      ? 'border-green-700 bg-green-900 text-green-300'
                                                      : ''
                                                  }
                                                >
                                                  {boleto.situacao}
                                                </Badge>
                                              </div>

                                              {/* QR Code PIX e Linha Digitável */}
                                              <div className="space-y-3">
                                                {/* PIX - prioridade alta */}
                                                {boleto.pixCopiaECola && (
                                                  <div className="rounded border border-green-700 bg-green-900/20 p-4">
                                                    <p className="mb-3 text-sm font-medium text-green-300">
                                                      <span className="inline-flex items-center gap-2">
                                                        <QrCode className="h-4 w-4" />
                                                        PIX Copia e Cola (Pagamento Instantâneo)
                                                      </span>
                                                    </p>
                                                    <div className="flex items-center gap-2 rounded bg-gray-900 p-3">
                                                      <code className="flex-1 break-all font-mono text-xs text-green-400">
                                                        {boleto.pixCopiaECola}
                                                      </code>
                                                      <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => {
                                                          navigator.clipboard.writeText(
                                                            boleto.pixCopiaECola
                                                          );
                                                          toast({
                                                            title: 'PIX copiado!',
                                                            description:
                                                              'Cole no app do seu banco para pagar',
                                                          });
                                                        }}
                                                      >
                                                        <Copy className="h-3 w-3" />
                                                      </Button>
                                                    </div>
                                                  </div>
                                                )}

                                                {/* Linha Digitável do Boleto */}
                                                {(boleto.linhaDigitavel || boleto.codigoBarras) && (
                                                  <div className="rounded border border-gray-700 bg-gray-800 p-4">
                                                    <p className="mb-3 text-sm font-medium text-gray-300">
                                                      <span className="inline-flex items-center gap-2">
                                                        <Barcode className="h-4 w-4" />
                                                        Linha Digitável do Boleto
                                                      </span>
                                                    </p>
                                                    <div className="flex items-center gap-2 rounded bg-gray-900 p-3">
                                                      <code className="flex-1 break-all font-mono text-xs text-orange-400">
                                                        {boleto.linhaDigitavel ||
                                                          boleto.codigoBarras}
                                                      </code>
                                                      <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => {
                                                          const codigo =
                                                            boleto.linhaDigitavel ||
                                                            boleto.codigoBarras;
                                                          navigator.clipboard.writeText(codigo);
                                                          toast({
                                                            title: 'Linha digitável copiada!',
                                                            description:
                                                              'Use no internet banking para pagar',
                                                          });
                                                        }}
                                                      >
                                                        <Copy className="h-3 w-3" />
                                                      </Button>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>

                                              {/* Ações do boleto */}
                                              <div className="flex gap-2">
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={async () => {
                                                    try {
                                                      console.log(
                                                        `[PDF DOWNLOAD] Tentando baixar PDF para: ${boleto.codigoSolicitacao}`
                                                      );
                                                      console.log(
                                                        `[PDF DOWNLOAD] Status do boleto: ${boleto.situacao}`
                                                      );

                                                      // Verificar status do boleto
                                                      console.log(
                                                        `[PDF DOWNLOAD] Tentativa de download para status: ${boleto.situacao}`
                                                      );

                                                      // Se o status ainda é EM_PROCESSAMENTO, avisar o usuário
                                                      if (
                                                        boleto.situacao === 'EM_PROCESSAMENTO' ||
                                                        boleto.situacao === 'CODIGO_INVALIDO'
                                                      ) {
                                                        toast({
                                                          title: 'PDF temporariamente indisponível',
                                                          description:
                                                            'O boleto está sendo processado. Use o código de barras abaixo para pagamento.',
                                                          variant: 'default',
                                                        });

                                                        // Copiar código de barras como fallback
                                                        if (
                                                          boleto.linhaDigitavel ||
                                                          boleto.codigoBarras
                                                        ) {
                                                          const codigo =
                                                            boleto.linhaDigitavel ||
                                                            boleto.codigoBarras;
                                                          await navigator.clipboard.writeText(
                                                            codigo
                                                          );
                                                          toast({
                                                            title: '✅ Código copiado!',
                                                            description:
                                                              'Use no app do banco ou PIX Copia e Cola',
                                                          });
                                                        }
                                                        return;
                                                      }

                                                      // Fazer download com autenticação correta usando TokenManager
                                                      console.log(
                                                        `[PDF DOWNLOAD] Usando código: ${boleto.codigoSolicitacao}`
                                                      );
                                                      console.log(
                                                        `[PDF DOWNLOAD] Nosso número: ${boleto.nossoNumero || 'não definido'}`
                                                      );
                                                      console.log(
                                                        `[PDF DOWNLOAD] Seu número: ${boleto.seuNumero || 'não definido'}`
                                                      );

                                                      // Obter token usando o TokenManager
                                                      const { TokenManager } = await import(
                                                        '@/lib/apiClient'
                                                      );
                                                      const tokenManager =
                                                        TokenManager.getInstance();
                                                      const token =
                                                        await tokenManager.getValidToken();

                                                      if (!token) {
                                                        throw new Error(
                                                          'Token de acesso não encontrado'
                                                        );
                                                      }

                                                      console.log(
                                                        `[PDF DOWNLOAD] Token obtido com sucesso (${token.length} caracteres)`
                                                      );

                                                      const response = await fetch(
                                                        `/api/inter/collections/${boleto.codigoSolicitacao}/pdf`,
                                                        {
                                                          method: 'GET',
                                                          headers: {
                                                            Authorization: `Bearer ${token}`,
                                                            Accept: 'application/pdf',
                                                            'Content-Type': 'application/json',
                                                          },
                                                        }
                                                      );

                                                      if (response.ok) {
                                                        const blob = await response.blob();
                                                        const url =
                                                          window.URL.createObjectURL(blob);
                                                        const a = document.createElement('a');
                                                        a.href = url;
                                                        a.download = `boleto-${boleto.codigoSolicitacao}.pdf`;
                                                        document.body.appendChild(a);
                                                        a.click();
                                                        window.URL.revokeObjectURL(url);
                                                        document.body.removeChild(a);

                                                        toast({
                                                          title: 'PDF baixado com sucesso!',
                                                          description:
                                                            'Arquivo salvo na pasta de Downloads',
                                                        });
                                                      } else {
                                                        throw new Error(
                                                          `Erro ${response.status}: ${response.statusText}`
                                                        );
                                                      }
                                                    } catch (error: any) {
                                                      console.error('[PDF DOWNLOAD] Erro:', error);

                                                      // SEMPRE informar que o PDF está disponível e pode tentar novamente
                                                      toast({
                                                        title: 'Erro temporário ao baixar PDF',
                                                        description:
                                                          'Por favor, tente novamente em alguns segundos. O PDF está disponível.',
                                                        variant: 'destructive',
                                                      });
                                                    }
                                                  }}
                                                  className="border-blue-600 text-blue-400 hover:bg-blue-600/10"
                                                >
                                                  <Download className="mr-2 h-4 w-4" />
                                                  Baixar PDF
                                                </Button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="rounded border border-gray-700 bg-gray-800 p-3">
                                          <p className="text-sm text-gray-400">
                                            Aguardando processamento dos boletos...
                                          </p>
                                        </div>
                                      )}

                                      <div className="grid grid-cols-3 gap-3">
                                        <Button
                                          variant="outline"
                                          onClick={async () => {
                                            try {
                                              // Atualizar status em tempo real
                                              console.log(
                                                `[REALTIME UPDATE] Iniciando atualização para proposta: ${proposta.id}`
                                              );

                                              const { apiRequest } = await import(
                                                '@/lib/queryClient'
                                              );
                                              const response = (await apiRequest(
                                                `/api/inter/realtime-update/${proposta.id}`,
                                                {
                                                  method: 'POST',
                                                }
                                              )) as {
                                                updated: number;
                                                removed: number;
                                                message?: string;
                                              };

                                              if (response.updated > 0 || response.removed > 0) {
                                                // Recarregar a página para mostrar os dados atualizados
                                                window.location.reload();

                                                toast({
                                                  title: 'Status atualizado!',
                                                  description: `${response.updated} boletos atualizados, ${response.removed} códigos inválidos removidos`,
                                                });
                                              } else {
                                                toast({
                                                  title: 'Sem atualizações',
                                                  description:
                                                    response.message || 'Status já está atualizado',
                                                });
                                              }
                                            } catch (error) {
                                              console.error('[REALTIME UPDATE] Erro:', error);
                                              toast({
                                                title: 'Erro',
                                                description: 'Erro ao atualizar status dos boletos',
                                                variant: 'destructive',
                                              });
                                            }
                                          }}
                                          className="border-green-600 text-green-400 hover:bg-green-600/10"
                                        >
                                          <RefreshCw className="mr-2 h-4 w-4" />
                                          Atualizar Status
                                        </Button>

                                        <Button
                                          variant="outline"
                                          onClick={async () => {
                                            try {
                                              // Usar dados das coleções já carregadas
                                              const collections = collectionsData || [];
                                              if (collections.length > 0) {
                                                // Abrir o PDF do primeiro boleto
                                                const firstCollection = collections[0];
                                                if (firstCollection.codigoSolicitacao) {
                                                  // Importar TokenManager para obter token válido
                                                  const { TokenManager } = await import(
                                                    '@/lib/apiClient'
                                                  );
                                                  const tokenManager = TokenManager.getInstance();
                                                  const token = await tokenManager.getValidToken();

                                                  if (!token) {
                                                    throw new Error('Não autenticado');
                                                  }

                                                  const response = await fetch(
                                                    `/api/inter/collections/${proposta.id}/${firstCollection.codigoSolicitacao}/pdf`,
                                                    {
                                                      headers: {
                                                        Authorization: `Bearer ${token}`,
                                                      },
                                                    }
                                                  );

                                                  if (response.ok) {
                                                    const blob = await response.blob();
                                                    const url = window.URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.download = `boleto-${firstCollection.seuNumero || firstCollection.codigoSolicitacao}.pdf`;
                                                    document.body.appendChild(a);
                                                    a.click();
                                                    window.URL.revokeObjectURL(url);
                                                    document.body.removeChild(a);
                                                  } else {
                                                    throw new Error('Erro ao baixar PDF');
                                                  }
                                                } else {
                                                  toast({
                                                    title: 'Erro',
                                                    description: 'Código do boleto não encontrado',
                                                    variant: 'destructive',
                                                  });
                                                }
                                              } else {
                                                toast({
                                                  title: 'Sem boletos',
                                                  description:
                                                    'Nenhum boleto foi gerado ainda para esta proposta',
                                                  variant: 'default',
                                                });
                                              }
                                            } catch (error) {
                                              toast({
                                                title: 'Erro',
                                                description: 'Erro ao baixar PDF do boleto',
                                                variant: 'destructive',
                                              });
                                            }
                                          }}
                                          className="border-orange-600 text-orange-400 hover:bg-orange-600/10"
                                        >
                                          <Printer className="mr-2 h-4 w-4" />
                                          Imprimir Boleto
                                        </Button>

                                        <Button
                                          variant="outline"
                                          onClick={async () => {
                                            try {
                                              // Buscar coleções para esta proposta
                                              const collections = collectionsData || [];
                                              if (collections.length > 0) {
                                                // Mostrar informações de todas as coleções
                                                const statusInfo = collections
                                                  .map(
                                                    (col: any) =>
                                                      `Parcela ${col.numeroParcela}: ${col.situacao || 'Aguardando'}`
                                                  )
                                                  .join('\n');

                                                toast({
                                                  title: 'Status dos Boletos',
                                                  description:
                                                    statusInfo || 'Nenhum boleto encontrado',
                                                });
                                              } else {
                                                toast({
                                                  title: 'Sem boletos',
                                                  description:
                                                    'Nenhum boleto foi gerado ainda para esta proposta',
                                                  variant: 'default',
                                                });
                                              }
                                            } catch (error) {
                                              console.error(
                                                '[INTER] Erro ao consultar boletos:',
                                                error
                                              );
                                              toast({
                                                title: 'Erro',
                                                description: 'Erro ao consultar status dos boletos',
                                                variant: 'destructive',
                                              });
                                            }
                                          }}
                                          className="border-orange-600 text-orange-400 hover:bg-orange-600/10"
                                        >
                                          <FileText className="mr-2 h-4 w-4" />
                                          Ver Detalhes
                                        </Button>
                                      </div>

                                      <div className="mt-2 text-xs text-gray-400">
                                        <p>
                                          <strong>Instruções para o Cliente:</strong>
                                        </p>
                                        <p>• Boleto gerado automaticamente pelo Banco Inter</p>
                                        <p>
                                          • Pode pagar via PIX, débito ou transferência bancária
                                        </p>
                                        <p>• Valor será creditado após compensação bancária</p>
                                        <p>
                                          • Vencimento:{' '}
                                          {new Date(
                                            new Date().setDate(new Date().getDate() + 5)
                                          ).toLocaleDateString('pt-BR')}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Para outras etapas, usar o controle padrão se o tipo de etapa for válido
                        if (step.etapa && step.etapa !== 'banco_inter') {
                          return (
                            <div key={step.id} className="mb-4">
                              <EtapaFormalizacaoControl
                                propostaId={proposta.id}
                                etapa={step.etapa}
                                titulo={step.title}
                                descricao={step.description}
                                concluida={isCompleted}
                                habilitada={step.interactive}
                                onUpdate={() => refetch()}
                              />
                            </div>
                          );
                        }
                        return null;
                      }

                      // Caso contrário, mostra a timeline normal
                      return (
                        <div key={step.id} className="relative">
                          {index !== formalizationSteps.length - 1 && (
                            <div
                              className={`absolute left-4 top-8 h-16 w-0.5 ${
                                isCompleted ? 'bg-green-500' : 'bg-gray-600'
                              }`}
                            />
                          )}

                          <div className="flex items-start space-x-4">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                                isCompleted
                                  ? 'bg-green-500 text-white'
                                  : isCurrent
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-600 text-gray-400'
                              }`}
                            >
                              {isCompleted ? (
                                <CheckCircle className="h-4 w-4" />
                              ) : isCurrent ? (
                                <Clock className="h-4 w-4" />
                              ) : (
                                <Icon className="h-4 w-4" />
                              )}
                            </div>

                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h4
                                  className={`text-sm font-medium ${
                                    isCompleted || isCurrent ? 'text-white' : 'text-gray-400'
                                  }`}
                                >
                                  {step.title}
                                </h4>
                                <span className="text-xs text-gray-400">{step.date}</span>
                              </div>
                              <p
                                className={`text-sm ${
                                  isCompleted || isCurrent ? 'text-gray-300' : 'text-gray-500'
                                }`}
                              >
                                {step.description}
                              </p>

                              {isCurrent && !step.interactive && (
                                <div className="mt-2 rounded-md border border-blue-700 bg-blue-900/30 p-3">
                                  <div className="flex items-center">
                                    <AlertCircle className="mr-2 h-4 w-4 text-blue-400" />
                                    <span className="text-sm font-medium text-blue-300">
                                      Etapa atual em andamento
                                    </span>
                                  </div>
                                  <p className="mt-1 text-sm text-blue-200">
                                    Aguardando ação do cliente ou processamento interno.
                                  </p>
                                </div>
                              )}

                              {/* Botões para CCB e ClickSign */}
                              {step.id === 2 &&
                                (proposta.status === 'CCB_GERADA' ||
                                  proposta.status === 'AGUARDANDO_ASSINATURA' ||
                                  proposta.status === 'ASSINATURA_CONCLUIDA' ||
                                  proposta.status === 'BOLETOS_EMITIDOS') && (
                                  <div className="mt-3">
                                    <Button
                                      onClick={async () => {
                                        try {
                                          // ✅ CORREÇÃO: Usar endpoint de formalização correto
                                          const response = (await apiRequest(
                                            `/api/formalizacao/${proposta.id}/ccb`
                                          )) as CCBResponse;
                                          if (!response.publicUrl) {
                                            toast({
                                              title: 'CCB não disponível',
                                              description:
                                                'A CCB ainda não foi gerada para esta proposta',
                                              variant: 'destructive',
                                            });
                                            return;
                                          }
                                          setCcbUrl(response.publicUrl || '');
                                          setShowCcbViewer(true);
                                        } catch (error) {
                                          toast({
                                            title: 'Erro',
                                            description: 'Erro ao visualizar CCB',
                                            variant: 'destructive',
                                          });
                                        }
                                      }}
                                      variant="outline"
                                      size="sm"
                                      className="mr-2"
                                    >
                                      <FileText className="mr-2 h-4 w-4" />
                                      Visualizar CCB
                                    </Button>
                                  </div>
                                )}

                              {step.id === 3 &&
                                (proposta.status === 'CCB_GERADA' ||
                                  proposta.status === 'AGUARDANDO_ASSINATURA') && (
                                  <div className="mt-3 rounded-lg border border-blue-700 bg-blue-900/20 p-4">
                                    <div className="mb-3 flex items-center justify-between">
                                      <h5 className="font-medium text-blue-300">
                                        Enviar para Assinatura Eletrônica
                                      </h5>
                                      <Signature className="h-5 w-5 text-blue-400" />
                                    </div>
                                    <p className="mb-4 text-sm text-blue-200">
                                      Clique no botão abaixo para enviar o contrato CCB para o
                                      ClickSign e gerar o link de assinatura para o cliente.
                                    </p>

                                    {/* Opção de Biometria Facial */}
                                    <div className="mb-4 flex items-center space-x-2 rounded-lg border border-purple-700 bg-purple-900/20 p-3">
                                      <input
                                        type="checkbox"
                                        id="useBiometricAuth"
                                        checked={useBiometricAuth}
                                        onChange={(e) => setUseBiometricAuth(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                      />
                                      <label
                                        htmlFor="useBiometricAuth"
                                        className="cursor-pointer text-sm text-gray-300"
                                      >
                                        <span className="font-medium">Usar Biometria Facial</span>
                                        <span className="mt-0.5 block text-xs text-gray-400">
                                          Adiciona validação facial com comparação de documento para
                                          maior segurança
                                        </span>
                                      </label>
                                    </div>

                                    <Button
                                      onClick={() => enviarClickSignMutation.mutate()}
                                      disabled={enviarClickSignMutation.isPending}
                                      className="w-full bg-blue-600 hover:bg-blue-700"
                                    >
                                      {enviarClickSignMutation.isPending ? (
                                        <div className="flex items-center">
                                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                                          Enviando para ClickSign...
                                        </div>
                                      ) : (
                                        <div className="flex items-center">
                                          <Signature className="mr-2 h-4 w-4" />
                                          Enviar Contrato para Assinatura (ClickSign)
                                        </div>
                                      )}
                                    </Button>
                                  </div>
                                )}

                              {(clickSignData || proposta.clicksignSignUrl) && step.id === 3 && (
                                <div className="mt-3 rounded-lg border border-green-700 bg-green-900/20 p-4">
                                  <div className="mb-3 flex items-center">
                                    <CheckCircle className="mr-2 h-5 w-5 text-green-400" />
                                    <h5 className="font-medium text-green-300">
                                      Link de Assinatura Disponível
                                    </h5>
                                  </div>
                                  <p className="mb-3 text-sm text-green-200">
                                    Compartilhe o link abaixo com o cliente para assinatura digital:
                                  </p>
                                  <div className="flex items-center gap-2 rounded border bg-gray-800 p-3">
                                    <input
                                      type="text"
                                      value={
                                        clickSignData?.signUrl || proposta.clicksignSignUrl || ''
                                      }
                                      readOnly
                                      className="flex-1 bg-transparent text-sm text-white"
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        const linkUrl =
                                          clickSignData?.signUrl || proposta.clicksignSignUrl || '';
                                        navigator.clipboard.writeText(linkUrl);
                                        toast({
                                          title: 'Copiado!',
                                          description:
                                            'Link de assinatura copiado para a área de transferência',
                                        });
                                      }}
                                    >
                                      Copiar
                                    </Button>
                                  </div>
                                  {clickSignData?.envelopeId && (
                                    <p className="mt-2 text-xs text-gray-400">
                                      Envelope ID: {clickSignData.envelopeId}
                                    </p>
                                  )}

                                  {/* Botão para regenerar link */}
                                  <div className="mt-3 border-t border-gray-700 pt-3">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={async () => {
                                        // ✅ REMOVIDO: setLoadingClickSign - usar enviarClickSignMutation
                                        try {
                                          console.log(
                                            '🔄 [CLICKSIGN] Regenerando link (seção 2) para proposta:',
                                            proposta.id
                                          );
                                          console.log(
                                            '📊 [CLICKSIGN] Estado atual (seção 2):',
                                            clickSignData
                                          );

                                          const response = (await apiRequest(
                                            `/api/propostas/${proposta.id}/clicksign/regenerar`,
                                            {
                                              method: 'POST',
                                            }
                                          )) as ClickSignData;

                                          console.log(
                                            '✅ [CLICKSIGN] Novo link gerado (seção 2):',
                                            response
                                          );

                                          // 🎯 CORREÇÃO CRÍTICA: Preservar o link na tela
                                          setClickSignData(response);

                                          toast({
                                            title: 'Sucesso',
                                            description:
                                              'Novo link de assinatura gerado com sucesso!',
                                          });
                                        } catch (error: any) {
                                          console.error(
                                            '❌ [CLICKSIGN] Erro ao regenerar (seção 2):',
                                            error
                                          );
                                          // Tratamento específico para erro de token ClickSign
                                          if (
                                            error.response?.status === 401 &&
                                            error.response?.data?.action ===
                                              'UPDATE_CLICKSIGN_TOKEN'
                                          ) {
                                            toast({
                                              title: 'Token ClickSign Inválido',
                                              description:
                                                error.response.data.details ||
                                                'Token do ClickSign precisa ser atualizado. Entre em contato com o administrador.',
                                              variant: 'destructive',
                                            });
                                          } else if (
                                            error.response?.status === 400 &&
                                            error.response?.data?.action ===
                                              'CHECK_CLICKSIGN_SERVICE'
                                          ) {
                                            toast({
                                              title: 'Erro na API ClickSign',
                                              description:
                                                error.response.data.details ||
                                                'Problema com o serviço ClickSign. Tente novamente em alguns minutos.',
                                              variant: 'destructive',
                                            });
                                          } else {
                                            toast({
                                              title: 'Erro',
                                              description:
                                                error.response?.data?.error ||
                                                'Erro ao regenerar link',
                                              variant: 'destructive',
                                            });
                                          }
                                        } finally {
                                          // ✅ REMOVIDO: setLoadingClickSign - usar enviarClickSignMutation
                                        }
                                      }}
                                      disabled={enviarClickSignMutation.isPending}
                                      className="border-yellow-600 text-yellow-400 hover:bg-yellow-600/10"
                                    >
                                      {enviarClickSignMutation.isPending ? (
                                        <div className="flex items-center">
                                          <div className="mr-2 h-3 w-3 animate-spin rounded-full border-b-2 border-yellow-400"></div>
                                          Regenerando...
                                        </div>
                                      ) : (
                                        <div className="flex items-center">
                                          <Signature className="mr-2 h-3 w-3" />
                                          Gerar Novo Link
                                        </div>
                                      )}
                                    </Button>
                                    <p className="mt-1 text-xs text-gray-500">
                                      Use caso o link anterior não esteja funcionando
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Documents Tab */}
            {activeTab === 'documents' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Documentos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Usar DocumentViewer com popup modal como na análise */}
                  <DocumentViewer
                    propostaId={proposta.id}
                    documents={[]}
                    ccbDocumentoUrl={
                      proposta.status === 'CCB_GERADA' ||
                      proposta.status === 'AGUARDANDO_ASSINATURA' ||
                      proposta.status === 'ASSINATURA_CONCLUIDA' ||
                      proposta.status === 'BOLETOS_EMITIDOS'
                        ? `/api/propostas/${proposta.id}/ccb-url`
                        : undefined
                    }
                  />
                </CardContent>
              </Card>
            )}

            {/* Contracts Tab */}
            {activeTab === 'contracts' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5" />
                    Contratos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Contract Status */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full ${
                            proposta.contratoGerado ? 'bg-green-100' : 'bg-gray-200'
                          }`}
                        >
                          <FileCheck
                            className={`h-5 w-5 ${
                              proposta.contratoGerado ? 'text-green-600' : 'text-gray-400'
                            }`}
                          />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Contrato Gerado</p>
                          <p className="text-sm text-gray-600">
                            {proposta.contratoGerado ? 'Sim' : 'Não'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full ${
                            proposta.contratoAssinado ? 'bg-green-100' : 'bg-gray-200'
                          }`}
                        >
                          <Signature
                            className={`h-5 w-5 ${
                              proposta.contratoAssinado ? 'text-green-600' : 'text-gray-400'
                            }`}
                          />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Contrato Assinado</p>
                          <p className="text-sm text-gray-600">
                            {proposta.contratoAssinado ? 'Sim' : 'Não'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Contract Actions */}
                    <div className="border-t pt-4">
                      <h4 className="mb-3 font-medium text-gray-900">Ações do Contrato</h4>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          disabled={!proposta.contratoGerado}
                          className="flex items-center gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          Visualizar Contrato
                        </Button>
                        <Button
                          variant="outline"
                          disabled={!proposta.contratoGerado}
                          className="flex items-center gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Baixar Contrato
                        </Button>
                        <Button
                          variant="outline"
                          disabled={!proposta.contratoGerado || proposta.contratoAssinado}
                          className="flex items-center gap-2"
                        >
                          <Send className="h-4 w-4" />
                          Enviar para Assinatura
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Proposal Summary */}
            <Card className="border-gray-700 bg-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <User className="h-5 w-5 text-blue-400" />
                  Resumo da Proposta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-400">Cliente</Label>
                    <p className="font-medium text-white">
                      {proposta.cliente_data?.nome || 'Nome não informado'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-400">Valor Aprovado</Label>
                    <p className="text-2xl font-bold text-green-400">
                      {formatCurrency(proposta.valorAprovado || proposta.valor || 0)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-400">Prazo</Label>
                    <p className="font-medium text-white">
                      {proposta.prazo || 0} meses
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-400">Data da Aprovação</Label>
                    <p className="flex items-center gap-1 text-white">
                      <Calendar className="h-4 w-4" />
                      {proposta.dataAprovacao
                        ? formatDate(proposta.dataAprovacao)
                        : formatDate(proposta.createdAt)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status Management */}
            <Card className="border-gray-700 bg-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Edit className="h-5 w-5 text-blue-400" />
                  Gerenciar Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="status" className="text-gray-400">
                      Status Atual
                    </Label>
                    <select
                      className="w-full rounded-md border border-gray-600 bg-gray-700 p-2 text-white"
                      value={form.watch('status') || proposta.status}
                      onChange={(e) =>
                        form.setValue(
                          'status',
                          e.target.value as
                            | 'documentos_enviados'
                            | 'CCB_GERADA'
                            | 'ASSINATURA_CONCLUIDA'
                            | 'BOLETOS_EMITIDOS'
                            | 'PAGAMENTO_CONFIRMADO'
                        )
                      }
                    >
                      <option value="aprovado">Aprovado</option>
                      <option value="documentos_enviados">Documentos Enviados</option>
                      <option value="CCB_GERADA">CCB Gerada</option>
                      <option value="AGUARDANDO_ASSINATURA">Aguardando Assinatura</option>
                      <option value="ASSINATURA_PENDENTE">Assinatura Pendente</option>
                      <option value="ASSINATURA_CONCLUIDA">Assinatura Concluída</option>
                      <option value="BOLETOS_EMITIDOS">Boletos Emitidos</option>
                      <option value="PAGAMENTO_PENDENTE">Pagamento Pendente</option>
                      <option value="PAGAMENTO_PARCIAL">Pagamento Parcial</option>
                      <option value="PAGAMENTO_CONFIRMADO">Pagamento Confirmado</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="observacoes" className="text-gray-400">
                      Observações
                    </Label>
                    <Textarea
                      id="observacoes"
                      rows={3}
                      placeholder="Adicione observações sobre o processo..."
                      className="border-gray-600 bg-gray-700 text-white"
                      {...form.register('observacoesFormalização')}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={updateFormalizacao.isPending}>
                    {updateFormalizacao.isPending ? 'Atualizando...' : 'Atualizar Status'}
                  </Button>
                </form>

                {/* 🎯 PAM V1.0: Botão "Marcar como Concluída" - Orquestração Manual */}
                {/* Renderização condicional baseada em role e status */}
                {(user?.role === 'ATENDENTE' || user?.role === 'ADMINISTRADOR' || user?.role === 'GERENTE') &&
                  (proposta.status === 'AGUARDANDO_ASSINATURA' || 
                   proposta.status === 'ASSINATURA_PENDENTE' || 
                   proposta.status === 'ASSINATURA_CONCLUIDA') && (
                  <div className="mt-4 border-t border-gray-600 pt-4">
                    <Button
                      onClick={() => marcarComoConcluida.mutate()}
                      className="w-full bg-orange-600 hover:bg-orange-700"
                      disabled={marcarComoConcluida.isPending}
                      data-testid="button-marcar-concluida"
                    >
                      {marcarComoConcluida.isPending ? 'Processando...' : 'Marcar como Concluída'}
                    </Button>
                    <p className="mt-2 text-xs text-gray-400 text-center">
                      Inicia o processo de geração automática de boletos
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Next Steps */}
            <Card className="border-gray-700 bg-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <AlertCircle className="h-5 w-5 text-blue-400" />
                  Próximos Passos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {proposta.status === 'aprovado' && (
                    <div className="rounded-md border border-blue-700 bg-blue-900/30 p-3">
                      <p className="text-sm font-medium text-blue-300">
                        Aguardando documentos adicionais
                      </p>
                      <p className="mt-1 text-sm text-blue-200">
                        Cliente deve enviar documentos complementares solicitados.
                      </p>
                    </div>
                  )}
                  {proposta.status === 'documentos_enviados' && (
                    <div className="rounded-md border border-purple-700 bg-purple-900/30 p-3">
                      <p className="text-sm font-medium text-purple-300">Preparar contratos</p>
                      <p className="mt-1 text-sm text-purple-200">
                        Gerar e preparar contratos para assinatura.
                      </p>
                    </div>
                  )}
                  {proposta.status === 'CCB_GERADA' && (
                    <div className="rounded-md border border-indigo-700 bg-indigo-900/30 p-3">
                      <p className="text-sm font-medium text-indigo-300">Aguardando assinatura</p>
                      <p className="mt-1 text-sm text-indigo-200">
                        Contratos enviados para assinatura do cliente.
                      </p>
                    </div>
                  )}
                  {proposta.status === 'ASSINATURA_CONCLUIDA' && (
                    <div className="rounded-md border border-orange-700 bg-orange-900/30 p-3">
                      <p className="text-sm font-medium text-orange-300">Preparar pagamento</p>
                      <p className="mt-1 text-sm text-orange-200">
                        Processar liberação do valor aprovado.
                      </p>
                    </div>
                  )}
                  {proposta.status === 'BOLETOS_EMITIDOS' && (
                    <div className="rounded-md border border-green-700 bg-green-900/30 p-3">
                      <p className="text-sm font-medium text-green-300">Liberar pagamento</p>
                      <p className="mt-1 text-sm text-green-200">
                        Valor pronto para ser liberado ao cliente.
                      </p>
                    </div>
                  )}
                  {proposta.status === 'PAGAMENTO_CONFIRMADO' && (
                    <div className="rounded-md border border-green-700 bg-green-900/30 p-3">
                      <p className="text-sm font-medium text-green-300">Processo concluído</p>
                      <p className="mt-1 text-sm text-green-200">
                        Valor liberado com sucesso ao cliente.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
