import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DadosClienteForm: React.FC<{ register: any, errors: any }> = ({ register, errors }) => {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="clienteNome">Nome Completo</Label>
        <Input id="clienteNome" {...register("clienteNome")} />
        {errors.clienteNome && <p className="text-red-500 text-sm mt-1">{errors.clienteNome.message}</p>}
      </div>
      <div>
        <Label htmlFor="clienteCpf">CPF</Label>
        <Input id="clienteCpf" {...register("clienteCpf")} />
        {errors.clienteCpf && <p className="text-red-500 text-sm mt-1">{errors.clienteCpf.message}</p>}
      </div>
      <div>
        <Label htmlFor="clienteEmail">Email</Label>
        <Input id="clienteEmail" type="email" {...register("clienteEmail")} />
        {errors.clienteEmail && <p className="text-red-500 text-sm mt-1">{errors.clienteEmail.message}</p>}
      </div>
    </div>
  );
};

export default DadosClienteForm;