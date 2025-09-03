import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Save, Send, FileImage, FileText, Eye } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/apiClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import CurrencyInput from '@/components/ui/CurrencyInput';
import HistoricoCompartilhado from '@/components/HistoricoCompartilhado';
import * as pdfjs from 'pdfjs-dist';

// Configurar worker path para pdfjs
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// Componente para preview de PDF
const PDFPreview: React.FC<{ url: string; className?: string }> = ({ url, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPDF = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const loadingTask = pdfjs.getDocument(url);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1); // Primeira página
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const context = canvas.getContext('2d');
        if (!context) return;
        
        // Calcular escala para fit no container
        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.min(120 / viewport.width, 160 / viewport.height);
        const scaledViewport = page.getViewport({ scale });
        
        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;
        
        const renderContext = {
          canvasContext: context,
          viewport: scaledViewport,
          canvas: canvas,
        };
        
        await page.render(renderContext).promise;
        setLoading(false);
      } catch (err) {
        console.error('Erro ao carregar PDF:', err);
        setError('Erro ao carregar preview do PDF');
        setLoading(false);
      }
    };

    loadPDF();
  }, [url]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-700 ${className}`}>
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-700 ${className}`}>
        <FileText className="h-8 w-8 text-gray-400" />
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center bg-white ${className}`}>
      <canvas ref={canvasRef} className="max-w-full max-h-full" />
    </div>
  );
};

// Componente para preview de documentos
const DocumentPreview: React.FC<{ 
  document: any; 
  className?: string;
  onClick?: () => void;
}> = ({ document, className = '', onClick }) => {
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(document.name || '');
  const isPDF = /\.pdf$/i.test(document.name || '');

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (document.url) {
      window.open(document.url, '_blank');
    }
  };

  if (isImage) {
    return (
      <div 
        className={`cursor-pointer overflow-hidden rounded-lg bg-gray-700 ${className}`}
        onClick={handleClick}
        data-testid="document-image-preview"
      >
        <img
          src={document.url}
          alt={document.name}
          className="h-full w-full object-cover transition-transform hover:scale-110"
          loading="lazy"
        />
      </div>
    );
  }

  if (isPDF) {
    return (
      <div 
        className={`cursor-pointer overflow-hidden rounded-lg ${className}`}
        onClick={handleClick}
        data-testid="document-pdf-preview"
      >
        <PDFPreview url={document.url} className="h-full w-full" />
      </div>
    );
  }

  // Arquivo genérico
  return (
    <div 
      className={`flex cursor-pointer items-center justify-center rounded-lg bg-gray-700 ${className}`}
      onClick={handleClick}
      data-testid="document-generic-preview"
    >
      <FileText className="h-8 w-8 text-gray-400" />
    </div>
  );
};

// Componente separado para documentos
const DocumentsTab: React.FC<{ propostaId: string }> = ({ propostaId }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: documentos, isLoading } = useQuery({
    queryKey: [`/api/propostas/${propostaId}/documents`],
    queryFn: async () => {
      const response = await api.get(`/api/propostas/${propostaId}/documents`);
      return response.data;
    },
    enabled: !!propostaId && propostaId.trim() !== '' && propostaId !== 'undefined',
  });

  // Mutation para upload de arquivo
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Usar o endpoint existente que faz upload e associa à proposta
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post(`/api/propostas/${propostaId}/documents`, formData);

      return response.data;
    },
    onSuccess: () => {
      toast({
        title: 'Documento enviado com sucesso!',
        description: 'O documento foi anexado à proposta.',
      });
      // Invalidar a query para recarregar a lista de documentos
      queryClient.invalidateQueries({ queryKey: [`/api/propostas/${propostaId}/documents`] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao enviar documento',
        description: error.message || 'Tente novamente em alguns instantes.',
        variant: 'destructive',
      });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file) => {
        uploadMutation.mutate(file);
      });
    }
  };

  if (isLoading) {
    return <div className="py-8 text-center text-gray-400">Carregando documentos...</div>;
  }

  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold text-blue-400">Documentos da Proposta</h3>

      {documentos?.documents && documentos.documents.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {documentos.documents.map((doc: any, index: number) => (
            <div
              key={index}
              className="group overflow-hidden rounded-lg border border-gray-700 bg-gray-800 transition-all hover:border-blue-500 hover:shadow-lg"
              data-testid={`document-card-${index}`}
            >
              {/* Preview da miniatura */}
              <div className="aspect-[4/3] w-full">
                <DocumentPreview 
                  document={doc} 
                  className="h-full w-full"
                  onClick={() => doc.url && window.open(doc.url, '_blank')}
                />
              </div>
              
              {/* Informações do documento */}
              <div className="p-3">
                <div className="mb-2">
                  <p className="truncate text-sm font-medium text-white" title={doc.name || doc.nome || `Documento ${index + 1}`}>
                    {doc.name || doc.nome || `Documento ${index + 1}`}
                  </p>
                  <p className="text-xs text-gray-400">
                    {doc.size ? `${(doc.size / 1024).toFixed(1)} KB` : 'Tamanho não especificado'}
                  </p>
                </div>
                
                {/* Botões de ação */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => doc.url && window.open(doc.url, '_blank')}
                    data-testid="button-view-document"
                  >
                    <Eye className="mr-1 h-3 w-3" />
                    Ver
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="text-xs" 
                    disabled
                    data-testid="button-remove-document"
                  >
                    Remover
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-gray-400">
          <FileText className="mx-auto mb-4 h-12 w-12" />
          <p className="text-lg font-medium">Nenhum documento encontrado</p>
          <p className="text-sm">Adicione documentos usando a área de upload abaixo</p>
        </div>
      )}

      <div className="mt-4 rounded-lg border-2 border-dashed border-gray-600 p-6 text-center">
        <input
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          id="file-upload"
          onChange={handleFileUpload}
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="text-gray-400">
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin" />
                <p className="text-sm font-medium">Enviando documento...</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">Clique para adicionar novos documentos</p>
                <p className="mt-1 text-xs">PDF, JPG, JPEG, PNG (máx. 10MB cada)</p>
              </>
            )}
          </div>
        </label>
      </div>
    </div>
  );
};

interface PropostaData {
  id: string;
  status: string;
  motivoPendencia?: string;
  clienteData?: any;
  condicoesData?: any;
  documentosAnexados?: any[];
  // Related entities
  loja?: { id: number; nomeLoja: string };
  parceiro?: { id: number; razaoSocial: string };
  produto?: { id: number; nomeProduto: string; tacValor?: string; tacTipo?: string };
  tabelaComercial?: {
    id: number;
    nomeTabela: string;
    taxaJuros: string;
    prazos: number[];
    comissao: string;
  };
  // Metadata
  createdAt?: string;
  analistaId?: string;
  dataAnalise?: string;
}

const EditarPropostaPendenciada: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // TODOS OS HOOKS DEVEM ESTAR NO TOPO - ANTES DE QUALQUER RETURN CONDICIONAL
  const [activeTab, setActiveTab] = useState('dados-cliente');

  // Estado inicial para os formulários
  const [formData, setFormData] = useState({
    clienteData: {},
    condicoesData: {},
  });

  // Buscar dados da proposta - APENAS reativa (sem polling)
  const {
    data: proposta,
    isLoading,
    error,
  } = useQuery({
    queryKey: [`/api/propostas/${id}`],
    queryFn: async () => {
      const response = await api.get(`/api/propostas/${id}`);
      // CORREÇÃO: Backend retorna { success: true, data: {...} }, precisamos acessar response.data.data
      const propostaData = response.data.data || response.data;
      return propostaData as PropostaData;
    },
    enabled: !!id && id.trim() !== '' && id !== 'undefined', // Validação mais robusta
    refetchOnWindowFocus: false, // Desabilitado para evitar rate limiting
    refetchOnReconnect: true,
    staleTime: 5 * 60 * 1000, // 5 minutos - dados ficam válidos por mais tempo
  });

  // Atualizar formData quando proposta carrega
  useEffect(() => {
    if (proposta) {
      console.log('🔍 DADOS DA PROPOSTA CARREGADA:', {
        clienteData: proposta.clienteData,
        cliente_data: (proposta as any).cliente_data,
        condicoesData: proposta.condicoesData,
        condicoes_data: (proposta as any).condicoes_data,
      });
      
      // Normalizar dados de cliente (suportar ambas estruturas clienteData e cliente_data)
      const clienteData = {
        ...(proposta.clienteData || {}),
        ...((proposta as any).cliente_data || {}),
        // Garantir que campos obrigatórios tenham valores
        nome: proposta.clienteData?.nome?.value || 
              proposta.clienteData?.nome || 
              (proposta as any).cliente_data?.nome?.value ||
              (proposta as any).cliente_data?.nome || '',
        cpf: proposta.clienteData?.cpf?.value || 
             proposta.clienteData?.cpf || 
             (proposta as any).cliente_data?.cpf?.value ||
             (proposta as any).cliente_data?.cpf || '',
        email: proposta.clienteData?.email?.value || 
               proposta.clienteData?.email || 
               (proposta as any).cliente_data?.email?.value ||
               (proposta as any).cliente_data?.email || '',
        telefone: proposta.clienteData?.telefone?.value || 
                  proposta.clienteData?.telefone || 
                  (proposta as any).cliente_data?.telefone?.value ||
                  (proposta as any).cliente_data?.telefone || '',
      };

      // Normalizar dados de condições
      const condicoesData = {
        ...(proposta.condicoesData || {}),
        ...((proposta as any).condicoes_data || {}),
      };
      
      setFormData({
        clienteData,
        condicoesData,
      });
    }
  }, [proposta]);

  // Mutation para salvar alterações (dados da proposta)
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('🔍 SALVANDO ALTERAÇÕES:', data);
      const response = await api.put(`/api/propostas/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: 'Alterações salvas',
        description: 'As alterações foram salvas com sucesso.',
      });
      // Invalidar múltiplas queries para atualização completa
      queryClient.invalidateQueries({ queryKey: [`/api/propostas/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/propostas/${id}/observacoes`] });
      queryClient.invalidateQueries({ queryKey: ['/api/propostas'] });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.message ||
        error?.response?.data?.message ||
        (typeof error === 'object' ? JSON.stringify(error) : String(error)) ||
        'Erro desconhecido';
      console.error('🔍 ERRO AO SALVAR:', { error, errorMessage });
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: errorMessage,
      });
    },
  });

  // Mutation para reenviar proposta (mudança de status)
  const resubmitMutation = useMutation({
    mutationFn: async () => {
      // Primeiro salva as alterações se houver
      if (
        Object.keys(formData.clienteData).length > 0 ||
        Object.keys(formData.condicoesData).length > 0
      ) {
        await api.put(`/api/propostas/${id}`, {
          cliente_data: formData.clienteData,
          condicoes_data: formData.condicoesData,
        });
      }

      // Usar endpoint específico para reenviar propostas pendentes
      const response = await api.put(`/api/propostas/${id}/resubmit`);
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: 'Proposta reenviada',
        description: 'A proposta foi reenviada para análise com sucesso.',
      });
      // Invalidar todas as queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['/api/propostas'] });
      queryClient.invalidateQueries({ queryKey: [`/api/propostas/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/propostas/${id}/observacoes`] });
      queryClient.invalidateQueries({ queryKey: ['proposta'] });
      setLocation('/dashboard');
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.error ||
        error?.message ||
        'Erro ao reenviar proposta';
      toast({
        variant: 'destructive',
        title: 'Erro ao reenviar',
        description: errorMessage,
      });
    },
  });

  // CÁLCULOS AUTOMÁTICOS - POSICIONADO CORRETAMENTE ANTES DOS RETURNS
  useEffect(() => {
    if (!proposta?.tabelaComercial?.taxaJuros) return;

    const valor = parseFloat((formData.condicoesData as any)?.valor?.replace(/[^\d,]/g, '')?.replace(',', '.') || '0');
    const prazo = parseInt((formData.condicoesData as any)?.prazo || '0');
    const taxaJuros = parseFloat(proposta.tabelaComercial.taxaJuros);

    if (valor > 0 && prazo > 0 && taxaJuros > 0) {
      const tacPercentual = 3;
      const valorTac = (valor * tacPercentual / 100);
      const iofMensal = 0.38;
      const iofDiario = 0.0082;
      const diasPorMes = 30;
      const iofTotal = (valor * (iofMensal + (iofDiario * prazo * diasPorMes)) / 100);
      const valorTotalFinanciado = valor + valorTac + iofTotal;
      const taxaMensal = taxaJuros / 100;
      const fatorJuros = Math.pow(1 + taxaMensal, prazo);
      const valorParcela = (valorTotalFinanciado * taxaMensal * fatorJuros) / (fatorJuros - 1);

      setFormData((prev) => ({
        ...prev,
        condicoesData: {
          ...prev.condicoesData,
          valorTac: valorTac.toFixed(2),
          valorIof: iofTotal.toFixed(2),
          valorTotalFinanciado: valorTotalFinanciado.toFixed(2),
          valorParcela: valorParcela.toFixed(2),
        },
      }));
    }
  }, [formData.condicoesData, proposta?.tabelaComercial?.taxaJuros]);

  console.log('🔍 COMPONENTE INICIADO com ID:', id);

  // Validação early return para IDs inválidos - AGORA DEPOIS DOS HOOKS
  if (!id || id.trim() === '' || id === 'undefined' || id === 'null') {
    console.log('🔍 ID INVÁLIDO DETECTADO:', id, ' - redirecionando para dashboard');
    return (
      <DashboardLayout title="Erro">
        <Alert variant="destructive">
          <AlertDescription>
            ID de proposta inválido. Redirecionando para o dashboard...
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  if (isLoading) {
    return (
      <DashboardLayout title="Editar Proposta Pendenciada">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !proposta) {
    const errorMessage =
      error?.message ||
      (typeof error === 'object' ? JSON.stringify(error) : String(error)) ||
      'Proposta não encontrada';
    console.log('🔍 ERRO OU PROPOSTA VAZIA:', { error, proposta, errorMessage });
    return (
      <DashboardLayout title="Editar Proposta Pendenciada">
        <Alert variant="destructive">
          <AlertDescription>
            Erro ao carregar proposta. Por favor, tente novamente.
            <br />
            <small>Debug: {errorMessage}</small>
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button onClick={() => window.location.reload()}>🔄 Recarregar</Button>
          <Button onClick={() => setLocation('/dashboard')} variant="outline" className="ml-2">
            Voltar ao Dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // DEBUG: Log para verificar status
  console.log('🔍 STATUS DEBUG CORRIGIDO:', {
    propostaStatus: proposta.status,
    statusType: typeof proposta.status,
    statusLength: proposta.status?.length,
    expectedStatus: 'pendenciado',
    isEqual: proposta.status === 'pendenciado',
    statusAsString: String(proposta.status),
    propostaCompleta: proposta,
  });

  // Verificar se a proposta está pendenciada (tratamento universal de tipos)
  const statusString = String(proposta.status || '').trim();
  if (statusString !== 'pendenciado' && statusString !== 'pendente') {
    return (
      <DashboardLayout title="Editar Proposta">
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <AlertCircle className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
                <h2 className="mb-2 text-xl font-semibold">Proposta não editável</h2>
                <p className="mb-4 text-gray-400">
                  Esta proposta está com status "{proposta.status}" e só pode ser editada quando
                  estiver "pendenciado" ou "pendente".
                </p>
                <p className="mb-4 text-sm text-gray-500">
                  Status atual:{' '}
                  <span className="rounded bg-gray-800 px-2 py-1 font-mono">"{statusString}"</span>
                </p>
                <p className="mb-4 text-xs text-gray-600">
                  Debug: raw={JSON.stringify(proposta.status)}, type={typeof proposta.status}
                </p>
                <div className="flex justify-center gap-2">
                  <Button
                    onClick={() => {
                      // Force refresh data
                      queryClient.invalidateQueries({ queryKey: [`/api/propostas/${id}`] });
                      window.location.reload();
                    }}
                    variant="secondary"
                  >
                    🔄 Recarregar Página
                  </Button>
                  <Button onClick={() => setLocation('/dashboard')} variant="outline">
                    Voltar ao Dashboard
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const handleClientChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      clienteData: {
        ...prev.clienteData,
        [field]: value,
      },
    }));
  };

  const handleCondicoesChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      condicoesData: {
        ...prev.condicoesData,
        [field]: value,
      },
    }));
  };


  const handleSave = () => {
    updateMutation.mutate({
      cliente_data: formData.clienteData,
      condicoes_data: formData.condicoesData,
    });
  };

  const handleResubmit = async () => {
    // Primeiro salvar se houver alterações, depois reenviar
    try {
      if (
        Object.keys(formData.clienteData).length > 0 ||
        Object.keys(formData.condicoesData).length > 0
      ) {
        // Aguardar salvamento completar antes de reenviar
        await updateMutation.mutateAsync({
          cliente_data: formData.clienteData,
          condicoes_data: formData.condicoesData,
        });
      }
      
      // Agora reenviar para análise
      resubmitMutation.mutate();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as alterações antes do reenvio.',
      });
    }
  };

  return (
    <DashboardLayout title="Editar Proposta Pendenciada">
      <div className="space-y-6">
        {/* Alerta de pendência */}
        {proposta?.motivoPendencia && (
          <Alert className="border-yellow-500 bg-yellow-950/20">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-yellow-200">
              <strong>Motivo da pendência:</strong> {proposta.motivoPendencia}
            </AlertDescription>
          </Alert>
        )}

        {/* Histórico de Comunicação - Compartilhado V2 */}
        <HistoricoCompartilhado propostaId={id!} context="edicao" />

        {/* Informações da proposta */}
        <Card>
          <CardHeader>
            <CardTitle>Proposta #{proposta?.id}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              <div>
                <span className="font-medium">Cliente:</span>{' '}
                {(formData.clienteData as any)?.nome || 
                 proposta?.clienteData?.nome?.value || 
                 proposta?.clienteData?.nome || 
                 (proposta as any)?.cliente_data?.nome?.value ||
                 (proposta as any)?.cliente_data?.nome ||
                 'Nome não informado'}
              </div>
              <div>
                <span className="font-medium">CPF:</span>{' '}
                {(formData.clienteData as any)?.cpf?.value || 
                 (formData.clienteData as any)?.cpf || 
                 proposta?.clienteData?.cpf?.value ||
                 proposta?.clienteData?.cpf ||
                 (proposta as any)?.cliente_data?.cpf?.value ||
                 (proposta as any)?.cliente_data?.cpf ||
                 'CPF não informado'}
              </div>
              <div>
                <span className="font-medium">Valor Solicitado:</span> R${' '}
                {(formData.condicoesData as any)?.valor?.cents ? 
                  ((formData.condicoesData as any)?.valor?.cents / 100).toFixed(2) : 
                  (formData.condicoesData as any)?.valor || 0}
              </div>
              <div>
                <span className="font-medium">Prazo:</span>{' '}
                {(formData.condicoesData as any)?.prazo || 0} meses
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs de edição */}
        <Card>
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dados-cliente">Dados do Cliente</TabsTrigger>
                <TabsTrigger value="condicoes">Condições do Crédito</TabsTrigger>
                <TabsTrigger value="documentos">Documentos</TabsTrigger>
              </TabsList>

              <TabsContent value="dados-cliente" className="mt-6 space-y-6">
                {/* Dados Pessoais */}
                <div>
                  <h3 className="mb-4 text-lg font-semibold text-blue-400">Dados Pessoais</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="nome">Nome Completo *</Label>
                      <Input
                        id="nome"
                        value={(formData.clienteData as any)?.nome || ''}
                        onChange={(e) => handleClientChange('nome', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cpf">CPF *</Label>
                      <Input
                        id="cpf"
                        value={(formData.clienteData as any)?.cpf?.value || (formData.clienteData as any)?.cpf || ''}
                        onChange={(e) => handleClientChange('cpf', e.target.value)}
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="rg">RG</Label>
                      <Input
                        id="rg"
                        value={(formData.clienteData as any)?.rg || ''}
                        onChange={(e) => handleClientChange('rg', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="orgaoEmissor">Órgão Emissor</Label>
                      <Input
                        id="orgaoEmissor"
                        value={(formData.clienteData as any)?.orgaoEmissor || ''}
                        onChange={(e) => handleClientChange('orgaoEmissor', e.target.value)}
                        placeholder="SSP/SP"
                      />
                    </div>
                    <div>
                      <Label htmlFor="dataNascimento">Data de Nascimento</Label>
                      <Input
                        id="dataNascimento"
                        type="date"
                        value={(formData.clienteData as any)?.dataNascimento || ''}
                        onChange={(e) => handleClientChange('dataNascimento', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="estadoCivil">Estado Civil</Label>
                      <Input
                        id="estadoCivil"
                        value={(formData.clienteData as any)?.estadoCivil || ''}
                        onChange={(e) => handleClientChange('estadoCivil', e.target.value)}
                        placeholder="Solteiro, Casado, etc."
                      />
                    </div>
                    <div>
                      <Label htmlFor="nacionalidade">Nacionalidade</Label>
                      <Input
                        id="nacionalidade"
                        value={(formData.clienteData as any)?.nacionalidade || ''}
                        onChange={(e) => handleClientChange('nacionalidade', e.target.value)}
                        placeholder="Brasileira"
                      />
                    </div>
                  </div>
                </div>

                {/* Contato */}
                <div>
                  <h3 className="mb-4 text-lg font-semibold text-blue-400">Contato</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">E-mail *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={(formData.clienteData as any)?.email?.value || (formData.clienteData as any)?.email || ''}
                        onChange={(e) => handleClientChange('email', e.target.value)}
                        placeholder="cliente@email.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="telefone">Telefone *</Label>
                      <Input
                        id="telefone"
                        value={(formData.clienteData as any)?.telefone?.value || (formData.clienteData as any)?.telefone || ''}
                        onChange={(e) => handleClientChange('telefone', e.target.value)}
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                  </div>
                </div>

                {/* Endereço */}
                <div>
                  <h3 className="mb-4 text-lg font-semibold text-blue-400">Endereço</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="cep">CEP</Label>
                      <Input
                        id="cep"
                        value={(formData.clienteData as any)?.cep?.value || (formData.clienteData as any)?.cep || ''}
                        onChange={(e) => handleClientChange('cep', e.target.value)}
                        placeholder="00000-000"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="endereco">Endereço Completo</Label>
                      <Textarea
                        id="endereco"
                        value={(formData.clienteData as any)?.endereco || ''}
                        onChange={(e) => handleClientChange('endereco', e.target.value)}
                        rows={3}
                        placeholder="Rua, número, bairro, cidade, estado"
                      />
                    </div>
                  </div>
                </div>

                {/* Dados Profissionais */}
                <div>
                  <h3 className="mb-4 text-lg font-semibold text-blue-400">Dados Profissionais</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="ocupacao">Ocupação *</Label>
                      <Input
                        id="ocupacao"
                        value={
                          (formData.clienteData as any)?.ocupacao ||
                          (formData.clienteData as any)?.profissao ||
                          ''
                        }
                        onChange={(e) => handleClientChange('ocupacao', e.target.value)}
                        placeholder="Profissão do cliente"
                      />
                    </div>
                    <div>
                      <Label htmlFor="renda">Renda Mensal *</Label>
                      <CurrencyInput
                        id="renda"
                        value={
                          (formData.clienteData as any)?.rendaMensal?.cents ? 
                            ((formData.clienteData as any)?.rendaMensal?.cents / 100).toString() :
                          (formData.clienteData as any)?.renda?.cents ? 
                            ((formData.clienteData as any)?.renda?.cents / 100).toString() :
                          (formData.clienteData as any)?.renda ||
                          (formData.clienteData as any)?.rendaMensal ||
                          ''
                        }
                        onChange={(e) => handleClientChange('renda', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="condicoes" className="mt-6 space-y-6">
                {/* Valores do Empréstimo */}
                <div>
                  <h3 className="mb-4 text-lg font-semibold text-blue-400">
                    Valores do Empréstimo
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="valor">Valor Solicitado *</Label>
                      <CurrencyInput
                        id="valor"
                        value={(formData.condicoesData as any)?.valor?.cents ? 
                          ((formData.condicoesData as any)?.valor?.cents / 100).toString() :
                          (formData.condicoesData as any)?.valor || ''}
                        onChange={(e) => handleCondicoesChange('valor', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="prazo">Prazo (meses) *</Label>
                      <Input
                        id="prazo"
                        type="number"
                        min="1"
                        max="120"
                        value={(formData.condicoesData as any)?.prazo || ''}
                        onChange={(e) => handleCondicoesChange('prazo', e.target.value)}
                        placeholder="12"
                      />
                    </div>
                    <div>
                      <Label htmlFor="valorTac">Valor TAC</Label>
                      <CurrencyInput
                        id="valorTac"
                        value={(formData.condicoesData as any)?.valorTac || ''}
                        onChange={(e) => handleCondicoesChange('valorTac', e.target.value)}
                        placeholder="Será calculado automaticamente"
                      />
                    </div>
                    <div>
                      <Label htmlFor="valorIof">Valor IOF</Label>
                      <CurrencyInput
                        id="valorIof"
                        value={(formData.condicoesData as any)?.valorIof || ''}
                        onChange={(e) => handleCondicoesChange('valorIof', e.target.value)}
                        placeholder="Será calculado automaticamente"
                      />
                    </div>
                    <div>
                      <Label htmlFor="valorTotalFinanciado">Valor Total Financiado</Label>
                      <CurrencyInput
                        id="valorTotalFinanciado"
                        value={(formData.condicoesData as any)?.valorTotalFinanciado || ''}
                        onChange={(e) =>
                          handleCondicoesChange('valorTotalFinanciado', e.target.value)
                        }
                        placeholder="Será calculado automaticamente"
                      />
                    </div>
                    <div>
                      <Label htmlFor="valorParcela">Valor da Parcela</Label>
                      <CurrencyInput
                        id="valorParcela"
                        value={(formData.condicoesData as any)?.valorParcela || ''}
                        onChange={(e) => handleCondicoesChange('valorParcela', e.target.value)}
                        placeholder="Será calculado automaticamente"
                      />
                    </div>
                  </div>
                </div>

                {/* Tabela e Produto */}
                <div>
                  <h3 className="mb-4 text-lg font-semibold text-blue-400">Produto e Tabela</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="produto">Produto</Label>
                      <Input
                        id="produto"
                        value={proposta?.produto?.nomeProduto || 
                               (proposta?.produto as any)?.nome ||
                               'Produto não definido'}
                        placeholder="Será calculado automaticamente"
                        className="bg-gray-800"
                      />
                    </div>
                    <div>
                      <Label htmlFor="tabelaComercial">Tabela Comercial</Label>
                      <Input
                        id="tabelaComercial"
                        value={proposta?.tabelaComercial?.nomeTabela ||
                               (proposta?.tabelaComercial as any)?.nome ||
                               'Tabela não definida'}
                        placeholder="Será calculado automaticamente"
                        className="bg-gray-800"
                      />
                    </div>
                    <div>
                      <Label htmlFor="taxaJuros">Taxa de Juros (%)</Label>
                      <Input
                        id="taxaJuros"
                        value={proposta?.tabelaComercial?.taxaJuros || ''}
                        placeholder="Será calculado automaticamente"
                        className="bg-gray-800"
                      />
                    </div>
                    <div>
                      <Label htmlFor="comissao">Comissão (%)</Label>
                      <Input
                        id="comissao"
                        value={proposta?.tabelaComercial?.comissao || ''}
                        placeholder="Será calculado automaticamente"
                        className="bg-gray-800"
                      />
                    </div>
                  </div>
                </div>

                {/* Finalidade e Garantia */}
                <div>
                  <h3 className="mb-4 text-lg font-semibold text-blue-400">
                    Detalhes do Empréstimo
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="finalidade">Finalidade *</Label>
                      <Input
                        id="finalidade"
                        value={(formData.condicoesData as any)?.finalidade || ''}
                        onChange={(e) => handleCondicoesChange('finalidade', e.target.value)}
                        placeholder="Capital de giro, aquisição de equipamentos, etc."
                      />
                    </div>
                    <div>
                      <Label htmlFor="garantia">Garantia</Label>
                      <Input
                        id="garantia"
                        value={(formData.condicoesData as any)?.garantia || ''}
                        onChange={(e) => handleCondicoesChange('garantia', e.target.value)}
                        placeholder="Sem garantia, aval, etc."
                      />
                    </div>
                  </div>
                </div>

                {/* Observações */}
                <div>
                  <h3 className="mb-4 text-lg font-semibold text-blue-400">Observações</h3>
                  <div>
                    <Label htmlFor="observacoes">Observações Adicionais</Label>
                    <Textarea
                      id="observacoes"
                      value={(formData.condicoesData as any)?.observacoes || ''}
                      onChange={(e) => handleCondicoesChange('observacoes', e.target.value)}
                      rows={4}
                      placeholder="Informações adicionais sobre o empréstimo..."
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="documentos" className="mt-6 space-y-4">
                <DocumentsTab propostaId={id!} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Botões de ação */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setLocation('/dashboard')}>
            Cancelar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar Alterações
            </Button>
            <Button
              className="btn-simpix-accent"
              onClick={handleResubmit}
              disabled={resubmitMutation.isPending}
            >
              {resubmitMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Reenviar para Análise
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default EditarPropostaPendenciada;
