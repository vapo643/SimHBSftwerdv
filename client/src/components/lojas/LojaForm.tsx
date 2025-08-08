import React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { useQuery } from "@tanstack/react-query";
import { Save, X, Loader2 } from "lucide-react";
import { z } from "zod";
import type { Loja, Parceiro } from "@shared/schema";
import { queryKeys } from "@/hooks/queries/queryKeys";

// Simplified schema for the form
const lojaFormSchema = z.object({
  parceiroId: z
    .number({ required_error: "Parceiro é obrigatório" })
    .min(1, "Selecione um parceiro"),
  nomeLoja: z.string().min(1, "Nome da loja é obrigatório"),
  endereco: z.string().min(1, "Endereço é obrigatório"),
});

type LojaFormData = z.infer<typeof lojaFormSchema>;

interface LojaFormProps {
  initialData?: Loja | null;
  onSubmit: (data: LojaFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const LojaForm: React.FC<LojaFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<LojaFormData>({
    resolver: zodResolver(lojaFormSchema),
    defaultValues: initialData
      ? {
          parceiroId: initialData.parceiroId,
          nomeLoja: initialData.nomeLoja,
          endereco: initialData.endereco,
        }
      : {
          parceiroId: undefined,
          nomeLoja: "",
          endereco: "",
        },
  });

  // Fetch parceiros for the select dropdown using consistent queryKeys and apiClient
  const { data: parceiros = [] } = useQuery<Parceiro[]>({
    queryKey: queryKeys.partners.list(),
    queryFn: async () => {
      const { api } = await import("@/lib/apiClient");
      const response = await api.get<Parceiro[]>("/api/parceiros");
      return response.data;
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-4">
        <div>
          <Label htmlFor="parceiroId" className="text-sm font-medium">
            Parceiro *
          </Label>
          <Controller
            name="parceiroId"
            control={control}
            render={({ field }) => (
              <Select
                onValueChange={value => field.onChange(parseInt(value, 10))}
                defaultValue={field.value ? String(field.value) : undefined}
                disabled={isLoading}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione um parceiro..." />
                </SelectTrigger>
                <SelectContent>
                  {parceiros.map(parceiro => (
                    <SelectItem key={parceiro.id} value={String(parceiro.id)}>
                      {parceiro.razaoSocial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.parceiroId && (
            <p className="mt-1 text-sm text-red-500">{errors.parceiroId.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="nomeLoja" className="text-sm font-medium">
            Nome da Loja *
          </Label>
          <Input
            id="nomeLoja"
            {...register("nomeLoja")}
            placeholder="Nome da loja"
            disabled={isLoading}
            className="mt-1"
          />
          {errors.nomeLoja && (
            <p className="mt-1 text-sm text-red-500">{errors.nomeLoja.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="endereco" className="text-sm font-medium">
            Endereço *
          </Label>
          <Input
            id="endereco"
            {...register("endereco")}
            placeholder="Endereço completo da loja"
            disabled={isLoading}
            className="mt-1"
          />
          {errors.endereco && (
            <p className="mt-1 text-sm text-red-500">{errors.endereco.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          className="gap-2"
        >
          <X className="h-4 w-4" />
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading} className="btn-simpix-primary gap-2">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {initialData ? "Atualizando..." : "Criando..."}
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {initialData ? "Atualizar Loja" : "Criar Loja"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default LojaForm;
export { LojaForm };
