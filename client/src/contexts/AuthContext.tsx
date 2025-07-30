import React, { createContext, useState, useEffect } from 'react';
import { getSupabase } from '../lib/supabase';
import { fetchWithToken } from '../lib/fetchWithToken';

export type Role = 'ADMINISTRADOR' | 'GERENTE' | 'ATENDENTE' | 'ANALISTA' | 'FINANCEIRO';

export interface UserProfile {
  id: string;
  full_name: string | null;
  email: string;
  role: Role;
  loja_id: string | null;
  loja?: {
    id: string;
    nome_loja: string;
    parceiro_id: string;
    parceiro?: {
      id: string;
      razao_social: string;
    };
  };
}

export interface AuthState {
  user: any | null; // Supabase User object
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  // Helper methods for role checking
  hasRole: (role: Role) => boolean;
  isAdmin: () => boolean;
  isAtendente: () => boolean;
  isAnalista: () => boolean;
  isGerente: () => boolean;
  isFinanceiro: () => boolean;
  
  // Permission checking
  canAccessAdmin: () => boolean;
  canAccessPayments: () => boolean;
  canAccessAnalysis: () => boolean;
  canAccessFormalization: () => boolean;
  
  // Actions
  refetchProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchUserProfile(): Promise<UserProfile | null> {
  try {
    const response = await fetchWithToken('/api/debug/me');
    if (!response.ok) {
      console.error('Failed to fetch user profile:', response.status);
      return null;
    }
    
    const data = await response.json();
    return data.profile || null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    isAuthenticated: false,
    isLoading: true
  });

  const refetchProfile = async () => {
    const profile = await fetchUserProfile();
    setAuthState(prev => ({ ...prev, profile }));
  };

  useEffect(() => {
    const supabase = getSupabase();
    
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setAuthState(prev => ({ ...prev, user: session.user, isAuthenticated: true }));
        fetchUserProfile().then(profile => {
          setAuthState(prev => ({ ...prev, profile, isLoading: false }));
        });
      } else {
        setAuthState({ user: null, profile: null, isAuthenticated: false, isLoading: false });
      }
    });

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        
        if (session) {
          setAuthState(prev => ({ ...prev, user: session.user, isAuthenticated: true, isLoading: true }));
          
          // Fetch profile data
          const profile = await fetchUserProfile();
          
          setAuthState({
            user: session.user,
            profile,
            isAuthenticated: true,
            isLoading: false
          });
        } else {
          setAuthState({
            user: null,
            profile: null,
            isAuthenticated: false,
            isLoading: false
          });
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Role checking helpers
  const hasRole = (role: Role): boolean => authState.profile?.role === role;
  const isAdmin = (): boolean => authState.profile?.role === 'ADMINISTRADOR';
  const isAtendente = (): boolean => authState.profile?.role === 'ATENDENTE';
  const isAnalista = (): boolean => authState.profile?.role === 'ANALISTA';
  const isGerente = (): boolean => authState.profile?.role === 'GERENTE';
  const isFinanceiro = (): boolean => authState.profile?.role === 'FINANCEIRO';

  // Permission checking helpers
  const canAccessAdmin = (): boolean => isAdmin();
  const canAccessPayments = (): boolean => isFinanceiro() || isAdmin();
  const canAccessAnalysis = (): boolean => isAnalista() || isGerente() || isAdmin();
  const canAccessFormalization = (): boolean => isAtendente() || isGerente() || isFinanceiro() || isAdmin();

  const contextValue: AuthContextType = {
    ...authState,
    hasRole,
    isAdmin,
    isAtendente,
    isAnalista,
    isGerente,
    isFinanceiro,
    canAccessAdmin,
    canAccessPayments,
    canAccessAnalysis,
    canAccessFormalization,
    refetchProfile
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;

// Also export the hook for convenience
export { useAuth } from '../hooks/useAuth';