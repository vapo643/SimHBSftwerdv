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

import { api } from "@/lib/apiClient";

const fetchProposta = async (id: string | undefined) => {
  if (!id) throw new Error("ID da proposta não fornecido.");
  try {
    const response = await api.get(`/api/propostas/${id}`);
    return response.data;
  } catch (error) {
    throw new Error("Proposta não encontrada");
  }
};

const fetchPropostaDocuments = async (id: string | undefined) => {
  if (!id) throw new Error("ID da proposta não fornecido.");
  try {
    const response = await api.get(`/api/propostas/${id}/documents`);
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar documentos:", error);
    return { documents: [] };
  }
};

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

const decisionSchema = z.object({
  status: z.enum(["aprovado", "rejeitado", "pendenciado"]),
  observacao: z.string().min(1, "Observação é obrigatória"),
});

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

  const { data: documentsData } = useQuery({
    queryKey: ["proposta-documents", propostaId],
    queryFn: () => fetchPropostaDocuments(propostaId),
    enabled: !!propostaId,
    refetchOnWindowFocus: false, // Desabilitado para evitar rate limiting
    staleTime: 10 * 60 * 1000, // 10 minutos - documentos mudam pouco
  });

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
      queryClient.invalidateQueries({ queryKey: ['/api/propostas'] });
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
      ...(data.status === 'pendenciado' && { motivoPendencia: data.observacao })
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

  return (
    <DashboardLayout title={`Análise Manual - Proposta #${proposta.id}`}>
      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          {/* Card de Dados do Cliente */}
          <Card>
            <CardHeader>
              <CardTitle>Dados do Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p><strong>Nome:</strong> {proposta.clienteData?.nome || "N/A"}</p>
              <p><strong>CPF:</strong> {proposta.clienteData?.cpf || "N/A"}</p>
              <p><strong>Email:</strong> {proposta.clienteData?.email || "N/A"}</p>
              <p><strong>Telefone:</strong> {proposta.clienteData?.telefone || "N/A"}</p>
              <p><strong>Data de Nascimento:</strong> {proposta.clienteData?.dataNascimento || "N/A"}</p>
              <p><strong>Renda Mensal:</strong> {proposta.clienteData?.renda ? `R$ ${proposta.clienteData.renda}` : "N/A"}</p>
              <p><strong>RG:</strong> {proposta.clienteData?.rg || "N/A"}</p>
              <p><strong>Órgão Emissor:</strong> {proposta.clienteData?.orgaoEmissor || "N/A"}</p>
              <p><strong>Estado Civil:</strong> {proposta.clienteData?.estadoCivil || "N/A"}</p>
              <p><strong>Nacionalidade:</strong> {proposta.clienteData?.nacionalidade || "N/A"}</p>
              <p><strong>CEP:</strong> {proposta.clienteData?.cep || "N/A"}</p>
              <p><strong>Endereço:</strong> {proposta.clienteData?.endereco || "N/A"}</p>
              <p><strong>Ocupação:</strong> {proposta.clienteData?.ocupacao || "N/A"}</p>
            </CardContent>
          </Card>

          {/* Card de Condições do Empréstimo */}
          <Card>
            <CardHeader>
              <CardTitle>Condições do Empréstimo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p><strong>Valor Solicitado:</strong> {proposta.condicoesData?.valor ? `R$ ${proposta.condicoesData.valor}` : "N/A"}</p>
              <p><strong>Prazo:</strong> {proposta.condicoesData?.prazo ? `${proposta.condicoesData.prazo} meses` : "N/A"}</p>
              <p><strong>Finalidade:</strong> {proposta.condicoesData?.finalidade || "N/A"}</p>
              <p><strong>Garantia:</strong> {proposta.condicoesData?.garantia || "N/A"}</p>
              <p><strong>TAC:</strong> {proposta.condicoesData?.valorTac ? `R$ ${proposta.condicoesData.valorTac}` : "N/A"}</p>
              <p><strong>IOF:</strong> {proposta.condicoesData?.valorIof ? `R$ ${proposta.condicoesData.valorIof}` : "N/A"}</p>
              <p><strong>Valor Total Financiado:</strong> {proposta.condicoesData?.valorTotalFinanciado ? `R$ ${proposta.condicoesData.valorTotalFinanciado}` : "N/A"}</p>
            </CardContent>
          </Card>

          {/* Card de Informações da Proposta */}
          <Card>
            <CardHeader>
              <CardTitle>Informações da Proposta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p><strong>Status Atual:</strong> {proposta.status || "N/A"}</p>
              <p><strong>Parceiro:</strong> {proposta.parceiro?.razaoSocial || "N/A"}</p>
              <p><strong>Loja:</strong> {proposta.loja?.nomeLoja || "N/A"}</p>
              <p><strong>Data de Criação:</strong> {proposta.createdAt ? new Date(proposta.createdAt).toLocaleDateString('pt-BR') : "N/A"}</p>
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
            documents={documentsData?.documents || []}
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
                  Você está visualizando esta proposta em modo de leitura. 
                  Apenas analistas podem aprovar ou negar propostas.
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
