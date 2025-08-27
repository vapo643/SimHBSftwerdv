import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { signOut } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import OfflineIndicator from './OfflineIndicator';
import { ThemeSelector } from './ThemeSelector';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import {
  _LayoutDashboard,
  _PlusCircle,
  _List,
  _CreditCard,
  _User,
  _LogOut,
  _FileText,
  _Settings, // Adicionando o ícone para configurações
  _Users, // Adicionando o ícone para usuários
  _Building2, // Adicionando o ícone para parceiros
  _Package, // Adicionando o ícone para produtos
  _Store, // Adicionando o ícone para lojas
  _Shield, // Adicionando o ícone para segurança OWASP
  _Receipt, // Adicionando o ícone para cobranças
  _Menu, // Ícone do menu hamburger
} from 'lucide-react';
import {
  _DropdownMenu,
  _DropdownMenuContent,
  _DropdownMenuItem,
  _DropdownMenuLabel,
  _DropdownMenuSeparator,
  _DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  actions?: React.ReactNode;
}

export default function DashboardLayout({ children, title, actions }: DashboardLayoutProps) {
  const [location] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fechar menu com Escape e ao navegar
  useEffect(() => {
    const _handleEscape = (e: KeyboardEvent) => {
      if (e.key == 'Escape') {
        setSidebarOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Fechar menu ao navegar (mobile)
  const _handleNavClick = () => {
    setSidebarOpen(false);
  };

  // 🔒 PERMISSÕES RÍGIDAS - Navigation logic handled directly in JSX below

  // All navigation constants removed - logic implemented directly in JSX for better maintainability

  const _handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: 'Logout realizado com sucesso',
        description: 'Você foi desconectado do sistema.',
      });
      // A lógica de redirecionamento será tratada pelo listener de auth
    }
catch {
      toast({
        title: 'Erro ao fazer logout',
        description: 'Tente novamente em alguns instantes.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="grid min-h-screen w-full overflow-hidden lg:grid-cols-[280px_1fr]">
      {/* Pilar 12 - Progressive Enhancement: Offline Status Banner */}
      <OfflineIndicator variant="banner" />

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="bg-background/80 fixed inset-0 z-50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => e.key == 'Escape' && setSidebarOpen(false)}
          role="button"
          tabIndex={0}
          aria-label="Close sidebar"
        />
      )}

      {/* Sidebar */}
      <div
        className={`lg:w-280 fixed inset-y-0 left-0 z-50 w-72 transform border-r bg-card text-card-foreground transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:block`}
      >
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-16 items-center justify-between border-b px-6">
            <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
              <img
                src="https://dvglgxrvhmtsixaabxha._supabase.co/storage/v1/object/public/logosimpixblack//simpix-logo-png.png.png"
                alt="Simpix Logo"
                className="h-32 w-auto"
              />
            </Link>
            <ThemeSelector />
          </div>
          <div className="flex-1 overflow-auto py-2">
            <nav className="space-y-6 px-4">
              {/* Workflow Principal */}
              <div className="space-y-2">
                <div className="px-3 pb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Workflow Principal
                  </h3>
                </div>
                {[
                  {
                    name: '📊 Dashboard',
                    href: '/dashboard',
                    icon: LayoutDashboard,
                    gradient: 'from-blue-500 to-purple-600',
                  },
                  {
                    name: '➕ Nova Proposta',
                    href: '/propostas/nova',
                    icon: PlusCircle,
                    gradient: 'from-green-500 to-emerald-600',
                  },
                  {
                    name: '📋 Fila de Análise',
                    href: '/credito/fila',
                    icon: List,
                    gradient: 'from-orange-500 to-red-600',
                  },
                  {
                    name: '📄 Formalização',
                    href: '/formalizacao',
                    icon: FileText,
                    gradient: 'from-indigo-500 to-blue-600',
                  },
                ]
                  .filter((item) => {
                    // 🔒 FILTRO RÍGIDO POR ROLE
                    switch (user?.role) {
                      case 'ATENDENTE': {
                        // ATENDENTE: Dashboard, Nova Proposta e Formalização
                        return ['📊 Dashboard', '➕ Nova Proposta', '📄 Formalização'].includes(
                          item.name
                        );

                      case 'ANALISTA': {
                        // ANALISTA: APENAS Fila de Análise
                        return ['📋 Fila de Análise'].includes(item.name);

                      case 'FINANCEIRO': {
                        // FINANCEIRO: Sem acesso ao workflow principal
                        return false; }

                      case 'GERENTE': {
                      case 'ADMINISTRADOR': {
                      case 'DIRETOR': {
                        // Gestores: Acesso completo
                        return true; }

                      default:
                        return false; }
                    }
                  })
                  .map((item) => {
                    const _Icon = item.icon;
                    const _isActive = location == item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={handleNavClick}
                        className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200 ${
                          isActive
                            ? `bg-gradient-to-r ${item.gradient} scale-105 transform text-white shadow-lg`
                            : 'hover:bg-accent/50 hover:scale-102 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <div
                          className={`rounded-lg p-2 ${isActive ? 'bg-white/20' : 'bg-accent/30 group-hover:bg-accent'} transition-colors`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className={`font-medium ${isActive ? 'text-white' : ''}`}>
                          {item.name}
                        </span>
                      </Link>
                    );
                  })}
              </div>

              {/* Área Financeira */}
              {(user?.role == 'FINANCEIRO' ||
                user?.role == 'ADMINISTRADOR' ||
                user?.role == 'DIRETOR') && (
                <div className="space-y-2">
                  <div className="px-3 pb-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Área Financeira
                    </h3>
                  </div>
                  <Link
                    href="/financeiro/pagamentos"
                    onClick={handleNavClick}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200 ${
                      location == '/financeiro/pagamentos'
                        ? 'scale-105 transform bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg'
                        : 'hover:bg-accent/50 hover:scale-102 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div
                      className={`rounded-lg p-2 ${location == '/financeiro/pagamentos' ? 'bg-white/20' : 'bg-accent/30 group-hover:bg-accent'} transition-colors`}
                    >
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <span
                      className={`font-medium ${location == '/financeiro/pagamentos' ? 'text-white' : ''}`}
                    >
                      💳 Pagamentos
                    </span>
                  </Link>
                  <Link
                    href="/financeiro/cobrancas"
                    onClick={handleNavClick}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200 ${
                      location == '/financeiro/cobrancas'
                        ? 'scale-105 transform bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg'
                        : 'hover:bg-accent/50 hover:scale-102 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div
                      className={`rounded-lg p-2 ${location == '/financeiro/cobrancas' ? 'bg-white/20' : 'bg-accent/30 group-hover:bg-accent'} transition-colors`}
                    >
                      <Receipt className="h-4 w-4" />
                    </div>
                    <span
                      className={`font-medium ${location == '/financeiro/cobrancas' ? 'text-white' : ''}`}
                    >
                      📑 Cobranças
                    </span>
                  </Link>
                </div>
              )}

              {/* Gestão Administrativa */}
              {(user?.role == 'ADMINISTRADOR' || user?.role == 'DIRETOR') && (
                <>
                  <div className="space-y-2">
                    <div className="px-3 pb-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Gestão de Acesso
                      </h3>
                    </div>
                    <Link
                      href="/admin/usuarios"
                      onClick={handleNavClick}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200 ${
                        location == '/admin/usuarios'
                          ? 'scale-105 transform bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg'
                          : 'hover:bg-accent/50 hover:scale-102 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div
                        className={`rounded-lg p-2 ${location == '/admin/usuarios' ? 'bg-white/20' : 'bg-accent/30 group-hover:bg-accent'} transition-colors`}
                      >
                        <Users className="h-4 w-4" />
                      </div>
                      <span
                        className={`font-medium ${location == '/admin/usuarios' ? 'text-white' : ''}`}
                      >
                        👤 Usuários & Perfis
                      </span>
                    </Link>
                  </div>

                  <div className="space-y-2">
                    <div className="px-3 pb-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Configurações
                      </h3>
                    </div>
                    {[
                      {
                        name: '🔧 Tabelas Comerciais',
                        href: '/configuracoes/tabelas',
                        icon: Settings,
                        gradient: 'from-slate-500 to-gray-600',
                      },
                      {
                        name: '📦 Produtos de Crédito',
                        href: '/configuracoes/produtos',
                        icon: Package,
                        gradient: 'from-cyan-500 to-blue-600',
                      },
                    ].map((item) => {
                      const _Icon = item.icon;
                      const _isActive = location == item.href;
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200 ${
                            isActive
                              ? `bg-gradient-to-r ${item.gradient} scale-105 transform text-white shadow-lg`
                              : 'hover:bg-accent/50 hover:scale-102 text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <div
                            className={`rounded-lg p-2 ${isActive ? 'bg-white/20' : 'bg-accent/30 group-hover:bg-accent'} transition-colors`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className={`font-medium ${isActive ? 'text-white' : ''}`}>
                            {item.name}
                          </span>
                        </Link>
                      );
                    })}
                  </div>

                  <div className="space-y-2">
                    <div className="px-3 pb-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Gestão Comercial
                      </h3>
                    </div>
                    {[
                      {
                        name: '🏢 Parceiros',
                        href: '/parceiros',
                        icon: Building2,
                        gradient: 'from-amber-500 to-orange-600',
                      },
                      {
                        name: '🏪 Lojas & Filiais',
                        href: '/admin/lojas',
                        icon: Store,
                        gradient: 'from-pink-500 to-rose-600',
                      },
                      {
                        name: '📑 Gestão de Contratos',
                        href: '/gestao/contratos',
                        icon: FileText,
                        gradient: 'from-teal-500 to-cyan-600',
                      },
                    ].map((item) => {
                      const _Icon = item.icon;
                      const _isActive = location == item.href;
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200 ${
                            isActive
                              ? `bg-gradient-to-r ${item.gradient} scale-105 transform text-white shadow-lg`
                              : 'hover:bg-accent/50 hover:scale-102 text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <div
                            className={`rounded-lg p-2 ${isActive ? 'bg-white/20' : 'bg-accent/30 group-hover:bg-accent'} transition-colors`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className={`font-medium ${isActive ? 'text-white' : ''}`}>
                            {item.name}
                          </span>
                        </Link>
                      );
                    })}
                  </div>

                  <div className="space-y-2">
                    <div className="px-3 pb-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Segurança & Compliance
                      </h3>
                    </div>
                    {[
                      {
                        name: '🔐 Dashboard OWASP',
                        href: '/admin/security/owasp',
                        icon: Shield,
                        gradient: 'from-red-500 to-pink-600',
                      },
                      {
                        name: '🔒 Monitoramento Avançado',
                        href: '/admin/security/dashboard',
                        icon: Shield,
                        gradient: 'from-purple-500 to-indigo-600',
                      },
                    ].map((item) => {
                      const _Icon = item.icon;
                      const _isActive = location == item.href;
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200 ${
                            isActive
                              ? `bg-gradient-to-r ${item.gradient} scale-105 transform text-white shadow-lg`
                              : 'hover:bg-accent/50 hover:scale-102 text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <div
                            className={`rounded-lg p-2 ${isActive ? 'bg-white/20' : 'bg-accent/30 group-hover:bg-accent'} transition-colors`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className={`font-medium ${isActive ? 'text-white' : ''}`}>
                            {item.name}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}
            </nav>
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <header className="bg-muted/40 flex h-14 items-center gap-4 border-b px-6 lg:h-[60px]">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{title}</h1>
          </div>
          {/* Actions area - for refresh buttons and other page-specific actions */}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
          {/* Pilar 12 - Progressive Enhancement: Offline indicator in header */}
          <OfflineIndicator variant="icon-only" />
          <ThemeSelector />
          {/* PAM V1.0 - Sistema de Alertas Proativos */}
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.email}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/configuracoes" className="flex items-center">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Configurações</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/configuracoes/sessoes" className="flex items-center">
                  <Shield className="mr-2 h-4 w-4" />
                  <span>Sessões Ativas</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">{children}</main>
      </div>
    </div>
  );
}
