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
// Removido temporariamente para resolver problema do Vite
// import { PropostaAnaliseViewModel, PropostaApiResponse } from '@/types/proposta.types';
// import { PropostaMapper } from '@/mappers/proposta.mapper';

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

// Helper removido - agora usamos o PropostaMapper

const fetchProposta = async (id: string | undefined): Promise<any> => {
  if (!id) throw new Error('ID da proposta não fornecido.');
  try {
    const response = await api.get(`/api/propostas/${id}`);
    console.log('[Análise] Resposta bruta da API:', response.data);
    
    // Usar dados diretamente sem mapper temporariamente
    const data = response.data.success !== undefined ? response.data.data : response.data;
    
    return data;
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
  } = useQuery<PropostaAnaliseViewModel>({
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

  // Mapper inline básico para compatibilidade temporária
  const mapProposta = (rawData: any) => {
    // 🔍 DEBUG: Log dos dados para identificar campos financeiros
    console.log('[MAPPER] Dados brutos da API:', JSON.stringify(rawData, null, 2));
    
    // Parse client data if it's a JSON string
    let clienteData = rawData.cliente_data || rawData.clienteData || {};
    if (typeof clienteData === 'string') {
      try {
        clienteData = JSON.parse(clienteData);
      } catch (e) {
        clienteData = {};
      }
    }

    return {
      id: rawData.id,
      numeroProposta: rawData.numero_proposta || rawData.numeroProposta,
      status: rawData.status || 'N/A',
      cliente: {
        nome: clienteData.nome || rawData.cliente_nome || rawData.clienteNome || 'N/A',
        cpf: clienteData.cpf || rawData.cliente_cpf || rawData.clienteCpf || 'N/A',
        email: clienteData.email || rawData.cliente_email || rawData.clienteEmail || 'N/A',
        telefone: clienteData.telefone || rawData.cliente_telefone || rawData.clienteTelefone || 'N/A',
        dataNascimento: clienteData.data_nascimento || clienteData.dataNascimento || rawData.cliente_data_nascimento || 'N/A',
        rendaMensal: safeRender(clienteData.renda_mensal || clienteData.rendaMensal || rawData.cliente_renda),
        rg: clienteData.rg || rawData.cliente_rg || rawData.clienteRg || 'N/A',
        orgaoEmissor: clienteData.orgao_emissor || clienteData.orgaoEmissor || rawData.cliente_orgao_emissor || 'N/A',
        estadoCivil: clienteData.estado_civil || clienteData.estadoCivil || rawData.cliente_estado_civil || 'N/A',
        nacionalidade: clienteData.nacionalidade || rawData.cliente_nacionalidade || 'N/A',
        cep: clienteData.cep || rawData.cliente_cep || rawData.clienteCep || 'N/A',
        endereco: clienteData.endereco || rawData.cliente_endereco || rawData.clienteEndereco || 'N/A',
        ocupacao: clienteData.ocupacao || rawData.cliente_ocupacao || rawData.clienteOcupacao || 'N/A'
      },
      condicoes: {
        valorSolicitado: safeRender(
          rawData.valor_solicitado || rawData.valorSolicitado || rawData.valor || 
          rawData.amount || rawData.loan_amount || rawData.loanAmount ||
          clienteData.valor_solicitado || clienteData.valorSolicitado
        ),
        prazo: rawData.prazo || rawData.prazo_meses || rawData.term || rawData.months || 
               rawData.duration || clienteData.prazo || 'N/A',
        finalidade: rawData.finalidade || rawData.purpose || rawData.loan_purpose || 
                   clienteData.finalidade || 'N/A',
        garantia: rawData.garantia || rawData.guarantee || rawData.collateral || 
                 clienteData.garantia || 'N/A',
        valorTac: safeRender(
          rawData.valor_tac || rawData.valorTac || rawData.tac || rawData.tac_amount ||
          clienteData.valor_tac || clienteData.valorTac
        ),
        valorIof: safeRender(
          rawData.valor_iof || rawData.valorIof || rawData.iof || rawData.iof_amount ||
          clienteData.valor_iof || clienteData.valorIof
        ),
        valorTotalFinanciado: safeRender(
          rawData.valor_total_financiado || rawData.valorTotalFinanciado || 
          rawData.total_amount || rawData.totalAmount || rawData.financed_amount ||
          clienteData.valor_total_financiado || clienteData.valorTotalFinanciado
        ),
        taxaJuros: rawData.taxa_juros || rawData.taxaJuros || rawData.interest_rate || 
                  rawData.interestRate || clienteData.taxa_juros || clienteData.taxaJuros
      },
      produto: {
        id: rawData.produto_id,
        nome: rawData.produto_nome || rawData.produtoNome || 'N/A'
      },
      loja: {
        id: rawData.loja_id,
        nome: rawData.loja_nome || rawData.lojaNome || 'N/A'
      },
      tabelaComercial: {
        id: rawData.tabela_comercial_id,
        nome: rawData.tabela_comercial_nome || 'N/A',
        taxa: rawData.tabela_comercial_taxa
      },
      createdAt: rawData.created_at || rawData.createdAt,
      updatedAt: rawData.updated_at || rawData.updatedAt,
      motivoPendencia: rawData.motivo_pendencia || rawData.motivoPendencia,
      motivoRejeicao: rawData.motivo_rejeicao || rawData.motivoRejeicao,
      observacoes: rawData.observacoes,
      documentos: rawData.documentos || []
    };
  };

  const propostaMapeada = mapProposta(proposta);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['proposta', propostaId] });
    queryClient.invalidateQueries({ queryKey: ['proposta_logs', propostaId] });
    queryClient.invalidateQueries({ queryKey: [`/api/propostas/${propostaId}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/propostas/${propostaId}/observacoes`] });
  };

  return (
    <DashboardLayout
      title={`Análise Manual - Proposta #${propostaMapeada.id}`}
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
                <strong>Nome:</strong> {propostaMapeada.cliente.nome}
              </p>
              <p>
                <strong>CPF:</strong> {propostaMapeada.cliente.cpf}
              </p>
              <p>
                <strong>Email:</strong> {propostaMapeada.cliente.email}
              </p>
              <p>
                <strong>Telefone:</strong> {propostaMapeada.cliente.telefone}
              </p>
              <p>
                <strong>Data de Nascimento:</strong> {propostaMapeada.cliente.dataNascimento}
              </p>
              <p>
                <strong>Renda Mensal:</strong> {propostaMapeada.cliente.rendaMensal}
              </p>
              <p>
                <strong>RG:</strong> {propostaMapeada.cliente.rg}
              </p>
              <p>
                <strong>Órgão Emissor:</strong> {propostaMapeada.cliente.orgaoEmissor}
              </p>
              <p>
                <strong>Estado Civil:</strong> {propostaMapeada.cliente.estadoCivil}
              </p>
              <p>
                <strong>Nacionalidade:</strong> {propostaMapeada.cliente.nacionalidade}
              </p>
              <p>
                <strong>CEP:</strong> {propostaMapeada.cliente.cep}
              </p>
              <p>
                <strong>Endereço:</strong> {propostaMapeada.cliente.endereco}
              </p>
              <p>
                <strong>Ocupação:</strong> {propostaMapeada.cliente.ocupacao}
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
                <strong>Valor Solicitado:</strong> {propostaMapeada.condicoes.valorSolicitado}
              </p>
              <p>
                <strong>Prazo:</strong> {propostaMapeada.condicoes.prazo} meses
              </p>
              <p>
                <strong>Finalidade:</strong> {propostaMapeada.condicoes.finalidade}
              </p>
              <p>
                <strong>Garantia:</strong> {propostaMapeada.condicoes.garantia}
              </p>
              <p>
                <strong>TAC:</strong> {propostaMapeada.condicoes.valorTac}
              </p>
              <p>
                <strong>IOF:</strong> {propostaMapeada.condicoes.valorIof}
              </p>
              <p>
                <strong>Valor Total Financiado:</strong> {propostaMapeada.condicoes.valorTotalFinanciado}
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
                <strong>Status Atual:</strong> {propostaMapeada.status}
              </p>
              <p>
                <strong>Produto:</strong> {propostaMapeada.produto.nome}
              </p>
              <p>
                <strong>Loja:</strong> {propostaMapeada.loja.nome}
              </p>
              <p>
                <strong>Data de Criação:</strong>{' '}
                {propostaMapeada.createdAt
                  ? new Date(propostaMapeada.createdAt).toLocaleDateString('pt-BR')
                  : 'N/A'}
              </p>
              {propostaMapeada.observacoes && (
                <p>
                  <strong>Observações:</strong> {propostaMapeada.observacoes}
                </p>
              )}
              {propostaMapeada.motivoPendencia && (
                <p>
                  <strong>Motivo da Pendência:</strong> {propostaMapeada.motivoPendencia}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Visualizador de Documentos */}
          {propostaMapeada.documentos && propostaMapeada.documentos.length > 0 && (
            <DocumentViewer
              propostaId={propostaId!}
              documents={propostaMapeada.documentos?.map((doc: any) => ({
                ...doc,
                name: doc.nome || doc.name || 'Documento'
              })) || []}
              ccbDocumentoUrl={undefined}
            />
          )}

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
