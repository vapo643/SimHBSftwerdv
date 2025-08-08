import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock } from "lucide-react";

interface IdleWarningModalProps {
  isOpen: boolean;
  onContinueSession: () => void;
  onLogout: () => void;
  warningTimeoutSeconds?: number; // Tempo restante em segundos antes do logout
}

export function IdleWarningModal({
  isOpen,
  onContinueSession,
  onLogout,
  warningTimeoutSeconds = 120, // 2 minutos por padrão
}: IdleWarningModalProps) {
  const [timeLeft, setTimeLeft] = useState(warningTimeoutSeconds);

  useEffect(() => {
    if (isOpen) {
      setTimeLeft(warningTimeoutSeconds);

      const interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            // Tempo esgotado, fazer logout automático
            clearInterval(interval);
            onLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isOpen, warningTimeoutSeconds, onLogout]);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
              <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">Sessão Expirando</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Sua sessão será encerrada devido à inatividade
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center justify-center gap-2 rounded-lg bg-muted p-4">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <span className="font-mono text-lg font-semibold">{formatTime(timeLeft)}</span>
          </div>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Você será deslogado automaticamente em {formatTime(timeLeft)} devido à inatividade.
            Clique em "Continuar Sessão" para manter-se logado.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onLogout} className="flex-1">
            Sair Agora
          </Button>
          <Button onClick={onContinueSession} className="flex-1">
            Continuar Sessão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
