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
  loading: boolean;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async () => {
    try {
      const supabase = getSupabase();
      const { data: currentUser } = await supabase.auth.getUser();
      if (currentUser.user) {
        try {
          // Fetch user data from debug endpoint for RBAC validation
          const response = await api.get<{
            id: string;
            email: string;
            role: string | null;
            full_name?: string | null;
            loja_id?: number | null;
          }>('/api/debug/me');
          
          setUser(response.data);
        } catch (error) {
          console.error('Error fetching profile data:', error);
          // Fallback to basic user data if profile fetch fails
          setUser({
            id: currentUser.user.id,
            email: currentUser.user.email || '',
            role: null,
          });
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const refetchUser = async () => {
    setLoading(true);
    await fetchUserProfile();
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const value = {
    user,
    loading,
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