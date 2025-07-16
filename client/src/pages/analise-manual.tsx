import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, AlertTriangle, Percent, FileText } from "lucide-react";

const decisionSchema = z.object({
  status: z.enum(["aprovado", "rejeitado", "solicitar_info"]),
  valorAprovado: z.string().optional(),
  taxaJuros: z.string().optional(),
  observacoes: z.string().optional(),
});

type DecisionForm = z.infer<typeof decisionSchema>;

interface Proposta {
  id: number;
  clienteNome: string;
  clienteCpf: string;
  clienteEmail: string;
  clienteTelefone: string;
  clienteDataNascimento: string;
  clienteRenda: string;
  valor: string;
  prazo: number;
  finalidade: string;
  garantia: string;
  status: string;
  documentos: string[] | null;
  createdAt: string;
}

export default function AnaliseManual() {
  const [, params] = useRoute("/credito/analise/:id");
  const propostaId = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: proposta, isLoading } = useQuery<Proposta>({
    queryKey: ["/api/propostas", propostaId],
    enabled: !!propostaId,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<DecisionForm>({
    resolver: zodResolver(decisionSchema),
  });

  const updateProposta = useMutation({
    mutationFn: async (data: DecisionForm) => {
      const response = await apiRequest("PATCH", `/api/propostas/${propostaId}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Decisão salva com sucesso!",
        description: "A proposta foi atualizada.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/propostas"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar decisão",
        description: error.message || "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: DecisionForm) => {
    updateProposta.mutate(data);
  };

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(parseFloat(value));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  // Mock credit analysis data
  const creditAnalysis = {
    score: 750,
    risco: "Médio",
    taxa: "2.5",
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Análise Manual">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-32 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="space-y-6">
            <Card className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-48 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!proposta) {
    return (
      <DashboardLayout title="Análise Manual">
        <div className="text-center py-12">
          <p className="text-gray-500">Proposta não encontrada</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`Análise Manual - Proposta #${proposta.id}`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client Information */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="border-b border-gray-200 pb-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Dados do Cliente</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-1">Nome</Label>
                  <p className="text-gray-900">{proposta.clienteNome}</p>
                </div>
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-1">CPF</Label>
                  <p className="text-gray-900">{proposta.clienteCpf}</p>
                </div>
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-1">Email</Label>
                  <p className="text-gray-900">{proposta.clienteEmail}</p>
                </div>
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-1">Telefone</Label>
                  <p className="text-gray-900">{proposta.clienteTelefone}</p>
                </div>
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</Label>
                  <p className="text-gray-900">{formatDate(proposta.clienteDataNascimento)}</p>
                </div>
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-1">Renda Mensal</Label>
                  <p className="text-gray-900">{proposta.clienteRenda}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Loan Details */}
          <Card>
            <CardContent className="p-6">
              <div className="border-b border-gray-200 pb-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Detalhes do Empréstimo</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-1">Valor Solicitado</Label>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(proposta.valor)}</p>
                </div>
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-1">Prazo</Label>
                  <p className="text-gray-900">{proposta.prazo} meses</p>
                </div>
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-1">Finalidade</Label>
                  <p className="text-gray-900">{proposta.finalidade}</p>
                </div>
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-1">Garantia</Label>
                  <p className="text-gray-900">{proposta.garantia}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Credit Analysis */}
          <Card>
            <CardContent className="p-6">
              <div className="border-b border-gray-200 pb-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Análise de Crédito</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">Score</p>
                  <p className="text-2xl font-bold text-green-600">{creditAnalysis.score}</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <AlertTriangle className="h-8 w-8 text-yellow-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">Risco</p>
                  <p className="text-2xl font-bold text-yellow-600">{creditAnalysis.risco}</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Percent className="h-8 w-8 text-blue-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">Taxa Sugerida</p>
                  <p className="text-2xl font-bold text-blue-600">{creditAnalysis.taxa}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Decision Panel */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="border-b border-gray-200 pb-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Painel de Decisão</h3>
              </div>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="status">Decisão</Label>
                  <Select onValueChange={(value) => setValue("status", value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma decisão" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aprovado">Aprovar</SelectItem>
                      <SelectItem value="rejeitado">Rejeitar</SelectItem>
                      <SelectItem value="solicitar_info">Solicitar Informações</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.status && (
                    <p className="text-sm text-red-600">{errors.status.message}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="valorAprovado">Valor Aprovado</Label>
                  <Input
                    id="valorAprovado"
                    placeholder={formatCurrency(proposta.valor)}
                    {...register("valorAprovado")}
                  />
                </div>
                
                <div>
                  <Label htmlFor="taxaJuros">Taxa de Juros (%)</Label>
                  <Input
                    id="taxaJuros"
                    placeholder="2.5"
                    {...register("taxaJuros")}
                  />
                </div>
                
                <div>
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    rows={4}
                    placeholder="Adicione observações sobre a decisão..."
                    {...register("observacoes")}
                  />
                </div>
                
                <Button
                  type="submit"
                  className="w-full"
                  disabled={updateProposta.isPending}
                >
                  {updateProposta.isPending ? "Salvando..." : "Salvar Decisão"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardContent className="p-6">
              <div className="border-b border-gray-200 pb-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Documentos</h3>
              </div>
              <div className="space-y-3">
                {proposta.documentos && proposta.documentos.length > 0 ? (
                  proposta.documentos.map((documento, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-red-500" />
                        <span className="text-sm font-medium text-gray-700">{documento}</span>
                      </div>
                      <Button variant="ghost" size="sm">
                        Visualizar
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">Nenhum documento anexado</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
