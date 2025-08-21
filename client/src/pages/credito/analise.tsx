import React from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";
import { DocumentViewer } from "@/components/DocumentViewer";
import { useAuth } from "@/contexts/AuthContext";
import HistoricoCompartilhado from "@/components/HistoricoCompartilhado";
import RefreshButton from "@/components/RefreshButton";

import { api } from "@/lib/apiClient";

const fetchProposta = async (id: string | undefined) => {
  if (!id) throw new Error("ID da proposta não fornecido.");
  try {
    const response = await api.get(`/api/propostas/${id}`);
    console.log("[Análise] Proposta carregada:", response.data);
    return response.data;
  } catch (error) {
    console.error("[Análise] Erro ao carregar proposta:", error);
    throw new Error("Proposta não encontrada");
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
    throw new Error(error.message || "Falha ao atualizar status");
  }
};

const decisionSchema = z
  .object({
    status: z.enum(["aprovado", "rejeitado", "pendenciado"]),
    observacao: z.string().optional(),
  })
  .refine(
    data => {
      // Observação é obrigatória APENAS quando o status é "pendenciado"
      if (data.status === "pendenciado") {
        return data.observacao && data.observacao.trim().length > 0;
      }
      // Para "aprovado" e "rejeitado", observação é opcional
      return true;
    },
    {
      message: "Observação é obrigatória quando a proposta é pendenciada",
      path: ["observacao"], // Aplica o erro no campo observacao
    }
  );

type DecisionFormData = z.infer<typeof decisionSchema>;

const AnaliseManualPage: React.FC = () => {
  const [match, params] = useRoute("/credito/analise/:id");
  const propostaId = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const {
    data: proposta,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["proposta", propostaId],
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
      toast({ title: "Sucesso!", description: "O status da proposta foi atualizado." });
      // Invalidar múltiplas queries para sincronização completa
      queryClient.invalidateQueries({ queryKey: ["proposta", propostaId] });
      queryClient.invalidateQueries({ queryKey: ["proposta_logs", propostaId] });
      queryClient.invalidateQueries({ queryKey: [`/api/propostas/${propostaId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/propostas/${propostaId}/observacoes`] });
      queryClient.invalidateQueries({ queryKey: ["/api/propostas"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro!", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: DecisionFormData) => {
    if (!propostaId) return;

    // For pendenciado status, send observacao as motivoPendencia
    const payload = {
      id: propostaId,
      status: data.status,
      observacao: data.observacao,
      ...(data.status === "pendenciado" && { motivoPendencia: data.observacao }),
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
          Proposta não encontrada.{" "}
          <Link to="/credito/fila" className="text-blue-500 hover:underline">
            Voltar para a fila.
          </Link>
        </p>
      </DashboardLayout>
    );

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["proposta", propostaId] });
    queryClient.invalidateQueries({ queryKey: ["proposta_logs", propostaId] });
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
                <strong>Nome:</strong> {proposta.cliente_nome || proposta.clienteNome || proposta.clienteData?.nome || "N/A"}
              </p>
              <p>
                <strong>CPF:</strong> {proposta.cliente_cpf || proposta.clienteCpf || proposta.clienteData?.cpf || "N/A"}
              </p>
              <p>
                <strong>Email:</strong> {proposta.cliente_email || proposta.clienteEmail || proposta.clienteData?.email || "N/A"}
              </p>
              <p>
                <strong>Telefone:</strong> {proposta.cliente_telefone || proposta.clienteTelefone || proposta.clienteData?.telefone || "N/A"}
              </p>
              <p>
                <strong>Data de Nascimento:</strong> {proposta.cliente_data_nascimento || proposta.clienteDataNascimento || proposta.clienteData?.dataNascimento || "N/A"}
              </p>
              <p>
                <strong>Renda Mensal:</strong>{" "}
                {proposta.cliente_renda || proposta.clienteRenda || proposta.clienteData?.renda ? 
                  `R$ ${proposta.cliente_renda || proposta.clienteRenda || proposta.clienteData.renda}` : "N/A"}
              </p>
              <p>
                <strong>RG:</strong> {proposta.cliente_rg || proposta.clienteRg || proposta.clienteData?.rg || "N/A"}
              </p>
              <p>
                <strong>Órgão Emissor:</strong> {proposta.cliente_orgao_emissor || proposta.clienteOrgaoEmissor || proposta.clienteData?.orgaoEmissor || "N/A"}
              </p>
              <p>
                <strong>Estado Civil:</strong> {proposta.cliente_estado_civil || proposta.clienteEstadoCivil || proposta.clienteData?.estadoCivil || "N/A"}
              </p>
              <p>
                <strong>Nacionalidade:</strong> {proposta.cliente_nacionalidade || proposta.clienteNacionalidade || proposta.clienteData?.nacionalidade || "N/A"}
              </p>
              <p>
                <strong>CEP:</strong> {proposta.cliente_cep || proposta.clienteCep || proposta.clienteData?.cep || "N/A"}
              </p>
              <p>
                <strong>Endereço:</strong> {proposta.cliente_endereco || proposta.clienteEndereco || proposta.clienteData?.endereco || "N/A"}
              </p>
              <p>
                <strong>Ocupação:</strong> {proposta.cliente_ocupacao || proposta.clienteOcupacao || proposta.clienteData?.ocupacao || "N/A"}
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
                <strong>Valor Solicitado:</strong>{" "}
                {proposta.valor_solicitado || proposta.valorSolicitado || proposta.condicoesData?.valor ? 
                  `R$ ${proposta.valor_solicitado || proposta.valorSolicitado || proposta.condicoesData.valor}` : "N/A"}
              </p>
              <p>
                <strong>Prazo:</strong>{" "}
                {proposta.prazo || proposta.condicoesData?.prazo ? 
                  `${proposta.prazo || proposta.condicoesData.prazo} meses` : "N/A"}
              </p>
              <p>
                <strong>Finalidade:</strong> {proposta.finalidade || proposta.condicoesData?.finalidade || "N/A"}
              </p>
              <p>
                <strong>Garantia:</strong> {proposta.garantia || proposta.condicoesData?.garantia || "N/A"}
              </p>
              <p>
                <strong>TAC:</strong>{" "}
                {proposta.valor_tac || proposta.valorTac || proposta.condicoesData?.valorTac ? 
                  `R$ ${proposta.valor_tac || proposta.valorTac || proposta.condicoesData.valorTac}` : "N/A"}
              </p>
              <p>
                <strong>IOF:</strong>{" "}
                {proposta.valor_iof || proposta.valorIof || proposta.condicoesData?.valorIof ? 
                  `R$ ${proposta.valor_iof || proposta.valorIof || proposta.condicoesData.valorIof}` : "N/A"}
              </p>
              <p>
                <strong>Valor Total Financiado:</strong>{" "}
                {proposta.valor_total_financiado || proposta.valorTotalFinanciado || proposta.condicoesData?.valorTotalFinanciado
                  ? `R$ ${proposta.valor_total_financiado || proposta.valorTotalFinanciado || proposta.condicoesData.valorTotalFinanciado}`
                  : "N/A"}
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
                <strong>Status Atual:</strong> {proposta.status || "N/A"}
              </p>
              <p>
                <strong>Parceiro:</strong> {proposta.parceiro?.razaoSocial || "N/A"}
              </p>
              <p>
                <strong>Loja:</strong> {proposta.loja?.nomeLoja || "N/A"}
              </p>
              <p>
                <strong>Data de Criação:</strong>{" "}
                {proposta.createdAt
                  ? new Date(proposta.createdAt).toLocaleDateString("pt-BR")
                  : "N/A"}
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
          {user && (user.role === "ANALISTA" || user.role === "ADMINISTRADOR") ? (
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
                    <Textarea id="observacao" {...register("observacao")} />
                  </div>
                  <Button type="submit" className="w-full" disabled={mutation.isPending}>
                    {mutation.isPending ? "Salvando..." : "Confirmar Decisão"}
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
