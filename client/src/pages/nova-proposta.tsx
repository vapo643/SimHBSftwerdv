import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { api } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/DashboardLayout";
import OfflineIndicator from "@/components/OfflineIndicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Upload } from "lucide-react";

const clienteSchema = z.object({
  clienteNome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  clienteCpf: z.string().min(11, "CPF deve ter 11 dígitos"),
  clienteEmail: z.string().email("Email inválido"),
  clienteTelefone: z.string().min(10, "Telefone inválido"),
  clienteDataNascimento: z.string().min(1, "Data de nascimento é obrigatória"),
  clienteRenda: z.string().min(1, "Renda é obrigatória"),
  // Campos de documentação - ADICIONADOS PARA CORREÇÃO CCB
  clienteRg: z.string().min(5, "RG é obrigatório"),
  clienteOrgaoEmissor: z.string().min(2, "Órgão emissor é obrigatório"),
  clienteRgDataEmissao: z.string().min(1, "Data de emissão do RG é obrigatória"),
  clienteRgUf: z.string().length(2, "UF do RG deve ter 2 caracteres"),
  clienteLocalNascimento: z.string().min(2, "Local de nascimento é obrigatório"),
  clienteEstadoCivil: z.string().min(1, "Estado civil é obrigatório"),
  clienteNacionalidade: z.string().min(1, "Nacionalidade é obrigatória"),
  // Campos de endereço separados
  clienteCep: z.string().min(8, "CEP inválido").optional(),
  clienteLogradouro: z.string().min(1, "Logradouro é obrigatório").optional(),
  clienteNumero: z.string().min(1, "Número é obrigatório").optional(),
  clienteComplemento: z.string().optional(),
  clienteBairro: z.string().min(1, "Bairro é obrigatório").optional(),
  clienteCidade: z.string().min(1, "Cidade é obrigatória").optional(),
  clienteUf: z.string().length(2, "UF deve ter 2 caracteres").optional(),
});

const emprestimoSchema = z.object({
  valor: z.string().min(1, "Valor é obrigatório"),
  prazo: z.string().min(1, "Prazo é obrigatório"),
  finalidade: z.string().min(1, "Finalidade é obrigatória"),
  garantia: z.string().min(1, "Garantia é obrigatória"),
  // Dados bancários para pagamento
  dadosPagamentoTipo: z.enum(["pix", "conta_bancaria"]).optional(),
  dadosPagamentoPix: z.string().optional(),
  dadosPagamentoBanco: z.string().optional(),
  dadosPagamentoAgencia: z.string().optional(),
  dadosPagamentoConta: z.string().optional(),
  dadosPagamentoDigito: z.string().optional(),
});

const documentosSchema = z.object({
  documentos: z.array(z.string()).optional(),
});

const fullSchema = clienteSchema.merge(emprestimoSchema).merge(documentosSchema);

type PropostaForm = z.infer<typeof fullSchema>;

export default function NovaProposta() {
  const [currentStep, setCurrentStep] = useState(1);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<PropostaForm>({
    resolver: zodResolver(fullSchema),
    defaultValues: {
      documentos: [],
    },
  });

  const createProposta = useMutation({
    mutationFn: async (data: PropostaForm) => {
      return apiRequest("/api/propostas", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          status: "aguardando_analise",
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Proposta criada com sucesso!",
        description: "A proposta foi enviada para análise.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/propostas"] });
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar proposta",
        description: error.message || "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    },
  });

  const uploadFile = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await api.post("/api/upload", formData);
      return response.data;
    },
    onSuccess: data => {
      const currentDocs = watch("documentos") || [];
      setValue("documentos", [...currentDocs, data.fileName]);
      toast({
        title: "Documento enviado com sucesso!",
        description: "O documento foi anexado à proposta.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao enviar documento",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadFile.mutate(file);
    }
  };

  const nextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = (data: PropostaForm) => {
    createProposta.mutate(data);
  };

  const steps = [
    { number: 1, title: "Dados do Cliente" },
    { number: 2, title: "Condições" },
    { number: 3, title: "Documentos" },
  ];

  return (
    <DashboardLayout title="Nova Proposta de Crédito">
      <div className="mx-auto max-w-4xl">
        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                    currentStep >= step.number
                      ? "bg-primary text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {step.number}
                </div>
                <span
                  className={`ml-2 text-sm font-medium ${
                    currentStep >= step.number ? "text-primary" : "text-gray-500"
                  }`}
                >
                  {step.title}
                </span>
                {index < steps.length - 1 && <div className="mx-4 h-px w-16 bg-gray-300"></div>}
              </div>
            ))}
          </div>
        </div>

        {/* Form Card */}
        <Card>
          <CardContent className="p-6">
            {/* Pilar 12 - Progressive Enhancement: Offline status for critical forms */}
            <OfflineIndicator variant="compact" className="mb-4" />

            {/* Progressive Enhancement: Form with fallback attributes */}
            <form
              onSubmit={handleSubmit(onSubmit)}
              action="/nova-proposta"
              method="POST"
              className="progressive-enhancement-form"
            >
              {/* Step 1: Cliente Data */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <h3 className="mb-4 text-lg font-semibold text-gray-900">Dados do Cliente</h3>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <Label htmlFor="clienteNome">Nome Completo</Label>
                      <Input
                        id="clienteNome"
                        placeholder="Digite o nome completo"
                        {...register("clienteNome")}
                      />
                      {errors.clienteNome && (
                        <p className="text-sm text-red-600">{errors.clienteNome.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="clienteCpf">CPF</Label>
                      <Input
                        id="clienteCpf"
                        placeholder="000.000.000-00"
                        {...register("clienteCpf")}
                      />
                      {errors.clienteCpf && (
                        <p className="text-sm text-red-600">{errors.clienteCpf.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="clienteEmail">Email</Label>
                      <Input
                        id="clienteEmail"
                        type="email"
                        placeholder="email@exemplo.com"
                        {...register("clienteEmail")}
                      />
                      {errors.clienteEmail && (
                        <p className="text-sm text-red-600">{errors.clienteEmail.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="clienteTelefone">Telefone</Label>
                      <Input
                        id="clienteTelefone"
                        placeholder="(11) 99999-9999"
                        {...register("clienteTelefone")}
                      />
                      {errors.clienteTelefone && (
                        <p className="text-sm text-red-600">{errors.clienteTelefone.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="clienteDataNascimento">Data de Nascimento</Label>
                      <Input
                        id="clienteDataNascimento"
                        type="date"
                        {...register("clienteDataNascimento")}
                      />
                      {errors.clienteDataNascimento && (
                        <p className="text-sm text-red-600">
                          {errors.clienteDataNascimento.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="clienteRenda">Renda Mensal</Label>
                      <Input
                        id="clienteRenda"
                        placeholder="R$ 5.000,00"
                        {...register("clienteRenda")}
                      />
                      {errors.clienteRenda && (
                        <p className="text-sm text-red-600">{errors.clienteRenda.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Campos de Documentação - ADICIONADOS PARA CORREÇÃO CCB */}
                  <h4 className="mt-6 mb-4 text-md font-semibold text-gray-800">Documentação</h4>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <Label htmlFor="clienteRg">RG</Label>
                      <Input
                        id="clienteRg"
                        
                        placeholder="00.000.000-0"
                        {...register("clienteRg")}
                      />
                      {errors.clienteRg && (
                        <p className="text-sm text-red-600">{errors.clienteRg.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="clienteOrgaoEmissor">Órgão Emissor</Label>
                      <Input
                        id="clienteOrgaoEmissor"
                        
                        placeholder="SSP"
                        {...register("clienteOrgaoEmissor")}
                      />
                      {errors.clienteOrgaoEmissor && (
                        <p className="text-sm text-red-600">{errors.clienteOrgaoEmissor.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="clienteRgDataEmissao">Data de Emissão do RG</Label>
                      <Input
                        id="clienteRgDataEmissao"
                        
                        type="date"
                        {...register("clienteRgDataEmissao")}
                      />
                      {errors.clienteRgDataEmissao && (
                        <p className="text-sm text-red-600">{errors.clienteRgDataEmissao.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="clienteRgUf">UF do RG</Label>
                      <Input
                        id="clienteRgUf"
                        
                        placeholder="SP"
                        maxLength={2}
                        {...register("clienteRgUf")}
                      />
                      {errors.clienteRgUf && (
                        <p className="text-sm text-red-600">{errors.clienteRgUf.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="clienteLocalNascimento">Local de Nascimento</Label>
                      <Input
                        id="clienteLocalNascimento"
                        
                        placeholder="São Paulo - SP"
                        {...register("clienteLocalNascimento")}
                      />
                      {errors.clienteLocalNascimento && (
                        <p className="text-sm text-red-600">{errors.clienteLocalNascimento.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="clienteEstadoCivil">Estado Civil</Label>
                      <Select onValueChange={value => setValue("clienteEstadoCivil", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o estado civil" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                          <SelectItem value="casado">Casado(a)</SelectItem>
                          <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                          <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                          <SelectItem value="uniao_estavel">União Estável</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.clienteEstadoCivil && (
                        <p className="text-sm text-red-600">{errors.clienteEstadoCivil.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="clienteNacionalidade">Nacionalidade</Label>
                      <Input
                        id="clienteNacionalidade"
                        
                        placeholder="Brasileira"
                        {...register("clienteNacionalidade")}
                      />
                      {errors.clienteNacionalidade && (
                        <p className="text-sm text-red-600">{errors.clienteNacionalidade.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Campos de Endereço */}
                  <h4 className="mt-6 mb-4 text-md font-semibold text-gray-800">Endereço</h4>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <Label htmlFor="clienteCep">CEP</Label>
                      <Input
                        id="clienteCep"
                        
                        placeholder="12345-678"
                        {...register("clienteCep")}
                      />
                      {errors.clienteCep && (
                        <p className="text-sm text-red-600">{errors.clienteCep.message}</p>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <Label htmlFor="clienteLogradouro">Logradouro</Label>
                      <Input
                        id="clienteLogradouro"
                        
                        placeholder="Rua, Avenida, etc."
                        {...register("clienteLogradouro")}
                      />
                      {errors.clienteLogradouro && (
                        <p className="text-sm text-red-600">{errors.clienteLogradouro.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="clienteNumero">Número</Label>
                      <Input
                        id="clienteNumero"
                        
                        placeholder="123"
                        {...register("clienteNumero")}
                      />
                      {errors.clienteNumero && (
                        <p className="text-sm text-red-600">{errors.clienteNumero.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="clienteComplemento">Complemento</Label>
                      <Input
                        id="clienteComplemento"
                        
                        placeholder="Apto, Casa, etc. (opcional)"
                        {...register("clienteComplemento")}
                      />
                      {errors.clienteComplemento && (
                        <p className="text-sm text-red-600">{errors.clienteComplemento.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="clienteBairro">Bairro</Label>
                      <Input
                        id="clienteBairro"
                        
                        placeholder="Nome do bairro"
                        {...register("clienteBairro")}
                      />
                      {errors.clienteBairro && (
                        <p className="text-sm text-red-600">{errors.clienteBairro.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="clienteCidade">Cidade</Label>
                      <Input
                        id="clienteCidade"
                        
                        placeholder="Nome da cidade"
                        {...register("clienteCidade")}
                      />
                      {errors.clienteCidade && (
                        <p className="text-sm text-red-600">{errors.clienteCidade.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="clienteUf">UF</Label>
                      <Input
                        id="clienteUf"
                        
                        placeholder="SP"
                        maxLength={2}
                        {...register("clienteUf")}
                      />
                      {errors.clienteUf && (
                        <p className="text-sm text-red-600">{errors.clienteUf.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Loan Conditions */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <h3 className="mb-4 text-lg font-semibold text-gray-900">
                    Condições do Empréstimo
                  </h3>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <Label htmlFor="valor">Valor Solicitado</Label>
                      <Input
                        id="valor"
                        
                        placeholder="R$ 50.000,00"
                        {...register("valor")}
                      />
                      {errors.valor && (
                        <p className="text-sm text-red-600">{errors.valor.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="prazo">Prazo (meses)</Label>
                      {/* Hidden input for progressive enhancement */}
                      <input type="hidden"  value={watch("prazo") || ""} />
                      <Select onValueChange={value => setValue("prazo", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o prazo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="12">12 meses</SelectItem>
                          <SelectItem value="24">24 meses</SelectItem>
                          <SelectItem value="36">36 meses</SelectItem>
                          <SelectItem value="48">48 meses</SelectItem>
                          <SelectItem value="60">60 meses</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.prazo && (
                        <p className="text-sm text-red-600">{errors.prazo.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="finalidade">Finalidade</Label>
                      {/* Hidden input for progressive enhancement */}
                      <input type="hidden"  value={watch("finalidade") || ""} />
                      <Select onValueChange={value => setValue("finalidade", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a finalidade" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="capital_giro">Capital de Giro</SelectItem>
                          <SelectItem value="investimento">Investimento</SelectItem>
                          <SelectItem value="equipamentos">Equipamentos</SelectItem>
                          <SelectItem value="reforma">Reforma</SelectItem>
                          <SelectItem value="outros">Outros</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.finalidade && (
                        <p className="text-sm text-red-600">{errors.finalidade.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="garantia">Tipo de Garantia</Label>
                      {/* Hidden input for progressive enhancement */}
                      <input type="hidden"  value={watch("garantia") || ""} />
                      <Select onValueChange={value => setValue("garantia", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a garantia" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aval">Aval</SelectItem>
                          <SelectItem value="fianca">Fiança</SelectItem>
                          <SelectItem value="imovel">Imóvel</SelectItem>
                          <SelectItem value="veiculo">Veículo</SelectItem>
                          <SelectItem value="sem_garantia">Sem Garantia</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.garantia && (
                        <p className="text-sm text-red-600">{errors.garantia.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Dados Bancários para Pagamento */}
                  <h4 className="mt-6 mb-4 text-md font-semibold text-gray-800">Dados para Pagamento</h4>
                  <div className="space-y-4">
                    <div>
                      <Label>Forma de Recebimento</Label>
                      <div className="flex gap-4">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="radio"
                            value="pix"
                            {...register("dadosPagamentoTipo")}
                            className="mr-2"
                          />
                          PIX
                        </label>
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="radio"
                            value="conta_bancaria"
                            {...register("dadosPagamentoTipo")}
                            className="mr-2"
                          />
                          Conta Bancária
                        </label>
                      </div>
                    </div>

                    {watch("dadosPagamentoTipo") === "pix" && (
                      <div>
                        <Label htmlFor="dadosPagamentoPix">Chave PIX</Label>
                        <Input
                          id="dadosPagamentoPix"
                          placeholder="CPF, E-mail, Telefone ou Chave Aleatória"
                          {...register("dadosPagamentoPix")}
                        />
                      </div>
                    )}

                    {watch("dadosPagamentoTipo") === "conta_bancaria" && (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="dadosPagamentoBanco">Banco</Label>
                          <Input
                            id="dadosPagamentoBanco"
                            placeholder="Ex: Banco do Brasil"
                            {...register("dadosPagamentoBanco")}
                          />
                        </div>
                        <div>
                          <Label htmlFor="dadosPagamentoAgencia">Agência</Label>
                          <Input
                            id="dadosPagamentoAgencia"
                            placeholder="0000"
                            {...register("dadosPagamentoAgencia")}
                          />
                        </div>
                        <div>
                          <Label htmlFor="dadosPagamentoConta">Conta</Label>
                          <Input
                            id="dadosPagamentoConta"
                            placeholder="00000"
                            {...register("dadosPagamentoConta")}
                          />
                        </div>
                        <div>
                          <Label htmlFor="dadosPagamentoDigito">Dígito</Label>
                          <Input
                            id="dadosPagamentoDigito"
                            placeholder="0"
                            maxLength={2}
                            {...register("dadosPagamentoDigito")}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Documents */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <h3 className="mb-4 text-lg font-semibold text-gray-900">Anexo de Documentos</h3>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {[
                      "Documento de Identidade",
                      "Comprovante de Renda",
                      "Comprovante de Residência",
                      "Documentos Adicionais",
                    ].map(docType => (
                      <div key={docType}>
                        <Label className="mb-2 block text-sm font-medium text-gray-700">
                          {docType}
                        </Label>
                        <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition-colors hover:border-primary">
                          <Upload className="mx-auto mb-2 text-3xl text-gray-400" />
                          <p className="mb-2 text-gray-500">
                            Clique para enviar ou arraste o arquivo aqui
                          </p>
                          <Input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={handleFileUpload}
                            className="hidden"
                            id={`file-${docType}`}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById(`file-${docType}`)?.click()}
                            disabled={uploadFile.isPending}
                          >
                            {uploadFile.isPending ? "Enviando..." : "Selecionar Arquivo"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="mt-8 flex justify-between border-t border-gray-200 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === 1}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>

                <div className="space-x-4">
                  <Button type="button" variant="outline">
                    Salvar Rascunho
                  </Button>
                  {currentStep < 3 ? (
                    <Button type="button" onClick={nextStep}>
                      Próximo
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={createProposta.isPending}>
                      {createProposta.isPending ? "Criando..." : "Criar Proposta"}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
