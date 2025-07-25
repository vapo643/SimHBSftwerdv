import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface User {
  id: string;
  email: string;
  role?: string;
  fullName?: string;
  lojaId?: number;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch user profile with role information
      const response = await apiRequest('/api/debug/me', {
        method: 'GET'
      });

      if (response && response.user) {
        setUser({
          id: response.user.id,
          email: response.user.email,
          role: response.user.role,
          fullName: response.user.fullName,
          lojaId: response.user.lojaId
        });
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Error fetching user:', err);
      setError('Failed to fetch user profile');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        isLoading, 
        error,
        refetchUser: fetchUser 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}