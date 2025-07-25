import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getSupabase } from '@/lib/supabase';
import { api } from '@/lib/apiClient';

interface User {
  id: string;
  email: string;
  role: string | null;
  full_name?: string | null;
  loja_id?: number | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUserProfile = async () => {
    try {
      const supabase = getSupabase();
      const { data: currentUser } = await supabase.auth.getUser();
      
      if (currentUser.user) {
        try {
          // Fetch complete user profile from debug endpoint
          const response = await api.get<{
            message: string;
            user: User;
            timestamp: string;
          }>('/api/debug/me');
          
          if (response.data.user) {
            // Log de diagnóstico para rastrear o usuário e token no contexto
            const supabase = getSupabase();
            const session = await supabase.auth.getSession();
            console.log('[PASSO 2 - CONTEXTO]', { 
              user: response.data.user,
              token: session.data.session?.access_token,
              tokenLength: session.data.session?.access_token?.length
            });
            
            setUser(response.data.user);
            setError(null);
          } else {
            throw new Error('Invalid user data received');
          }
        } catch (apiError) {
          console.error('Error fetching profile data:', apiError);
          setError(apiError as Error);
          // No fallback - security requirement per architecture
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
    fetchUserProfile();
  }, []);

  const value = {
    user,
    isLoading,
    error,
    refetchUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}