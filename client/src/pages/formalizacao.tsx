import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle, 
  Clock, 
  FileText, 
  AlertCircle,
  User,
  CreditCard
} from "lucide-react";

interface Proposta {
  id: number;
  clienteNome: string;
  valor: string;
  status: string;
  createdAt: string;
}

export default function Formalizacao() {
  const [, params] = useRoute("/formalizacao/acompanhamento/:id");
  const propostaId = params?.id;

  const { data: proposta, isLoading } = useQuery<Proposta>({
    queryKey: ["/api/propostas", propostaId],
    enabled: !!propostaId,
  });

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(parseFloat(value));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getStatusProgress = (status: string) => {
    const statusMap = {
      'aprovado': 25,
      'documentos_enviados': 50,
      'contratos_assinados': 75,
      'pronto_pagamento': 100,
      'pago': 100,
    };
    return statusMap[status as keyof typeof statusMap] || 0;
  };

  const formalizationSteps = [
    {
      id: 1,
      title: "Proposta Aprovada",
      description: "Proposta foi aprovada pela equipe de crédito",
      icon: CheckCircle,
      status: "completed",
      date: "15/12/2023",
    },
    {
      id: 2,
      title: "Documentos Adicionais",
      description: "Aguardando documentos complementares do cliente",
      icon: FileText,
      status: "current",
      date: "16/12/2023",
    },
    {
      id: 3,
      title: "Contratos e Assinaturas",
      description: "Preparação e assinatura dos contratos",
      icon: User,
      status: "pending",
      date: "17/12/2023",
    },
    {
      id: 4,
      title: "Liberação do Pagamento",
      description: "Processo de liberação do valor aprovado",
      icon: CreditCard,
      status: "pending",
      date: "18/12/2023",
    },
  ];

  if (isLoading) {
    return (
      <DashboardLayout title="Acompanhamento da Formalização">
        <div className="space-y-6">
          <Card className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-32 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!proposta) {
    return (
      <DashboardLayout title="Acompanhamento da Formalização">
        <div className="text-center py-12">
          <p className="text-gray-500">Proposta não encontrada</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`Acompanhamento da Formalização - Proposta #${proposta.id}`}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Proposal Summary */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Resumo da Proposta</h3>
              <Badge variant="default">
                {proposta.status === 'aprovado' ? 'Aprovado' : proposta.status}
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-600">Cliente</p>
                <p className="text-lg font-semibold text-gray-900">{proposta.clienteNome}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Valor Aprovado</p>
                <p className="text-lg font-semibold text-gray-900">{formatCurrency(proposta.valor)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Data da Aprovação</p>
                <p className="text-lg font-semibold text-gray-900">{formatDate(proposta.createdAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Progress Bar */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">Progresso da Formalização</h3>
                <span className="text-sm font-medium text-gray-600">
                  {getStatusProgress(proposta.status)}% concluído
                </span>
              </div>
              <Progress value={getStatusProgress(proposta.status)} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Formalization Steps */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Etapas da Formalização</h3>
            
            <div className="space-y-8">
              {formalizationSteps.map((step, index) => {
                const Icon = step.icon;
                const isCompleted = step.status === 'completed';
                const isCurrent = step.status === 'current';
                
                return (
                  <div key={step.id} className="relative">
                    {index !== formalizationSteps.length - 1 && (
                      <div className={`absolute left-4 top-8 w-0.5 h-16 ${
                        isCompleted ? 'bg-green-500' : 'bg-gray-300'
                      }`} />
                    )}
                    
                    <div className="flex items-start space-x-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isCompleted 
                          ? 'bg-green-500 text-white' 
                          : isCurrent 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-200 text-gray-500'
                      }`}>
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
                          <h4 className={`text-sm font-medium ${
                            isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-500'
                          }`}>
                            {step.title}
                          </h4>
                          <span className="text-xs text-gray-500">{step.date}</span>
                        </div>
                        <p className={`text-sm ${
                          isCompleted || isCurrent ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          {step.description}
                        </p>
                        
                        {isCurrent && (
                          <div className="mt-2 p-3 bg-blue-50 rounded-md">
                            <div className="flex items-center">
                              <AlertCircle className="h-4 w-4 text-blue-600 mr-2" />
                              <span className="text-sm font-medium text-blue-800">
                                Etapa atual em andamento
                              </span>
                            </div>
                            <p className="text-sm text-blue-700 mt-1">
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

        {/* Next Steps */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Próximos Passos</h3>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                <h4 className="text-sm font-medium text-yellow-800">
                  Ação Necessária
                </h4>
              </div>
              <p className="text-sm text-yellow-700 mt-1">
                Cliente deve enviar os documentos complementares solicitados para dar continuidade ao processo.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
