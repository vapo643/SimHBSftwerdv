import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Monitor, Smartphone, Tablet, Trash2, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Session {
  id: string;
  ipAddress: string;
  userAgent: string;
  device: string;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  isActive: boolean;
  isCurrent: boolean;
}

export default function SessoesAtivas() {
  const { toast } = useToast();
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);

  // Buscar sessões ativas
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["/api/auth/sessions"],
    queryFn: async () => {
      const response = await fetch("/api/auth/sessions", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("supabase.auth.token")}`,
        },
      });
      if (!response.ok) throw new Error("Erro ao buscar sessões");
      const data = await response.json();
      return data.sessions as Session[];
    },
  });

  // Mutation para deletar sessão
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/auth/sessions/${sessionId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("supabase.auth.token")}`,
        },
      });
      if (!response.ok) throw new Error("Erro ao encerrar sessão");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sessão encerrada",
        description: "A sessão foi encerrada com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/sessions"] });
      setSessionToDelete(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível encerrar a sessão.",
        variant: "destructive",
      });
    },
  });

  const getDeviceIcon = (device: string) => {
    if (device.toLowerCase().includes("mobile") || device.toLowerCase().includes("android") || device.toLowerCase().includes("iphone")) {
      return <Smartphone className="h-5 w-5" />;
    }
    if (device.toLowerCase().includes("ipad") || device.toLowerCase().includes("tablet")) {
      return <Tablet className="h-5 w-5" />;
    }
    return <Monitor className="h-5 w-5" />;
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            <CardTitle>Sessões Ativas</CardTitle>
          </div>
          <CardDescription>
            Gerencie os dispositivos e locais onde sua conta está conectada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">
              Carregando sessões...
            </div>
          ) : sessions?.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Nenhuma sessão ativa encontrada.
            </div>
          ) : (
            sessions?.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-accent rounded-lg">
                    {getDeviceIcon(session.device)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{session.device}</span>
                      {session.isCurrent && (
                        <Badge variant="secondary" className="text-xs">
                          Sessão Atual
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      IP: {session.ipAddress}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Criada em: {format(new Date(session.createdAt), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Última atividade: {format(new Date(session.lastActivityAt), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                </div>
                {!session.isCurrent && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSessionToDelete(session)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmação para encerrar sessão */}
      <AlertDialog open={!!sessionToDelete} onOpenChange={() => setSessionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar sessão?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja encerrar esta sessão? O usuário será desconectado deste dispositivo.
              <div className="mt-4 p-3 bg-accent rounded-md">
                <div className="font-medium">{sessionToDelete?.device}</div>
                <div className="text-sm text-muted-foreground">IP: {sessionToDelete?.ipAddress}</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => sessionToDelete && deleteSessionMutation.mutate(sessionToDelete.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Encerrar Sessão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}