import React from 'react';
import { useRoute, Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle } from 'lucide-react';
import { DocumentViewer } from '@/components/DocumentViewer';
import { useAuth } from '@/contexts/AuthContext';
import HistoricoCompartilhado from '@/components/HistoricoCompartilhado';
import RefreshButton from '@/components/RefreshButton';

import { api } from '@/lib/apiClient';

// 🔧 Helper function to safely render complex values
const safeRender = (value: any): string => {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    // If it has a 'cents' property, convert to currency
    if (value.cents !== undefined) {
      const reais = value.cents / 100;
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(reais);
    }
    // If it has a 'value' property, use that
    if (value.value !== undefined) return String(value.value);
    // If it's an array, join with commas
    if (Array.isArray(value)) return value.join(', ');
    // Otherwise, return JSON string
    return JSON.stringify(value);
  }
  return String(value);
};

// Helper to safely parse cliente_data JSON
const getClienteData = (proposta: any) => {
  if (proposta.cliente_data) {
    try {
      return typeof proposta.cliente_data === 'string' 
        ? JSON.parse(proposta.cliente_data) 
        : proposta.cliente_data;
    } catch {
      return {};
    }
  }
  return {};
};

const fetchProposta = async (id: string | undefined) => {
  if (!id) throw new Error('ID da proposta não fornecido.');
  try {
    const response = await api.get(`/api/propostas/${id}`);
    console.log('[Análise] Proposta carregada:', response.data);
    // A API retorna {success: true, data: {...}}, precisamos apenas do data
    return response.data?.data || response.data;
  } catch (error) {
    console.error('[Análise] Erro ao carregar proposta:', error);
    throw new Error('Proposta não encontrada');
  }
};

// Removido - documentos agora vêm incluídos na proposta

const updatePropostaStatus = async ({
  id,
  status,
  observacao,
  motivoPendencia,
}: {
  id: string;
  status: string;
  observacao?: string;
  motivoPendencia?: string;
}) => {
  try {
    const response = await api.put(`/api/propostas/${id}/status`, {
      status,
      observacao,
      motivoPendencia,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.message || 'Falha ao atualizar status');
  }
};

const decisionSchema = z
  .object({
    status: z.enum(['aprovado', 'rejeitado', 'pendenciado']),
    observacao: z.string().optional(),
  })
  .refine(
    (data) => {
      // Observação é obrigatória APENAS quando o status é "pendenciado"
      if (data.status === 'pendenciado') {
        return data.observacao && data.observacao.trim().length > 0;
      }
      // Para "aprovado" e "rejeitado", observação é opcional
      return true;
    },
    {
      message: 'Observação é obrigatória quando a proposta é pendenciada',
      path: ['observacao'], // Aplica o erro no campo observacao
    }
  );

type DecisionFormData = z.infer<typeof decisionSchema>;

const AnaliseManualPage: React.FC = () => {
  const [match, params] = useRoute('/credito/analise/:id');
  const propostaId = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const {
    data: proposta,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['proposta', propostaId],
    queryFn: () => fetchProposta(propostaId),
    enabled: !!propostaId,
    refetchOnWindowFocus: false, // Desabilitado para evitar rate limiting
    refetchOnReconnect: true,
    staleTime: 5 * 60 * 1000, // 5 minutos - dados ficam válidos por mais tempo
  });

  // Removido - documentos agora vêm incluídos na proposta

  const { register, handleSubmit, control } = useForm<DecisionFormData>({
    resolver: zodResolver(decisionSchema),
  });

  const mutation = useMutation({
    mutationFn: updatePropostaStatus,
    onSuccess: () => {
      toast({ title: 'Sucesso!', description: 'O status da proposta foi atualizado.' });
      // Invalidar múltiplas queries para sincronização completa
      queryClient.invalidateQueries({ queryKey: ['proposta', propostaId] });
      queryClient.invalidateQueries({ queryKey: ['proposta_logs', propostaId] });
      queryClient.invalidateQueries({ queryKey: [`/api/propostas/${propostaId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/propostas/${propostaId}/observacoes`] });
      queryClient.invalidateQueries({ queryKey: ['/api/propostas'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro!', description: error.message, variant: 'destructive' });
    },
  });

  const onSubmit = (data: DecisionFormData) => {
    if (!propostaId) return;

    // For pendenciado status, send observacao as motivoPendencia
    const payload = {
      id: propostaId,
      status: data.status,
      observacao: data.observacao,
      ...(data.status === 'pendenciado' && { motivoPendencia: data.observacao }),
    };

    mutation.mutate(payload);
  };

  if (isLoading)
    return (
      <DashboardLayout title="Análise Manual">
        <p className="p-6">Carregando proposta...</p>
      </DashboardLayout>
    );
  if (isError || !proposta)
    return (
      <DashboardLayout title="Erro">
        <p className="p-6">
          Proposta não encontrada.{' '}
          <Link to="/credito/fila" className="text-blue-500 hover:underline">
            Voltar para a fila.
          </Link>
        </p>
      </DashboardLayout>
    );

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['proposta', propostaId] });
    queryClient.invalidateQueries({ queryKey: ['proposta_logs', propostaId] });
    queryClient.invalidateQueries({ queryKey: [`/api/propostas/${propostaId}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/propostas/${propostaId}/observacoes`] });
  };

  return (
    <DashboardLayout
      title={`Análise Manual - Proposta #${proposta.id}`}
      actions={<RefreshButton onRefresh={handleRefresh} isLoading={isLoading} variant="ghost" />}
    >
      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          {/* Card de Dados do Cliente */}
          <Card>
            <CardHeader>
              <CardTitle>Dados do Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p>
                <strong>Nome:</strong>{' '}
                {safeRender(proposta.cliente_nome ||
                  proposta.clienteNome ||
                  proposta.clienteData?.nome)}
              </p>
              <p>
                <strong>CPF:</strong>{' '}
                {safeRender(proposta.cliente_cpf || proposta.clienteCpf || getClienteData(proposta)?.cpf)}
              </p>
              <p>
                <strong>Email:</strong>{' '}
                {safeRender(proposta.cliente_email ||
                  proposta.clienteEmail ||
                  getClienteData(proposta)?.email)}
              </p>
              <p>
                <strong>Telefone:</strong>{' '}
                {safeRender(proposta.cliente_telefone ||
                  proposta.clienteTelefone ||
                  getClienteData(proposta)?.telefone)}
              </p>
              <p>
                <strong>Data de Nascimento:</strong>{' '}
                {safeRender(proposta.cliente_data_nascimento ||
                  proposta.clienteDataNascimento ||
                  getClienteData(proposta)?.dataNascimento)}
              </p>
              <p>
                <strong>Renda Mensal:</strong>{' '}
                {safeRender(
                  proposta.cliente_renda || 
                  proposta.clienteRenda || 
                  getClienteData(proposta)?.rendaMensal || 
                  getClienteData(proposta)?.renda_mensal ||
                  getClienteData(proposta)?.renda
                )}
              </p>
              <p>
                <strong>RG:</strong>{' '}
                {safeRender(proposta.cliente_rg || proposta.clienteRg || getClienteData(proposta)?.rg)}
              </p>
              <p>
                <strong>Órgão Emissor:</strong>{' '}
                {safeRender(proposta.cliente_orgao_emissor ||
                  proposta.clienteOrgaoEmissor ||
                  getClienteData(proposta)?.orgaoEmissor)}
              </p>
              <p>
                <strong>Estado Civil:</strong>{' '}
                {safeRender(proposta.cliente_estado_civil ||
                  proposta.clienteEstadoCivil ||
                  getClienteData(proposta)?.estadoCivil)}
              </p>
              <p>
                <strong>Nacionalidade:</strong>{' '}
                {safeRender(proposta.cliente_nacionalidade ||
                  proposta.clienteNacionalidade ||
                  getClienteData(proposta)?.nacionalidade)}
              </p>
              <p>
                <strong>CEP:</strong>{' '}
                {safeRender(proposta.cliente_cep || proposta.clienteCep || getClienteData(proposta)?.cep)}
              </p>
              <p>
                <strong>Endereço:</strong>{' '}
                {safeRender(proposta.cliente_endereco ||
                  proposta.clienteEndereco ||
                  getClienteData(proposta)?.endereco)}
              </p>
              <p>
                <strong>Ocupação:</strong>{' '}
                {safeRender(proposta.cliente_ocupacao ||
                  proposta.clienteOcupacao ||
                  getClienteData(proposta)?.ocupacao)}
              </p>
            </CardContent>
          </Card>

          {/* Card de Condições do Empréstimo */}
          <Card>
            <CardHeader>
              <CardTitle>Condições do Empréstimo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p>
                <strong>Valor Solicitado:</strong>{' '}
                {safeRender(proposta.valor || proposta.valor_solicitado || proposta.valorSolicitado || proposta.condicoesData?.valor)}
              </p>
              <p>
                <strong>Prazo:</strong>{' '}
                {proposta.prazo || proposta.condicoesData?.prazo
                  ? `${safeRender(proposta.prazo || proposta.condicoesData.prazo)} meses`
                  : 'N/A'}
              </p>
              <p>
                <strong>Finalidade:</strong>{' '}
                {proposta.finalidade || proposta.condicoesData?.finalidade || 'Não informado'}
              </p>
              <p>
                <strong>Garantia:</strong>{' '}
                {proposta.garantia || proposta.condicoesData?.garantia || 'Não informado'}
              </p>
              <p>
                <strong>TAC:</strong>{' '}
                {safeRender(proposta.valor_tac || proposta.valorTac || proposta.condicoesData?.valorTac)}
              </p>
              <p>
                <strong>IOF:</strong>{' '}
                {safeRender(proposta.valor_iof || proposta.valorIof || proposta.condicoesData?.valorIof)}
              </p>
              <p>
                <strong>Valor Total Financiado:</strong>{' '}
                {safeRender(proposta.valor_total_financiado || proposta.valorTotalFinanciado || proposta.condicoesData?.valorTotalFinanciado)}
              </p>
            </CardContent>
          </Card>

          {/* Card de Informações da Proposta */}
          <Card>
            <CardHeader>
              <CardTitle>Informações da Proposta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p>
                <strong>Status Atual:</strong> {safeRender(proposta.status)}
              </p>
              <p>
                <strong>Parceiro:</strong> {safeRender(proposta.parceiro?.razaoSocial || proposta.loja_nome || 'Parceiro Padrão')}
              </p>
              <p>
                <strong>Loja:</strong> {safeRender(proposta.loja_nome || proposta.loja?.nomeLoja || 'N/A')}
              </p>
              <p>
                <strong>Data de Criação:</strong>{' '}
                {proposta.createdAt
                  ? new Date(proposta.createdAt).toLocaleDateString('pt-BR')
                  : 'N/A'}
              </p>
              {proposta.ccbDocumentoUrl && (
                <p>
                  <strong>Documento CCB:</strong>
                  <a
                    href={proposta.ccbDocumentoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-500 hover:underline"
                  >
                    Visualizar Documento
                  </a>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Visualizador de Documentos */}
          <DocumentViewer
            propostaId={propostaId!}
            documents={proposta.documentos || []}
            ccbDocumentoUrl={proposta.ccbDocumentoUrl}
          />

          {/* Renderização condicional - Painel de Decisão apenas para ANALISTA e ADMINISTRADOR */}
          {user && (user.role === 'ANALISTA' || user.role === 'ADMINISTRADOR') ? (
            <Card>
              <CardHeader>
                <CardTitle>Painel de Decisão</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <Label>Decisão</Label>
                    <Controller
                      name="status"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma decisão..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="aprovado">Aprovar Proposta</SelectItem>
                            <SelectItem value="rejeitado">Negar Proposta</SelectItem>
                            <SelectItem value="pendenciado">Pendenciar</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div>
                    <Label htmlFor="observacao">Observações (obrigatório se pendenciar)</Label>
                    <Textarea id="observacao" {...register('observacao')} />
                  </div>
                  <Button type="submit" className="w-full" disabled={mutation.isPending}>
                    {mutation.isPending ? 'Salvando...' : 'Confirmar Decisão'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Visualização da Proposta</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Você está visualizando esta proposta em modo de leitura. Apenas analistas podem
                  aprovar ou negar propostas.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
        <div className="md:col-span-1">
          {/* Histórico de Comunicação - Compartilhado V2 */}
          <HistoricoCompartilhado propostaId={propostaId!} context="analise" />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AnaliseManualPage;
