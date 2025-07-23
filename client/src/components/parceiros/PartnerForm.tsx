import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { insertParceiroSchema, InsertParceiro, Parceiro } from "@shared/schema";
import { Save, X, Loader2 } from "lucide-react";

interface PartnerFormProps {
  initialData?: Parceiro | null;
  onSubmit: (data: InsertParceiro) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const PartnerForm: React.FC<PartnerFormProps> = ({ 
  initialData, 
  onSubmit, 
  onCancel, 
  isLoading = false 
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InsertParceiro>({
    resolver: zodResolver(insertParceiroSchema),
    defaultValues: initialData ? {
      razaoSocial: initialData.razaoSocial,
      cnpj: initialData.cnpj,
    } : {
      razaoSocial: "",
      cnpj: "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-4">
        <div>
          <Label htmlFor="razaoSocial" className="text-sm font-medium">
            Razão Social *
          </Label>
          <Input 
            id="razaoSocial" 
            {...register("razaoSocial")} 
            placeholder="Nome oficial da empresa"
            disabled={isLoading}
            className="mt-1"
          />
          {errors.razaoSocial && (
            <p className="mt-1 text-sm text-red-500">{errors.razaoSocial.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="cnpj" className="text-sm font-medium">
            CNPJ *
          </Label>
          <Input 
            id="cnpj" 
            {...register("cnpj")} 
            placeholder="00.000.000/0001-00"
            disabled={isLoading}
            className="mt-1"
          />
          {errors.cnpj && (
            <p className="mt-1 text-sm text-red-500">{errors.cnpj.message}</p>
          )}
        </div>

        

        
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t">
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
        <Button 
          type="submit" 
          disabled={isLoading}
          className="gap-2 btn-simpix-primary"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {initialData ? "Atualizando..." : "Criando..."}
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {initialData ? "Atualizar Parceiro" : "Criar Parceiro"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default PartnerForm;
