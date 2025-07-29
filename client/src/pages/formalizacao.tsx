import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
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
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import RefreshButton from "@/components/RefreshButton";
import { useAuth } from "@/contexts/AuthContext";

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
  documentos_adicionais?: string[];
  contrato_gerado?: boolean;
  contrato_assinado?: boolean;
  data_assinatura?: string;
  data_pagamento?: string;
  observacoes_formalizacao?: string;
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
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch (e) {
        console.warn(`Erro ao fazer parse de ${fieldName} para proposta ${propostaId}:`, e);
        return {};
      }
    }
    return field || {};
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

  // No need to filter since backend already filters by formalization statuses
  const formalizacaoPropostas = propostas || [];

  if (isLoading) {
    return (
      <DashboardLayout title="Formalização">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, index) => (
            <Card key={index} className="animate-pulse bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="mb-4 h-6 rounded bg-gray-700"></div>
                <div className="mb-2 h-4 rounded bg-gray-700"></div>
                <div className="h-4 w-3/4 rounded bg-gray-700"></div>
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

  // Filtrar propostas baseado no papel do usuário
  const filteredPropostas = user?.role === 'ATENDENTE' 
    ? formalizacaoPropostas.filter(p => 
        // ATENDENTE só vê propostas que precisam de sua ação
        p.status === 'aprovado' || 
        p.status === 'documentos_enviados' ||
        (p.loja_id === user.loja_id) // Suas próprias propostas
      )
    : formalizacaoPropostas; // ANALISTA vê todas

  const getTitle = () => {
    return user?.role === 'ATENDENTE' 
      ? "Minhas Propostas - Formalização"
      : "Formalização - Visão Geral";
  };

  const getDescription = () => {
    return user?.role === 'ATENDENTE'
      ? "Propostas que precisam da sua ação para prosseguir na formalização"
      : "Acompanhe o processo de formalização das propostas aprovadas";
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
            <h1 className="text-2xl font-bold text-white dark:text-white">{getTitle()}</h1>
            <p className="text-gray-400 dark:text-gray-400">
              {getDescription()}
            </p>
            {user?.role === 'ATENDENTE' && (
              <div className="mt-2 flex items-center gap-2 text-sm text-blue-400">
                <Shield className="h-4 w-4" />
                <span>Visualização do Atendente - Ações Pendentes</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-400">Total em Formalização</p>
              <p className="text-2xl font-bold text-blue-400">{filteredPropostas.length}</p>
            </div>
          </div>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[
            { status: "aprovado", label: "Aprovado", color: "bg-green-500" },
            { status: "documentos_enviados", label: "Docs Enviados", color: "bg-blue-500" },
            { status: "contratos_preparados", label: "Contratos Prep.", color: "bg-purple-500" },
            { status: "contratos_assinados", label: "Assinados", color: "bg-indigo-500" },
            { status: "pronto_pagamento", label: "Pronto Pag.", color: "bg-orange-500" },
            { status: "pago", label: "Pago", color: "bg-green-600" },
          ].map(item => {
            const count = filteredPropostas.filter(p => p.status === item.status).length;
            return (
              <Card key={item.status} className="bg-gray-800 border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className={`h-3 w-3 rounded-full ${item.color}`}></div>
                    <span className="text-2xl font-bold text-white">{count}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-400">{item.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Propostas List */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredPropostas.map(proposta => (
            <Card key={proposta.id} className="cursor-pointer transition-shadow hover:shadow-lg bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">#{proposta.id}</h3>
                  <Badge className={`${getStatusColor(proposta.status)} text-white`}>
                    {getStatusText(proposta.status)}
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-400">Cliente</p>
                    <p className="font-medium text-white">
                      {parseJsonbField(proposta.cliente_data, 'cliente_data', proposta.id)?.nome || 'Nome não informado'}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-400">Valor Aprovado</p>
                    <p className="font-bold text-green-400">
                      {formatCurrency(parseJsonbField(proposta.condicoes_data, 'condicoes_data', proposta.id)?.valor || 0)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-400">Data da Aprovação</p>
                    <p className="text-white">
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

        {filteredPropostas.length === 0 && (
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
  
  const propostaId = params?.id;

  // TODOS os hooks devem estar aqui no topo
  const { data: proposta, isLoading } = useQuery<Proposta>({
    queryKey: ["/api/propostas", propostaId],
    enabled: !!propostaId,
  });

  const form = useForm<UpdateFormalizacaoForm>({
    resolver: zodResolver(updateFormalizacaoSchema),
    defaultValues: {
      status: proposta?.status as any,
      documentosAdicionais: proposta?.documentos_adicionais || [],
      contratoGerado: proposta?.contrato_gerado || false,
      contratoAssinado: proposta?.contrato_assinado || false,
      observacoesFormalização: proposta?.observacoes_formalizacao || "",
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
      date: formatDate(proposta.data_aprovacao || proposta.created_at),
      completed: true,
    },
    {
      id: 2,
      title: "Documentos Adicionais",
      description: "Envio de documentos complementares",
      icon: FileText,
      status:
        proposta.status === "documentos_enviados"
          ? "current"
          : proposta.status === "aprovado"
            ? "current"
            : "completed",
      date: proposta.documentos_adicionais?.length ? formatDate(proposta.updated_at) : "Pendente",
      completed: proposta.status !== "aprovado",
    },
    {
      id: 3,
      title: "Contratos Preparados",
      description: "Geração e preparação dos contratos",
      icon: FileCheck,
      status:
        proposta.status === "contratos_preparados"
          ? "current"
          : proposta.contrato_gerado
            ? "completed"
            : "pending",
      date: proposta.contrato_gerado ? formatDate(proposta.updated_at) : "Pendente",
      completed: proposta.contrato_gerado,
    },
    {
      id: 4,
      title: "Assinatura dos Contratos",
      description: "Assinatura digital dos contratos",
      icon: Signature,
      status:
        proposta.status === "contratos_assinados"
          ? "current"
          : proposta.contrato_assinado
            ? "completed"
            : "pending",
      date: proposta.data_assinatura ? formatDate(proposta.data_assinatura) : "Pendente",
      completed: proposta.contrato_assinado,
    },
    {
      id: 5,
      title: "Liberação do Pagamento",
      description: "Processo de liberação do valor aprovado",
      icon: CreditCard,
      status:
        proposta.status === "pronto_pagamento"
          ? "current"
          : proposta.status === "pago"
            ? "completed"
            : "pending",
      date: proposta.data_pagamento ? formatDate(proposta.data_pagamento) : "Pendente",
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

  // Função para obter título baseado no papel
  const getTitle = () => {
    return user?.role === 'ATENDENTE' 
      ? `Minha Proposta #${proposta.id} - Ação Necessária`
      : `Acompanhamento da Formalização - Proposta #${proposta.id}`;
  };

  // Função para obter destino do botão voltar
  const getBackLocation = () => {
    return user?.role === 'ATENDENTE' 
      ? "/formalizacao"
      : "/credito/fila";
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
              {user?.role === 'ATENDENTE' ? 'Voltar para Minhas Propostas' : 'Voltar para Fila'}
            </Button>
            {user?.role === 'ATENDENTE' && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <Shield className="h-4 w-4" />
                <span>Visualização do Atendente</span>
              </div>
            )}
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
        <Card>
          <CardContent className="p-6">
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  {user?.role === 'ATENDENTE' ? 'Sua Ação Necessária' : 'Progresso da Formalização'}
                </h3>
                <span className="text-sm font-medium text-gray-600">
                  {getStatusProgress(proposta.status)}% concluído
                </span>
              </div>
              <Progress value={getStatusProgress(proposta.status)} className="h-3" />
            </div>
          </CardContent>
        </Card>

        {/* Tabs Navigation */}
        <Card>
          <CardContent className="p-0">
            <div className="border-b">
              <div className="flex space-x-8 px-6 py-4">
                <button
                  onClick={() => setActiveTab("timeline")}
                  className={`flex items-center gap-2 border-b-2 pb-2 text-sm font-medium ${
                    activeTab === "timeline"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Activity className="h-4 w-4" />
                  {user?.role === 'ATENDENTE' ? 'Progresso' : 'Timeline'}
                </button>
                <button
                  onClick={() => setActiveTab("documents")}
                  className={`flex items-center gap-2 border-b-2 pb-2 text-sm font-medium ${
                    activeTab === "documents"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
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
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
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
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Timeline de Formalização
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {formalizationSteps.map((step, index) => {
                      const Icon = step.icon;
                      const isCompleted = step.completed;
                      const isCurrent = step.status === "current";

                      return (
                        <div key={step.id} className="relative">
                          {index !== formalizationSteps.length - 1 && (
                            <div
                              className={`absolute left-4 top-8 h-16 w-0.5 ${
                                isCompleted ? "bg-green-500" : "bg-gray-300"
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
                                    : "bg-gray-200 text-gray-500"
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
                                    isCompleted || isCurrent ? "text-gray-900" : "text-gray-500"
                                  }`}
                                >
                                  {step.title}
                                </h4>
                                <span className="text-xs text-gray-500">{step.date}</span>
                              </div>
                              <p
                                className={`text-sm ${
                                  isCompleted || isCurrent ? "text-gray-600" : "text-gray-400"
                                }`}
                              >
                                {step.description}
                              </p>

                              {isCurrent && (
                                <div className="mt-2 rounded-md bg-blue-50 p-3">
                                  <div className="flex items-center">
                                    <AlertCircle className="mr-2 h-4 w-4 text-blue-600" />
                                    <span className="text-sm font-medium text-blue-800">
                                      Etapa atual em andamento
                                    </span>
                                  </div>
                                  <p className="mt-1 text-sm text-blue-700">
                                    Aguardando ação do cliente ou processamento interno.
                                  </p>
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
                  <div className="space-y-4">
                    {/* Original Documents */}
                    <div>
                      <h4 className="mb-3 font-medium text-gray-900">Documentos Originais</h4>
                      <div className="space-y-2">
                        {/* TODO: Implementar busca de documentos originais da proposta */}
                        <div className="py-4 text-center text-gray-500">
                          <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                          <p>Carregamento de documentos originais em desenvolvimento</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Additional Documents */}
                    <div>
                      <h4 className="mb-3 font-medium text-gray-900">Documentos Adicionais</h4>
                      <div className="space-y-2">
                        {proposta.documentos_adicionais &&
                        proposta.documentos_adicionais.length > 0 ? (
                          proposta.documentos_adicionais.map((documento, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between rounded-md bg-green-50 p-3"
                            >
                              <div className="flex items-center space-x-3">
                                <FileText className="h-4 w-4 text-green-500" />
                                <span className="text-sm font-medium text-gray-700">
                                  {documento}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <Button variant="ghost" size="sm">
                                  <Eye className="mr-1 h-4 w-4" />
                                  Visualizar
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Download className="mr-1 h-4 w-4" />
                                  Baixar
                                </Button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-4 text-center text-gray-500">
                            <Upload className="mx-auto mb-2 h-8 w-8 opacity-50" />
                            <p>Nenhum documento adicional enviado</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
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
                            proposta.contrato_gerado ? "bg-green-100" : "bg-gray-200"
                          }`}
                        >
                          <FileCheck
                            className={`h-5 w-5 ${
                              proposta.contrato_gerado ? "text-green-600" : "text-gray-400"
                            }`}
                          />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Contrato Gerado</p>
                          <p className="text-sm text-gray-600">
                            {proposta.contrato_gerado ? "Sim" : "Não"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full ${
                            proposta.contrato_assinado ? "bg-green-100" : "bg-gray-200"
                          }`}
                        >
                          <Signature
                            className={`h-5 w-5 ${
                              proposta.contrato_assinado ? "text-green-600" : "text-gray-400"
                            }`}
                          />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Contrato Assinado</p>
                          <p className="text-sm text-gray-600">
                            {proposta.contrato_assinado ? "Sim" : "Não"}
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
                          disabled={!proposta.contrato_gerado}
                          className="flex items-center gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          Visualizar Contrato
                        </Button>
                        <Button
                          variant="outline"
                          disabled={!proposta.contrato_gerado}
                          className="flex items-center gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Baixar Contrato
                        </Button>
                        <Button
                          variant="outline"
                          disabled={!proposta.contrato_gerado || proposta.contrato_assinado}
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Resumo da Proposta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Cliente</Label>
                    <p className="font-medium text-gray-900">{proposta.cliente_data?.nome || 'Nome não informado'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Valor Aprovado</Label>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(proposta.condicoes_data?.valor || 0)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Taxa de Juros</Label>
                    <p className="flex items-center gap-1 font-medium text-gray-900">
                      <Percent className="h-4 w-4" />
                      {/* TODO: Adicionar taxa de juros */}
                      N/A% a.m.
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Prazo</Label>
                    <p className="font-medium text-gray-900">{proposta.condicoes_data?.prazo || 0} meses</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Data da Aprovação</Label>
                    <p className="flex items-center gap-1 text-gray-900">
                      <Calendar className="h-4 w-4" />
                      {formatDate(proposta.data_aprovacao || proposta.created_at)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Edit className="h-5 w-5" />
                  Gerenciar Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="status">Status Atual</Label>
                    <select
                      className="w-full rounded-md border p-2"
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
                    <Label htmlFor="observacoes">Observações</Label>
                    <Textarea
                      id="observacoes"
                      rows={3}
                      placeholder="Adicione observações sobre o processo..."
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Próximos Passos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {proposta.status === "aprovado" && (
                    <div className="rounded-md bg-blue-50 p-3">
                      <p className="text-sm font-medium text-blue-800">
                        Aguardando documentos adicionais
                      </p>
                      <p className="mt-1 text-sm text-blue-700">
                        Cliente deve enviar documentos complementares solicitados.
                      </p>
                    </div>
                  )}
                  {proposta.status === "documentos_enviados" && (
                    <div className="rounded-md bg-purple-50 p-3">
                      <p className="text-sm font-medium text-purple-800">Preparar contratos</p>
                      <p className="mt-1 text-sm text-purple-700">
                        Gerar e preparar contratos para assinatura.
                      </p>
                    </div>
                  )}
                  {proposta.status === "contratos_preparados" && (
                    <div className="rounded-md bg-indigo-50 p-3">
                      <p className="text-sm font-medium text-indigo-800">Aguardando assinatura</p>
                      <p className="mt-1 text-sm text-indigo-700">
                        Contratos enviados para assinatura do cliente.
                      </p>
                    </div>
                  )}
                  {proposta.status === "contratos_assinados" && (
                    <div className="rounded-md bg-orange-50 p-3">
                      <p className="text-sm font-medium text-orange-800">Preparar pagamento</p>
                      <p className="mt-1 text-sm text-orange-700">
                        Processar liberação do valor aprovado.
                      </p>
                    </div>
                  )}
                  {proposta.status === "pronto_pagamento" && (
                    <div className="rounded-md bg-green-50 p-3">
                      <p className="text-sm font-medium text-green-800">Liberar pagamento</p>
                      <p className="mt-1 text-sm text-green-700">
                        Valor pronto para ser liberado ao cliente.
                      </p>
                    </div>
                  )}
                  {proposta.status === "pago" && (
                    <div className="rounded-md bg-green-50 p-3">
                      <p className="text-sm font-medium text-green-800">Processo concluído</p>
                      <p className="mt-1 text-sm text-green-700">
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
