import React from "react";
import { useForm, Controller } from "react-hook-form";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const configSchema = z
  .object({
    tabelaComercial: z.string().nonempty("A seleção da tabela é obrigatória."),
    comissao: z.number().positive("A comissão deve ser um número positivo."),
    taxaJurosCustomizada: z.number().optional(),
    prazosCustomizados: z.string().optional(),
  })
  .refine(
    data => {
      if (data.tabelaComercial === "custom") {
        return data.taxaJurosCustomizada && data.prazosCustomizados;
      }
      return true;
    },
    {
      message: "Juros e Prazos são obrigatórios para tabelas customizadas.",
      path: ["taxaJurosCustomizada"],
    }
  );

type ConfigFormData = z.infer<typeof configSchema>;

const ConfiguracaoComercialForm: React.FC = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    watch,
  } = useForm<ConfigFormData>({
    resolver: zodResolver(configSchema),
  });

  const selectedTable = watch("tabelaComercial");

  const onSubmit = (data: ConfigFormData) => {
    console.log("Configuração Salva:", data);
  };

  const mockTabelas = ["Tabela Padrão 2024", "Tabela Prime"];

  return (
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
                    {mockTabelas.map(t => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
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
            <Input id="comissao" type="number" {...register("comissao", { valueAsNumber: true })} />
            {errors.comissao && (
              <p className="mt-1 text-sm text-red-500">{errors.comissao.message}</p>
            )}
          </div>

          {selectedTable === "custom" && (
            <div className="space-y-4 rounded-md border bg-secondary p-4">
              <h3 className="font-semibold">Tabela Personalizada</h3>
              <div>
                <Label htmlFor="taxaJurosCustomizada">Taxa de Juros (%)</Label>
                <Input
                  id="taxaJurosCustomizada"
                  type="number"
                  {...register("taxaJurosCustomizada", { valueAsNumber: true })}
                />
                {errors.taxaJurosCustomizada && (
                  <p className="mt-1 text-sm text-red-500">{errors.taxaJurosCustomizada.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="prazosCustomizados">
                  Prazos Permitidos (meses, separados por vírgula)
                </Label>
                <Input
                  id="prazosCustomizados"
                  {...register("prazosCustomizados")}
                  placeholder="Ex: 12,24,36"
                />
                {errors.prazosCustomizados && (
                  <p className="mt-1 text-sm text-red-500">{errors.prazosCustomizados.message}</p>
                )}
              </div>
            </div>
          )}
          <Button type="submit" className="w-full">
            Salvar Configuração Comercial
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ConfiguracaoComercialForm;
