/**
 * Pilar 12 - Aprimoramento Progressivo
 * Indicador de Status de Conexão
 */

import { useState, useEffect } from "react";
import { AlertTriangle, Wifi, WifiOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface OfflineIndicatorProps {
  className?: string;
  variant?: "banner" | "compact" | "icon-only";
}

export default function OfflineIndicator({ 
  className = "", 
  variant = "banner" 
}: OfflineIndicatorProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Mostrar mensagem de reconexão por 3 segundos se estava offline
      if (wasOffline) {
        setTimeout(() => setWasOffline(false), 3000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    // Adiciona listeners para mudanças no status da conexão
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  // Não renderiza nada se estiver online e nunca esteve offline
  if (isOnline && !wasOffline) {
    return null;
  }

  // Variant: icon-only - apenas ícone pequeno
  if (variant === "icon-only") {
    return (
      <div className={`flex items-center ${className}`} title={isOnline ? "Online" : "Offline"}>
        {isOnline ? (
          <Wifi className="h-4 w-4 text-green-500" />
        ) : (
          <WifiOff className="h-4 w-4 text-red-500" />
        )}
      </div>
    );
  }

  // Variant: compact - indicador pequeno no canto
  if (variant === "compact") {
    return (
      <div 
        className={`fixed bottom-4 right-4 z-50 px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm transition-all duration-300 ${
          isOnline 
            ? "bg-green-100 text-green-800 border border-green-200" 
            : "bg-red-100 text-red-800 border border-red-200"
        } ${className}`}
      >
        {isOnline ? (
          <>
            <Wifi className="h-4 w-4" />
            <span>Reconectado</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4" />
            <span>Offline</span>
          </>
        )}
      </div>
    );
  }

  // Variant: banner - banner completo no topo
  if (!isOnline) {
    return (
      <div className={`bg-red-50 border-b border-red-200 ${className}`}>
        <Alert className="border-0 bg-transparent">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Você está offline.</strong> Algumas funcionalidades podem não estar disponíveis. 
            Dados inseridos em formulários serão preservados até que a conexão seja restaurada.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Mostrar mensagem de reconexão temporariamente
  if (isOnline && wasOffline) {
    return (
      <div className={`bg-green-50 border-b border-green-200 ${className}`}>
        <Alert className="border-0 bg-transparent">
          <Wifi className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>Conexão restaurada!</strong> Você está novamente online.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return null;
}

/**
 * Hook personalizado para detectar status de conexão
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}