import React from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Clock, User, FileText, DollarSign, Calendar, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface FormalizacaoData {
  id: number;
  status: string;
  clienteData: {
    nome: string;
    cpf: string;
    email: string;
    telefone: string;
  };
  condicoesData: {
    valor: number;
    prazo: number;
  };
  dataAprovacao: string | null;
  documentosAdicionais: string | null;
  contratoGerado: boolean;
  contratoAssinado: boolean;
  dataAssinatura: string | null;
  dataPagamento: string | null;
  observacoesFormalização: string | null;
  createdAt: string;
  lojaNome: string;
  parceiroRazaoSocial: string;
  produtoNome: string;
}

const ChecklistItem = ({ label, completed }: { label: string; completed: boolean }) => (
  <div className="bg-secondary/50 flex items-center space-x-3 rounded-md p-3">
    {completed ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <Clock className="h-5 w-5 text-yellow-500" />
    )}
    <span className="font-medium">{label}</span>
  </div>
);

const StatusBadge = ({ status }: { status: string }) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "aprovado":
        return { variant: "default" as const, color: "bg-green-500", label: "Aprovado" };
      case "documentos_enviados":
        return { variant: "secondary" as const, color: "bg-blue-500", label: "Documentos Enviados" };
      case "contratos_preparados":
        return { variant: "secondary" as const, color: "bg-purple-500", label: "Contratos Preparados" };
      case "contratos_assinados":
        return { variant: "default" as const, color: "bg-orange-500", label: "Contratos Assinados" };
      case "pronto_pagamento":
        return { variant: "default" as const, color: "bg-amber-500", label: "Pronto para Pagamento" };
      case "pago":
        return { variant: "default" as const, color: "bg-green-600", label: "Pago" };
      default:
        return { variant: "outline" as const, color: "bg-gray-500", label: status };
    }
  };

  const config = getStatusConfig(status);
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

const AcompanhamentoFormalizacao: React.FC = () => {
  const [match, params] = useRoute("/formalizacao/acompanhamento/:id");
  const propostaId = params?.id;

  const { data: proposta, isLoading, error } = useQuery<FormalizacaoData>({
    queryKey: ["/api/propostas", propostaId, "formalizacao"],
    queryFn: () => apiRequest(`/api/propostas/${propostaId}/formalizacao`, { method: 'GET' }),
    enabled: !!propostaId && !isNaN(parseInt(propostaId)),
  });

  if (isLoading) {
    return (
      <DashboardLayout title="Carregando...">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <Clock className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Carregando dados da proposta...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !proposta) {
    return (
      <DashboardLayout title="Erro">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <p>Erro ao carregar dados da proposta. Verifique se o ID está correto.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`Acompanhamento da Proposta #${proposta.id}`}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Proposta #{proposta.id}</h1>
          <StatusBadge status={proposta.status} />
        </div>

        {/* Informações do Cliente */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Dados do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-400">Nome</p>
              <p className="font-medium">{proposta.clienteData.nome}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400">CPF</p>
              <p className="font-medium">{proposta.clienteData.cpf}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400">Email</p>
              <p className="font-medium">{proposta.clienteData.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400">Telefone</p>
              <p className="font-medium">{proposta.clienteData.telefone}</p>
            </div>
          </CardContent>
        </Card>

        {/* Informações do Empréstimo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Condições do Empréstimo
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-400">Valor Solicitado</p>
              <p className="font-medium">
                R$ {proposta.condicoesData.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400">Prazo</p>
              <p className="font-medium">{proposta.condicoesData.prazo} meses</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400">Produto</p>
              <p className="font-medium">{proposta.produtoNome}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400">Parceiro</p>
              <p className="font-medium">{proposta.parceiroRazaoSocial}</p>
            </div>
          </CardContent>
        </Card>

        {/* Checklist de Formalização */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Checklist de Formalização
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ChecklistItem 
              label="Proposta Aprovada" 
              completed={proposta.status !== "aguardando_analise" && proposta.status !== "em_analise"} 
            />
            <ChecklistItem 
              label="Documentos Adicionais Enviados" 
              completed={proposta.status === "documentos_enviados" || proposta.status === "contratos_preparados" || proposta.status === "contratos_assinados" || proposta.status === "pronto_pagamento" || proposta.status === "pago"} 
            />
            <ChecklistItem 
              label="Contrato Gerado" 
              completed={proposta.contratoGerado} 
            />
            <ChecklistItem 
              label="Contrato Assinado" 
              completed={proposta.contratoAssinado} 
            />
            <ChecklistItem 
              label="Pronto para Pagamento" 
              completed={proposta.status === "pronto_pagamento" || proposta.status === "pago"} 
            />
            <ChecklistItem 
              label="Pagamento Realizado" 
              completed={proposta.status === "pago"} 
            />
          </CardContent>
        </Card>

        {/* Histórico de Datas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Histórico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>Proposta Criada:</span>
              <span className="font-medium">
                {new Date(proposta.createdAt).toLocaleDateString('pt-BR')}
              </span>
            </div>
            {proposta.dataAprovacao && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span>Data de Aprovação:</span>
                  <span className="font-medium">
                    {new Date(proposta.dataAprovacao).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </>
            )}
            {proposta.dataAssinatura && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span>Data de Assinatura:</span>
                  <span className="font-medium">
                    {new Date(proposta.dataAssinatura).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </>
            )}
            {proposta.dataPagamento && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span>Data de Pagamento:</span>
                  <span className="font-medium">
                    {new Date(proposta.dataPagamento).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Observações */}
        {proposta.observacoesFormalização && (
          <Card>
            <CardHeader>
              <CardTitle>Observações</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300">{proposta.observacoesFormalização}</p>
            </CardContent>
          </Card>
        )}

        {/* Ações */}
        <div className="flex gap-4">
          <Button variant="outline">Reenviar Links para o Cliente</Button>
          <Button variant="outline">Atualizar Status</Button>
          <Button variant="outline">Adicionar Observação</Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AcompanhamentoFormalizacao;
