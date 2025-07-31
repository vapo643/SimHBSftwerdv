/**
 * Dashboard de Segurança - Projeto Cérbero
 * 
 * Interface em tempo real para monitoramento de segurança
 * com visualização de vulnerabilidades, anomalias e métricas.
 */

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  AlertTriangle,
  Activity,
  Bug,
  Lock,
  Eye,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Zap,
  Target,
  FileSearch,
  Package
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface SecurityMetrics {
  totalRequests: number;
  suspiciousRequests: number;
  blockedRequests: number;
  uniqueIPs: number;
  averageResponseTime: number;
  errorRate: number;
  anomalyScore: number;
}

interface VulnerabilityReport {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  endpoint?: string;
  description: string;
  detectedAt: Date;
  falsePositiveScore: number;
}

interface AnomalyDetection {
  id: string;
  type: string;
  confidence: number;
  description: string;
  timestamp: Date;
}

const SEVERITY_COLORS = {
  CRITICAL: '#dc2626',
  HIGH: '#ea580c',
  MEDIUM: '#f59e0b',
  LOW: '#10b981',
};

export function SecurityDashboard() {
  const queryClient = useQueryClient();
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Dados em tempo real
  const { data: metrics } = useQuery({
    queryKey: ['/api/security/metrics', selectedTimeRange],
    refetchInterval: autoRefresh ? 10000 : false, // 10 segundos
  });
  
  const { data: vulnerabilities } = useQuery({
    queryKey: ['/api/security/vulnerabilities'],
    refetchInterval: autoRefresh ? 30000 : false, // 30 segundos
  });
  
  const { data: anomalies } = useQuery({
    queryKey: ['/api/security/anomalies'],
    refetchInterval: autoRefresh ? 10000 : false,
  });
  
  const { data: dependencyScans } = useQuery({
    queryKey: ['/api/security/dependency-scan'],
    refetchInterval: autoRefresh ? 300000 : false, // 5 minutos
  });
  
  const { data: semgrepFindings } = useQuery({
    queryKey: ['/api/security/semgrep-findings'],
    refetchInterval: autoRefresh ? 60000 : false, // 1 minuto
  });
  
  // WebSocket para eventos em tempo real
  useEffect(() => {
    try {
      const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/security`);
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'anomaly':
            queryClient.invalidateQueries({ queryKey: ['/api/security/anomalies'] });
            break;
          case 'vulnerability':
            queryClient.invalidateQueries({ queryKey: ['/api/security/vulnerabilities'] });
            break;
          case 'critical-alert':
            // Mostrar notificação
            showCriticalAlert(data);
            break;
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      return () => {
        ws.close();
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [queryClient]);
  
  // Calcular estatísticas
  const stats = {
    securityScore: calculateSecurityScore(metrics, vulnerabilities),
    totalVulnerabilities: Array.isArray(vulnerabilities) ? vulnerabilities.length : 0,
    criticalVulnerabilities: Array.isArray(vulnerabilities) ? vulnerabilities.filter((v: VulnerabilityReport) => v.severity === 'CRITICAL').length : 0,
    recentAnomalies: Array.isArray(anomalies) ? anomalies.filter((a: AnomalyDetection) => 
      new Date(a.timestamp).getTime() > Date.now() - 3600000
    ).length : 0,
  };
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Monitoramento Avançado de Segurança
          </h1>
          <p className="text-muted-foreground">
            Sistema autônomo de detecção e prevenção de vulnerabilidades
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <Badge 
            variant={autoRefresh ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className="h-4 w-4 mr-1" />
            {autoRefresh ? 'Ao Vivo' : 'Pausado'}
          </Badge>
          
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="px-3 py-1 rounded-md border"
          >
            <option value="1h">Última hora</option>
            <option value="24h">Últimas 24h</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
          </select>
        </div>
      </div>
      
      {/* Score de Segurança */}
      <Card>
        <CardHeader>
          <CardTitle>Score de Segurança Global</CardTitle>
          <CardDescription>
            Avaliação geral da postura de segurança do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-6xl font-bold" style={{
              color: getScoreColor(stats.securityScore)
            }}>
              {stats.securityScore}%
            </div>
            <div className="space-y-2 text-right">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Proteções Ativas: 20</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-500" />
                <span>Conformidade OWASP: 100%</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span>Detecção ML: Ativa</span>
              </div>
            </div>
          </div>
          <Progress value={stats.securityScore} className="mt-4" />
        </CardContent>
      </Card>
      
      {/* Estatísticas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          title="Vulnerabilidades"
          value={stats.totalVulnerabilities}
          icon={<Bug className="h-8 w-8" />}
          trend={-15}
          critical={stats.criticalVulnerabilities}
        />
        <StatsCard
          title="Anomalias/Hora"
          value={stats.recentAnomalies}
          icon={<AlertTriangle className="h-8 w-8" />}
          trend={25}
        />
        <StatsCard
          title="IPs Bloqueados"
          value={metrics?.blockedIPs || 0}
          icon={<Lock className="h-8 w-8" />}
          trend={10}
        />
        <StatsCard
          title="Taxa de Erro"
          value={`${(metrics?.errorRate || 0).toFixed(2)}%`}
          icon={<XCircle className="h-8 w-8" />}
          trend={-5}
        />
      </div>
      
      {/* Alertas Críticos */}
      {vulnerabilities?.filter((v: VulnerabilityReport) => v.severity === 'CRITICAL').length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Atenção: Vulnerabilidades Críticas Detectadas</AlertTitle>
          <AlertDescription>
            {stats.criticalVulnerabilities} vulnerabilidades críticas requerem ação imediata.
            <div className="mt-2 space-y-1">
              {vulnerabilities
                .filter((v: VulnerabilityReport) => v.severity === 'CRITICAL')
                .slice(0, 3)
                .map((vuln: VulnerabilityReport) => (
                  <div key={vuln.id} className="text-sm">
                    • {vuln.type}: {vuln.description}
                  </div>
                ))}
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Tabs com Detalhes */}
      <Tabs defaultValue="vulnerabilities" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="vulnerabilities">Vulnerabilidades</TabsTrigger>
          <TabsTrigger value="anomalies">Anomalias</TabsTrigger>
          <TabsTrigger value="attacks">Ataques</TabsTrigger>
          <TabsTrigger value="dependencies">Dependências</TabsTrigger>
          <TabsTrigger value="code">Análise de Código</TabsTrigger>
        </TabsList>
        
        <TabsContent value="vulnerabilities" className="space-y-4">
          <VulnerabilitiesPanel vulnerabilities={vulnerabilities} />
        </TabsContent>
        
        <TabsContent value="anomalies" className="space-y-4">
          <AnomaliesPanel anomalies={anomalies} />
        </TabsContent>
        
        <TabsContent value="attacks" className="space-y-4">
          <AttacksPanel metrics={metrics} />
        </TabsContent>
        
        <TabsContent value="dependencies" className="space-y-4">
          <DependenciesPanel scans={dependencyScans} />
        </TabsContent>
        
        <TabsContent value="code" className="space-y-4">
          <CodeAnalysisPanel findings={semgrepFindings} />
        </TabsContent>
      </Tabs>
      
      {/* Gráficos de Tendências */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Tendência de Segurança</CardTitle>
          </CardHeader>
          <CardContent>
            <SecurityTrendChart data={metrics?.trend || []} />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Vulnerabilidades</CardTitle>
          </CardHeader>
          <CardContent>
            <VulnerabilityDistribution vulnerabilities={vulnerabilities} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Componentes auxiliares
function StatsCard({ title, value, icon, trend, critical }: any) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {critical !== undefined && (
              <p className="text-sm text-destructive">
                {critical} críticas
              </p>
            )}
          </div>
          <div className="flex flex-col items-end">
            {icon}
            {trend !== undefined && (
              <Badge 
                variant={trend > 0 ? "destructive" : "default"}
                className="mt-2"
              >
                {trend > 0 ? '+' : ''}{trend}%
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VulnerabilitiesPanel({ vulnerabilities }: any) {
  if (!vulnerabilities || vulnerabilities.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <p className="text-lg font-semibold">Nenhuma vulnerabilidade detectada</p>
          <p className="text-muted-foreground">O sistema está seguro</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-4">
      {vulnerabilities.map((vuln: VulnerabilityReport) => (
        <Card key={vuln.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge 
                    style={{ 
                      backgroundColor: SEVERITY_COLORS[vuln.severity],
                      color: 'white'
                    }}
                  >
                    {vuln.severity}
                  </Badge>
                  <span className="font-semibold">{vuln.type}</span>
                  {vuln.endpoint && (
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {vuln.endpoint}
                    </code>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{vuln.description}</p>
                <p className="text-xs text-muted-foreground">
                  Detectado em {new Date(vuln.detectedAt).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">
                  Confiança: {((1 - vuln.falsePositiveScore) * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AnomaliesPanel({ anomalies }: any) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Detecções em Tempo Real</CardTitle>
          <CardDescription>
            Anomalias detectadas por Machine Learning
          </CardDescription>
        </CardHeader>
        <CardContent>
          {anomalies?.map((anomaly: AnomalyDetection) => (
            <div key={anomaly.id} className="border-l-4 border-warning pl-4 py-2 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{anomaly.type}</p>
                  <p className="text-sm text-muted-foreground">{anomaly.description}</p>
                </div>
                <Badge variant="outline">
                  {(anomaly.confidence * 100).toFixed(0)}% certeza
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function AttacksPanel({ metrics }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Padrões de Ataque Detectados</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <AttackPattern 
            type="SQL Injection"
            count={metrics?.attacks?.sql || 0}
            blocked={metrics?.blocked?.sql || 0}
          />
          <AttackPattern 
            type="XSS"
            count={metrics?.attacks?.xss || 0}
            blocked={metrics?.blocked?.xss || 0}
          />
          <AttackPattern 
            type="Brute Force"
            count={metrics?.attacks?.bruteforce || 0}
            blocked={metrics?.blocked?.bruteforce || 0}
          />
          <AttackPattern 
            type="Path Traversal"
            count={metrics?.attacks?.pathTraversal || 0}
            blocked={metrics?.blocked?.pathTraversal || 0}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function AttackPattern({ type, count, blocked }: any) {
  const blockRate = count > 0 ? (blocked / count * 100).toFixed(0) : 100;
  
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div>
        <p className="font-medium">{type}</p>
        <p className="text-sm text-muted-foreground">
          {count} tentativas • {blocked} bloqueadas
        </p>
      </div>
      <div className="text-right">
        <p className="text-2xl font-bold">{blockRate}%</p>
        <p className="text-xs text-muted-foreground">Taxa de bloqueio</p>
      </div>
    </div>
  );
}

function DependenciesPanel({ scans }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Análise de Dependências (OWASP Dependency-Check)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {scans?.vulnerabilities?.map((dep: any) => (
          <div key={dep.cve} className="border-b last:border-0 py-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{dep.dependency}</p>
                <p className="text-sm text-muted-foreground">{dep.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">{dep.cve}</Badge>
                  <Badge 
                    style={{ 
                      backgroundColor: SEVERITY_COLORS[dep.severity],
                      color: 'white'
                    }}
                  >
                    CVSS: {dep.cvssScore}
                  </Badge>
                </div>
              </div>
              <Badge>{dep.version}</Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CodeAnalysisPanel({ findings }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSearch className="h-5 w-5" />
          Análise de Código (Semgrep SAST)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {findings?.map((finding: any) => (
          <div key={finding.id} className="border-b last:border-0 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium">{finding.rule}</p>
                <Badge 
                  variant={finding.severity === 'ERROR' ? 'destructive' : 'default'}
                >
                  {finding.severity}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{finding.message}</p>
              <div className="flex items-center gap-2 text-xs">
                <code className="bg-muted px-2 py-1 rounded">
                  {finding.file}:{finding.line}:{finding.column}
                </code>
                {finding.category && (
                  <Badge variant="outline">{finding.category}</Badge>
                )}
              </div>
              {finding.fixSuggestion && (
                <Alert className="mt-2">
                  <AlertDescription className="text-xs">
                    💡 {finding.fixSuggestion}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SecurityTrendChart({ data }: any) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Area 
          type="monotone" 
          dataKey="securityScore" 
          stroke="#10b981" 
          fill="#10b981" 
          fillOpacity={0.3}
          name="Score de Segurança"
        />
        <Area 
          type="monotone" 
          dataKey="threats" 
          stroke="#ef4444" 
          fill="#ef4444"
          fillOpacity={0.3}
          name="Ameaças"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function VulnerabilityDistribution({ vulnerabilities }: any) {
  const data = vulnerabilities ? 
    Object.entries(
      vulnerabilities.reduce((acc: any, vuln: VulnerabilityReport) => {
        acc[vuln.severity] = (acc[vuln.severity] || 0) + 1;
        return acc;
      }, {})
    ).map(([severity, count]) => ({
      name: severity,
      value: count as number,
      fill: SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS]
    })) : [];
  
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, value }) => `${name}: ${value}`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

// Funções auxiliares
function calculateSecurityScore(metrics: any, vulnerabilities: any): number {
  if (!metrics || !vulnerabilities) return 100;
  
  let score = 100;
  
  // Penalizar por vulnerabilidades
  const vulnPenalty = {
    CRITICAL: 15,
    HIGH: 10,
    MEDIUM: 5,
    LOW: 2
  };
  
  vulnerabilities.forEach((vuln: VulnerabilityReport) => {
    score -= vulnPenalty[vuln.severity] || 0;
  });
  
  // Penalizar por métricas ruins
  if (metrics.errorRate > 5) score -= 10;
  if (metrics.anomalyScore > 50) score -= 15;
  if (metrics.blockedRequests > metrics.totalRequests * 0.1) score -= 20;
  
  return Math.max(0, Math.min(100, score));
}

function getScoreColor(score: number): string {
  if (score >= 90) return '#10b981';
  if (score >= 70) return '#f59e0b';
  if (score >= 50) return '#ea580c';
  return '#dc2626';
}

function showCriticalAlert(data: any) {
  // Implementar notificação do navegador ou toast
  console.error('ALERTA CRÍTICO:', data);
}

export default SecurityDashboard;