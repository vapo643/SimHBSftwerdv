import React from 'react';
import { useRoute, Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import HistoricoComunicao from '@/components/analise/HistoricoComunicao';

import fetchWithToken from '@/lib/apiClient';

// Supondo a existência dessas funções de fetch
const fetchProposta = async (id: string | undefined) => {
    if (!id) throw new Error("ID da proposta não fornecido.");
    const res = await fetchWithToken(`/api/propostas/${id}`);
    if (!res.ok) throw new Error('Proposta não encontrada');
    return res.json();
}

const updatePropostaStatus = async ({ id, status, observacao }: { id: string, status: string, observacao?: string }) => {
    const res = await fetchWithToken(`/api/propostas/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, observacao })
    });
    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Falha ao atualizar status');
    }
    return res.json();
}

const decisionSchema = z.object({
  status: z.enum(['Aprovada', 'Negada', 'Pendente com Observação']),
  observacao: z.string().optional(),
});

type DecisionFormData = z.infer<typeof decisionSchema>;

const AnaliseManualPage: React.FC = () => {
  const [match, params] = useRoute("/credito/analise/:id");
  const propostaId = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: proposta, isLoading, isError } = useQuery({
    queryKey: ['proposta', propostaId],
    queryFn: () => fetchProposta(propostaId),
    enabled: !!propostaId
  });
  
  const { register, handleSubmit, control } = useForm<DecisionFormData>({
    resolver: zodResolver(decisionSchema),
  });

  const mutation = useMutation({
    mutationFn: updatePropostaStatus,
    onSuccess: () => {
      toast({ title: "Sucesso!", description: "O status da proposta foi atualizado." });
      queryClient.invalidateQueries({ queryKey: ['proposta', propostaId] });
      queryClient.invalidateQueries({ queryKey: ['proposta_logs', propostaId] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro!", description: error.message, variant: "destructive" });
    }
  });

  const onSubmit = (data: DecisionFormData) => {
      if (!propostaId) return;
      mutation.mutate({ id: propostaId, ...data });
  };

  if (isLoading) return <DashboardLayout title="Análise Manual"><p className="p-6">Carregando proposta...</p></DashboardLayout>;
  if (isError || !proposta) return <DashboardLayout title="Erro"><p className="p-6">Proposta não encontrada. <Link to="/credito/fila" className="text-blue-500 hover:underline">Voltar para a fila.</Link></p></DashboardLayout>;

  return (
    <DashboardLayout title={`Análise Manual - Proposta #${proposta.id}`}>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle>Detalhes da Proposta</CardTitle></CardHeader>
              <CardContent>
                <p><strong>Cliente:</strong> {proposta.clienteNome || 'N/A'}</p>
                <p><strong>CPF:</strong> {proposta.clienteCpf || 'N/A'}</p>
                <p><strong>Valor Solicitado:</strong> R$ {proposta.valorSolicitado?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || 'N/A'}</p>
                <p><strong>Prazo:</strong> {proposta.prazoMeses || 'N/A'} meses</p>
                <p><strong>Status:</strong> {proposta.status || 'N/A'}</p>
                <p><strong>Data de Criação:</strong> {proposta.createdAt ? new Date(proposta.createdAt).toLocaleString('pt-BR') : 'N/A'}</p>
              </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle>Painel de Decisão</CardTitle></CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div>
                            <Label>Decisão</Label>
                             <Controller 
                                name="status" 
                                control={control} 
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <SelectTrigger><SelectValue placeholder="Selecione uma decisão..." /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Aprovada">Aprovar Proposta</SelectItem>
                                            <SelectItem value="Negada">Negar Proposta</SelectItem>
                                            <SelectItem value="Pendente com Observação">Pendenciar</SelectItem>
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
                            {mutation.isPending ? "Salvando..." : "Confirmar Decisão"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
        <div className="md:col-span-1">
            <HistoricoComunicao propostaId={propostaId} />
        </div>
      </div>
    </DashboardLayout>
  );
}

export default AnaliseManualPage;