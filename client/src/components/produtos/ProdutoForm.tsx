import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const produtoSchema = z.object({
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
  tacAtivaParaClientesExistentes: z.boolean().default(true),
});

type ProdutoFormData = z.infer<typeof produtoSchema>;

interface ProdutoFormProps {
  onSubmit: (data: ProdutoFormData) => void;
  onCancel: () => void;
  initialData?: ProdutoFormData;
}

const ProdutoForm: React.FC<ProdutoFormProps> = ({ onSubmit, onCancel, initialData }) => {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProdutoFormData>({
    resolver: zodResolver(produtoSchema),
    defaultValues: initialData || {
      status: 'Ativo',
      tacValor: 0,
      tacTipo: 'fixo',
      tacAtivaParaClientesExistentes: true,
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

      <div className="space-y-3 p-4 border rounded-lg bg-blue-50">
        <div className="text-sm font-medium text-blue-900">
          📋 Configuração TAC para Clientes
        </div>
        <div className="text-xs text-blue-700 mb-3">
          • <strong>Clientes NOVOS:</strong> Sempre pagam 10% TAC (automático) <br/>
          • <strong>Clientes EXISTENTES:</strong> TAC configurável abaixo
        </div>
        <Controller
          name="tacAtivaParaClientesExistentes"
          control={control}
          render={({ field }) => (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="tacAtivaParaClientesExistentes"
                checked={field.value}
                onCheckedChange={field.onChange}
                data-testid="checkbox-tac-clientes-existentes"
              />
              <Label 
                htmlFor="tacAtivaParaClientesExistentes" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Ativar TAC para clientes existentes
              </Label>
            </div>
          )}
        />
        <div className="text-xs text-gray-600">
          Se desmarcado, clientes existentes ficam isentos de TAC neste produto
        </div>
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
