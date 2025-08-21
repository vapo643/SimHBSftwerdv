import { useFeatureFlags, useFeatureFlag, FeatureGate } from "@/contexts/FeatureFlagContext";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, XCircle, TrendingUp, DollarSign, FileText } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Componente de exemplo demonstrando diferentes usos de feature flags
 */
export function FeatureFlagExample() {
  const { flags, isLoading, checkFlag, refreshFlags } = useFeatureFlags();
  const isMaintenanceMode = useFeatureFlag('maintenance-mode');
  const isReadOnlyMode = useFeatureFlag('read-only-mode');
  const hasExperimentalApi = useFeatureFlag('nova-api-experimental');
  const hasAdvancedReports = useFeatureFlag('relatorios-avancados');
  const hasPixInstant = useFeatureFlag('pagamento-pix-instant');
  
  // Query para buscar dados da API experimental (apenas se flag ativa)
  const { data: analyticsData, isLoading: analyticsLoading, error: analyticsError } = useQuery({
    queryKey: ['/api/experimental/analytics'],
    enabled: hasExperimentalApi, // Só executa se a flag estiver ativa
    queryFn: async () => {
      const response = await apiRequest('/api/experimental/analytics', {
        method: 'GET',
      });
      
      const responseData = response as Response;
      
      if (!responseData.ok) {
        throw new Error('Failed to fetch experimental analytics');
      }
      
      return responseData.json();
    },
    retry: 1,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span>Carregando feature flags...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Card de Status das Feature Flags */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Status das Feature Flags</CardTitle>
              <CardDescription>
                Funcionalidades controladas por feature flags
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={refreshFlags}
            >
              Atualizar Flags
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(flags).map(([flagName, isEnabled]) => (
              <div 
                key={flagName}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <span className="text-sm font-medium">{flagName}</span>
                <Badge 
                  variant={isEnabled ? "default" : "secondary"}
                  className={isEnabled ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
                >
                  {isEnabled ? (
                    <>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Ativo
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3 mr-1" />
                      Inativo
                    </>
                  )}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alertas de Modo Especial */}
      {isMaintenanceMode && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Modo de Manutenção Ativo</AlertTitle>
          <AlertDescription>
            O sistema está em manutenção. Algumas funcionalidades podem estar limitadas.
          </AlertDescription>
        </Alert>
      )}

      {isReadOnlyMode && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Modo Somente Leitura</AlertTitle>
          <AlertDescription>
            O sistema está em modo somente leitura. Alterações não são permitidas.
          </AlertDescription>
        </Alert>
      )}

      {/* Feature Gate: Analytics Experimental */}
      <FeatureGate 
        flag="nova-api-experimental"
        fallback={
          <Card>
            <CardHeader>
              <CardTitle className="text-muted-foreground">
                Analytics Avançado (Em Breve)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Esta funcionalidade está em desenvolvimento e será liberada gradualmente.
              </p>
            </CardContent>
          </Card>
        }
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Analytics Avançado</CardTitle>
              <Badge variant="outline" className="border-orange-200 text-orange-700">Beta</Badge>
            </div>
            <CardDescription>
              Dados experimentais da nova API de analytics
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ) : analyticsError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Erro ao carregar dados experimentais
                </AlertDescription>
              </Alert>
            ) : analyticsData?.data ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3">
                  <FileText className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Propostas</p>
                    <p className="text-2xl font-bold">{analyticsData.data.total_propostas}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <DollarSign className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Total</p>
                    <p className="text-2xl font-bold">
                      {new Intl.NumberFormat('pt-BR', { 
                        style: 'currency', 
                        currency: 'BRL' 
                      }).format(analyticsData.data.total_valor)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <TrendingUp className="h-8 w-8 text-purple-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Versão API</p>
                    <p className="text-lg font-semibold">{analyticsData.data.experimental_version}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </FeatureGate>

      {/* Feature Gate: Relatórios Avançados */}
      <FeatureGate flag="relatorios-avancados">
        <Card>
          <CardHeader>
            <CardTitle>Relatórios Avançados</CardTitle>
            <CardDescription>
              Acesso a relatórios detalhados e personalizados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">
              Acessar Relatórios Avançados
            </Button>
          </CardContent>
        </Card>
      </FeatureGate>

      {/* Feature Gate: PIX Instantâneo */}
      <FeatureGate flag="pagamento-pix-instant">
        <Card>
          <CardHeader>
            <CardTitle>PIX Instantâneo</CardTitle>
            <CardDescription>
              Processamento de pagamentos PIX em tempo real
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                PIX Instantâneo está disponível para sua conta
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </FeatureGate>

      {/* Uso Programático das Flags */}
      <Card>
        <CardHeader>
          <CardTitle>Uso Programático</CardTitle>
          <CardDescription>
            Exemplo de verificação condicional de features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {checkFlag('novo-dashboard') ? (
              <p className="text-sm">
                ✅ Novo dashboard está habilitado - renderizando versão atualizada
              </p>
            ) : (
              <p className="text-sm">
                ❌ Novo dashboard desabilitado - usando versão clássica
              </p>
            )}
            
            {checkFlag('ab-test-onboarding') ? (
              <p className="text-sm">
                ✅ Teste A/B de onboarding ativo - variante experimental
              </p>
            ) : (
              <p className="text-sm">
                ❌ Teste A/B de onboarding inativo - fluxo padrão
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}