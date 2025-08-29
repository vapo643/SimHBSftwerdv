import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signIn } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import zxcvbn from 'zxcvbn';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

// UX-004: Tipos para indicador de força de senha
type PasswordStrength = {
  strength: 'weak' | 'fair' | 'good' | 'strong';
  percentage: number;
  feedback: string;
  suggestions: string[];
  color: string;
};

const LoginPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);
  const { toast } = useToast();

  // UX-004: Função para avaliar força da senha usando zxcvbn
  const evaluatePasswordStrength = (password: string): PasswordStrength | null => {
    if (!password) return null;
    
    const result = zxcvbn(password);
    
    const strengthMap = {
      0: { label: 'weak' as const, color: 'bg-red-500', percentage: 20 },
      1: { label: 'weak' as const, color: 'bg-red-400', percentage: 40 },
      2: { label: 'fair' as const, color: 'bg-yellow-500', percentage: 60 },
      3: { label: 'good' as const, color: 'bg-green-500', percentage: 80 },
      4: { label: 'strong' as const, color: 'bg-green-600', percentage: 100 },
    };
    
    const mapping = strengthMap[result.score as keyof typeof strengthMap];
    
    return {
      strength: mapping.label,
      percentage: mapping.percentage,
      feedback: result.feedback.warning || getStrengthMessage(result.score),
      suggestions: result.feedback.suggestions || [],
      color: mapping.color,
    };
  };

  // UX-004: Mensagens de força da senha
  const getStrengthMessage = (score: number): string => {
    switch (score) {
      case 0:
      case 1:
        return 'Senha muito fraca';
      case 2:
        return 'Senha fraca';
      case 3:
        return 'Senha boa';
      case 4:
        return 'Senha muito forte';
      default:
        return 'Avalie sua senha';
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  // UX-004: Observer para mudanças na senha
  const passwordValue = watch('password', '');
  
  // UX-004: Atualizar força da senha quando o valor mudar
  React.useEffect(() => {
    const strength = evaluatePasswordStrength(passwordValue);
    setPasswordStrength(strength);
  }, [passwordValue]);

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
              <Input 
                id="password" 
                type="password" 
                required 
                {...register('password')} 
                data-testid="input-password"
              />
              
              {/* UX-004: Critérios mínimos de validação */}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Critérios mínimos:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li>Mínimo de 8 caracteres</li>
                  <li>Pelo menos 3 tipos de caracteres (maiúsculas, minúsculas, números, símbolos)</li>
                  <li>Não deve ser uma senha comum</li>
                </ul>
              </div>

              {/* UX-004: Indicador visual de força da senha */}
              {passwordValue && passwordStrength && (
                <div className="space-y-2" data-testid="password-strength-indicator">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Força da senha:</span>
                    <span className={`text-sm font-medium ${
                      passwordStrength.strength === 'weak' ? 'text-red-500' :
                      passwordStrength.strength === 'fair' ? 'text-yellow-500' :
                      passwordStrength.strength === 'good' ? 'text-green-500' :
                      'text-green-600'
                    }`} data-testid="password-strength-text">
                      {passwordStrength.strength === 'weak' ? 'Fraca' :
                       passwordStrength.strength === 'fair' ? 'Razoável' :
                       passwordStrength.strength === 'good' ? 'Boa' :
                       'Muito Forte'}
                    </span>
                  </div>
                  
                  <Progress 
                    value={passwordStrength.percentage} 
                    className="h-2"
                    data-testid="password-strength-progress"
                  />
                  
                  {passwordStrength.feedback && (
                    <p className="text-xs text-muted-foreground" data-testid="password-feedback">
                      {passwordStrength.feedback}
                    </p>
                  )}
                  
                  {passwordStrength.suggestions.length > 0 && (
                    <div className="text-xs text-muted-foreground" data-testid="password-suggestions">
                      <p className="font-medium">Sugestões:</p>
                      <ul className="list-disc list-inside ml-2 space-y-0.5">
                        {passwordStrength.suggestions.map((suggestion, index) => (
                          <li key={index}>{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

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
