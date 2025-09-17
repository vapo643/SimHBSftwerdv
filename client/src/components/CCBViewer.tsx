/**
 * Componente para visualização e gerenciamento de CCB
 * PAM V1.0 - Refatorado com dois botões distintos: CCB Original e CCB Assinada
 */

import { useState, useEffect } from 'react';
import { FileText, Download, RefreshCw, Eye, CheckCircle, Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { queryKeys, invalidationPatterns } from '@/hooks/queries/queryKeys';

interface CCBViewerProps {
  proposalId: string;
  onCCBGenerated?: () => void;
}

interface CCBStatus {
  ccbPath?: string;
  signedUrl?: string;
  generatedAt?: string;
}

export function CCBViewer({ proposalId, onCCBGenerated }: CCBViewerProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [shouldPoll, setShouldPoll] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth(); // PAM V1.0: Obter informações do usuário para verificar role

  // 🔥 CORREÇÃO DA RACE CONDITION: Query com polling inteligente
  const {
    data: proposalData,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.proposta.all(proposalId), // 🔧 Query keys padronizadas
    refetchInterval: (isGenerating || shouldPoll) ? 2000 : false, // 🔄 Poll até confirmar CCB presente
    select: (data: any) => {
      console.log('🔍 [CCBViewer] Raw API data:', data);
      const result = {
        ccbPath: data?.data?.caminho_ccb || data?.caminhoCcb || data?.ccbPath,
        signedUrl: data?.data?.caminho_ccb || data?.caminhoCcb || data?.signedUrl,
        generatedAt: data?.data?.ccb_gerado_em || data?.ccbGeradoEm || data?.ccb_gerado_em,
        status: data?.data?.status || data?.status,
        caminhoCcbAssinado: data?.data?.caminho_ccb_assinado || data?.caminhoCcbAssinado || data?.caminho_ccb_assinado,
        dataAssinatura: data?.data?.data_assinatura || data?.dataAssinatura || data?.data_assinatura,
        ccbGerado: data?.data?.ccb_gerado || data?.ccbGerado || data?.ccb_gerado
      };
      console.log('🔍 [CCBViewer] Mapped data:', result);
      
      // 🎯 CORREÇÃO PRINCIPAL: Parar polling apenas quando CCB fields estão presentes
      if (shouldPoll && (result.ccbPath || result.ccbGerado)) {
        console.log('✅ [CCBViewer] CCB detectada, parando polling automático');
        setShouldPoll(false);
      }
      
      return result;
    }
  });

  // 📱 AUTO-OPEN: Se CCB já existe no mount, pode abrir viewer diretamente
  useEffect(() => {
    if (proposalData && (proposalData.ccbPath || proposalData.ccbGerado)) {
      console.log('🔍 [CCBViewer] CCB detectada no mount - interface pronta');
    }
  }, [proposalData]);
  
  // PAM V1.0: Compatibilidade - criar ccbStatus para não quebrar código existente
  const ccbStatus = proposalData ? {
    ccbPath: proposalData.ccbPath,
    signedUrl: proposalData.signedUrl,
    generatedAt: proposalData.generatedAt
  } : null;
  
  // PAM V1.0: Dados de CCB assinada extraídos da query principal
  const caminhoCcbAssinado = proposalData?.caminhoCcbAssinado;
  const dataAssinatura = proposalData?.dataAssinatura;

  // 🔥 CORREÇÃO: Mutation com polling inteligente para prevenir race condition
  const generateCCBMutation = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);
      setShouldPoll(true); // 🎯 Iniciar polling inteligente
      return apiRequest(`/api/propostas/${proposalId}/gerar-ccb`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: 'CCB em processamento...',
        description: 'O documento está sendo gerado. Aguarde alguns momentos.',
        variant: 'default',
      });

      // 🔧 Invalidar usando padrões padronizados
      invalidationPatterns.onFormalizacaoChange(proposalId).forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey });
      });
      
      // 🚨 CORREÇÃO PRINCIPAL: NÃO parar isGenerating imediatamente
      // setIsGenerating(false); // ❌ REMOVIDO - causava race condition
      
      // Parar isGenerating após delay, mas manter shouldPoll ativo
      setTimeout(() => {
        console.log('⏰ [CCBViewer] Parando indicador de geração, mantendo polling ativo');
        setIsGenerating(false);
      }, 3000); // Delay mais longo para UX melhor
      
      onCCBGenerated?.();
    },
    onError: (error: unknown) => {
      setIsGenerating(false);
      setShouldPoll(false);
      const errorMessage =
        error instanceof Error ? error.message : 'Ocorreu um erro ao gerar o documento.';
      toast({
        title: 'Erro ao gerar CCB',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  // 🔥 CORREÇÃO: Mutation de regeneração com polling inteligente
  const regenerateCCBMutation = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);
      setShouldPoll(true); // 🎯 Iniciar polling inteligente
      return apiRequest(`/api/propostas/${proposalId}/gerar-ccb`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: 'CCB sendo regenerado...',
        description: 'O documento está sendo regenerado com o novo template. Aguarde.',
        variant: 'default',
      });

      // 🔧 Invalidar usando padrões padronizados
      invalidationPatterns.onFormalizacaoChange(proposalId).forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey });
      });
      
      // 🚨 CORREÇÃO: NÃO parar isGenerating imediatamente
      setTimeout(() => {
        console.log('⏰ [CCBViewer] Parando indicador de regeneração, mantendo polling ativo');
        setIsGenerating(false);
      }, 3000); // Delay para UX melhor
    },
    onError: (error: unknown) => {
      setIsGenerating(false);
      setShouldPoll(false);
      const errorMessage =
        error instanceof Error ? error.message : 'Ocorreu um erro ao regenerar o documento.';
      toast({
        title: 'Erro ao regenerar CCB',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  // PAM V1.0: Nova mutação para buscar URL assinada do endpoint correto
  const fetchCcbUrlMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      console.log('🚀 [CCBViewer] Buscando URL assinada para proposta:', proposalId);
      return apiRequest(`/api/formalizacao/${proposalId}/ccb`);
    },
    onSuccess: (data: any) => {
      console.log('✅ [CCBViewer] URL assinada recebida:', data);
      if (data && data.signedUrl) {
        const urlWithTimestamp = `${data.signedUrl}&t=${Date.now()}`;
        console.log('🔗 [CCBViewer] Abrindo URL:', urlWithTimestamp);
        window.open(urlWithTimestamp, '_blank');
      } else {
        console.error('❌ [CCBViewer] API não retornou URL válida:', data);
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: 'A API não retornou uma URL válida para a CCB.',
        });
      }
    },
    onError: (error: any) => {
      console.error('❌ [CCBViewer] Erro ao buscar URL da CCB:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao buscar URL da CCB',
        description: error.message || 'Erro desconhecido ao buscar URL da CCB',
      });
    },
  });

  // PAM V1.0: Nova mutação para buscar URL assinada da CCB assinada
  const fetchCcbAssinadaUrlMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      console.log('🚀 [CCBViewer] Buscando URL da CCB assinada para proposta:', proposalId);
      return apiRequest(`/api/formalizacao/${proposalId}/ccb-assinada`);
    },
    onSuccess: (data: any) => {
      console.log('✅ [CCBViewer] URL da CCB assinada recebida:', data);
      if (data && data.publicUrl) {
        const urlWithTimestamp = `${data.publicUrl}&t=${Date.now()}`;
        console.log('🔗 [CCBViewer] Abrindo URL da CCB assinada:', urlWithTimestamp);
        window.open(urlWithTimestamp, '_blank');
      } else {
        console.error('❌ [CCBViewer] API não retornou URL válida para CCB assinada:', data);
        toast({
          variant: 'destructive',
          title: 'CCB Assinada não disponível',
          description: data?.message || 'O documento assinado ainda não está disponível',
        });
      }
    },
    onError: (error: any) => {
      console.error('❌ [CCBViewer] Erro ao buscar URL da CCB assinada:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao buscar CCB assinada',
        description: error.message || 'Erro desconhecido ao buscar CCB assinada',
      });
    },
  });

  // PAM V1.0: Handler refatorado para usar mutação - download CCB original
  const handleDownload = () => {
    console.log('🔽 [CCBViewer] Iniciando download da CCB original');
    fetchCcbUrlMutation.mutate(proposalId);
  };

  // PAM V1.0: Handler refatorado para usar mutação - visualizar CCB original
  const handleView = () => {
    console.log('👁️ [CCBViewer] Iniciando visualização da CCB original');
    fetchCcbUrlMutation.mutate(proposalId);
  };

  // PAM V1.0: Handler refatorado para usar mutação - visualizar CCB assinada
  const handleViewCCBAssinada = () => {
    console.log('👁️ [CCBViewer] Iniciando visualização da CCB assinada');
    fetchCcbAssinadaUrlMutation.mutate(proposalId);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Cédula de Crédito Bancário (CCB)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Cédula de Crédito Bancário (CCB)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>
              Erro ao carregar status do CCB. Por favor, tente novamente.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const hasCCB = ccbStatus && (ccbStatus.signedUrl || proposalData?.ccbGerado);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Cédula de Crédito Bancário (CCB)
        </CardTitle>
        <CardDescription>
          {hasCCB
            ? `Gerado em ${format(new Date(ccbStatus.generatedAt!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
            : 'Documento ainda não gerado'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasCCB ? (
          <div className="space-y-4">
            {/* Status de documento gerado */}
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                CCB gerado com sucesso e pronto para assinatura.
              </AlertDescription>
            </Alert>

            {/* Preview do PDF (opcional - pode usar iframe) */}
            <div className="rounded-lg border bg-gray-50 p-4">
              <p className="mb-3 text-sm text-gray-600">
                Documento disponível para visualização e download
              </p>

              {/* Ações do documento - PAM V1.0: Dois botões distintos */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleView}
                  disabled={fetchCcbUrlMutation.isPending}
                  className="flex items-center gap-2"
                  data-testid="button-view-ccb-original"
                >
                  {fetchCcbUrlMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  {fetchCcbUrlMutation.isPending ? 'Buscando...' : 'Ver CCB Original'}
                </Button>

                {/* PAM V1.0 CORREÇÃO: Todos os roles autorizados podem VER CCB assinada */}
                {proposalData?.caminhoCcbAssinado && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleViewCCBAssinada}
                    disabled={fetchCcbAssinadaUrlMutation.isPending}
                    className="flex items-center gap-2 border-green-600 text-green-600 hover:bg-green-50"
                    data-testid="button-view-ccb-assinada"
                  >
                    {fetchCcbAssinadaUrlMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Shield className="h-4 w-4" />
                    )}
                    {fetchCcbAssinadaUrlMutation.isPending ? 'Buscando...' : 'Ver CCB Assinada'}
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  disabled={fetchCcbUrlMutation.isPending}
                  className="flex items-center gap-2"
                  data-testid="button-download-ccb"
                >
                  {fetchCcbUrlMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {fetchCcbUrlMutation.isPending ? 'Buscando...' : 'Baixar PDF Original'}
                </Button>

                {/* PAM V1.0: Botão de download CCB assinada - EXCLUSIVO para ADMINISTRADOR */}
                {proposalData?.caminhoCcbAssinado && user?.role === 'ADMINISTRADOR' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const response = (await apiRequest(
                          `/api/formalizacao/${proposalId}/ccb-assinada`
                        )) as { publicUrl?: string };
                        if (response.publicUrl) {
                          // Forçar download ao invés de abrir em nova aba
                          const link = document.createElement('a');
                          link.href = response.publicUrl;
                          link.download = `CCB_Assinada_${proposalId}.pdf`;
                          link.click();
                        }
                      } catch (error) {
                        toast({
                          title: 'Erro ao baixar',
                          description: 'Erro ao baixar CCB assinada',
                          variant: 'destructive',
                        });
                      }
                    }}
                    className="flex items-center gap-2 border-purple-600 text-purple-600 hover:bg-purple-50"
                    data-testid="button-download-ccb-assinada"
                  >
                    <Download className="h-4 w-4" />
                    Baixar CCB Assinada
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => regenerateCCBMutation.mutate()}
                  disabled={regenerateCCBMutation.isPending || isGenerating}
                  className="flex items-center gap-2 border-blue-500 text-blue-600 hover:bg-blue-50"
                  data-testid="button-regenerate-ccb"
                >
                  <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  {isGenerating ? 'Gerando...' : 'Gerar CCB Novamente'}
                </Button>
              </div>
            </div>

            {/* Informações do documento */}
            <div className="space-y-1 text-xs text-gray-500">
              <p>• Documento preenchido com os dados da proposta</p>
              <p>• Pronto para envio à assinatura eletrônica</p>
              <p>• Formato PDF com campos permanentes</p>
              <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-3 text-blue-700">
                <p className="text-sm font-medium">✅ Nova Arquitetura CCB:</p>
                <p className="text-xs">
                  Agora usando pdf-lib para preservar 100% do template original com logo e
                  formatação.
                </p>
                <p className="mt-1 text-xs">
                  Clique em "Gerar CCB Novamente" para criar nova versão com dados atualizados.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Informação sobre geração */}
            <Alert>
              <AlertDescription>
                A CCB será gerada usando o template padrão com os dados da proposta. Este é o
                primeiro passo do processo de formalização.
              </AlertDescription>
            </Alert>

            {/* Botão para gerar */}
            <Button
              onClick={() => generateCCBMutation.mutate()}
              disabled={generateCCBMutation.isPending || isGenerating}
              className="w-full"
              data-testid="button-generate-ccb"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Gerando CCB...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Gerar CCB
                </>
              )}
            </Button>

            {/* Instruções */}
            <div className="space-y-1 text-xs text-gray-500">
              <p>• O documento será gerado automaticamente</p>
              <p>• Todos os campos serão preenchidos com os dados atuais</p>
              <p>• Após geração, você poderá visualizar e baixar o PDF</p>
              <div className="mt-3 rounded border border-yellow-200 bg-yellow-50 p-3 text-yellow-700">
                <p className="text-sm font-medium">📄 Template Original:</p>
                <p className="text-xs">
                  O sistema usará o template PDF personalizado da Simpix
                  (server/templates/template_ccb.pdf) e preencherá os campos em cima do documento
                  original.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
