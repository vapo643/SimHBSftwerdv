import { useState } from "react";
import { Link, useLocation } from "wouter";
import { signOut } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import OfflineIndicator from "./OfflineIndicator";
import { ThemeSelector } from "./ThemeSelector";
import {
  LayoutDashboard,
  PlusCircle,
  List,
  CreditCard,
  Bell,
  User,
  LogOut,
  FileText,
  Settings, // Adicionando o ícone para configurações
  Users, // Adicionando o ícone para usuários
  Building2, // Adicionando o ícone para parceiros
  Package, // Adicionando o ícone para produtos
  Store, // Adicionando o ícone para lojas
  Shield, // Adicionando o ícone para segurança OWASP
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  actions?: React.ReactNode;
}

export default function DashboardLayout({ children, title, actions }: DashboardLayoutProps) {
  const [location] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Debug: Log user info
  console.log('[DEBUG] User role:', user?.role);
  console.log('[DEBUG] User data:', user);
  console.log('[DEBUG] Should show admin menu:', user && true);
  console.log('[DEBUG] Location:', location);

  // Base navigation items - varies by role
  const attendantNavigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Nova Proposta", href: "/propostas/nova", icon: PlusCircle },
    { name: "Minhas Propostas", href: "/credito/fila", icon: List },
    { name: "Formalização", href: "/formalizacao", icon: FileText },
  ];

  const analystNavigation = [
    { name: "Fila de Análise", href: "/credito/fila", icon: List },
    // Nota: ANALISTA não tem acesso à Formalização conforme regras de negócio
  ];

  const managerNavigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Nova Proposta", href: "/propostas/nova", icon: PlusCircle },
    { name: "Fila de Análise", href: "/credito/fila", icon: List },
    { name: "Formalização", href: "/formalizacao", icon: FileText },
  ];

  // Financial navigation items - only visible to FINANCEIRO role
  const financeNavigation = [
    { name: "Pagamentos", href: "/financeiro/pagamentos", icon: CreditCard },
  ];

  // Administrative navigation items - organized by categories
  const adminNavigation = [
    // Gestão de Usuários e Acesso
    { name: "👥 Usuários", href: "/admin/usuarios", icon: Users, category: "Gestão de Acesso" },
    
    // Configurações do Sistema  
    { name: "⚙️ Tabelas Comerciais", href: "/configuracoes/tabelas", icon: Settings, category: "Configurações" },
    { name: "📦 Produtos", href: "/configuracoes/produtos", icon: Package, category: "Configurações" },
    
    // Gestão Comercial
    { name: "🏢 Parceiros", href: "/parceiros", icon: Building2, category: "Gestão Comercial" },
    { name: "🏪 Lojas", href: "/admin/lojas", icon: Store, category: "Gestão Comercial" },
    
    // Segurança e Compliance
    { name: "🛡️ OWASP Dashboard", href: "/admin/security/owasp", icon: Shield, category: "Segurança" },
    { name: "🔒 Monitoramento Avançado", href: "/admin/security/dashboard", icon: Shield, category: "Segurança" },
  ];

  // Build navigation based on user role
  let navigation = [];
  
  switch (user?.role) {
    case 'ATENDENTE':
      navigation = attendantNavigation;
      break;
    case 'ANALISTA':
      navigation = analystNavigation;
      break;
    case 'GERENTE':
      navigation = managerNavigation;
      break;
    case 'FINANCEIRO':
      navigation = [...managerNavigation, ...financeNavigation];
      break;
    case 'ADMINISTRADOR':
      navigation = [...managerNavigation, ...financeNavigation, ...adminNavigation];
      break;
    default:
      navigation = attendantNavigation;
  }

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Logout realizado com sucesso",
        description: "Você foi desconectado do sistema.",
      });
      // A lógica de redirecionamento será tratada pelo listener de auth
    } catch (error) {
      toast({
        title: "Erro ao fazer logout",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-[280px_1fr]">
      {/* Pilar 12 - Progressive Enhancement: Offline Status Banner */}
      <OfflineIndicator variant="banner" />
      <div className="hidden border-r bg-card text-card-foreground lg:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-16 items-center justify-between border-b px-6">
            <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
              <img 
                src="https://dvglgxrvhmtsixaabxha.supabase.co/storage/v1/object/public/logosimpixblack//simpix-logo-png.png.png" 
                alt="Simpix Logo" 
                className="h-32 w-auto"
              />
            </Link>
            <ThemeSelector />
          </div>
          <div className="flex-1 overflow-auto py-2">
            <nav className="px-4 space-y-6">
              
              {/* Workflow Principal */}
              <div className="space-y-2">
                <div className="px-3 pb-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Workflow Principal
                  </h3>
                </div>
                {[
                  { name: "📊 Dashboard", href: "/dashboard", icon: LayoutDashboard, gradient: "from-blue-500 to-purple-600" },
                  { name: "➕ Nova Proposta", href: "/propostas/nova", icon: PlusCircle, gradient: "from-green-500 to-emerald-600" },
                  { name: "📋 Fila de Análise", href: "/credito/fila", icon: List, gradient: "from-orange-500 to-red-600" },
                  { name: "📄 Formalização", href: "/formalizacao", icon: FileText, gradient: "from-indigo-500 to-blue-600" },
                ].filter(item => 
                  (user?.role === 'ATENDENTE' && ['📊 Dashboard', '➕ Nova Proposta', '📋 Fila de Análise', '📄 Formalização'].includes(item.name)) ||
                  (user?.role === 'ANALISTA' && ['📋 Fila de Análise'].includes(item.name)) ||
                  (user?.role === 'GERENTE' && ['📊 Dashboard', '➕ Nova Proposta', '📋 Fila de Análise', '📄 Formalização'].includes(item.name)) ||
                  (user?.role === 'FINANCEIRO' && ['📊 Dashboard', '➕ Nova Proposta', '📋 Fila de Análise', '📄 Formalização'].includes(item.name)) ||
                  (user?.role === 'ADMINISTRADOR' && ['📊 Dashboard', '➕ Nova Proposta', '📋 Fila de Análise', '📄 Formalização'].includes(item.name))
                ).map(item => {
                  const Icon = item.icon;
                  const isActive = location === item.href;
                  return (
                    <Link 
                      key={item.name} 
                      href={item.href}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200 ${
                        isActive
                          ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg transform scale-105`
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50 hover:scale-102"
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${isActive ? 'bg-white/20' : 'bg-accent/30 group-hover:bg-accent'} transition-colors`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className={`font-medium ${isActive ? 'text-white' : ''}`}>{item.name}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Área Financeira */}
              {(user?.role === 'FINANCEIRO' || user?.role === 'ADMINISTRADOR' || user?.role === 'ADMIN') && (
                <div className="space-y-2">
                  <div className="px-3 pb-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Área Financeira
                    </h3>
                  </div>
                  <Link 
                    href="/financeiro/pagamentos"
                    className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200 ${
                      location === "/financeiro/pagamentos"
                        ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg transform scale-105"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50 hover:scale-102"
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${location === "/financeiro/pagamentos" ? 'bg-white/20' : 'bg-accent/30 group-hover:bg-accent'} transition-colors`}>
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <span className={`font-medium ${location === "/financeiro/pagamentos" ? 'text-white' : ''}`}>💳 Pagamentos</span>
                  </Link>
                </div>
              )}

              {/* DEBUG: Forçar exibição do menu */}
              <div className="space-y-2">
                <div className="px-3 pb-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    DEBUG - Teste Menu
                  </h3>
                </div>
                <div className="text-xs text-red-500 px-3">
                  User: {user?.email} | Role: {user?.role} | ID: {user?.id}
                </div>
              </div>

              {/* Gestão Administrativa - DEBUG: Mostrando para todos temporariamente */}
              {user && (
                <>
                  <div className="space-y-2">
                    <div className="px-3 pb-2">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Gestão de Acesso
                      </h3>
                    </div>
                    <Link 
                      href="/admin/usuarios"
                      className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200 ${
                        location === "/admin/usuarios"
                          ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg transform scale-105"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50 hover:scale-102"
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${location === "/admin/usuarios" ? 'bg-white/20' : 'bg-accent/30 group-hover:bg-accent'} transition-colors`}>
                        <Users className="h-4 w-4" />
                      </div>
                      <span className={`font-medium ${location === "/admin/usuarios" ? 'text-white' : ''}`}>👤 Usuários & Perfis</span>
                    </Link>
                  </div>

                  <div className="space-y-2">
                    <div className="px-3 pb-2">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Configurações
                      </h3>
                    </div>
                    {[
                      { name: "🔧 Tabelas Comerciais", href: "/configuracoes/tabelas", icon: Settings, gradient: "from-slate-500 to-gray-600" },
                      { name: "📦 Produtos de Crédito", href: "/configuracoes/produtos", icon: Package, gradient: "from-cyan-500 to-blue-600" },
                    ].map(item => {
                      const Icon = item.icon;
                      const isActive = location === item.href;
                      return (
                        <Link 
                          key={item.name} 
                          href={item.href}
                          className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200 ${
                            isActive
                              ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg transform scale-105`
                              : "text-muted-foreground hover:text-foreground hover:bg-accent/50 hover:scale-102"
                          }`}
                        >
                          <div className={`p-2 rounded-lg ${isActive ? 'bg-white/20' : 'bg-accent/30 group-hover:bg-accent'} transition-colors`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className={`font-medium ${isActive ? 'text-white' : ''}`}>{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>

                  <div className="space-y-2">
                    <div className="px-3 pb-2">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Gestão Comercial
                      </h3>
                    </div>
                    {[
                      { name: "🏢 Parceiros", href: "/parceiros", icon: Building2, gradient: "from-amber-500 to-orange-600" },
                      { name: "🏪 Lojas & Filiais", href: "/admin/lojas", icon: Store, gradient: "from-pink-500 to-rose-600" },
                    ].map(item => {
                      const Icon = item.icon;
                      const isActive = location === item.href;
                      return (
                        <Link 
                          key={item.name} 
                          href={item.href}
                          className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200 ${
                            isActive
                              ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg transform scale-105`
                              : "text-muted-foreground hover:text-foreground hover:bg-accent/50 hover:scale-102"
                          }`}
                        >
                          <div className={`p-2 rounded-lg ${isActive ? 'bg-white/20' : 'bg-accent/30 group-hover:bg-accent'} transition-colors`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className={`font-medium ${isActive ? 'text-white' : ''}`}>{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>

                  <div className="space-y-2">
                    <div className="px-3 pb-2">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Segurança & Compliance
                      </h3>
                    </div>
                    {[
                      { name: "🔐 Dashboard OWASP", href: "/admin/security/owasp", icon: Shield, gradient: "from-red-500 to-pink-600" },
                      { name: "🔒 Monitoramento Avançado", href: "/admin/security/dashboard", icon: Shield, gradient: "from-purple-500 to-indigo-600" },
                    ].map(item => {
                      const Icon = item.icon;
                      const isActive = location === item.href;
                      return (
                        <Link 
                          key={item.name} 
                          href={item.href}
                          className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200 ${
                            isActive
                              ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg transform scale-105`
                              : "text-muted-foreground hover:text-foreground hover:bg-accent/50 hover:scale-102"
                          }`}
                        >
                          <div className={`p-2 rounded-lg ${isActive ? 'bg-white/20' : 'bg-accent/30 group-hover:bg-accent'} transition-colors`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className={`font-medium ${isActive ? 'text-white' : ''}`}>{item.name}</span>
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
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{title}</h1>
          </div>
          {/* Actions area - for refresh buttons and other page-specific actions */}
          {actions && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}
          {/* Pilar 12 - Progressive Enhancement: Offline indicator in header */}
          <OfflineIndicator variant="icon-only" />
          <ThemeSelector />
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
