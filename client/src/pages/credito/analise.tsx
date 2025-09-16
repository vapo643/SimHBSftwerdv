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
import { PropostaMapper } from '@/mappers/proposta.mapper';
import { queryKeys } from '@/hooks/queries/queryKeys';
// Removido temporariamente para resolver problema do Vite

// 🔧 Formatadores específicos para diferentes tipos de dados
const formatAsCurrency = (value: any): string => {
  if (value === null || value === undefined) return 'N/A';
  return PropostaMapper.formatMoney(value);
};

const formatAsPercent = (value: any): string => {
  if (value === null || value === undefined || value === '') return 'N/A';
  const numValue = Number(value);
  if (isNaN(numValue)) return 'N/A'; // 🔧 BLINDAGEM: Nunca retorna "NaN" literal
  return `${numValue.toFixed(2).replace('.', ',')}%`;
};

// 🔧 Helper function simplificada - apenas para valores nulos e conversão de string
const safeRender = (value: any): string => {
  if (value === null || value === undefined || value === '') return 'N/A';
  return String(value);
};

// Helper removido - agora usamos o PropostaMapper

const fetchProposta = async (id: string | undefined): Promise<any> => {
  if (!id) throw new Error('ID da proposta não fornecido.');
  try {
    // API methods now return normalized data directly (envelope unwrapping handled centrally)
    const data = await api.get(`/api/propostas/${id}`);
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
    (data: { status: string; observacao?: string }) => {
      // Observação é obrigatória quando o status é "pendenciado" OU "rejeitado"
      if (data.status === 'pendenciado' || data.status === 'rejeitado') {
        return data.observacao && data.observacao.trim().length > 0;
      }
      // Para "aprovado", observação é opcional
      return true;
    },
    {
      message: 'Observação/motivo é obrigatório para rejeições e pendências',
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
  } = useQuery<any>({
    queryKey: queryKeys.proposta.all(propostaId || ''),
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
      // Invalidar múltiplas queries para sincronização completa usando query keys padronizados
      if (propostaId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.proposta.all(propostaId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.proposta.logs(propostaId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.proposta.historico(propostaId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.proposta.observacoes(propostaId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.propostas.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.propostas.analise() });
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

  // Mapper inline para dados da API com estrutura aninhada
  const mapProposta = (rawData: any) => {
    // Parse client data if it's a JSON string
    let clienteData = rawData.cliente_data || rawData.clienteData || {};
    if (typeof clienteData === 'string') {
      try {
        clienteData = JSON.parse(clienteData);
      } catch (e) {
        clienteData = {};
      }
    }

    // Extrair dados dos objetos aninhados
    const produto = rawData.produto || {};
    const tabelaComercial = rawData.tabelaComercial || {};
    const condicoesData = rawData.condicoesData || {};

    return {
      id: rawData.id,
      numeroProposta: rawData.numero_proposta || rawData.numeroProposta,
      status: rawData.status || 'N/A',
      cliente: {
        // 🛡️ BLINDAGEM ANTI-REGRESSÃO: Múltiplas convenções de nomenclatura suportadas
        nome: rawData.nomeCliente || rawData.clienteNome || rawData.cliente_nome || clienteData.nome || 'N/A',
        cpf: rawData.cpfCliente || rawData.clienteCpf || rawData.cliente_cpf || clienteData.cpf || 'N/A',
        email: (rawData.emailCliente && rawData.emailCliente.trim()) || rawData.clienteEmail || rawData.cliente_email || clienteData.email || 'N/A',
        telefone: (rawData.telefoneCliente && rawData.telefoneCliente.trim()) || rawData.clienteTelefone || rawData.cliente_telefone || clienteData.telefone || 'N/A',
        dataNascimento:
          rawData.clienteDataNascimento ||
          rawData.cliente_data_nascimento ||
          clienteData.data_nascimento ||
          clienteData.dataNascimento ||
          'N/A',
        rendaMensal: rawData.clienteRenda || rawData.cliente_renda || clienteData.renda_mensal || clienteData.rendaMensal || 0,
        rg: rawData.clienteRg || rawData.cliente_rg || clienteData.rg || 'N/A',
        orgaoEmissor:
          rawData.clienteOrgaoEmissor ||
          rawData.cliente_orgao_emissor ||
          clienteData.orgao_emissor ||
          clienteData.orgaoEmissor ||
          'N/A',
        estadoCivil:
          rawData.clienteEstadoCivil ||
          rawData.cliente_estado_civil ||
          clienteData.estado_civil ||
          clienteData.estadoCivil ||
          'N/A',
        nacionalidade: rawData.clienteNacionalidade || rawData.cliente_nacionalidade || clienteData.nacionalidade || 'N/A',
        cep: rawData.clienteCep || rawData.cliente_cep || clienteData.cep || 'N/A',
        endereco:
          rawData.clienteEndereco ||
          rawData.cliente_endereco ||
          clienteData.endereco ||
          'N/A',
        ocupacao:
          rawData.clienteOcupacao ||
          rawData.cliente_ocupacao ||
          clienteData.ocupacao ||
          'N/A',
      },
      condicoes: {
        // ✍️ CORREÇÃO: Usar dados diretos da API com fallbacks mínimos para compatibilidade
        valorSolicitado: formatAsCurrency(
          rawData.valorSolicitado || rawData.valor || condicoesData.valorSolicitado
        ),
        prazo: rawData.prazo || condicoesData.prazo || 'N/A',
        finalidade: rawData.finalidade || condicoesData.finalidade || 'N/A',
        garantia: rawData.garantia || condicoesData.garantia || 'N/A',
        valorTac: formatAsCurrency(rawData.valorTac || condicoesData.valorTac),
        tacTipo: rawData.tacTipo || 'valor',
        valorIof: formatAsCurrency(rawData.valorIof || condicoesData.valorIof),
        valorTotalFinanciado: formatAsCurrency(
          rawData.valorTotalFinanciado || condicoesData.valorTotalFinanciado
        ),
        taxaJuros: formatAsPercent(rawData.taxaJuros || rawData.taxa_juros || tabelaComercial.taxaJuros),
      },
      produto: {
        id: rawData.produtoId || rawData.produto_id,
        // ✅ CORRIGIDO: API individual retorna produtoNome diretamente
        nome: rawData.produtoNome || produto.nomeProduto || rawData.produto_nome || 'N/A',
      },
      loja: {
        id: rawData.lojaId || rawData.loja_id,
        // ✅ CORRIGIDO: API individual retorna loja.nomeLoja no objeto aninhado
        nome:
          (rawData.loja && rawData.loja.nomeLoja) || rawData.lojaNome || rawData.loja_nome || 'N/A',
      },
      tabelaComercial: {
        id: rawData.tabelaComercialId || rawData.tabela_comercial_id,
        nome: tabelaComercial.nomeTabela || rawData.tabela_comercial_nome || 'N/A',
        taxa: tabelaComercial.taxaJuros || rawData.tabela_comercial_taxa,
      },
      createdAt: rawData.created_at || rawData.createdAt,
      updatedAt: rawData.updated_at || rawData.updatedAt,
      motivoPendencia: rawData.motivo_pendencia || rawData.motivoPendencia,
      motivoRejeicao: rawData.motivo_rejeicao || rawData.motivoRejeicao,
      observacoes: rawData.observacoes,
      documentos: rawData.documentos || [],
    };
  };

  const propostaMapeada = mapProposta(proposta);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['proposta', propostaId] });
    queryClient.invalidateQueries({ queryKey: ['proposta_logs', propostaId] });
    queryClient.invalidateQueries({ queryKey: ['proposta_historico', propostaId] });
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
                <strong>Nome:</strong> {safeRender(propostaMapeada.cliente.nome)}
              </p>
              <p>
                <strong>CPF:</strong> {safeRender(propostaMapeada.cliente.cpf)}
              </p>
              <p>
                <strong>Email:</strong> {safeRender(propostaMapeada.cliente.email)}
              </p>
              <p>
                <strong>Telefone:</strong> {safeRender(propostaMapeada.cliente.telefone)}
              </p>
              <p>
                <strong>Data de Nascimento:</strong>{' '}
                {safeRender(propostaMapeada.cliente.dataNascimento)}
              </p>
              <p>
                <strong>Renda Mensal:</strong> {formatAsCurrency(propostaMapeada.cliente.rendaMensal)}
              </p>
              <p>
                <strong>RG:</strong> {safeRender(propostaMapeada.cliente.rg)}
              </p>
              <p>
                <strong>Órgão Emissor:</strong> {safeRender(propostaMapeada.cliente.orgaoEmissor)}
              </p>
              <p>
                <strong>Estado Civil:</strong> {safeRender(propostaMapeada.cliente.estadoCivil)}
              </p>
              <p>
                <strong>Nacionalidade:</strong> {safeRender(propostaMapeada.cliente.nacionalidade)}
              </p>
              <p>
                <strong>CEP:</strong> {safeRender(propostaMapeada.cliente.cep)}
              </p>
              <p>
                <strong>Endereço:</strong> {safeRender(propostaMapeada.cliente.endereco)}
              </p>
              <p>
                <strong>Ocupação:</strong> {safeRender(propostaMapeada.cliente.ocupacao)}
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
                {propostaMapeada.condicoes.valorSolicitado}
              </p>
              <p>
                <strong>Prazo:</strong>{' '}
                {Number.isFinite(Number(propostaMapeada.condicoes.prazo))
                  ? `${safeRender(propostaMapeada.condicoes.prazo)} meses`
                  : safeRender(propostaMapeada.condicoes.prazo)}
              </p>
              <p>
                <strong>Finalidade:</strong> {safeRender(propostaMapeada.condicoes.finalidade)}
              </p>
              <p>
                <strong>Garantia:</strong> {safeRender(propostaMapeada.condicoes.garantia)}
              </p>
              <p>
                <strong>Valor Total Financiado:</strong>{' '}
                {propostaMapeada.condicoes.valorTotalFinanciado}
              </p>
              {propostaMapeada.condicoes.taxaJuros !== 'N/A' && (
                <p>
                  <strong>Taxa de Juros:</strong> {propostaMapeada.condicoes.taxaJuros}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Card de Informações da Proposta */}
          <Card>
            <CardHeader>
              <CardTitle>Informações da Proposta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p>
                <strong>Status Atual:</strong> {safeRender(propostaMapeada.status)}
              </p>
              <p>
                <strong>Produto:</strong> {safeRender(propostaMapeada.produto.nome)}
              </p>
              <p>
                <strong>Loja:</strong> {safeRender(propostaMapeada.loja.nome)}
              </p>
              <p>
                <strong>Data de Criação:</strong>{' '}
                {propostaMapeada.createdAt
                  ? new Date(propostaMapeada.createdAt).toLocaleDateString('pt-BR')
                  : 'N/A'}
              </p>
              {propostaMapeada.observacoes && (
                <p>
                  <strong>Observações:</strong> {safeRender(propostaMapeada.observacoes)}
                </p>
              )}
              {propostaMapeada.motivoPendencia && (
                <p>
                  <strong>Motivo da Pendência:</strong>{' '}
                  {safeRender(propostaMapeada.motivoPendencia)}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Visualizador de Documentos - THREAD C.1 CORREÇÃO */}
          {propostaId && (
            <DocumentViewer
              propostaId={propostaId}
              documents={
                propostaMapeada.documentos?.map((fileName: string) => ({
                  name: fileName,
                  url: '', // API will fetch real URLs
                })) || []
              }
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
                    <Label htmlFor="observacao">Observações (obrigatório para rejeições e pendências)</Label>
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
