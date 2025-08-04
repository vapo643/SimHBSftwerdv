import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  Clock,
  FileText,
  AlertCircle,
  User,
  CreditCard,
  Download,
  Upload,
  Edit,
  Send,
  ArrowLeft,
  Calendar,
  DollarSign,
  Shield,
  Percent,
  Activity,
  Eye,
  MessageSquare,
  FileCheck,
  Signature,
  TrendingUp,
  Building2,
  Printer,
  Copy,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import RefreshButton from "@/components/RefreshButton";
import { useAuth } from "@/contexts/AuthContext";
import { EtapaFormalizacaoControl } from "@/components/propostas/EtapaFormalizacaoControl";
import { DocumentViewer } from "@/components/DocumentViewer";

interface Proposta {
  id: string;
  status: string;
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
  ccbGerado: boolean;
  assinaturaEletronicaConcluida: boolean;
  biometriaConcluida: boolean;
  caminhoCcbAssinado?: string;
  interBoletoGerado?: boolean;
  interCodigoSolicitacao?: string;
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
}

const updateFormalizacaoSchema = z.object({
  status: z
    .enum([
      "documentos_enviados",
      "contratos_preparados",
      "contratos_assinados",
      "pronto_pagamento",
      "pago",
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

  const { data: propostas, isLoading, error } = useQuery<Proposta[]>({
    queryKey: ["/api/propostas/formalizacao"],
    queryFn: async () => {
      console.log("Fazendo requisição para /api/propostas/formalizacao");
      const response = await apiRequest("/api/propostas/formalizacao");
      console.log("Resposta do endpoint formalizacao:", response);
      
      // PARSING DEFENSIVO: Garantir que dados JSONB sejam objetos
      const propostsWithParsedData = response.map((proposta: any) => ({
        ...proposta,
        cliente_data: parseJsonbField(proposta.cliente_data, 'cliente_data', proposta.id),
        condicoes_data: parseJsonbField(proposta.condicoes_data, 'condicoes_data', proposta.id)
      }));
      
      console.log("Propostas com dados parseados:", propostsWithParsedData);
      return propostsWithParsedData;
    }
  });

  // Debug: log error if any
  if (error) {
    console.error("Erro na query de formalização:", error);
  }

  const formatCurrency = (value: string | number) => {
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(numValue);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const getStatusColor = (status: string) => {
    const statusColors = {
      aprovado: "bg-green-500",
      documentos_enviados: "bg-blue-500",
      contratos_preparados: "bg-purple-500",
      contratos_assinados: "bg-indigo-500",
      pronto_pagamento: "bg-orange-500",
      pago: "bg-green-600",
    };
    return statusColors[status as keyof typeof statusColors] || "bg-gray-500";
  };

  const getStatusText = (status: string) => {
    const statusTexts = {
      aprovado: "Aprovado",
      documentos_enviados: "Documentos Enviados",
      contratos_preparados: "Contratos Preparados",
      contratos_assinados: "Contratos Assinados",
      pronto_pagamento: "Pronto para Pagamento",
      pago: "Pago",
    };
    return statusTexts[status as keyof typeof statusTexts] || status;
  };

  // Backend already handles all permission filtering
  const formalizacaoPropostas = propostas || [];

  if (isLoading) {
    return (
      <DashboardLayout title="Formalização">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, index) => (
            <Card key={index} className="animate-pulse bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
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
    queryClient.invalidateQueries({ queryKey: ['/api/propostas/formalizacao'] });
  };

  const getTitle = () => {
    return "Propostas em Formalização";
  };

  const getDescription = () => {
    return "Acompanhe o processo de formalização das propostas aprovadas";
  };

  return (
    <DashboardLayout 
      title={getTitle()}
      actions={
        <RefreshButton 
          onRefresh={handleRefresh}
          isLoading={isLoading}
          variant="ghost"
        />
      }
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{getTitle()}</h1>
            <p className="text-gray-600 dark:text-gray-400">
              {getDescription()}
            </p>

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
            { status: "aprovado", label: "Aprovado", color: "bg-green-400" },
            { status: "documentos_enviados", label: "Docs Enviados", color: "bg-blue-500" },
            { status: "contratos_preparados", label: "Contratos Prep.", color: "bg-purple-500" },
            { status: "contratos_assinados", label: "Assinados", color: "bg-indigo-500" },
            { status: "pronto_pagamento", label: "Pronto Pag.", color: "bg-orange-500" },
          ].map(item => {
            const count = formalizacaoPropostas.filter(p => p.status === item.status).length;
            return (
              <Card key={item.status} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className={`h-3 w-3 rounded-full ${item.color}`}></div>
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{count}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{item.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Propostas List */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {formalizacaoPropostas.map(proposta => (
            <Card key={proposta.id} className="cursor-pointer transition-shadow hover:shadow-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">#{proposta.id}</h3>
                  <Badge className={`${getStatusColor(proposta.status)} text-white`}>
                    {getStatusText(proposta.status)}
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Cliente</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {parseJsonbField(proposta.cliente_data, 'cliente_data', proposta.id)?.nome || 'Nome não informado'}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Valor Aprovado</p>
                    <p className="font-bold text-green-400">
                      {formatCurrency(parseJsonbField(proposta.condicoes_data, 'condicoes_data', proposta.id)?.valor || 0)}
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
                    variant={user?.role === 'ATENDENTE' && 
                            (proposta.status === 'aprovado' || proposta.status === 'documentos_enviados') 
                            ? "default" : "outline"}
                  >
                    {user?.role === 'ATENDENTE' && 
                     (proposta.status === 'aprovado' || proposta.status === 'documentos_enviados')
                      ? "Ação Necessária" : "Acompanhar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
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
  const [, params] = useRoute("/formalizacao/acompanhamento/:id");
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"timeline" | "documents" | "contracts">("timeline");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [ccbUrl, setCcbUrl] = useState<string | null>(null);
  const [showCcbViewer, setShowCcbViewer] = useState(false);
  const [clickSignData, setClickSignData] = useState<any>(null);
  const [loadingClickSign, setLoadingClickSign] = useState(false);
  const [useBiometricAuth, setUseBiometricAuth] = useState(false);
  const [interBoletoData, setInterBoletoData] = useState<any>(null);
  const [loadingInter, setLoadingInter] = useState(false);
  const [boletosGerados, setBoletosGerados] = useState<any[]>([]);
  
  const propostaId = params?.id;

  // Query para buscar boletos gerados
  const { data: collectionsData } = useQuery({
    queryKey: ["/api/inter/collections", propostaId],
    queryFn: async () => {
      if (!propostaId) return [];
      const response = await apiRequest(`/api/inter/collections/${propostaId}`);
      return response;
    },
    enabled: !!propostaId,
  });

  // TODOS os hooks devem estar aqui no topo
  const { data: proposta, isLoading, refetch } = useQuery<Proposta>({
    queryKey: ["/api/propostas", propostaId, "formalizacao"],
    queryFn: async () => {
      console.log(`🔍 [DEBUG] Buscando dados de formalização para proposta: ${propostaId}`);
      const response = await apiRequest(`/api/propostas/${propostaId}/formalizacao`);
      console.log(`🔍 [DEBUG] Dados recebidos do backend:`, response);
      console.log(`🔍 [DEBUG] Cliente Data:`, response.clienteData);
      console.log(`🔍 [DEBUG] Condicoes Data:`, response.condicoesData);
      console.log(`🔍 [DEBUG] Data Aprovação:`, response.dataAprovacao);
      console.log(`🔍 [DEBUG] Documentos - Total:`, response.documentos?.length || 0);
      console.log(`🔍 [DEBUG] Documentos - Estrutura:`, response.documentos);
      console.log(`🔍 [DEBUG] Primeiro documento:`, response.documentos?.[0]);
      return response;
    },
    enabled: !!propostaId,
  });

  const form = useForm<UpdateFormalizacaoForm>({
    resolver: zodResolver(updateFormalizacaoSchema),
    defaultValues: {
      status: proposta?.status as any,
      documentosAdicionais: proposta?.documentosAdicionais || [],
      contratoGerado: proposta?.contratoGerado || false,
      contratoAssinado: proposta?.contratoAssinado || false,
      observacoesFormalização: proposta?.observacoesFormalização || "",
    },
  });

  const updateFormalizacao = useMutation({
    mutationFn: async (data: UpdateFormalizacaoForm) => {
      const response = await apiRequest(`/api/propostas/${propostaId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Formalização atualizada com sucesso",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/propostas", propostaId],
      });
      // Also invalidate the formalization list
      queryClient.invalidateQueries({
        queryKey: ["/api/propostas/formalizacao"],
      });
    },
    onError: error => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar formalização",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (value: string | number) => {
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(numValue);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("pt-BR");
  };

  // Função para gerar CCB
  const generateCCB = async (propostaId: string) => {
    try {
      toast({
        title: "Gerando CCB",
        description: "Aguarde, gerando CCB com todos os dados da proposta...",
      });
      
      const response = await apiRequest(`/api/propostas/${propostaId}/gerar-ccb`, {
        method: "POST"
      });
      
      if (response.success) {
        toast({
          title: "Sucesso",
          description: response.message,
        });
        // Recarregar dados para atualizar status ccbGerado
        refetch();
      }
    } catch (error) {
      console.error('Erro ao gerar CCB:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar CCB. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Função para visualizar CCB
  const viewCCB = async (propostaId: string) => {
    try {
      const response = await apiRequest(`/api/propostas/${propostaId}/ccb-url`);
      if (response.url) {
        // Abrir em nova aba
        window.open(response.url, '_blank');
      }
    } catch (error) {
      console.error('Erro ao visualizar CCB:', error);
      toast({
        title: "Erro",
        description: "Erro ao visualizar CCB. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Função para enviar CCB para ClickSign
  const sendToClickSign = async (propostaId: string) => {
    setLoadingClickSign(true);
    try {
      toast({
        title: "Enviando para ClickSign",
        description: "Preparando CCB para assinatura eletrônica...",
      });
      
      const response = await apiRequest(`/api/clicksign/send-ccb/${propostaId}`, {
        method: "POST"
      });
      
      if (response.success) {
        toast({
          title: "Sucesso",
          description: "CCB enviada para ClickSign! Link de assinatura gerado.",
        });
        // Atualizar dados ClickSign
        await checkClickSignStatus(propostaId);
        refetch();
      }
    } catch (error: any) {
      console.error('Erro ao enviar para ClickSign:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar CCB para ClickSign.",
        variant: "destructive",
      });
    } finally {
      setLoadingClickSign(false);
    }
  };

  // Função para consultar status ClickSign  
  const checkClickSignStatus = async (propostaId: string) => {
    try {
      const response = await apiRequest(`/api/clicksign/status/${propostaId}`);
      setClickSignData(response);
      return response;
    } catch (error) {
      console.error('Erro ao consultar status ClickSign:', error);
      return null;
    }
  };

  // Carregar status ClickSign na inicialização
  const { data: initialClickSignData } = useQuery({
    queryKey: ["/api/clicksign/status", propostaId],
    queryFn: () => checkClickSignStatus(propostaId!),
    enabled: !!propostaId && !!proposta?.ccbGerado,
  });

  // Atualizar clickSignData quando initialClickSignData mudar
  React.useEffect(() => {
    if (initialClickSignData) {
      setClickSignData(initialClickSignData);
    }
  }, [initialClickSignData]);

  const getStatusProgress = (status: string) => {
    const statusMap = {
      aprovado: 20,
      documentos_enviados: 40,
      contratos_preparados: 60,
      contratos_assinados: 80,
      pronto_pagamento: 90,
      pago: 100,
    };
    return statusMap[status as keyof typeof statusMap] || 0;
  };

  const getStatusColor = (status: string) => {
    const statusColors = {
      aprovado: "bg-green-500",
      documentos_enviados: "bg-blue-500",
      contratos_preparados: "bg-purple-500",
      contratos_assinados: "bg-indigo-500",
      pronto_pagamento: "bg-orange-500",
      pago: "bg-green-600",
    };
    return statusColors[status as keyof typeof statusColors] || "bg-gray-500";
  };

  const getStatusText = (status: string) => {
    const statusTexts = {
      aprovado: "Aprovado",
      documentos_enviados: "Documentos Enviados",
      contratos_preparados: "Contratos Preparados",
      contratos_assinados: "Contratos Assinados",
      pronto_pagamento: "Pronto para Pagamento",
      pago: "Pago",
    };
    return statusTexts[status as keyof typeof statusTexts] || status;
  };

  // AGORA toda a lógica condicional pode vir aqui, APÓS todos os hooks
  
  // 🔧 CORREÇÃO CRÍTICA: Lógica condicional APÓS todos os hooks
  // Se não tem ID, mostrar lista de propostas
  if (!propostaId) {
    return <FormalizacaoList />;
  }

  const getFormalizationSteps = (proposta: Proposta) => [
    {
      id: 1,
      title: "Proposta Aprovada",
      description: "Proposta foi aprovada pela equipe de crédito",
      icon: CheckCircle,
      status: "completed",
      date: formatDate(proposta.dataAprovacao || proposta.createdAt),
      completed: true,
    },
    {
      id: 2,
      title: "CCB Gerada",
      description: "Cédula de Crédito Bancário gerada automaticamente",
      icon: FileText,
      status: proposta.ccbGerado ? "completed" : "current",
      date: proposta.ccbGerado ? formatDate(proposta.createdAt) : "Pendente",
      completed: proposta.ccbGerado,
      interactive: true,
      etapa: 'ccb_gerado' as const,
    },
    {
      id: 3,
      title: "Assinatura Eletrônica",
      description: "Documento enviado para ClickSign para assinatura",
      icon: Signature,
      status: proposta.assinaturaEletronicaConcluida ? "completed" : proposta.ccbGerado ? "current" : "pending",
      date: proposta.assinaturaEletronicaConcluida ? formatDate(proposta.createdAt) : "Pendente",
      completed: proposta.assinaturaEletronicaConcluida,
      interactive: proposta.ccbGerado,
      etapa: 'assinatura_eletronica' as const,
    },
    {
      id: 4,
      title: "Biometria Validada",
      description: "Validação biométrica concluída",
      icon: Shield,
      status: proposta.biometriaConcluida ? "completed" : proposta.assinaturaEletronicaConcluida ? "current" : "pending",
      date: proposta.biometriaConcluida ? formatDate(proposta.createdAt) : "Pendente",
      completed: proposta.biometriaConcluida,
      interactive: proposta.assinaturaEletronicaConcluida,
      etapa: 'biometria' as const,
    },
    {
      id: 5,
      title: "Banco Inter - Boletos",
      description: "Boletos gerados automaticamente pelo Banco Inter para pagamento",
      icon: Building2,
      status: proposta.interBoletoGerado ? "completed" : proposta.assinaturaEletronicaConcluida ? "current" : "pending",
      date: proposta.interBoletoGerado ? formatDate(proposta.createdAt) : "Pendente",
      completed: proposta.interBoletoGerado || false,
      interactive: proposta.assinaturaEletronicaConcluida,
      etapa: 'banco_inter' as const,
    },
    {
      id: 6,
      title: "Liberação do Pagamento",
      description: "Valor liberado e disponível para transferência",
      icon: CreditCard,
      status:
        proposta.status === "pronto_pagamento"
          ? "current"
          : proposta.status === "pago"
            ? "completed"
            : "pending",
      date: proposta.dataPagamento ? formatDate(proposta.dataPagamento) : "Pendente",
      completed: proposta.status === "pago",
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
            <Card key={index} className="animate-pulse bg-gray-800 border-gray-700">
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
          <Button onClick={() => setLocation("/credito/fila")} className="mt-4">
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
    return "/formalizacao";
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
        <Card className="bg-gray-800 border-gray-700">
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
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-0">
            <div className="border-b border-gray-600">
              <div className="flex space-x-8 px-6 py-4">
                <button
                  onClick={() => setActiveTab("timeline")}
                  className={`flex items-center gap-2 border-b-2 pb-2 text-sm font-medium ${
                    activeTab === "timeline"
                      ? "border-blue-400 text-blue-400"
                      : "border-transparent text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <Activity className="h-4 w-4" />
                  {user?.role === 'ATENDENTE' ? 'Progresso' : 'Timeline'}
                </button>
                <button
                  onClick={() => setActiveTab("documents")}
                  className={`flex items-center gap-2 border-b-2 pb-2 text-sm font-medium ${
                    activeTab === "documents"
                      ? "border-blue-400 text-blue-400"
                      : "border-transparent text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  Documentos
                </button>
                {/* ANALISTA vê todas as tabs, ATENDENTE pode ter acesso limitado */}
                {user?.role !== 'ATENDENTE' && (
                  <button
                    onClick={() => setActiveTab("contracts")}
                    className={`flex items-center gap-2 border-b-2 pb-2 text-sm font-medium ${
                      activeTab === "contracts"
                        ? "border-blue-400 text-blue-400"
                        : "border-transparent text-gray-400 hover:text-gray-200"
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
            {activeTab === "timeline" && (
              <Card className="bg-gray-800 border-gray-700">
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
                      const isCurrent = step.status === "current";

                      // Se é uma etapa interativa, mostra o controle (independente do role)
                      if (step.interactive && step.etapa) {
                        // Para a etapa de assinatura eletrônica, mostrar interface customizada
                        if (step.etapa === 'assinatura_eletronica' && proposta.ccbGerado) {
                          return (
                            <div key={step.id} className="mb-4">
                              <div className="space-y-4">
                                {/* Controle padrão da etapa */}
                                <EtapaFormalizacaoControl
                                  propostaId={proposta.id}
                                  etapa={step.etapa}
                                  titulo={step.title}
                                  descricao={step.description}
                                  concluida={isCompleted}
                                  habilitada={step.interactive}
                                  onUpdate={() => refetch()}
                                />
                                
                                {/* Botão de enviar para ClickSign se ainda não foi enviado */}
                                {!proposta.clicksignSignUrl && !clickSignData && (
                                  <div className="mt-3 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
                                    <div className="flex items-center justify-between mb-3">
                                      <h5 className="font-medium text-blue-300">Enviar para Assinatura Eletrônica</h5>
                                      <Signature className="h-5 w-5 text-blue-400" />
                                    </div>
                                    <p className="text-sm text-blue-200 mb-4">
                                      Clique no botão abaixo para enviar o contrato CCB para o ClickSign e gerar o link de assinatura para o cliente.
                                    </p>
                                    <Button
                                      onClick={async () => {
                                        setLoadingClickSign(true);
                                        try {
                                          const response = await apiRequest(`/api/propostas/${proposta.id}/clicksign/enviar`, {
                                            method: 'POST'
                                          });
                                          setClickSignData(response);
                                          toast({
                                            title: "Sucesso",
                                            description: "Contrato enviado para ClickSign com sucesso!",
                                          });
                                          refetch(); // Recarregar dados da proposta
                                        } catch (error: any) {
                                          toast({
                                            title: "Erro",
                                            description: error.response?.data?.message || "Erro ao enviar para ClickSign",
                                            variant: "destructive",
                                          });
                                        } finally {
                                          setLoadingClickSign(false);
                                        }
                                      }}
                                      disabled={loadingClickSign}
                                      className="w-full bg-blue-600 hover:bg-blue-700"
                                    >
                                      {loadingClickSign ? (
                                        <div className="flex items-center">
                                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                          Enviando para ClickSign...
                                        </div>
                                      ) : (
                                        <div className="flex items-center">
                                          <Signature className="h-4 w-4 mr-2" />
                                          Enviar Contrato para Assinatura (ClickSign)
                                        </div>
                                      )}
                                    </Button>
                                  </div>
                                )}
                                
                                {/* Exibir link de assinatura se já existe */}
                                {(clickSignData || proposta.clicksignSignUrl) && (
                                  <div className="mt-3 p-4 bg-green-900/20 border border-green-700 rounded-lg">
                                    <div className="flex items-center mb-3">
                                      <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
                                      <h5 className="font-medium text-green-300">Link de Assinatura Disponível</h5>
                                    </div>
                                    <p className="text-sm text-green-200 mb-3">
                                      Compartilhe o link abaixo com o cliente para assinatura digital:
                                    </p>
                                    <div className="flex items-center gap-2 p-3 bg-gray-800 rounded border">
                                      <input
                                        type="text"
                                        value={clickSignData?.signUrl || proposta.clicksignSignUrl || ''}
                                        readOnly
                                        className="flex-1 bg-transparent text-white text-sm"
                                      />
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          const linkUrl = clickSignData?.signUrl || proposta.clicksignSignUrl || '';
                                          navigator.clipboard.writeText(linkUrl);
                                          toast({
                                            title: "Copiado!",
                                            description: "Link de assinatura copiado para a área de transferência",
                                          });
                                        }}
                                      >
                                        Copiar
                                      </Button>
                                    </div>
                                    {clickSignData?.envelopeId && (
                                      <p className="text-xs text-gray-400 mt-2">
                                        Envelope ID: {clickSignData.envelopeId}
                                      </p>
                                    )}
                                    
                                    {/* Botão para regenerar link */}
                                    <div className="mt-3 pt-3 border-t border-gray-700">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={async () => {
                                          setLoadingClickSign(true);
                                          try {
                                            const response = await apiRequest(`/api/propostas/${proposta.id}/clicksign/regenerar`, {
                                              method: 'POST'
                                            });
                                            setClickSignData(response);
                                            toast({
                                              title: "Sucesso",
                                              description: "Novo link de assinatura gerado com sucesso!",
                                            });
                                            refetch(); // Recarregar dados da proposta
                                          } catch (error: any) {
                                            toast({
                                              title: "Erro",
                                              description: error.response?.data?.error || "Erro ao regenerar link",
                                              variant: "destructive",
                                            });
                                          } finally {
                                            setLoadingClickSign(false);
                                          }
                                        }}
                                        disabled={loadingClickSign}
                                        className="border-yellow-600 text-yellow-400 hover:bg-yellow-600/10"
                                      >
                                        {loadingClickSign ? (
                                          <div className="flex items-center">
                                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-400 mr-2"></div>
                                            Regenerando...
                                          </div>
                                        ) : (
                                          <div className="flex items-center">
                                            <Signature className="h-3 w-3 mr-2" />
                                            Gerar Novo Link
                                          </div>
                                        )}
                                      </Button>
                                      <p className="text-xs text-gray-500 mt-1">
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
                        if (step.etapa === 'banco_inter' && proposta.assinaturaEletronicaConcluida) {
                          return (
                            <div key={step.id} className="mb-4">
                              <div className="space-y-4">
                                {/* Interface do Banco Inter */}
                                <div className="mt-3 p-4 bg-orange-900/20 border border-orange-700 rounded-lg">
                                  <div className="flex items-center justify-between mb-3">
                                    <h5 className="font-medium text-orange-300 flex items-center gap-2">
                                      <Building2 className="h-5 w-5" />
                                      Banco Inter - Boletos de Pagamento
                                    </h5>
                                  </div>
                                  
                                  <p className="text-sm text-orange-200 mb-4">
                                    Após a assinatura do contrato, os boletos são gerados automaticamente pelo Banco Inter para processamento do pagamento ao cliente.
                                  </p>

                                  {(!proposta.interBoletoGerado && !interBoletoData && (!collectionsData || collectionsData.length === 0)) ? (
                                    // Botão para gerar boletos
                                    <Button
                                      onClick={async () => {
                                        setLoadingInter(true);
                                        try {
                                          // Preparar dados para a API do Inter
                                          const dataVencimento = new Date();
                                          dataVencimento.setDate(dataVencimento.getDate() + 5); // Vencimento em 5 dias
                                          
                                          // Aviso se dados de endereço estão incompletos
                                          const enderecoIncompleto = !proposta.cliente_data?.endereco || !proposta.cliente_data?.numero || 
                                              !proposta.cliente_data?.bairro || !proposta.cliente_data?.cidade || 
                                              !proposta.cliente_data?.uf || !proposta.cliente_data?.cep;
                                          
                                          if (enderecoIncompleto) {
                                            console.warn('[INTER] Dados de endereço incompletos, usando valores padrão temporários');
                                          }
                                          
                                          const requestData = {
                                            proposalId: proposta.id,
                                            valorTotal: proposta.condicoes_data?.valor || 0,
                                            dataVencimento: dataVencimento.toISOString().split('T')[0],
                                            clienteData: {
                                              nome: proposta.cliente_data?.nome || '',
                                              cpf: proposta.cliente_data?.cpf || '',
                                              email: proposta.cliente_data?.email || '',
                                              telefone: proposta.cliente_data?.telefone || '00000000000',
                                              endereco: proposta.cliente_data?.endereco || 'Rua Principal',
                                              numero: proposta.cliente_data?.numero || '100',
                                              complemento: proposta.cliente_data?.complemento || '',
                                              bairro: proposta.cliente_data?.bairro || 'Centro',
                                              cidade: proposta.cliente_data?.cidade || 'São Paulo',
                                              uf: proposta.cliente_data?.uf || 'SP',
                                              cep: proposta.cliente_data?.cep?.replace(/\D/g, '') || '00000000'
                                            }
                                          };
                                          
                                          console.log('[INTER] Enviando dados para gerar boleto:', requestData);
                                          
                                          const response = await apiRequest('/api/inter/collections', {
                                            method: 'POST',
                                            body: JSON.stringify(requestData)
                                          });
                                          
                                          console.log('[INTER] Resposta da API:', response);
                                          
                                          toast({
                                            title: "Sucesso",
                                            description: `Boleto gerado com sucesso! Código: ${response.codigoSolicitacao}`,
                                          });
                                          
                                          // Atualizar estado local para mostrar o código do boleto
                                          setInterBoletoData(response);
                                          refetch(); // Recarregar dados da proposta
                                        } catch (error: any) {
                                          console.error('[INTER] Erro ao gerar boleto:', error);
                                          toast({
                                            title: "Erro",
                                            description: error.response?.data?.details || error.response?.data?.error || "Erro ao gerar boletos",
                                            variant: "destructive",
                                          });
                                        } finally {
                                          setLoadingInter(false);
                                        }
                                      }}
                                      disabled={loadingInter}
                                      className="w-full bg-orange-600 hover:bg-orange-700"
                                    >
                                      {loadingInter ? (
                                        <div className="flex items-center">
                                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                          Gerando boleto...
                                        </div>
                                      ) : (
                                        <div className="flex items-center">
                                          <Building2 className="h-4 w-4 mr-2" />
                                          Gerar Boletos via Banco Inter
                                        </div>
                                      )}
                                    </Button>
                                  ) : (
                                    // Boletos já gerados - mostrar lista
                                    <div className="space-y-3">
                                      <div className="flex items-center gap-2 p-3 bg-green-900/20 border border-green-700 rounded">
                                        <CheckCircle className="h-5 w-5 text-green-400" />
                                        <span className="text-green-300 font-medium">
                                          {collectionsData && collectionsData.length > 0 
                                            ? `${collectionsData.length} boleto(s) gerado(s) com sucesso` 
                                            : "Boletos gerados com sucesso"}
                                        </span>
                                      </div>
                                      
                                      {/* Listar todos os boletos gerados */}
                                      {collectionsData && collectionsData.length > 0 ? (
                                        <div className="space-y-3">
                                          {collectionsData.map((boleto: any, index: number) => (
                                            <div key={boleto.id || index} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                                              <div className="flex items-start justify-between mb-3">
                                                <div>
                                                  <h6 className="font-medium text-orange-300 mb-1">
                                                    {boleto.seuNumero || boleto.codigoSolicitacao}
                                                  </h6>
                                                  <div className="flex items-center gap-4 text-sm text-gray-400">
                                                    <span>Valor: R$ {boleto.valorNominal}</span>
                                                    <span>Venc: {new Date(boleto.dataVencimento).toLocaleDateString('pt-BR')}</span>
                                                  </div>
                                                </div>
                                                <Badge 
                                                  variant={
                                                    boleto.situacao === 'RECEBIDO' ? 'success' : 
                                                    boleto.situacao === 'VENCIDO' ? 'destructive' : 
                                                    'secondary'
                                                  }
                                                >
                                                  {boleto.situacao}
                                                </Badge>
                                              </div>
                                              
                                              {/* QR Code e Código de Barras */}
                                              {(boleto.qrCode || boleto.codigoBarras) && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                  {boleto.qrCode && (
                                                    <div className="p-3 bg-gray-900 rounded border border-gray-700">
                                                      <p className="text-xs text-gray-400 mb-2">QR Code PIX</p>
                                                      <div className="bg-white p-2 rounded">
                                                        <img 
                                                          src={`data:image/png;base64,${boleto.qrCode}`} 
                                                          alt="QR Code PIX" 
                                                          className="w-full max-w-[150px] mx-auto"
                                                        />
                                                      </div>
                                                    </div>
                                                  )}
                                                  
                                                  {boleto.codigoBarras && (
                                                    <div className="p-3 bg-gray-900 rounded border border-gray-700">
                                                      <p className="text-xs text-gray-400 mb-2">Código de Barras</p>
                                                      <div className="flex items-center gap-2">
                                                        <code className="flex-1 text-orange-400 font-mono text-xs break-all">
                                                          {boleto.codigoBarras}
                                                        </code>
                                                        <Button
                                                          size="sm"
                                                          variant="ghost"
                                                          onClick={() => {
                                                            navigator.clipboard.writeText(boleto.codigoBarras);
                                                            toast({
                                                              title: "Copiado!",
                                                              description: "Código de barras copiado",
                                                            });
                                                          }}
                                                        >
                                                          <Copy className="h-3 w-3" />
                                                        </Button>
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                              
                                              {/* Ações do boleto */}
                                              <div className="flex gap-2">
                                                {boleto.linkPdf && (
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => window.open(boleto.linkPdf, '_blank')}
                                                    className="border-orange-700 text-orange-300 hover:bg-orange-900/20"
                                                  >
                                                    <Download className="h-4 w-4 mr-2" />
                                                    Baixar PDF
                                                  </Button>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (interBoletoData?.codigoSolicitacao || proposta.interCodigoSolicitacao) && (
                                        <div className="p-3 bg-gray-800 rounded border border-gray-700">
                                          <p className="text-sm text-gray-400 mb-1">Código do Boleto:</p>
                                          <div className="flex items-center gap-2">
                                            <code className="flex-1 text-orange-400 font-mono">
                                              {interBoletoData?.codigoSolicitacao || proposta.interCodigoSolicitacao}
                                            </code>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => {
                                                const codigo = interBoletoData?.codigoSolicitacao || proposta.interCodigoSolicitacao || '';
                                                navigator.clipboard.writeText(codigo);
                                                toast({
                                                  title: "Copiado!",
                                                  description: "Código do boleto copiado para a área de transferência",
                                                });
                                              }}
                                            >
                                              <Copy className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                      
                                      <div className="grid grid-cols-2 gap-3">
                                        <Button
                                          variant="outline"
                                          onClick={async () => {
                                            try {
                                              const codigo = interBoletoData?.codigoSolicitacao || proposta.interCodigoSolicitacao;
                                              if (codigo) {
                                                window.open(`/api/inter/collections/${codigo}/pdf`, '_blank');
                                              }
                                            } catch (error) {
                                              toast({
                                                title: "Erro",
                                                description: "Erro ao baixar PDF do boleto",
                                                variant: "destructive",
                                              });
                                            }
                                          }}
                                          className="border-orange-600 text-orange-400 hover:bg-orange-600/10"
                                        >
                                          <Printer className="h-4 w-4 mr-2" />
                                          Imprimir Boleto
                                        </Button>
                                        
                                        <Button
                                          variant="outline"
                                          onClick={async () => {
                                            try {
                                              const codigo = interBoletoData?.codigoSolicitacao || proposta.interCodigoSolicitacao;
                                              if (codigo) {
                                                const response = await apiRequest(`/api/inter/collections/${codigo}`);
                                                console.log('[INTER] Detalhes do boleto:', response);
                                                toast({
                                                  title: "Informações do Boleto",
                                                  description: `Status: ${response.data?.situacao || 'Aguardando'}`,
                                                });
                                              }
                                            } catch (error) {
                                              console.error('[INTER] Erro ao consultar boleto:', error);
                                            }
                                          }}
                                          className="border-orange-600 text-orange-400 hover:bg-orange-600/10"
                                        >
                                          <FileText className="h-4 w-4 mr-2" />
                                          Ver Detalhes
                                        </Button>
                                      </div>
                                      
                                      <div className="text-xs text-gray-400 mt-2">
                                        <p><strong>Instruções para o Cliente:</strong></p>
                                        <p>• Boleto gerado automaticamente pelo Banco Inter</p>
                                        <p>• Pode pagar via PIX, débito ou transferência bancária</p>
                                        <p>• Valor será creditado após compensação bancária</p>
                                        <p>• Vencimento: {new Date(new Date().setDate(new Date().getDate() + 5)).toLocaleDateString('pt-BR')}</p>
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
                                isCompleted ? "bg-green-500" : "bg-gray-600"
                              }`}
                            />
                          )}

                          <div className="flex items-start space-x-4">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                                isCompleted
                                  ? "bg-green-500 text-white"
                                  : isCurrent
                                    ? "bg-blue-500 text-white"
                                    : "bg-gray-600 text-gray-400"
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
                                    isCompleted || isCurrent ? "text-white" : "text-gray-400"
                                  }`}
                                >
                                  {step.title}
                                </h4>
                                <span className="text-xs text-gray-400">{step.date}</span>
                              </div>
                              <p
                                className={`text-sm ${
                                  isCompleted || isCurrent ? "text-gray-300" : "text-gray-500"
                                }`}
                              >
                                {step.description}
                              </p>

                              {isCurrent && !step.interactive && (
                                <div className="mt-2 rounded-md bg-blue-900/30 border border-blue-700 p-3">
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
                              {step.id === 2 && proposta.ccbGerado && (
                                <div className="mt-3">
                                  <Button
                                    onClick={async () => {
                                      try {
                                        const response = await apiRequest(`/api/propostas/${proposta.id}/ccb-url`);
                                        setCcbUrl(response.url);
                                        setShowCcbViewer(true);
                                      } catch (error) {
                                        toast({
                                          title: "Erro",
                                          description: "Erro ao visualizar CCB",
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                    variant="outline"
                                    size="sm"
                                    className="mr-2"
                                  >
                                    <FileText className="h-4 w-4 mr-2" />
                                    Visualizar CCB
                                  </Button>
                                </div>
                              )}

                              {step.id === 3 && proposta.ccbGerado && !proposta.assinaturaEletronicaConcluida && (
                                <div className="mt-3 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
                                  <div className="flex items-center justify-between mb-3">
                                    <h5 className="font-medium text-blue-300">Enviar para Assinatura Eletrônica</h5>
                                    <Signature className="h-5 w-5 text-blue-400" />
                                  </div>
                                  <p className="text-sm text-blue-200 mb-4">
                                    Clique no botão abaixo para enviar o contrato CCB para o ClickSign e gerar o link de assinatura para o cliente.
                                  </p>
                                  
                                  {/* Opção de Biometria Facial */}
                                  <div className="flex items-center space-x-2 p-3 mb-4 bg-purple-900/20 rounded-lg border border-purple-700">
                                    <input
                                      type="checkbox"
                                      id="useBiometricAuth"
                                      checked={useBiometricAuth}
                                      onChange={(e) => setUseBiometricAuth(e.target.checked)}
                                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="useBiometricAuth" className="text-sm text-gray-300 cursor-pointer">
                                      <span className="font-medium">Usar Biometria Facial</span>
                                      <span className="block text-xs text-gray-400 mt-0.5">
                                        Adiciona validação facial com comparação de documento para maior segurança
                                      </span>
                                    </label>
                                  </div>
                                  
                                  <Button
                                    onClick={async () => {
                                      setLoadingClickSign(true);
                                      try {
                                        const response = await apiRequest(`/api/propostas/${proposta.id}/clicksign/enviar`, {
                                          method: 'POST',
                                          body: JSON.stringify({
                                            useBiometricAuth: useBiometricAuth
                                          })
                                        });
                                        setClickSignData(response);
                                        toast({
                                          title: "Sucesso",
                                          description: "Contrato enviado para ClickSign com sucesso!",
                                        });
                                      } catch (error: any) {
                                        toast({
                                          title: "Erro",
                                          description: error.response?.data?.message || "Erro ao enviar para ClickSign",
                                          variant: "destructive",
                                        });
                                      } finally {
                                        setLoadingClickSign(false);
                                      }
                                    }}
                                    disabled={loadingClickSign}
                                    className="w-full bg-blue-600 hover:bg-blue-700"
                                  >
                                    {loadingClickSign ? (
                                      <div className="flex items-center">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                        Enviando para ClickSign...
                                      </div>
                                    ) : (
                                      <div className="flex items-center">
                                        <Signature className="h-4 w-4 mr-2" />
                                        Enviar Contrato para Assinatura (ClickSign)
                                      </div>
                                    )}
                                  </Button>
                                </div>
                              )}

                              {(clickSignData || proposta.clicksignSignUrl) && step.id === 3 && (
                                <div className="mt-3 p-4 bg-green-900/20 border border-green-700 rounded-lg">
                                  <div className="flex items-center mb-3">
                                    <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
                                    <h5 className="font-medium text-green-300">Link de Assinatura Disponível</h5>
                                  </div>
                                  <p className="text-sm text-green-200 mb-3">
                                    Compartilhe o link abaixo com o cliente para assinatura digital:
                                  </p>
                                  <div className="flex items-center gap-2 p-3 bg-gray-800 rounded border">
                                    <input
                                      type="text"
                                      value={clickSignData?.signUrl || proposta.clicksignSignUrl || ''}
                                      readOnly
                                      className="flex-1 bg-transparent text-white text-sm"
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        const linkUrl = clickSignData?.signUrl || proposta.clicksignSignUrl || '';
                                        navigator.clipboard.writeText(linkUrl);
                                        toast({
                                          title: "Copiado!",
                                          description: "Link de assinatura copiado para a área de transferência",
                                        });
                                      }}
                                    >
                                      Copiar
                                    </Button>
                                  </div>
                                  {clickSignData?.envelopeId && (
                                    <p className="text-xs text-gray-400 mt-2">
                                      Envelope ID: {clickSignData.envelopeId}
                                    </p>
                                  )}
                                  
                                  {/* Botão para regenerar link */}
                                  <div className="mt-3 pt-3 border-t border-gray-700">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={async () => {
                                        setLoadingClickSign(true);
                                        try {
                                          const response = await apiRequest(`/api/propostas/${proposta.id}/clicksign/regenerar`, {
                                            method: 'POST'
                                          });
                                          setClickSignData(response);
                                          toast({
                                            title: "Sucesso",
                                            description: "Novo link de assinatura gerado com sucesso!",
                                          });
                                        } catch (error: any) {
                                          // Tratamento específico para erro de token ClickSign
                                          if (error.response?.status === 401 && error.response?.data?.action === 'UPDATE_CLICKSIGN_TOKEN') {
                                            toast({
                                              title: "Token ClickSign Inválido",
                                              description: error.response.data.details || "Token do ClickSign precisa ser atualizado. Entre em contato com o administrador.",
                                              variant: "destructive",
                                            });
                                          } else if (error.response?.status === 400 && error.response?.data?.action === 'CHECK_CLICKSIGN_SERVICE') {
                                            toast({
                                              title: "Erro na API ClickSign",
                                              description: error.response.data.details || "Problema com o serviço ClickSign. Tente novamente em alguns minutos.",
                                              variant: "destructive",
                                            });
                                          } else {
                                            toast({
                                              title: "Erro",
                                              description: error.response?.data?.error || "Erro ao regenerar link",
                                              variant: "destructive",
                                            });
                                          }
                                        } finally {
                                          setLoadingClickSign(false);
                                        }
                                      }}
                                      disabled={loadingClickSign}
                                      className="border-yellow-600 text-yellow-400 hover:bg-yellow-600/10"
                                    >
                                      {loadingClickSign ? (
                                        <div className="flex items-center">
                                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-400 mr-2"></div>
                                          Regenerando...
                                        </div>
                                      ) : (
                                        <div className="flex items-center">
                                          <Signature className="h-3 w-3 mr-2" />
                                          Gerar Novo Link
                                        </div>
                                      )}
                                    </Button>
                                    <p className="text-xs text-gray-500 mt-1">
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
            {activeTab === "documents" && (
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
                    ccbDocumentoUrl={proposta.ccbGerado ? `/api/propostas/${proposta.id}/ccb-url` : undefined}
                  />
                </CardContent>
              </Card>
            )}

            {/* Contracts Tab */}
            {activeTab === "contracts" && (
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
                            proposta.contratoGerado ? "bg-green-100" : "bg-gray-200"
                          }`}
                        >
                          <FileCheck
                            className={`h-5 w-5 ${
                              proposta.contratoGerado ? "text-green-600" : "text-gray-400"
                            }`}
                          />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Contrato Gerado</p>
                          <p className="text-sm text-gray-600">
                            {proposta.contratoGerado ? "Sim" : "Não"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full ${
                            proposta.contratoAssinado ? "bg-green-100" : "bg-gray-200"
                          }`}
                        >
                          <Signature
                            className={`h-5 w-5 ${
                              proposta.contratoAssinado ? "text-green-600" : "text-gray-400"
                            }`}
                          />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Contrato Assinado</p>
                          <p className="text-sm text-gray-600">
                            {proposta.contratoAssinado ? "Sim" : "Não"}
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
            <Card className="bg-gray-800 border-gray-700">
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
                    <p className="font-medium text-white">{proposta.cliente_data?.nome || 'Nome não informado'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-400">Valor Aprovado</Label>
                    <p className="text-2xl font-bold text-green-400">
                      {formatCurrency(proposta.condicoes_data?.valor || 0)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-400">Taxa de Juros</Label>
                    <p className="flex items-center gap-1 font-medium text-white">
                      <Percent className="h-4 w-4" />
                      {'N/A'}% a.m.
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-400">Prazo</Label>
                    <p className="font-medium text-white">{proposta.condicoes_data?.prazo || 0} meses</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-400">Data da Aprovação</Label>
                    <p className="flex items-center gap-1 text-white">
                      <Calendar className="h-4 w-4" />
                      {proposta.dataAprovacao ? formatDate(proposta.dataAprovacao) : formatDate(proposta.createdAt)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status Management */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Edit className="h-5 w-5 text-blue-400" />
                  Gerenciar Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="status" className="text-gray-400">Status Atual</Label>
                    <select
                      className="w-full rounded-md border border-gray-600 bg-gray-700 text-white p-2"
                      value={form.watch("status") || proposta.status}
                      onChange={e => form.setValue("status", e.target.value as any)}
                    >
                      <option value="aprovado">Aprovado</option>
                      <option value="documentos_enviados">Documentos Enviados</option>
                      <option value="contratos_preparados">Contratos Preparados</option>
                      <option value="contratos_assinados">Contratos Assinados</option>
                      <option value="pronto_pagamento">Pronto para Pagamento</option>
                      <option value="pago">Pago</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="observacoes" className="text-gray-400">Observações</Label>
                    <Textarea
                      id="observacoes"
                      rows={3}
                      placeholder="Adicione observações sobre o processo..."
                      className="bg-gray-700 border-gray-600 text-white"
                      {...form.register("observacoesFormalização")}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={updateFormalizacao.isPending}>
                    {updateFormalizacao.isPending ? "Atualizando..." : "Atualizar Status"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Next Steps */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <AlertCircle className="h-5 w-5 text-blue-400" />
                  Próximos Passos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {proposta.status === "aprovado" && (
                    <div className="rounded-md bg-blue-900/30 border border-blue-700 p-3">
                      <p className="text-sm font-medium text-blue-300">
                        Aguardando documentos adicionais
                      </p>
                      <p className="mt-1 text-sm text-blue-200">
                        Cliente deve enviar documentos complementares solicitados.
                      </p>
                    </div>
                  )}
                  {proposta.status === "documentos_enviados" && (
                    <div className="rounded-md bg-purple-900/30 border border-purple-700 p-3">
                      <p className="text-sm font-medium text-purple-300">Preparar contratos</p>
                      <p className="mt-1 text-sm text-purple-200">
                        Gerar e preparar contratos para assinatura.
                      </p>
                    </div>
                  )}
                  {proposta.status === "contratos_preparados" && (
                    <div className="rounded-md bg-indigo-900/30 border border-indigo-700 p-3">
                      <p className="text-sm font-medium text-indigo-300">Aguardando assinatura</p>
                      <p className="mt-1 text-sm text-indigo-200">
                        Contratos enviados para assinatura do cliente.
                      </p>
                    </div>
                  )}
                  {proposta.status === "contratos_assinados" && (
                    <div className="rounded-md bg-orange-900/30 border border-orange-700 p-3">
                      <p className="text-sm font-medium text-orange-300">Preparar pagamento</p>
                      <p className="mt-1 text-sm text-orange-200">
                        Processar liberação do valor aprovado.
                      </p>
                    </div>
                  )}
                  {proposta.status === "pronto_pagamento" && (
                    <div className="rounded-md bg-green-900/30 border border-green-700 p-3">
                      <p className="text-sm font-medium text-green-300">Liberar pagamento</p>
                      <p className="mt-1 text-sm text-green-200">
                        Valor pronto para ser liberado ao cliente.
                      </p>
                    </div>
                  )}
                  {proposta.status === "pago" && (
                    <div className="rounded-md bg-green-900/30 border border-green-700 p-3">
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
