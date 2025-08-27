import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { User, onAuthStateChange } from '@/lib/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Nossa nova camada de abstração retorna AuthSubscription diretamente
    const _subscription = onAuthStateChange((user) => {
      setUser(user);
      setLoading(false);

      if (!user) {
        setLocation('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [setLocation]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
