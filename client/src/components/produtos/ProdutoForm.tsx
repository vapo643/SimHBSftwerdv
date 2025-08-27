import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  _Select,
  _SelectContent,
  _SelectItem,
  _SelectTrigger,
  _SelectValue,
} from '@/components/ui/select';

const _produtoSchema = z.object({
  nome: z.string().min(3, 'Nome do Produto é obrigatório.'),
  status: z.enum(['Ativo', 'Inativo'], {
    errorMap: () => ({ message: 'Status é obrigatório.' }),
  }),
  tacValor: z.number().min(0, 'Valor da TAC deve ser maior ou igual a zero').default(0),
  tacTipo: z
    .enum(['fixo', 'percentual'], {
      errorMap: () => ({ message: 'Tipo de TAC é obrigatório.' }),
    })
    .default('fixo'),
});

type ProdutoFormData = z.infer<typeof produtoSchema>;

interface ProdutoFormProps {
  onSubmit: (data: ProdutoFormData) => void;
  onCancel: () => void;
  initialData?: ProdutoFormData;
}

const ProdutoForm: React.FC<ProdutoFormProps> = ({ onSubmit, onCancel, initialData }) => {
  const {
  _control,
  _register,
  _handleSubmit,
    formState: { errors },
  } = useForm<ProdutoFormData>({
    resolver: zodResolver(produtoSchema),
    defaultValues: initialData || {
      status: 'Ativo',
      tacValor: 0,
      tacTipo: 'fixo',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="nome">Nome do Produto</Label>
        <Input id="nome" {...register('nome')} />
        {errors.nome && <p className="mt-1 text-sm text-red-500">{errors.nome.message}</p>}
      </div>

      <div>
        <Label htmlFor="status">Status</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Selecione o Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Ativo">Ativo</SelectItem>
                <SelectItem value="Inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {errors.status && <p className="mt-1 text-sm text-red-500">{errors.status.message}</p>}
      </div>

      <div>
        <Label htmlFor="tacValor">Valor da TAC (R$)</Label>
        <Input
          id="tacValor"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          {...register('tacValor', { valueAsNumber: true })}
        />
        {errors.tacValor && <p className="mt-1 text-sm text-red-500">{errors.tacValor.message}</p>}
      </div>

      <div>
        <Label htmlFor="tacTipo">Tipo de TAC</Label>
        <Controller
          name="tacTipo"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger id="tacTipo">
                <SelectValue placeholder="Selecione o Tipo de TAC" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixo">Valor Fixo (R$)</SelectItem>
                <SelectItem value="percentual">Percentual (%)</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {errors.tacTipo && <p className="mt-1 text-sm text-red-500">{errors.tacTipo.message}</p>}
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

export default ProdutoForm;
