import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
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

  const fetchUserProfile = async (currentSession: Session | null) => {
    try {
      if (currentSession?.user) {
        try {
          // Fetch complete user profile from debug endpoint
          const response = await api.get<{
            message: string;
            user: User;
            timestamp: string;
          }>('/api/debug/me');
          
          if (response.data.user) {
            console.log('🔐 [AUTH RESTORED] User profile loaded with valid token');
            setUser(response.data.user);
            setError(null);
          } else {
            throw new Error('Invalid user data received');
          }
        } catch (apiError) {
          console.error('Error fetching profile data:', apiError);
          setError(apiError as Error);
          setUser(null);
        }
      } else {
        setUser(null);
        setError(null);
      }
    } catch (authError) {
      console.error('Error checking authentication:', authError);
      setError(authError as Error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Conservative refetch strategy: maintain old data while fetching new
  const refetchUser = async () => {
    // Don't set loading to true to maintain current user data
    try {
      const supabase = getSupabase();
      const { data: currentUser } = await supabase.auth.getUser();
      
      if (currentUser.user) {
        const response = await api.get<{
          message: string;
          user: User;
          timestamp: string;
        }>('/api/debug/me');
        
        if (response.data.user) {
          setUser(response.data.user);
          setError(null);
        }
      } else {
        setUser(null);
        setError(null);
      }
    } catch (err) {
      console.error('Error refetching user:', err);
      setError(err as Error);
      // Keep existing user data on error (conservative strategy)
    }
  };

  useEffect(() => {
    const supabase = getSupabase();
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setAccessToken(initialSession?.access_token || null);
      fetchUserProfile(initialSession);
    });

    // Set up reactive auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession: Session | null) => {
        console.log(`🔐 [AUTH EVENT] ${event}`, { 
          hasSession: !!currentSession, 
          tokenLength: currentSession?.access_token?.length 
        });
        
        setSession(currentSession);
        setAccessToken(currentSession?.access_token || null);
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          fetchUserProfile(currentSession);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setError(null);
          setIsLoading(false);
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

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