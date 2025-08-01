import { useState } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/queryClient';

const emailChangeSchema = z.object({
  newEmail: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória')
});

type EmailChangeFormData = z.infer<typeof emailChangeSchema>;

interface EmailChangeStatusResponse {
  hasPendingChange: boolean;
  newEmail: string | null;
}

interface EmailChangeResponse {
  message: string;
  debugToken?: string;
}

export default function AlterarEmail() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const form = useForm<EmailChangeFormData>({
    resolver: zodResolver(emailChangeSchema),
    defaultValues: {
      newEmail: '',
      password: ''
    }
  });

  // Check for pending email change
  const { data: statusData } = useQuery<EmailChangeStatusResponse>({
    queryKey: ['/api/auth/email-change-status'],
    refetchInterval: pendingEmail ? 5000 : false // Poll if there's a pending change
  });

  // Request email change mutation
  const changeEmailMutation = useMutation({
    mutationFn: async (data: EmailChangeFormData) => {
      const response = await apiRequest<EmailChangeResponse>('/api/auth/change-email', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: 'Email de verificação enviado',
        description: 'Verifique seu novo email para confirmar a alteração.',
      });
      
      // In development, show the token
      if (data.debugToken) {
        setVerificationToken(data.debugToken);
      }
      
      setPendingEmail(form.getValues('newEmail'));
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao alterar email',
        description: error.message || 'Ocorreu um erro ao processar sua solicitação',
        variant: 'destructive'
      });
    }
  });

  // Verify email change mutation
  const verifyEmailMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await apiRequest('/api/auth/verify-email-change', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: 'Email alterado com sucesso',
        description: 'Por favor, faça login novamente com seu novo email.',
      });
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao verificar email',
        description: error.message || 'Token inválido ou expirado',
        variant: 'destructive'
      });
      setVerificationToken(null);
    }
  });

  const onSubmit = (data: EmailChangeFormData) => {
    changeEmailMutation.mutate(data);
  };

  const handleVerifyToken = () => {
    if (verificationToken) {
      verifyEmailMutation.mutate(verificationToken);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-2xl">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => setLocation('/configuracoes')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Configurações
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Alterar Email
            </CardTitle>
            <CardDescription>
              Altere o email associado à sua conta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Current Email Display */}
            <div className="rounded-lg border p-4 bg-muted/50">
              <div className="text-sm text-muted-foreground mb-1">Email atual</div>
              <div className="font-medium">{user?.email}</div>
            </div>

            {/* Pending Email Change Alert */}
            {statusData?.hasPendingChange && (
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  Você tem uma alteração de email pendente para: <strong>{statusData.newEmail}</strong>
                  <br />
                  Verifique seu email para confirmar a alteração.
                </AlertDescription>
              </Alert>
            )}

            {/* Development Token Display */}
            {verificationToken && (
              <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <div className="mb-2">
                    <strong>Modo Desenvolvimento - Token de Verificação:</strong>
                  </div>
                  <code className="block p-2 bg-muted rounded text-xs break-all mb-3">
                    {verificationToken}
                  </code>
                  <Button
                    size="sm"
                    onClick={handleVerifyToken}
                    disabled={verifyEmailMutation.isPending}
                  >
                    Verificar Token
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Email Change Form */}
            {!statusData?.hasPendingChange && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="newEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Novo Email</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            placeholder="novo.email@exemplo.com"
                            disabled={changeEmailMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha Atual</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            placeholder="Digite sua senha atual"
                            disabled={changeEmailMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end pt-4">
                    <Button
                      type="submit"
                      disabled={changeEmailMutation.isPending}
                    >
                      {changeEmailMutation.isPending ? 'Processando...' : 'Alterar Email'}
                    </Button>
                  </div>
                </form>
              </Form>
            )}

            {/* Security Notice */}
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Por motivos de segurança, você precisará verificar o novo email antes que a alteração seja efetivada.
                Um email de verificação será enviado para o novo endereço.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}