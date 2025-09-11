import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from 'react';
import { getSupabase } from '@/lib/supabase';
import { api } from '@/lib/apiClient';
import { useIdleTimer } from '@/hooks/useIdleTimer';
import { IdleWarningModal } from '@/components/IdleWarningModal';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

interface User {
  id: string;
  email: string;
  role: string | null;
  full_name?: string | null;
  loja_id?: number | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  accessToken: string | null;
  isLoading: boolean;
  error: Error | null;
  refetchUser: () => Promise<void>;
  resetIdleTimer: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // States para controle do idle timeout
  const [showIdleWarning, setShowIdleWarning] = useState(false);

  // Configurações de timeout (30 minutos total, aviso 2 minutos antes)
  const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutos em ms
  const WARNING_TIMEOUT = 2 * 60 * 1000; // 2 minutos em ms
  const WARNING_TIME = IDLE_TIMEOUT - WARNING_TIMEOUT; // 28 minutos

  // Função para logout por inatividade
  const handleIdleLogout = useCallback(async () => {
    console.log('🔐 [IDLE TIMEOUT] User being logged out due to inactivity');
    try {
      const supabase = getSupabase();
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setAccessToken(null);
      setShowIdleWarning(false);
      setError(null);
    } catch (error) {
      console.error('Error during idle logout:', error);
    }
  }, []);

  // Função para mostrar aviso de inatividade
  const handleIdleWarning = useCallback(() => {
    console.log('⚠️ [IDLE WARNING] Showing inactivity warning to user (2 minutes left)');
    setShowIdleWarning(true);
  }, []);

  // Função para continuar a sessão (resetar timer)
  const handleContinueSession = useCallback(() => {
    console.log('🔄 [IDLE RESET] User chose to continue session');
    setShowIdleWarning(false);
    // O resetTimer será chamado automaticamente pelo useIdleTimer quando esta função executar
  }, []);

  // Integração do idle timer - só ativo quando usuário está logado
  const { resetTimer } = useIdleTimer({
    timeout: WARNING_TIME, // 28 minutos para mostrar aviso
    onIdle: handleIdleWarning,
    throttle: 1000, // Reduz a frequência de eventos para performance
  });

  const fetchUserProfile = useCallback(async (currentSession: Session | null) => {
    // 🔒 CONTROLE DE CONCORRÊNCIA: Previne múltiplas chamadas simultâneas
    if (isLoading) {
      console.log('🔒 [AUTH LOCK] fetchUserProfile já está em execução, ignorando chamada duplicada');
      return;
    }

    // 🔧 STATE MACHINE: Transição para estado "loading"
    setIsLoading(true);
    console.log('🔄 [AUTH LOADING] Iniciando busca do perfil do usuário');

    try {
      if (currentSession?.user) {
        try {
          // Fetch complete user profile from debug endpoint
          const response = await api.get<{
            message: string;
            user: User;
            timestamp: string;
          }>('/api/debug/me');

          // Handle both ApiResponse<T> and direct T response types
          const userData = 'data' in response ? response.data : response;
          if (userData?.user) {
            console.log('🔐 [AUTH SUCCESS] User profile loaded with valid token');
            setUser(userData.user);
            setError(null);
          } else {
            throw new Error('Invalid user data received from API');
          }
        } catch (apiError) {
          console.error('🚨 [AUTH ERROR] Error fetching profile data:', apiError);
          // 🛡️ GESTÃO GRACIOSA: Define erro e para o fluxo (sem retry)
          setError(apiError as Error);
          setUser(null);
        }
      } else {
        // 🔄 [AUTH IDLE] Sem sessão ativa - estado limpo
        console.log('🔄 [AUTH IDLE] Nenhuma sessão ativa, limpando estado do usuário');
        setUser(null);
        setError(null);
      }
    } catch (authError) {
      console.error('🚨 [AUTH CRITICAL] Error in authentication flow:', authError);
      // 🛡️ GESTÃO GRACIOSA: Define erro crítico e para o fluxo
      setError(authError as Error);
      setUser(null);
    } finally {
      // 🔧 STATE MACHINE: Transição para estado "idle"
      setIsLoading(false);
      console.log('✅ [AUTH COMPLETE] Processo de autenticação finalizado');
    }
  }, [isLoading]); // ⚠️ Dependência crítica: isLoading

  // 🔄 REFETCH COORDENADO: Usa a mesma lógica de controle de estado
  const refetchUser = useCallback(async () => {
    console.log('🔄 [REFETCH] Manual refetch solicitado');
    
    // 🔒 CONTROLE DE CONCORRÊNCIA: Coordena com fetchUserProfile
    if (isLoading) {
      console.log('🔒 [REFETCH LOCK] fetchUserProfile em execução, aguardando...');
      return;
    }

    try {
      const supabase = getSupabase();
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      // 🎯 DELEGAÇÃO: Usa a lógica centralizada do fetchUserProfile
      console.log('🎯 [REFETCH DELEGATE] Delegando para fetchUserProfile com sessão atual');
      await fetchUserProfile(currentSession);
      
    } catch (err) {
      console.error('🚨 [REFETCH ERROR] Error getting current session:', err);
      setError(err as Error);
      // 🛡️ GESTÃO GRACIOSA: Mantém dados existentes em caso de erro na sessão
    }
  }, [isLoading, fetchUserProfile]);

  useEffect(() => {
    console.log('🚀 [AUTH INIT] Inicializando contexto de autenticação');
    const supabase = getSupabase();

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      console.log('🔍 [AUTH INITIAL] Sessão inicial obtida', {
        hasSession: !!initialSession,
        tokenLength: initialSession?.access_token?.length,
      });
      
      setSession(initialSession);
      setAccessToken(initialSession?.access_token || null);
      
      // 🎯 COORDENAÇÃO: fetchUserProfile já tem controle de concorrência interno
      console.log('🎯 [AUTH INITIAL] Chamando fetchUserProfile para sessão inicial');
      fetchUserProfile(initialSession);
    });

    // Set up reactive auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession: Session | null) => {
        console.log(`🔐 [AUTH EVENT] ${event}`, {
          hasSession: !!currentSession,
          tokenLength: currentSession?.access_token?.length,
          currentLoadingState: isLoading,
        });

        setSession(currentSession);
        setAccessToken(currentSession?.access_token || null);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // 🎯 COORDENAÇÃO: fetchUserProfile já tem controle de concorrência interno
          console.log(`🎯 [AUTH EVENT] Chamando fetchUserProfile para evento ${event}`);
          fetchUserProfile(currentSession);
        } else if (event === 'SIGNED_OUT') {
          // 🧹 LIMPEZA: Estado limpo para logout
          console.log('🧹 [AUTH SIGNED_OUT] Limpando estado do usuário');
          setUser(null);
          setError(null);
          setIsLoading(false);
        }
      }
    );

    return () => {
      console.log('🔄 [AUTH CLEANUP] Limpando subscription do contexto de autenticação');
      subscription?.unsubscribe();
    };
  }, [fetchUserProfile, isLoading]); // ⚠️ Dependências críticas para coordenação

  const value = {
    user,
    session,
    accessToken,
    isLoading,
    error,
    refetchUser,
    resetIdleTimer: resetTimer,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {/* Modal de aviso de inatividade - só aparece quando usuário está logado */}
      {user && (
        <IdleWarningModal
          isOpen={showIdleWarning}
          onContinueSession={handleContinueSession}
          onLogout={handleIdleLogout}
          warningTimeoutSeconds={WARNING_TIMEOUT / 1000} // Converter para segundos
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
