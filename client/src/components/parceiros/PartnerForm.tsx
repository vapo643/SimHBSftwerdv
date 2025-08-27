import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Parceiro } from '@shared/schema';
import { Save, X, Loader2 } from 'lucide-react';
import { z } from 'zod';

// Simplified schema with only essential fields
const simplifiedPartnerSchema = z.object({
  razaoSocial: z.string().min(1, 'Razão Social é obrigatória'),
  cnpj: z.string().min(1, 'CNPJ é obrigatório'),
});

type SimplifiedPartnerData = z.infer<typeof simplifiedPartnerSchema>;

interface PartnerFormProps {
  initialData?: Parceiro | null;
  onSubmit: (data: SimplifiedPartnerData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const PartnerForm: React.FC<PartnerFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SimplifiedPartnerData>({
    resolver: zodResolver(simplifiedPartnerSchema),
    defaultValues: initialData
      ? {
          razaoSocial: initialData.razaoSocial,
          cnpj: initialData.cnpj,
        }
      : {
          razaoSocial: '',
          cnpj: '',
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
            {...register('razaoSocial')}
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
            {...register('cnpj')}
            placeholder="00.000.000/0001-00"
            disabled={isLoading}
            className="mt-1"
          />
          {errors.cnpj && <p className="mt-1 text-sm text-red-500">{errors.cnpj.message}</p>}
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
              {initialData ? 'Atualizando...' : 'Criando...'}
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {initialData ? 'Atualizar Parceiro' : 'Criar Parceiro'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default PartnerForm;
