import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import DadosClienteForm from "@/components/forms/DadosClienteForm";
import { useToast } from "@/hooks/use-toast";

// Schema Unificado
const fullProposalSchema = z.object({
  // Campos do cliente (mantendo compatibilidade com DadosClienteForm)
  nomeCompleto: z.string().min(3, "Nome completo é obrigatório."),
  cpfCnpj: z
    .string()
    .refine(value => value.length === 14 || value.length === 18, "CPF/CNPJ inválido."),
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
  // Campos de crédito
  valorSolicitado: z.coerce.number().positive("Valor deve ser positivo"),
  produto: z.string().nonempty("Produto é obrigatório."),
  prazo: z.string().nonempty("Prazo é obrigatório."),
  dataPrimeiroVencimento: z.string().nonempty("Data de vencimento é obrigatória."),
  incluirTac: z.boolean().default(false),
});

type FullFormData = z.infer<typeof fullProposalSchema>;

const NovaProposta: React.FC = () => {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<FullFormData>({
    resolver: zodResolver(fullProposalSchema),
  });

  const { toast } = useToast();
  const [resumoSimulacao, setResumoSimulacao] = useState<any>(null);
  const [loadingSimulacao, setLoadingSimulacao] = useState(false);

  const valorSolicitado = watch("valorSolicitado");
  const prazo = watch("prazo");
  const produto = watch("produto");
  const incluirTac = watch("incluirTac");
  const dataPrimeiroVencimento = watch("dataPrimeiroVencimento");

  useEffect(() => {
    const handleSimulacao = async () => {
      if (valorSolicitado > 0 && prazo && produto && dataPrimeiroVencimento) {
        setLoadingSimulacao(true);
        try {
          const params = new URLSearchParams({
            valor: String(valorSolicitado),
            prazo: prazo,
            produto_id: produto,
            incluir_tac: String(incluirTac || false), // Garante "true" ou "false"
            dataVencimento: dataPrimeiroVencimento,
          });
          const response = await fetch(`/api/simulacao?${params.toString()}`);
          const data = await response.json();
          if (!response.ok) throw new Error(data.error);
          setResumoSimulacao(data);
        } catch (error) {
          toast({
            title: "Erro na Simulação",
            description: (error as Error).message,
            variant: "destructive",
          });
        } finally {
          setLoadingSimulacao(false);
        }
      }
    };
    const debounce = setTimeout(() => handleSimulacao(), 800);
    return () => clearTimeout(debounce);
  }, [valorSolicitado, prazo, produto, incluirTac, dataPrimeiroVencimento, toast]);

  const onSubmit: SubmitHandler<FullFormData> = data => {
    console.log("DADOS COMPLETOS DA PROPOSTA:", data);
    toast({
      title: "Proposta Enviada com Sucesso!",
      description: "Os dados foram registrados no console.",
    });
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
            <div className="mt-4 rounded-md border p-4">
              <DadosClienteForm register={register} control={control} errors={errors} />
            </div>
          </TabsContent>

          <TabsContent value="condicoes-emprestimo">
            <div className="mt-4 space-y-4 rounded-md border p-4">
              <div>
                <Label htmlFor="valorSolicitado">Valor Solicitado</Label>
                <Input id="valorSolicitado" type="number" {...register("valorSolicitado")} />
                {errors.valorSolicitado && (
                  <p className="mt-1 text-sm text-red-500">{errors.valorSolicitado.message}</p>
                )}
              </div>
              <div>
                <Label>Produto de Crédito</Label>
                <Controller
                  name="produto"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="produto_a">Crédito Pessoal</SelectItem>
                        <SelectItem value="produto_b">Crédito Consignado</SelectItem>
                        <SelectItem value="produto_c">Crédito Empresarial</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.produto && (
                  <p className="mt-1 text-sm text-red-500">{errors.produto.message}</p>
                )}
              </div>
              <div>
                <Label>Prazo de Pagamento</Label>
                <Controller
                  name="prazo"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="6">6 meses</SelectItem>
                        <SelectItem value="12">12 meses</SelectItem>
                        <SelectItem value="18">18 meses</SelectItem>
                        <SelectItem value="24">24 meses</SelectItem>
                        <SelectItem value="36">36 meses</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.prazo && (
                  <p className="mt-1 text-sm text-red-500">{errors.prazo.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="dataPrimeiroVencimento">Data do Primeiro Vencimento</Label>
                <Input
                  id="dataPrimeiroVencimento"
                  type="date"
                  {...register("dataPrimeiroVencimento")}
                />
                {errors.dataPrimeiroVencimento && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.dataPrimeiroVencimento.message}
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Controller
                  name="incluirTac"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="incluirTac"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label htmlFor="incluirTac">Incluir TAC na operação?</Label>
              </div>
              <div>
                <Label>Resumo da Simulação</Label>
                <Textarea
                  readOnly
                  value={
                    loadingSimulacao
                      ? "Calculando..."
                      : resumoSimulacao
                        ? `Valor da Parcela: ${resumoSimulacao.valorParcela.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
Taxa de Juros: ${resumoSimulacao.taxaJurosMensal.toFixed(2)}% a.m.
IOF: ${resumoSimulacao.iof.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
TAC: ${resumoSimulacao.valorTac.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
CET: ${resumoSimulacao.cet.toFixed(2)}% a.a.`
                        : "Preencha os campos para simular."
                  }
                  rows={5}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="anexo-documentos">
            <div className="mt-4 space-y-4 rounded-md border p-4">
              <div>
                <Label htmlFor="documento-identidade">
                  Documento de Identidade (Frente e Verso)
                </Label>
                <Input id="documento-identidade" type="file" accept=".pdf,.jpg,.jpeg,.png" />
              </div>
              <div>
                <Label htmlFor="comprovante-residencia">Comprovante de Residência</Label>
                <Input id="comprovante-residencia" type="file" accept=".pdf,.jpg,.jpeg,.png" />
              </div>
              <div>
                <Label htmlFor="comprovante-renda">Comprovante de Renda</Label>
                <Input id="comprovante-renda" type="file" accept=".pdf,.jpg,.jpeg,.png" />
              </div>
              <div>
                <Label htmlFor="documento-adicional">Documento Adicional (Opcional)</Label>
                <Input id="documento-adicional" type="file" accept=".pdf,.jpg,.jpeg,.png" />
              </div>
            </div>
          </TabsContent>
        </Tabs>
        <div className="mt-4 flex justify-end pt-6">
          <Button type="submit">Enviar Proposta</Button>
        </div>
      </form>
    </DashboardLayout>
  );
};

export default NovaProposta;
