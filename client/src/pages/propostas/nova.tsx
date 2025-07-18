import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import DadosClienteForm from '@/components/forms/DadosClienteForm';
import { useToast } from '@/hooks/use-toast';

const fullProposalSchema = z.object({
  nomeCompleto: z.string().min(3, "Nome completo é obrigatório."),
  cpfCnpj: z.string().refine(value => value.length === 14 || value.length === 18, "CPF/CNPJ inválido."),
  rg: z.string().min(5, "RG é obrigatório.").optional(),
  orgaoEmissor: z.string().min(2, "Órgão Emissor é obrigatório.").optional(),
  estadoCivil: z.string().nonempty("Estado Civil é obrigatório."),
  dataNascimento: z.string().min(1, "Data de nascimento é obrigatória."),
  nacionalidade: z.string().min(3, "Nacionalidade é obrigatória."),
  endereco: z.string().min(5, "Endereço completo é obrigatório."),
  cep: z.string().length(9, "CEP deve ter 9 dígitos (incluindo traço)."),
  telefone: z.string().min(10, "Telefone / WhatsApp é obrigatório."),
  email: z.string().email("Email inválido."),
  ocupacao: z.string().min(3, "Ocupação / Profissão é obrigatória."),
  rendaMensal: z.coerce.number().positive("Renda ou Faturamento deve ser um número positivo."),
  valorSolicitado: z.coerce.number().positive("Valor deve ser positivo"),
  produto: z.string().nonempty("Produto é obrigatório."),
  prazo: z.string().nonempty("Prazo é obrigatório."),
  tabelaComercial: z.string().nonempty("Tabela comercial é obrigatória."),
  incluirTac: z.boolean().default(false),
  documentos: z.any().optional(),
});

type FullFormData = z.infer<typeof fullProposalSchema>;

const NovaProposta: React.FC = () => {
    const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FullFormData>({
        resolver: zodResolver(fullProposalSchema),
    });
    
    const { toast } = useToast();
    const [resumoSimulacao, setResumoSimulacao] = useState<any>(null);
    const [loadingSimulacao, setLoadingSimulacao] = useState(false);

    const valorSolicitado = watch("valorSolicitado");
    const prazo = watch("prazo");
    const produto = watch("produto");
    const tabelaComercial = watch("tabelaComercial");

    useEffect(() => {
        const handleSimulacao = async () => {
            if (valorSolicitado > 0 && prazo && tabelaComercial) {
                setLoadingSimulacao(true);
                try {
                    // Simulação de chamada de API
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    const response = await fetch('/api/simular', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            valorSolicitado: Number(valorSolicitado),
                            prazoEmMeses: Number(prazo),
                            tabelaComercialId: tabelaComercial // Enviando o ID da tabela
                        }),
                    });
                    
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'Erro na simulação');

                    setResumoSimulacao(data);
                } catch (error) {
                    toast({ title: "Erro na Simulação", description: (error as Error).message, variant: "destructive" });
                } finally {
                    setLoadingSimulacao(false);
                }
            }
        };
        
        const debounceSimulate = setTimeout(() => {
            handleSimulacao();
        }, 500); // Delay para não chamar a API a cada dígito

        return () => clearTimeout(debounceSimulate);

    }, [valorSolicitado, prazo, tabelaComercial, toast]);

    const onSubmit: SubmitHandler<FullFormData> = data => {
        console.log("DADOS COMPLETOS DA PROPOSTA:", data);
        toast({ title: "Proposta Enviada com Sucesso!", description: "Os dados foram registrados no console." });
    };

    return (
        <DashboardLayout title="Nova Proposta de Crédito">
            <form onSubmit={handleSubmit(onSubmit)}>
                <Tabs defaultValue="dados-cliente" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="dados-cliente">Dados do Cliente</TabsTrigger>
                        <TabsTrigger value="condicoes-emprestimo">Condições do Empréstimo</TabsTrigger>
                        <TabsTrigger value="anexo-documentos">Anexo de Documentos</TabsTrigger>
                    </TabsList>

                    <TabsContent value="dados-cliente">
                        <div className="p-4 border rounded-md mt-4">
                            <DadosClienteForm register={register} control={control} errors={errors} />
                        </div>
                    </TabsContent>

                    <TabsContent value="condicoes-emprestimo">
                        <div className="space-y-4 p-4 border rounded-md mt-4">
                             <div>
                                <Label htmlFor="valorSolicitado">Valor Solicitado</Label>
                                <Input id="valorSolicitado" type="number" {...register('valorSolicitado')} placeholder="R$ 0,00" />
                                {errors.valorSolicitado && <p className="text-red-500 text-sm mt-1">{errors.valorSolicitado.message}</p>}
                            </div>
                            <div>
                                <Label>Produto de Crédito</Label>
                                <Controller name="produto" control={control} render={({ field }) => (
                                    <Select onValueChange={field.onChange} defaultValue={field.value}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent><SelectItem value="pessoal">Crédito Pessoal</SelectItem></SelectContent></Select>
                                )} />
                                {errors.produto && <p className="text-red-500 text-sm mt-1">{errors.produto.message}</p>}
                            </div>
                            <div>
                                <Label>Prazo de Pagamento</Label>
                                <Controller name="prazo" control={control} render={({ field }) => (
                                    <Select onValueChange={field.onChange} defaultValue={field.value}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent><SelectItem value="12">12 meses</SelectItem><SelectItem value="24">24 meses</SelectItem></SelectContent></Select>
                                )} />
                                {errors.prazo && <p className="text-red-500 text-sm mt-1">{errors.prazo.message}</p>}
                            </div>
                            <div>
                                <Label>Tabela Comercial</Label>
                                <Controller name="tabelaComercial" control={control} render={({ field }) => (
                                    <Select onValueChange={field.onChange} defaultValue={field.value}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent><SelectItem value="tabela-a">Tabela A (5.0% a.m.)</SelectItem><SelectItem value="tabela-b">Tabela B (7.5% a.m.)</SelectItem></SelectContent></Select>
                                )} />
                                {errors.tabelaComercial && <p className="text-red-500 text-sm mt-1">{errors.tabelaComercial.message}</p>}
                            </div>
                            <div className="flex items-center space-x-2">
                                <Controller name="incluirTac" control={control} render={({ field }) => <Checkbox id="incluirTac" checked={field.value} onCheckedChange={field.onChange} />} />
                                <Label htmlFor="incluirTac">Incluir TAC na operação?</Label>
                            </div>
                            <div>
                                <Label>Resumo da Simulação</Label>
                                <Textarea readOnly value={loadingSimulacao ? "Calculando..." : (resumoSimulacao ? `Valor da Parcela: ${resumoSimulacao.valorParcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\nCET Anual: ${resumoSimulacao.cet}%` : "Preencha os campos para simular.")} rows={4} />
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="anexo-documentos">
                        <div className="space-y-4 p-4 border rounded-md mt-4">
                             <div>
                                <Label htmlFor="doc1">Documento de Identidade</Label>
                                <Input id="doc1" type="file" />
                            </div>
                            <div>
                                <Label htmlFor="doc2">Comprovante de Residência</Label>
                                <Input id="doc2" type="file" />
                            </div>
                            <div>
                                <Label htmlFor="doc3">Comprovante de Renda</Label>
                                <Input id="doc3" type="file" />
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
                <div className="flex justify-end pt-6 mt-4">
                    <Button type="submit">Enviar Proposta</Button>
                </div>
            </form>
        </DashboardLayout>
    );
};

export default NovaProposta;