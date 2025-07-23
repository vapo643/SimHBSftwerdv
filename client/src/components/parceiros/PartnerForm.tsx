import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const partnerSchema = z.object({
  razaoSocial: z.string().min(3, "Razão Social é obrigatória."),
  cnpj: z.string().min(14, "CNPJ é obrigatório."),
  comissaoPadrao: z.string().optional(),
});

type PartnerFormData = z.infer<typeof partnerSchema>;

interface PartnerFormProps {
  initialData?: any;
  onSubmit: (data: PartnerFormData) => void;
  onCancel: () => void;
}

const PartnerForm: React.FC<PartnerFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PartnerFormData>({
    resolver: zodResolver(partnerSchema),
    defaultValues: initialData || {},
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="razaoSocial">Razão Social</Label>
        <Input id="razaoSocial" {...register("razaoSocial")} />
        {errors.razaoSocial && (
          <p className="mt-1 text-sm text-red-500">{errors.razaoSocial.message}</p>
        )}
      </div>
      <div>
        <Label htmlFor="cnpj">CNPJ</Label>
        <Input id="cnpj" {...register("cnpj")} placeholder="00.000.000/0001-00" />
        {errors.cnpj && <p className="mt-1 text-sm text-red-500">{errors.cnpj.message}</p>}
      </div>
      <div>
        <Label htmlFor="comissaoPadrao">Comissão Padrão (%)</Label>
        <Input id="comissaoPadrao" {...register("comissaoPadrao")} placeholder="Ex: 5.5" />
        {errors.comissaoPadrao && (
          <p className="mt-1 text-sm text-red-500">{errors.comissaoPadrao.message}</p>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  );
};

export default PartnerForm;
