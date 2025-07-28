import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getSupabase } from '@/lib/supabase';
import { api } from '@/lib/apiClient';
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