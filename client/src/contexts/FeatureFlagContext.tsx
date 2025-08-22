import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

// Interface para as feature flags
interface FeatureFlags {
  'maintenance-mode': boolean;
  'read-only-mode': boolean;
  'novo-dashboard': boolean;
  'pagamento-pix-instant': boolean;
  'relatorios-avancados': boolean;
  'ab-test-onboarding': boolean;
  'nova-api-experimental': boolean;
  [key: string]: boolean; // Permite flags adicionais
}

// Interface para o contexto
interface FeatureFlagContextType {
  flags: FeatureFlags;
  isLoading: boolean;
  error: Error | null;
  checkFlag: (flagName: string) => boolean;
  refreshFlags: () => void;
}

// Valores padrão (todas as flags desabilitadas)
const defaultFlags: FeatureFlags = {
  'maintenance-mode': false,
  'read-only-mode': false,
  'novo-dashboard': false,
  'pagamento-pix-instant': false,
  'relatorios-avancados': false,
  'ab-test-onboarding': false,
  'nova-api-experimental': false,
};

// Criar o contexto
const FeatureFlagContext = createContext<FeatureFlagContextType | undefined>(undefined);

// Provider component
export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(defaultFlags);

  // Buscar flags do backend
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/features'],
    refetchInterval: 60000, // Atualiza a cada minuto
    staleTime: 30000, // Considera fresh por 30 segundos
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Atualizar state local quando dados chegarem
  useEffect(() => {
    if (data && typeof data === 'object' && 'flags' in data) {
      setFlags(prevFlags => ({
        ...prevFlags,
        ...(data as any).flags,
      }));
    } else if (data && typeof data === 'object') {
      // Se data é diretamente o objeto de flags
      setFlags(prevFlags => ({
        ...prevFlags,
        ...(data as FeatureFlags),
      }));
    }
  }, [data]);

  // Função helper para verificar uma flag específica
  const checkFlag = (flagName: string): boolean => {
    return flags[flagName] ?? false;
  };

  // Função para forçar refresh das flags
  const refreshFlags = () => {
    refetch();
  };

  // Log de desenvolvimento
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🚩 Feature Flags carregadas:', flags);
    }
  }, [flags]);

  // Verificar modo de manutenção
  useEffect(() => {
    if (flags['maintenance-mode']) {
      console.warn('⚠️ MODO DE MANUTENÇÃO ATIVO');
      // Poderia redirecionar para página de manutenção aqui
    }
  }, [flags['maintenance-mode']]);

  // Verificar modo read-only
  useEffect(() => {
    if (flags['read-only-mode']) {
      console.warn('⚠️ MODO SOMENTE LEITURA ATIVO');
      // Poderia desabilitar formulários globalmente aqui
    }
  }, [flags['read-only-mode']]);

  const value: FeatureFlagContextType = {
    flags,
    isLoading,
    error: error as Error | null,
    checkFlag,
    refreshFlags,
  };

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

// Hook para usar o contexto
export function useFeatureFlags() {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlags deve ser usado dentro de FeatureFlagProvider');
  }
  return context;
}

// Hook conveniente para verificar uma flag específica
export function useFeatureFlag(flagName: string): boolean {
  const { flags } = useFeatureFlags();
  return flags[flagName] ?? false;
}

// Hook para verificar múltiplas flags
export function useFeatureFlagsMultiple(flagNames: string[]): Record<string, boolean> {
  const { flags } = useFeatureFlags();
  const result: Record<string, boolean> = {};
  
  flagNames.forEach(flagName => {
    result[flagName] = flags[flagName] ?? false;
  });
  
  return result;
}

// Componente helper para renderização condicional
interface FeatureGateProps {
  flag: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGate({ flag, children, fallback = null }: FeatureGateProps) {
  const isEnabled = useFeatureFlag(flag);
  return isEnabled ? <>{children}</> : <>{fallback}</>;
}

// Componente para modo de manutenção
export function MaintenanceMode({ children }: { children: ReactNode }) {
  const isMaintenanceMode = useFeatureFlag('maintenance-mode');
  
  if (isMaintenanceMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Sistema em Manutenção
          </h1>
          <p className="text-lg text-gray-600 mb-4">
            Estamos realizando melhorias no sistema.
          </p>
          <p className="text-md text-gray-500">
            Por favor, tente novamente em alguns minutos.
          </p>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}

// Componente para modo read-only
export function ReadOnlyBanner() {
  const isReadOnly = useFeatureFlag('read-only-mode');
  
  if (!isReadOnly) return null;
  
  return (
    <div className="bg-yellow-50 border-b border-yellow-200">
      <div className="max-w-7xl mx-auto py-3 px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center">
          <p className="font-medium text-yellow-800">
            ⚠️ Sistema em modo somente leitura - Alterações temporariamente desabilitadas
          </p>
        </div>
      </div>
    </div>
  );
}