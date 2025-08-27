import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { User, Mail, Shield, Settings, Lock, Monitor, ArrowRight } from 'lucide-react';

export default function Configuracoes() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMINISTRADOR';

  const settingsOptions = [
    {
      title: 'Alterar Email',
      description: 'Altere o email associado à sua conta',
      icon: Mail,
      href: '/configuracoes/alterar-email',
      available: true,
    },
    {
      title: 'Sessões Ativas',
      description: 'Gerencie suas sessões de login ativas',
      icon: Monitor,
      href: '/configuracoes/sessoes',
      available: true,
    },
    {
      title: 'Alterar Senha',
      description: 'Atualize sua senha de acesso',
      icon: Lock,
      href: '/configuracoes/alterar-senha',
      available: false, // To be implemented
    },
    {
      title: 'Produtos de Crédito',
      description: 'Gerencie produtos de crédito disponíveis',
      icon: Settings,
      href: '/configuracoes/produtos',
      available: isAdmin,
    },
    {
      title: 'Tabelas Comerciais',
      description: 'Configure tabelas comerciais e taxas',
      icon: Settings,
      href: '/configuracoes/tabelas',
      available: isAdmin,
    },
  ];

  return (
    <DashboardLayout title="Configurações">
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-6xl p-4">
          {/* Header */}
          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-bold">Configurações</h1>
            <p className="text-muted-foreground">
              Gerencie suas preferências e configurações da conta
            </p>
          </div>

          {/* User Info Card */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informações da Conta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm text-muted-foreground">Nome</div>
                  <div className="font-medium">{user?.full_name || 'Não informado'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Email</div>
                  <div className="font-medium">{user?.email}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Perfil</div>
                  <div className="font-medium">{user?.role}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">ID do Usuário</div>
                  <div className="font-mono text-xs">{user?.id}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Settings Options Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {settingsOptions
              .filter((option) => option.available)
              .map((option) => (
                <Card
                  key={option.href}
                  className="cursor-pointer transition-shadow hover:shadow-lg"
                >
                  <Link href={option.href}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <option.icon className="h-5 w-5" />
                          {option.title}
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </CardTitle>
                      <CardDescription>{option.description}</CardDescription>
                    </CardHeader>
                  </Link>
                </Card>
              ))}
          </div>

          {/* Security Notice */}
          <Card className="mt-8 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <Shield className="h-5 w-5" />
                Segurança da Conta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Mantenha suas informações de acesso seguras. Nunca compartilhe sua senha e sempre
                faça logout ao usar computadores compartilhados.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
