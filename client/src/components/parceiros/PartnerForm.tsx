import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const partnerSchema = z.object({
  razaoSocial: z.string().min(3, "Razão Social é obrigatória."),
  nomeFantasia: z.string().min(3, "Nome Fantasia é obrigatório."),
  cnpj: z.string().length(18, "CNPJ deve ter 18 caracteres (incluindo pontos, barra e hífen)."),
});

type PartnerFormData = z.infer<typeof partnerSchema>;

interface PartnerFormProps {
  initialData?: any;
  onSubmit: (data: PartnerFormData) => void;
  onCancel: () => void;
}

const PartnerForm: React.FC<PartnerFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const { register, handleSubmit, formState: { errors } } = useForm<PartnerFormData>({
    resolver: zodResolver(partnerSchema),
    defaultValues: initialData || {},
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="cnpj">CNPJ</Label>
        <Input id="cnpj" {...register("cnpj")} placeholder="00.000.000/0001-00" />
        {errors.cnpj && <p className="text-red-500 text-sm mt-1">{errors.cnpj.message}</p>}
      </div>
      <div>
        <Label htmlFor="razaoSocial">Razão Social</Label>
        <Input id="razaoSocial" {...register("razaoSocial")} />
        {errors.razaoSocial && <p className="text-red-500 text-sm mt-1">{errors.razaoSocial.message}</p>}
      </div>
      <div>
        <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
        <Input id="nomeFantasia" {...register("nomeFantasia")} />
        {errors.nomeFantasia && <p className="text-red-500 text-sm mt-1">{errors.nomeFantasia.message}</p>}
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  );
};

export default PartnerForm;