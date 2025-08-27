import React from 'react';
import { Controller, UseFormRegister, Control, FieldErrors } from 'react-hook-form';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  _Select,
  _SelectContent,
  _SelectItem,
  _SelectTrigger,
  _SelectValue,
} from '@/components/ui/select';

const _clienteSchema = z.object({
  nomeCompleto: z.string().min(3, 'Nome completo é obrigatório.'),
  cpfCnpj: z
    .string()
    .refine((value) => value.length == 14 || value.length == 18, 'CPF/CNPJ inválido.'),
  rg: z.string().min(5, 'RG é obrigatório.').optional(),
  orgaoEmissor: z.string().min(2, 'Órgão Emissor é obrigatório.').optional(),
  estadoCivil: z.string().nonempty('Estado Civil é obrigatório.'),
  dataNascimento: z.string().min(1, 'Data de nascimento é obrigatória.'),
  nacionalidade: z.string().min(3, 'Nacionalidade é obrigatória.'),
  endereco: z.string().min(5, 'Endereço completo é obrigatório.'),
  cep: z.string().length(9, 'CEP deve ter 9 dígitos (incluindo traço).'),
  telefone: z.string().min(10, 'Telefone / WhatsApp é obrigatório.'),
  email: z.string().email('Email inválido.'),
  ocupacao: z.string().min(3, 'Ocupação / Profissão é obrigatória.'),
  rendaMensal: z.coerce.number().positive('Renda ou Faturamento deve ser um número positivo.'),
});

type _ClienteFormData = z.infer<typeof _clienteSchema>;

interface FormData {
  [key: string]: unknown;
}

interface DadosClienteFormProps {
  register: UseFormRegister<FormData>;
  control: Control<FormData>;
  errors: FieldErrors<FormData>;
}

const DadosClienteForm: React.FC<DadosClienteFormProps> = ({ register, control, errors }) => {
  // O handleSubmit é gerenciado pelo componente pai
  return (
    <div className="max-h-[70vh] space-y-4 overflow-y-auto p-1">
      <div>
        <Label htmlFor="nomeCompleto">Nome completo / Razão Social</Label>
        <Input id="nomeCompleto" className="input-simpix" {...register('nomeCompleto')} />
        {errors.nomeCompleto && (
          <p className="mt-1 text-sm text-red-500">{errors.nomeCompleto.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="cpfCnpj">CPF / CNPJ</Label>
        <Input id="cpfCnpj" className="input-simpix" {...register('cpfCnpj')} />
        {errors.cpfCnpj && <p className="mt-1 text-sm text-red-500">{errors.cpfCnpj.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="rg">RG</Label>
          <Input id="rg" className="input-simpix" {...register('rg')} />
          {errors.rg && <p className="mt-1 text-sm text-red-500">{errors.rg.message}</p>}
        </div>
        <div>
          <Label htmlFor="orgaoEmissor">Órgão Emissor</Label>
          <Input id="orgaoEmissor" className="input-simpix" {...register('orgaoEmissor')} />
          {errors.orgaoEmissor && (
            <p className="mt-1 text-sm text-red-500">{errors.orgaoEmissor.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="estadoCivil">Estado Civil</Label>
          <Controller
            name="estadoCivil"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                  <SelectItem value="casado">Casado(a)</SelectItem>
                  <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                  <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                  <SelectItem value="uniao_estavel">União Estável</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.estadoCivil && (
            <p className="mt-1 text-sm text-red-500">{errors.estadoCivil.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="dataNascimento">Data de Nascimento</Label>
          <Input
            type="date"
            id="dataNascimento"
            className="input-simpix"
            {...register('dataNascimento')}
          />
          {errors.dataNascimento && (
            <p className="mt-1 text-sm text-red-500">{errors.dataNascimento.message}</p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="nacionalidade">Nacionalidade</Label>
        <Input id="nacionalidade" className="input-simpix" {...register('nacionalidade')} />
        {errors.nacionalidade && (
          <p className="mt-1 text-sm text-red-500">{errors.nacionalidade.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="cep">CEP</Label>
        <Input id="cep" className="input-simpix" {...register('cep')} />
        {errors.cep && <p className="mt-1 text-sm text-red-500">{errors.cep.message}</p>}
      </div>

      <div>
        <Label htmlFor="endereco">Endereço Completo (Rua, Nº, Bairro, Cidade, Estado)</Label>
        <Input id="endereco" className="input-simpix" {...register('endereco')} />
        {errors.endereco && <p className="mt-1 text-sm text-red-500">{errors.endereco.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="telefone">Telefone / WhatsApp</Label>
          <Input id="telefone" className="input-simpix" {...register('telefone')} />
          {errors.telefone && (
            <p className="mt-1 text-sm text-red-500">{errors.telefone.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" className="input-simpix" {...register('email')} />
          {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="ocupacao">Ocupação / Profissão</Label>
          <Input id="ocupacao" className="input-simpix" {...register('ocupacao')} />
          {errors.ocupacao && (
            <p className="mt-1 text-sm text-red-500">{errors.ocupacao.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="rendaMensal">Renda / Faturamento Mensal</Label>
          <Input
            type="number"
            id="rendaMensal"
            className="input-simpix"
            {...register('rendaMensal')}
            placeholder="R$ 0,00"
          />
          {errors.rendaMensal && (
            <p className="mt-1 text-sm text-red-500">{errors.rendaMensal.message}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DadosClienteForm;
