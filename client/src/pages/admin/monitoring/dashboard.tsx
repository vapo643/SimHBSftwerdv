import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Clock, XCircle, BarChart3, Activity } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';

interface QueueMetrics {
  queueName: string;
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  dlqSize?: number;
  alerts: {
    highFailureRate: boolean;
    slowProcessing: boolean;
    highDLQSize: boolean;
  };
}

interface QueueMetricsResponse {
  queues: QueueMetrics[];
  timestamp: string;
  healthy: boolean;
}

export default function MonitoringDashboard() {
  const { user } = useAuth();

  // RBAC: Verificar se usuário é ADMINISTRADOR
  if (user?.role !== 'ADMINISTRADOR') {
    return (
      <DashboardLayout title="Acesso Negado">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Você não tem permissão para acessar esta página. Apenas usuários com perfil
            ADMINISTRADOR podem visualizar o dashboard de monitoramento.
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  // Buscar dados de métricas das filas a cada 10 segundos
  const {
    data: metricsData,
    isLoading,
    error,
    isError,
  } = useQuery<QueueMetricsResponse>({
    queryKey: ['/api/monitoring/queues/metrics'],
    refetchInterval: 10000, // 10 segundos
    refetchIntervalInBackground: true,
  });

  const getQueueIcon = (queueName: string) => {
    if (queueName === 'dead-letter-queue') {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
    return <Activity className="h-5 w-5 text-blue-500" />;
  };

  const getStatusBadge = (queue: QueueMetrics) => {
    const hasAlerts = Object.values(queue.alerts).some((alert) => alert);

    if (hasAlerts) {
      return <Badge variant="destructive">Alerta</Badge>;
    }

    if (queue.activeJobs > 0) {
      return <Badge variant="secondary">Processando</Badge>;
    }

    return (
      <Badge variant="default" className="bg-green-100 text-green-800">
        Saudável
      </Badge>
    );
  };

  const getCardBorderClass = (queue: QueueMetrics) => {
    const hasAlerts = Object.values(queue.alerts).some((alert) => alert);
    return hasAlerts ? 'border-red-500 border-2' : '';
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Dashboard de Monitoramento">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DashboardLayout>
    );
  }

  if (isError) {
    return (
      <DashboardLayout title="Dashboard de Monitoramento">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Erro ao carregar métricas das filas: {error?.message || 'Erro desconhecido'}
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Dashboard de Monitoramento">
      <div className="space-y-6">
        {/* Header com status geral */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-6 w-6" />
            <h2 className="text-2xl font-bold">Filas BullMQ</h2>
          </div>
          <div className="flex items-center space-x-2">
            {metricsData?.healthy ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-500" />
            )}
            <span className="text-sm text-muted-foreground">
              Última atualização:{' '}
              {metricsData?.timestamp
                ? new Date(metricsData.timestamp).toLocaleTimeString()
                : 'N/A'}
            </span>
          </div>
        </div>

        {/* Grid de Cards das Filas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {metricsData?.queues?.map((queue) => (
            <Card
              key={queue.queueName}
              className={getCardBorderClass(queue)}
              data-testid={`card-queue-${queue.queueName}`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center space-x-2">
                  {getQueueIcon(queue.queueName)}
                  <span>{queue.queueName}</span>
                </CardTitle>
                {getStatusBadge(queue)}
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Métricas principais */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total:</span>
                      <span className="font-semibold" data-testid={`text-total-${queue.queueName}`}>
                        {queue.totalJobs}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ativos:</span>
                      <span
                        className="font-semibold text-blue-600"
                        data-testid={`text-active-${queue.queueName}`}
                      >
                        {queue.activeJobs}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Completos:</span>
                      <span
                        className="font-semibold text-green-600"
                        data-testid={`text-completed-${queue.queueName}`}
                      >
                        {queue.completedJobs}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Falhados:</span>
                      <span
                        className="font-semibold text-red-600"
                        data-testid={`text-failed-${queue.queueName}`}
                      >
                        {queue.failedJobs}
                      </span>
                    </div>
                  </div>

                  {/* DLQ Size para dead-letter-queue */}
                  {queue.queueName === 'dead-letter-queue' && queue.dlqSize !== undefined && (
                    <div className="border-t pt-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">DLQ Size:</span>
                        <span
                          className={`font-semibold ${queue.dlqSize > 0 ? 'text-red-600' : 'text-green-600'}`}
                          data-testid="text-dlq-size"
                        >
                          {queue.dlqSize}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Alertas ativos */}
                  {Object.values(queue.alerts).some((alert) => alert) && (
                    <div className="border-t pt-2">
                      <div className="flex items-center space-x-1 text-sm text-red-600">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Alertas ativos:</span>
                      </div>
                      <ul className="mt-1 text-xs text-red-600 space-y-1">
                        {queue.alerts.highFailureRate && <li>• Alta taxa de falhas</li>}
                        {queue.alerts.slowProcessing && <li>• Processamento lento</li>}
                        {queue.alerts.highDLQSize && <li>• DLQ com muitos jobs</li>}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Mensagem caso não haja filas */}
        {(!metricsData?.queues || metricsData.queues.length === 0) && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Nenhuma fila encontrada ou todas as filas estão vazias.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </DashboardLayout>
  );
}
