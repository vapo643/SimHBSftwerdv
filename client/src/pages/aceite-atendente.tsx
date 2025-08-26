import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  ChevronLeft,
  CheckCircle,
  XCircle,
  FileText,
  User,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Clock,
} from 'lucide-react';
import { useState } from 'react';
// Remove formatCurrency from utils import
import { apiRequest, queryClient } from '@/lib/queryClient';

interface PropostaAceite {
  id: string;
  status: string;
  nomeCliente: string;
  cpfCliente: string;
  emailCliente: string;
  telefoneCliente: string;
  valorSolicitado: number;
  valorAprovado: number;
  prazo: number;
  dataAprovacao: string;
  observacoesAnalista: string;
  loja?: {
    id: number;
    nomeLoja: string;
  };
  parceiro?: {
    id: number;
    razaoSocial: string;
  };
  createdAt: string;
}

export default function AceiteAtendente() {
  const [observacoes, setObservacoes] = useState<Record<string, string>>({});

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const { data: propostas, isLoading } = useQuery<PropostaAceite[]>({
    queryKey: ['/api/propostas/aguardando-aceite'],
    queryFn: async () => {
      const response = await apiRequest('/api/propostas?status=aguardando_aceite_atendente');
      return response;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      observacao,
    }: {
      id: string;
      status: string;
      observacao: string;
    }) => {
      return apiRequest(`/api/propostas/${id}/status`, {
        method: 'PUT',
        body: { status, observacao },
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/propostas/aguardando-aceite'] });
      toast({
        title: variables.status === 'aceito_atendente' ? 'Proposta aceita' : 'Proposta cancelada',
        description:
          variables.status === 'aceito_atendente'
            ? 'A proposta foi aceita e está pronta para formalização'
            : 'A proposta foi cancelada',
      });
      setObservacoes((prev) => {
        const updated = { ...prev };
        delete updated[variables.id];
        return updated;
      });
    },
    onError: () => {
      toast({
        title: 'Erro ao atualizar status',
        description: 'Não foi possível atualizar o status da proposta',
        variant: 'destructive',
      });
    },
  });

  const handleAccept = (id: string) => {
    const observacao = observacoes[id] || 'Proposta aceita pelo atendente para formalização';
    updateStatusMutation.mutate({ id, status: 'aceito_atendente', observacao });
  };

  const handleReject = (id: string) => {
    const observacao = observacoes[id];
    if (!observacao || observacao.trim() === '') {
      toast({
        title: 'Observação obrigatória',
        description: 'Por favor, informe o motivo do cancelamento',
        variant: 'destructive',
      });
      return;
    }
    updateStatusMutation.mutate({ id, status: 'cancelado', observacao });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando propostas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-8 flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Aceite de Propostas
            </h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              Aceite ou cancele propostas aprovadas pelo analista
            </p>
          </div>
        </div>

        {!propostas || propostas.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur-sm dark:bg-gray-800/80">
            <CardContent className="p-12 text-center">
              <FileText className="mx-auto mb-4 h-16 w-16 text-gray-400" />
              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                Nenhuma proposta aguardando aceite
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Quando uma proposta for aprovada pelo analista, ela aparecerá aqui para seu aceite.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {propostas.map((proposta) => (
              <Card key={proposta.id} className="bg-white/80 backdrop-blur-sm dark:bg-gray-800/80">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">
                      Proposta {proposta.id.substring(0, 8).toUpperCase()}
                    </CardTitle>
                    <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                      Aguardando Aceite
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Dados do Cliente */}
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Dados do Cliente
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">Nome:</span>
                        <span className="text-sm font-medium">{proposta.nomeCliente}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">CPF:</span>
                        <span className="text-sm font-medium">{proposta.cpfCliente}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">Telefone:</span>
                        <span className="text-sm font-medium">{proposta.telefoneCliente}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">Email:</span>
                        <span className="text-sm font-medium">{proposta.emailCliente}</span>
                      </div>
                    </div>
                  </div>

                  {/* Valores */}
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Informações do Empréstimo
                    </h3>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
                        <div className="mb-1 flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-gray-400" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            Valor Solicitado
                          </span>
                        </div>
                        <p className="text-lg font-semibold">
                          {formatCurrency(proposta.valorSolicitado)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
                        <div className="mb-1 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            Valor Aprovado
                          </span>
                        </div>
                        <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                          {formatCurrency(proposta.valorAprovado || proposta.valorSolicitado)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
                        <div className="mb-1 flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">Prazo</span>
                        </div>
                        <p className="text-lg font-semibold">{proposta.prazo} meses</p>
                      </div>
                    </div>
                  </div>

                  {/* Observações do Analista */}
                  {proposta.observacoesAnalista && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Observações do Analista
                      </h3>
                      <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {proposta.observacoesAnalista}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Área de Observações */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Suas Observações
                    </label>
                    <Textarea
                      value={observacoes[proposta.id] || ''}
                      onChange={(e) =>
                        setObservacoes((prev) => ({ ...prev, [proposta.id]: e.target.value }))
                      }
                      placeholder="Digite observações sobre o aceite ou cancelamento..."
                      className="w-full"
                      rows={3}
                    />
                  </div>

                  {/* Ações */}
                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={() => handleAccept(proposta.id)}
                      disabled={updateStatusMutation.isPending}
                      className="flex-1"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Aceitar para Formalização
                    </Button>
                    <Button
                      onClick={() => handleReject(proposta.id)}
                      disabled={updateStatusMutation.isPending}
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Cancelar Proposta
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
