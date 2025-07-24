import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';

interface User {
  id: string;
  email: string;
  role: string;
  full_name?: string;
  loja_id?: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: Error | null;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Step 2.2: Custom hook for easy access to auth data
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // Fetch current user profile
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['auth', 'currentUser'],
    queryFn: async () => {
      try {
        const response = await api.get<{ user: User }>('/api/auth/me');
        return response.data.user;
      } catch (error) {
        // Return null if user is not authenticated
        return null;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  useEffect(() => {
    if (data) {
      setUser(data);
    }
  }, [data]);

  const value: AuthContextType = {
    user,
    loading: isLoading,
    error: error as Error | null,
    refreshUser: () => refetch(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}