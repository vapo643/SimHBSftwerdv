import React from 'react';
import { Link, useLocation } from 'wouter';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  name: string;
  path: string;
}

interface BreadcrumbsProps {
  className?: string;
}

// UX-008: Mapeamento de rotas para nomes amigáveis
const routeMapping: Record<string, string> = {
  // Workflow Principal
  'dashboard': 'Dashboard',
  'propostas': 'Propostas',
  'nova': 'Nova Proposta',
  'editar': 'Editar Proposta',
  'detalhes': 'Detalhes da Proposta',
  'credito': 'Crédito',
  'fila': 'Fila de Análise',
  'formalizacao': 'Formalização',
  
  // Área Financeira
  'financeiro': 'Financeiro',
  'pagamentos': 'Pagamentos',
  'cobrancas': 'Cobranças',
  
  // Gestão Administrativa
  'admin': 'Administração',
  'usuarios': 'Usuários & Perfis',
  'configuracoes': 'Configurações',
  'tabelas': 'Tabelas Comerciais',
  'produtos': 'Produtos de Crédito',
  
  // Gestão Comercial
  'parceiros': 'Parceiros',
  'lojas': 'Lojas & Filiais',
  'gestao': 'Gestão',
  'contratos': 'Contratos',
  
  // Segurança
  'security': 'Segurança',
  'owasp': 'Dashboard OWASP',
  
  // Outros
  'aceite-atendente': 'Aceite de Propostas',
};

// UX-008: Função para gerar breadcrumbs baseado no pathname
const generateBreadcrumbs = (pathname: string): BreadcrumbItem[] => {
  // Sempre começar com "Início"
  const breadcrumbs: BreadcrumbItem[] = [
    { name: 'Início', path: '/dashboard' }
  ];
  
  // Remover a primeira barra e dividir por segmentos
  const segments = pathname.replace(/^\//, '').split('/').filter(Boolean);
  
  // Se não há segmentos ou é só dashboard, retornar apenas "Início"
  if (segments.length === 0 || (segments.length === 1 && segments[0] === 'dashboard')) {
    return breadcrumbs;
  }
  
  // Construir breadcrumbs dinamicamente
  let currentPath = '';
  
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    
    // Usar mapeamento ou fallback para o nome
    const friendlyName = routeMapping[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    
    // Para o último segmento, não incluir link
    breadcrumbs.push({
      name: friendlyName,
      path: currentPath
    });
  });
  
  return breadcrumbs;
};

export function Breadcrumbs({ className = '' }: BreadcrumbsProps) {
  const [location] = useLocation();
  const breadcrumbs = generateBreadcrumbs(location);
  
  // Não mostrar breadcrumbs se houver apenas um item (Início)
  if (breadcrumbs.length <= 1) {
    return null;
  }
  
  return (
    <nav 
      className={`flex items-center space-x-1 text-sm text-muted-foreground ${className}`}
      aria-label="Breadcrumb"
      data-testid="breadcrumbs-navigation"
    >
      {breadcrumbs.map((item, index) => {
        const isLast = index === breadcrumbs.length - 1;
        const isFirst = index === 0;
        
        return (
          <div key={item.path} className="flex items-center">
            {/* Separador */}
            {!isFirst && (
              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            )}
            
            {/* Item do breadcrumb */}
            {isLast ? (
              // Último item - não é link
              <span 
                className="font-medium text-foreground"
                data-testid={`breadcrumb-current-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {isFirst && <Home className="inline h-4 w-4 mr-1" />}
                {item.name}
              </span>
            ) : (
              // Item intermediário - é link
              <Link 
                to={item.path}
                className="hover:text-foreground transition-colors flex items-center"
                data-testid={`breadcrumb-link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {isFirst && <Home className="inline h-4 w-4 mr-1" />}
                {item.name}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export default Breadcrumbs;