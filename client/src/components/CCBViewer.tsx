/**
 * Componente para visualização e gerenciamento de CCB
 */

import { useState } from 'react';
import { FileText, Download, RefreshCw, Eye, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';

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
  const queryClient = useQueryClient();

  // Query para buscar status do CCB
  const { data: ccbStatus, isLoading, error } = useQuery<CCBStatus>({
    queryKey: ['ccb', proposalId],
    queryFn: async () => {
      const response = await fetch(`/api/formalizacao/${proposalId}/ccb`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        throw new Error('Erro ao buscar CCB');
      }
      
      return response.json();
    },
    refetchInterval: isGenerating ? 2000 : false // Poll enquanto gera
  });

  // Mutation para gerar CCB
  const generateCCBMutation = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);
      return apiRequest('/api/formalizacao/generate-ccb', {
        method: 'POST',
        body: JSON.stringify({ proposalId })
      });
    },
    onSuccess: () => {
      toast({
        title: 'CCB Gerado!',
        description: 'O documento foi gerado com sucesso.',
        variant: 'default'
      });
      
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['ccb', proposalId] });
      queryClient.invalidateQueries({ queryKey: ['proposta', proposalId] });
      queryClient.invalidateQueries({ queryKey: ['formalizacao-status', proposalId] });
      
      setIsGenerating(false);
      onCCBGenerated?.();
    },
    onError: (error: any) => {
      setIsGenerating(false);
      toast({
        title: 'Erro ao gerar CCB',
        description: error.message || 'Ocorreu um erro ao gerar o documento.',
        variant: 'destructive'
      });
    }
  });

  // Mutation para regenerar CCB
  const regenerateCCBMutation = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);
      return apiRequest(`/api/formalizacao/${proposalId}/regenerate-ccb`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast({
        title: 'CCB Regenerado!',
        description: 'O documento foi regenerado com sucesso.',
        variant: 'default'
      });
      
      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ['ccb', proposalId] });
      queryClient.invalidateQueries({ queryKey: ['proposta', proposalId] });
      
      setIsGenerating(false);
    },
    onError: (error: any) => {
      setIsGenerating(false);
      toast({
        title: 'Erro ao regenerar CCB',
        description: error.message || 'Ocorreu um erro ao regenerar o documento.',
        variant: 'destructive'
      });
    }
  });

  const handleDownload = () => {
    if (ccbStatus?.signedUrl) {
      window.open(ccbStatus.signedUrl, '_blank');
    }
  };

  const handleView = () => {
    if (ccbStatus?.signedUrl) {
      window.open(ccbStatus.signedUrl, '_blank');
    }
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

  const hasCCB = ccbStatus && ccbStatus.signedUrl;

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
            : 'Documento ainda não gerado'
          }
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
            <div className="border rounded-lg p-4 bg-gray-50">
              <p className="text-sm text-gray-600 mb-3">
                Documento disponível para visualização e download
              </p>
              
              {/* Ações do documento */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleView}
                  className="flex items-center gap-2"
                  data-testid="button-view-ccb"
                >
                  <Eye className="h-4 w-4" />
                  Visualizar
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="flex items-center gap-2"
                  data-testid="button-download-ccb"
                >
                  <Download className="h-4 w-4" />
                  Baixar PDF
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => regenerateCCBMutation.mutate()}
                  disabled={regenerateCCBMutation.isPending || isGenerating}
                  className="flex items-center gap-2"
                  data-testid="button-regenerate-ccb"
                >
                  <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  Regenerar
                </Button>
              </div>
            </div>

            {/* Informações do documento */}
            <div className="text-xs text-gray-500 space-y-1">
              <p>• Documento preenchido com os dados da proposta</p>
              <p>• Pronto para envio à assinatura eletrônica</p>
              <p>• Formato PDF com campos permanentes</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Informação sobre geração */}
            <Alert>
              <AlertDescription>
                A CCB será gerada usando o template padrão com os dados da proposta.
                Este é o primeiro passo do processo de formalização.
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
            <div className="text-xs text-gray-500 space-y-1">
              <p>• O documento será gerado automaticamente</p>
              <p>• Todos os campos serão preenchidos com os dados atuais</p>
              <p>• Após geração, você poderá visualizar e baixar o PDF</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}