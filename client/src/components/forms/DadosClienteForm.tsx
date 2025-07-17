import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from "@/lib/utils";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const FormMessage = ({ children }: { children: React.ReactNode }) => {
  if (!children) return null;
  return <p className="text-sm font-medium text-red-500 mt-1">{children}</p>;
};

const clienteSchema = z.object({
  clienteNome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres."),
  clienteCpf: z.string().length(11, "CPF deve ter exatamente 11 dígitos."),
  clienteDataNascimento: z.string().min(1, "Data de nascimento é obrigatória."),
  clienteTelefone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos."),
  clienteEmail: z.string().email("Formato de e-mail inválido."),
});

type ClienteFormData = z.infer<typeof clienteSchema>;

const DadosClienteForm: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema),
  });

  const onSubmit = async (data: ClienteFormData) => {
    setIsSubmitting(true);
    console.log("Enviando dados:", data);
    // Simula uma chamada de API
    await new Promise(resolve => setTimeout(resolve, 2000)); 
    setIsSubmitting(false);
    console.log("Dados enviados com sucesso!");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="clienteNome">Nome Completo</Label>
        <Input 
          id="clienteNome" 
          aria-invalid={!!errors.clienteNome}
          className={cn({ "border-red-500": errors.clienteNome })}
          {...register("clienteNome")} 
        />
        <FormMessage>{errors.clienteNome?.message}</FormMessage>
      </div>
      <div>
        <Label htmlFor="clienteCpf">CPF</Label>
        <Input 
          id="clienteCpf" 
          aria-invalid={!!errors.clienteCpf}
          className={cn({ "border-red-500": errors.clienteCpf })}
          {...register("clienteCpf")} 
        />
        <FormMessage>{errors.clienteCpf?.message}</FormMessage>
      </div>
      <div>
        <Label htmlFor="clienteDataNascimento">Data de Nascimento</Label>
        <Input 
          type="date" 
          id="clienteDataNascimento" 
          aria-invalid={!!errors.clienteDataNascimento}
          className={cn({ "border-red-500": errors.clienteDataNascimento })}
          {...register("clienteDataNascimento")} 
        />
        <FormMessage>{errors.clienteDataNascimento?.message}</FormMessage>
      </div>
      <div>
        <Label htmlFor="clienteTelefone">Celular</Label>
        <Input 
          id="clienteTelefone" 
          aria-invalid={!!errors.clienteTelefone}
          className={cn({ "border-red-500": errors.clienteTelefone })}
          {...register("clienteTelefone")} 
        />
        <FormMessage>{errors.clienteTelefone?.message}</FormMessage>
      </div>
      <div>
        <Label htmlFor="clienteEmail">E-mail</Label>
        <Input 
          type="email" 
          id="clienteEmail" 
          aria-invalid={!!errors.clienteEmail}
          className={cn({ "border-red-500": errors.clienteEmail })}
          {...register("clienteEmail")} 
        />
        <FormMessage>{errors.clienteEmail?.message}</FormMessage>
      </div>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Enviando...' : 'Próximo'}
      </Button>
    </form>
  );
};

export default DadosClienteForm;