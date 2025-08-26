import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const lojaSchema = z.object({
  nome: z.string().min(3, 'Nome da loja é obrigatório.'),
  endereco: z.string().min(10, 'Endereço é obrigatório.'),
});

type LojaFormData = z.infer<typeof lojaSchema>;

interface LojaFormProps {
  onSubmit: (data: LojaFormData) => void;
  onCancel: () => void;
}

const LojaForm: React.FC<LojaFormProps> = ({ onSubmit, onCancel }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LojaFormData>({
    resolver: zodResolver(lojaSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="nome">Nome da Loja</Label>
        <Input id="nome" {...register('nome')} />
        {errors.nome && <p className="mt-1 text-sm text-red-500">{errors.nome.message}</p>}
      </div>
      <div>
        <Label htmlFor="endereco">Endereço Completo</Label>
        <Input id="endereco" {...register('endereco')} />
        {errors.endereco && <p className="mt-1 text-sm text-red-500">{errors.endereco.message}</p>}
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">Salvar Loja</Button>
      </div>
    </form>
  );
};

export default LojaForm;
