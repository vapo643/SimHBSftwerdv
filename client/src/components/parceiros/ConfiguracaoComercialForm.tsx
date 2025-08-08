import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { api } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useRoute } from "wouter";

const configSchema = z.object({
  tabelaComercial: z.string().nonempty("A seleção da tabela é obrigatória."),
  comissao: z.number().positive("A comissão deve ser um número positivo."),
});

const customTabelaSchema = z.object({
  nomeTabela: z.string().min(3, "Nome da tabela deve ter pelo menos 3 caracteres"),
  produtoId: z.number().positive("Produto é obrigatório"),
  taxaJuros: z.number().positive("Taxa de juros deve ser positiva"),
  prazos: z.array(z.number().positive()).min(1, "Deve ter pelo menos um prazo"),
  comissao: z.number().min(0, "Comissão deve ser maior ou igual a zero").default(0),
});

type ConfigFormData = z.infer<typeof configSchema>;
type CustomTabelaFormData = z.infer<typeof customTabelaSchema>;

interface TabelaComercial {
  id: number;
  nomeTabela: string;
  taxaJuros: string;
  prazos: number[];
  produtoId: number;
  parceiroId?: number;
}

interface Produto {
  id: number;
  nomeProduto: string;
  isActive: boolean;
}

const ConfiguracaoComercialForm: React.FC = () => {
  const [_match, params] = useRoute("/parceiros/detalhe/:id");
  const partnerId = params ? parseInt(params.id) : null;

  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [novoPrazo, setNovoPrazo] = useState("");
  const [prazos, setPrazos] = useState<number[]>([]);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    watch,
    setValue,
  } = useForm<ConfigFormData>({
    resolver: zodResolver(configSchema),
  });

  const {
    register: registerCustom,
    handleSubmit: handleSubmitCustom,
    formState: { errors: customErrors },
    setValue: setValueCustom,
    reset: resetCustom,
  } = useForm<CustomTabelaFormData>({
    resolver: zodResolver(customTabelaSchema),
  });

  const selectedTable = watch("tabelaComercial");

  // Fetch commercial tables from API
  const {
    data: tabelasComerciais = [],
    isLoading: loadingTabelas,
    error: tabelasError,
  } = useQuery<TabelaComercial[]>({
    queryKey: ["tabelas-comerciais"],
    queryFn: async () => {
      const response = await api.get<TabelaComercial[]>("/api/tabelas-comerciais");
      return response.data;
    },
  });

  // Fetch products for dropdown
  const { data: produtos = [], isLoading: loadingProdutos } = useQuery<Produto[]>({
    queryKey: ["produtos"],
    queryFn: async () => {
      const response = await api.get<Produto[]>("/api/produtos");
      return response.data;
    },
  });

  // Mutation for creating custom table
  const createTabelaMutation = useMutation({
    mutationFn: async (data: CustomTabelaFormData & { prazos: number[] }) => {
      if (!partnerId) throw new Error("Partner ID not found");

      // Convert single produtoId to produtoIds array as expected by backend
      const payload = {
        nomeTabela: data.nomeTabela,
        taxaJuros: data.taxaJuros,
        comissao: data.comissao,
        prazos: data.prazos,
        produtoIds: [data.produtoId], // Convert single ID to array
        parceiroId: partnerId,
      };

      console.log("Sending payload to backend:", payload);

      const response = await api.post("/api/admin/tabelas-comerciais", payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tabelas-comerciais"] });
      setIsCustomModalOpen(false);
      resetCustom();
      setPrazos([]);
      toast({
        title: "Sucesso!",
        description: "Tabela comercial personalizada criada com sucesso!",
      });
    },
    onError: (error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message : "Erro ao criar tabela comercial";
      toast({
        title: "Erro!",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ConfigFormData) => {
    console.log("Configuração Salva:", data);
    toast({
      title: "Configuração salva",
      description: "As configurações comerciais foram atualizadas.",
    });
  };

  const onSubmitCustom = (data: CustomTabelaFormData) => {
    // Validate that we have at least one prazo
    if (prazos.length === 0) {
      toast({
        title: "Erro!",
        description: "Adicione pelo menos um prazo permitido.",
        variant: "destructive",
      });
      return;
    }

    console.log("Form data:", data);
    console.log("Prazos:", prazos);

    createTabelaMutation.mutate({
      ...data,
      prazos,
    });
  };

  // Tag input functions
  const adicionarPrazo = () => {
    const prazo = parseInt(novoPrazo);
    if (prazo > 0 && !prazos.includes(prazo)) {
      const novosPrazos = [...prazos, prazo].sort((a, b) => a - b);
      setPrazos(novosPrazos);
      setValueCustom("prazos", novosPrazos);
      setNovoPrazo("");
    }
  };

  const removerPrazo = (prazoRemover: number) => {
    const novosPrazos = prazos.filter(p => p !== prazoRemover);
    setPrazos(novosPrazos);
    setValueCustom("prazos", novosPrazos);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      adicionarPrazo();
    }
  };

  // Open custom modal when "custom" is selected
  React.useEffect(() => {
    if (selectedTable === "custom") {
      setIsCustomModalOpen(true);
    }
  }, [selectedTable]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Configuração Comercial</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="tabelaComercial">Tabela Comercial Aplicável</Label>
              <Controller
                name="tabelaComercial"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger id="tabelaComercial">
                      <SelectValue placeholder="Selecione uma tabela..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">-- Criar Tabela Personalizada --</SelectItem>
                      {loadingTabelas ? (
                        <SelectItem value="loading" disabled>
                          Carregando tabelas...
                        </SelectItem>
                      ) : tabelasError ? (
                        <SelectItem value="error" disabled>
                          Erro ao carregar tabelas
                        </SelectItem>
                      ) : tabelasComerciais.length === 0 ? (
                        <SelectItem value="empty" disabled>
                          Nenhuma tabela encontrada
                        </SelectItem>
                      ) : (
                        tabelasComerciais.map(tabela => (
                          <SelectItem key={tabela.id} value={tabela.id.toString()}>
                            {tabela.nomeTabela} - {tabela.taxaJuros}% a.m.
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.tabelaComercial && (
                <p className="mt-1 text-sm text-red-500">{errors.tabelaComercial.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="comissao">Comissão do Parceiro (%)</Label>
              <Input
                id="comissao"
                type="number"
                {...register("comissao", { valueAsNumber: true })}
              />
              {errors.comissao && (
                <p className="mt-1 text-sm text-red-500">{errors.comissao.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full">
              Salvar Configuração Comercial
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Modal for creating custom table */}
      <Dialog
        open={isCustomModalOpen}
        onOpenChange={open => {
          setIsCustomModalOpen(open);
          if (!open) {
            resetCustom();
            setPrazos([]);
            setValue("tabelaComercial", "");
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Criar Tabela Comercial Personalizada</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitCustom(onSubmitCustom)} className="space-y-4">
            <div>
              <Label htmlFor="nomeTabela">Nome da Tabela</Label>
              <Input
                id="nomeTabela"
                {...registerCustom("nomeTabela")}
                placeholder="Ex: Tabela Especial - Parceiro X"
              />
              {customErrors.nomeTabela && (
                <p className="mt-1 text-sm text-red-500">{customErrors.nomeTabela.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="produtoId">Produto Associado</Label>
              <Controller
                name="produtoId"
                control={controlCustom}
                render={({ field }) => (
                  <Select
                    onValueChange={value => field.onChange(parseInt(value))}
                    value={field.value?.toString()}
                  >
                    <SelectTrigger id="produtoId">
                      <SelectValue placeholder="Selecione um produto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingProdutos ? (
                        <SelectItem value="loading" disabled>
                          Carregando produtos...
                        </SelectItem>
                      ) : produtos.length === 0 ? (
                        <SelectItem value="empty" disabled>
                          Nenhum produto encontrado
                        </SelectItem>
                      ) : (
                        produtos
                          .filter(p => p.isActive)
                          .map(produto => (
                            <SelectItem key={produto.id} value={produto.id.toString()}>
                              {produto.nomeProduto}
                            </SelectItem>
                          ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
              {customErrors.produtoId && (
                <p className="mt-1 text-sm text-red-500">{customErrors.produtoId.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="taxaJuros">Taxa de Juros Mensal (%)</Label>
              <Input
                id="taxaJuros"
                type="number"
                step="0.01"
                {...registerCustom("taxaJuros", { valueAsNumber: true })}
                placeholder="Ex: 2.5"
              />
              {customErrors.taxaJuros && (
                <p className="mt-1 text-sm text-red-500">{customErrors.taxaJuros.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="comissao">Comissão (%)</Label>
              <Input
                id="comissao"
                type="number"
                step="0.01"
                min="0"
                {...registerCustom("comissao", { valueAsNumber: true })}
                placeholder="Ex: 15.50"
              />
              {customErrors.comissao && (
                <p className="mt-1 text-sm text-red-500">{customErrors.comissao.message}</p>
              )}
            </div>

            <div>
              <Label>Prazos Permitidos (meses)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={novoPrazo}
                  onChange={e => setNovoPrazo(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ex: 12"
                />
                <Button type="button" onClick={adicionarPrazo} size="sm">
                  Adicionar
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {prazos.map(prazo => (
                  <Badge key={prazo} className="flex items-center gap-1">
                    {prazo} meses
                    <button
                      type="button"
                      onClick={() => removerPrazo(prazo)}
                      className="ml-1 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              {customErrors.prazos && (
                <p className="mt-1 text-sm text-red-500">{customErrors.prazos.message}</p>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCustomModalOpen(false);
                  resetCustom();
                  setPrazos([]);
                  setValue("tabelaComercial", "");
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createTabelaMutation.isPending}>
                {createTabelaMutation.isPending ? "Criando..." : "Criar Tabela"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ConfiguracaoComercialForm;
