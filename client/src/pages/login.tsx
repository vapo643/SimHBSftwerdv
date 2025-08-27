import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signIn } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

const LoginPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      await signIn(data.email, data.password);
      setLocation('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Erro ao fazer login',
        description: error.message || 'Credenciais inválidas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2">
      <div className="relative hidden items-center justify-center overflow-hidden bg-muted lg:flex">
        <div className="to-primary/80 absolute inset-0 bg-gradient-to-br from-primary opacity-40 dark:opacity-60"></div>
        <img
          src="https://dvglgxrvhmtsixaabxha.supabase.co/storage/v1/object/public/logosimpixblack//Logotipo_Achadinhos_de_Beleza_Colorido_Moderno_Rosa_e_Preto-removebg-preview.png"
          alt="Simpix Logo"
          className="relative z-10 w-1/2 opacity-75"
        />
      </div>
      <div className="lg:min-h-auto flex min-h-screen items-center justify-center bg-background py-12">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold text-foreground">Login</h1>
            <p className="text-balance text-muted-foreground">Acesse sua conta para continuar</p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                required
                {...register('email')}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Senha</Label>
              </div>
              <Input id="password" type="password" required {...register('password')} />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
