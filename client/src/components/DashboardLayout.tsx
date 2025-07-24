import { useState } from "react";
import { Link, useLocation } from "wouter";
import { signOut } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import OfflineIndicator from "./OfflineIndicator";
import { useAuth } from "@/contexts/AuthContext";
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
} from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
}

export default function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const [location] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  // Definir navegação com permissões
  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, requireAdmin: false },
    { name: "Nova Proposta", href: "/propostas/nova", icon: PlusCircle, requireAdmin: false },
    { name: "Fila de Análise", href: "/credito/fila", icon: List, requireAdmin: false },
    { name: "Formalização", href: "/formalizacao/fila", icon: FileText, requireAdmin: false },
    { name: "Pagamentos", href: "/financeiro/pagamentos", icon: CreditCard, requireAdmin: false },
    { name: "Tabelas Comerciais", href: "/configuracoes/tabelas", icon: Settings, requireAdmin: false },
    { name: "Usuários", href: "/admin/usuarios", icon: Users, requireAdmin: true }, // Admin only
    { name: "Parceiros", href: "/parceiros", icon: Building2, requireAdmin: true }, // Admin only
    { name: "Produtos", href: "/configuracoes/produtos", icon: Package, requireAdmin: false },
    { name: "Lojas", href: "/admin/lojas", icon: Store, requireAdmin: true }, // Admin only
  ];

  // Filtrar navegação baseado na role do usuário
  const filteredNavigation = navigation.filter(item => {
    if (item.requireAdmin && user?.role !== 'ADMINISTRADOR') {
      return false;
    }
    return true;
  });

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
          <div className="flex h-16 items-center border-b px-6">
            <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
              <img 
                src="https://dvglgxrvhmtsixaabxha.supabase.co/storage/v1/object/public/logosimpixblack//simpix-logo-png.png.png" 
                alt="Simpix Logo" 
                className="h-32 w-auto"
              />
            </Link>
          </div>
          <div className="flex-1 overflow-auto py-2">
            <nav className="grid items-start px-4 text-sm font-medium">
              {filteredNavigation.map(item => {
                const Icon = item.icon;
                const isActive = location === item.href;
                return (
                  <Link 
                    key={item.name} 
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-primary"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <header className="bg-muted/40 flex h-14 items-center gap-4 border-b px-6 lg:h-[60px]">
          {/* Lógica do cabeçalho, como busca ou menu de usuário, pode vir aqui */}
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{title}</h1>
          </div>
          {/* Pilar 12 - Progressive Enhancement: Offline indicator in header */}
          <OfflineIndicator variant="icon-only" />
          <Button onClick={handleSignOut} variant="outline" size="icon">
            <LogOut className="h-5 w-5" />
          </Button>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">{children}</main>
      </div>
    </div>
  );
}
