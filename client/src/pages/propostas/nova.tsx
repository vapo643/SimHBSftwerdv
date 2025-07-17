import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DadosClienteForm from '@/components/forms/DadosClienteForm';
import { useToast } from '@/hooks/use-toast';

const condicoesSchema = z.object({
  valorSolicitado: z.coerce.number().positive({ message: "O valor deve ser positivo." }),
  produto: z.string().nonempty({ message: "Produto é obrigatório." }),
  tabelaDeJuros: z.string().nonempty({ message: "Tabela de Juros é obrigatória." }),
  prazo: z.coerce.number().positive({ message: "Prazo é obrigatório." }),
});

type CondicoesFormData = z.infer<typeof condicoesSchema>;

const CondicoesEmprestimoForm: React.FC = () => {
  const { control, handleSubmit, watch, formState: { errors } } = useForm<CondicoesFormData>();
  const [valorParcela, setValorParcela] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const valorSolicitado = watch('valorSolicitado');
  const prazo = watch('prazo');
  const tabelaDeJuros = watch('tabelaDeJuros');

  useEffect(() => {
    const simulate = async () => {
      if (valorSolicitado > 0 && prazo > 0 && tabelaDeJuros) {
        setLoading(true);
        setValorParcela(null); 
        try {
          // No mundo real, a taxa viria da tabela selecionada
          const taxaDeJurosMensal = 5; 

          const response = await fetch('/api/simular', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              valorSolicitado: Number(valorSolicitado),
              prazoEmMeses: Number(prazo),
              taxaDeJurosMensal 
            }),
          });
          
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Erro na simulação');

          setValorParcela(data.valorParcela);
        } catch (error) {
          toast({ title: "Erro na Simulação", description: (error as Error).message, variant: "destructive" });
        } finally {
          setLoading(false);
        }
      }
    };

    const debounceSimulate = setTimeout(() => {
        simulate();
    }, 500); // Adiciona um delay para não chamar a API a cada dígito

    return () => clearTimeout(debounceSimulate);
  }, [valorSolicitado, prazo, tabelaDeJuros, toast]);

  const onSubmit = (data: CondicoesFormData) => console.log(data);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="valor-solicitado">Valor Solicitado</Label>
        <Controller name="valorSolicitado" control={control} render={({ field }) => <Input {...field} type="number" placeholder="R$ 0,00" onChange={e => field.onChange(e.target.valueAsNumber)} />} />
        {errors.valorSolicitado && <p className="text-red-500 text-sm mt-1">{errors.valorSolicitado.message}</p>}
      </div>
      <div>
        <Label>Produto</Label>
        <Controller name="produto" control={control} render={({ field }) => (
          <Select onValueChange={field.onChange} defaultValue={field.value}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent><SelectItem value="pessoal">Crédito Pessoal</SelectItem></SelectContent></Select>
        )} />
      </div>
       <div>
        <Label>Tabela de Juros</Label>
        <Controller name="tabelaDeJuros" control={control} render={({ field }) => (
          <Select onValueChange={field.onChange} defaultValue={field.value}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent><SelectItem value="tabela-a">Tabela A (5% a.m.)</SelectItem></SelectContent></Select>
        )} />
      </div>
      <div>
        <Label>Prazo</Label>
        <Controller name="prazo" control={control} render={({ field }) => (
          <Select onValueChange={field.onChange} defaultValue={field.value}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent><SelectItem value="12">12 meses</SelectItem><SelectItem value="24">24 meses</SelectItem></SelectContent></Select>
        )} />
      </div>
      <div>
        <Label>Resumo da Simulação</Label>
        <Textarea readOnly value={loading ? "Calculando..." : (valorParcela ? `Valor da Parcela: ${valorParcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : "Preencha os campos para simular.")} rows={3} />
      </div>
    </form>
  );
};

const NovaProposta: React.FC = () => {
  return (
    <DashboardLayout title="Nova Proposta de Crédito">
      <Tabs defaultValue="dados-cliente" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dados-cliente">Dados do Cliente</TabsTrigger>
          <TabsTrigger value="condicoes-emprestimo">Condições do Empréstimo</TabsTrigger>
          <TabsTrigger value="anexo-documentos">Anexo de Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="dados-cliente">
          <div className="p-4 border rounded-md mt-4">
            <DadosClienteForm />
          </div>
        </TabsContent>

        <TabsContent value="condicoes-emprestimo">
          <div className="p-4 border rounded-md mt-4">
            <CondicoesEmprestimoForm />
          </div>
        </TabsContent>

        <TabsContent value="anexo-documentos">
          <div className="space-y-4 p-4 border rounded-md mt-4">
            <div><Label htmlFor="doc-id">Documento de Identidade</Label><Input id="doc-id" type="file" /></div>
            <div><Label htmlFor="doc-res">Comprovante de Residência</Label><Input id="doc-res" type="file" /></div>
            <div><Label htmlFor="doc-renda">Comprovante de Renda</Label><Input id="doc-renda" type="file" /></div>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default NovaProposta;