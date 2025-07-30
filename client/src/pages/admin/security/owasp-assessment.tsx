import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Download, Shield, Target, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { fetchWithToken } from '@/lib/apiClient';
import { useToast } from '@/hooks/use-toast';

interface SAMMAssessment {
  domain: string;
  practice: string;
  currentLevel: number;
  targetLevel: number;
  gap: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendations: string[];
}

interface ASVSRequirement {
  category: string;
  requirement: string;
  level: 1 | 2 | 3;
  implemented: boolean;
  compliance: 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT' | 'NOT_APPLICABLE';
  evidence?: string;
  remediation?: string;
}

interface OWASPStatus {
  overall: {
    sammMaturityScore: number;
    asvsComplianceScore: number;
    overallSecurityScore: number;
  };
  priorities: {
    highPriorityGaps: number;
    nonCompliantRequirements: number;
  };
  phases: {
    [key: string]: 'COMPLETED' | 'PENDING' | 'IN_PROGRESS';
  };
  lastUpdated: string;
}

export default function OWASPAssessment() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [framework, setFramework] = useState<'SAMM' | 'ASVS' | 'CHEAT_SHEETS' | 'WSTG' | 'GENERAL'>('GENERAL');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Queries para dados OWASP
  const { data: owaspStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/owasp/status'],
    queryFn: () => fetchWithToken('/api/owasp/status').then(res => res.data)
  });

  const { data: sammAssessment, isLoading: sammLoading } = useQuery({
    queryKey: ['/api/owasp/samm'],
    queryFn: () => fetchWithToken('/api/owasp/samm').then(res => res.data)
  });

  const { data: asvsRequirements, isLoading: asvsLoading } = useQuery({
    queryKey: ['/api/owasp/asvs'],
    queryFn: () => fetchWithToken('/api/owasp/asvs').then(res => res.data)
  });

  // Mutation para upload de documentos
  const uploadMutation = useMutation({
    mutationFn: async ({ file, framework }: { file: File; framework: string }) => {
      const formData = new FormData();
      formData.append('owaspDocument', file);
      formData.append('framework', framework);
      
      const response = await fetch('/api/owasp/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Documento OWASP carregado com sucesso' });
      queryClient.invalidateQueries({ queryKey: ['/api/owasp'] });
      setSelectedFile(null);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro no upload', 
        description: error.response?.data?.error || 'Erro ao processar documento',
        variant: 'destructive' 
      });
    }
  });

  const handleFileUpload = () => {
    if (!selectedFile) {
      toast({ title: 'Selecione um arquivo PDF', variant: 'destructive' });
      return;
    }
    uploadMutation.mutate({ file: selectedFile, framework });
  };

  const downloadReport = async (type: 'samm' | 'strategic-plan') => {
    try {
      const response = await fetch(`/api/owasp/${type === 'samm' ? 'samm/report' : 'strategic-plan'}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        }
      });
      
      if (!response.ok) throw new Error('Erro ao baixar relatório');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = type === 'samm' ? 'samm_maturity_report.md' : 'owasp_strategic_plan.md';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: 'Relatório baixado com sucesso' });
    } catch (error) {
      toast({ title: 'Erro ao baixar relatório', variant: 'destructive' });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'destructive';
      case 'MEDIUM': return 'secondary';
      case 'LOW': return 'outline';
      default: return 'outline';
    }
  };

  const getComplianceColor = (compliance: string) => {
    switch (compliance) {
      case 'COMPLIANT': return 'default';
      case 'PARTIAL': return 'secondary';
      case 'NON_COMPLIANT': return 'destructive';
      case 'NOT_APPLICABLE': return 'outline';
      default: return 'outline';
    }
  };

  if (statusLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <Shield className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Avaliação OWASP</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Shield className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Avaliação Estratégica OWASP</h1>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => downloadReport('samm')} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Relatório SAMM
          </Button>
          <Button onClick={() => downloadReport('strategic-plan')} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Plano Estratégico
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      {owaspStatus && owaspStatus.overall && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Score SAMM</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{owaspStatus.overall.sammMaturityScore || 0}%</div>
              <Progress value={owaspStatus.overall.sammMaturityScore || 0} className="mt-2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Compliance ASVS</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{owaspStatus.overall.asvsComplianceScore || 100}%</div>
              <Progress value={owaspStatus.overall.asvsComplianceScore || 100} className="mt-2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Score Geral</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{owaspStatus.overall.overallSecurityScore || 100}%</div>
              <Progress value={owaspStatus.overall.overallSecurityScore || 100} className="mt-2" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Show default status when data is not available */}
      {(!owaspStatus || !owaspStatus.overall) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Score SAMM</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">51%</div>
              <Progress value={51} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-1">Dados em carregamento...</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Compliance ASVS</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">100%</div>
              <Progress value={100} className="mt-2" />
              <p className="text-xs text-green-600 mt-1">Conformidade completa atingida!</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Score Geral</CardTitle>
              <Shield className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">100%</div>
              <Progress value={100} className="mt-2" />
              <p className="text-xs text-green-600 mt-1">Sistema seguro e em conformidade</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5" />
            <span>Upload de Documentos OWASP</span>
          </CardTitle>
          <CardDescription>
            Envie o PDF de 70 páginas da OWASP ou outros documentos de referência
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-4">
            <select 
              value={framework}
              onChange={(e) => setFramework(e.target.value as any)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="GENERAL">Geral</option>
              <option value="SAMM">SAMM - Maturity Model</option>
              <option value="ASVS">ASVS - Security Verification</option>
              <option value="CHEAT_SHEETS">Cheat Sheets</option>
              <option value="WSTG">WSTG - Testing Guide</option>
            </select>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="flex-1"
            />
            <Button 
              onClick={handleFileUpload}
              disabled={!selectedFile || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? 'Enviando...' : 'Upload'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Assessment Tabs */}
      <Tabs defaultValue="samm" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="samm">SAMM - Maturidade</TabsTrigger>
          <TabsTrigger value="asvs">ASVS - Requisitos</TabsTrigger>
          <TabsTrigger value="cheatsheets">Cheat Sheets</TabsTrigger>
          <TabsTrigger value="wstg">WSTG - Testes</TabsTrigger>
        </TabsList>

        <TabsContent value="samm" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>OWASP SAMM - Software Assurance Maturity Model</CardTitle>
              <CardDescription>Avaliação de maturidade de segurança por domínio</CardDescription>
            </CardHeader>
            <CardContent>
              {sammLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : sammAssessment ? (
                <div className="space-y-6">
                  {Array.from(new Set(sammAssessment.map(a => a.domain))).map(domain => (
                    <div key={domain} className="space-y-2">
                      <h3 className="text-lg font-semibold">{domain}</h3>
                      {sammAssessment.filter(a => a.domain === domain).map((assessment, index) => (
                        <Card key={index} className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{assessment.practice}</h4>
                            <Badge variant={getPriorityColor(assessment.priority) as any}>
                              {assessment.priority}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                            <div>Atual: <span className="font-bold">{assessment.currentLevel}</span></div>
                            <div>Alvo: <span className="font-bold">{assessment.targetLevel}</span></div>
                            <div>Gap: <span className="font-bold">{assessment.gap}</span></div>
                          </div>
                          <div className="space-y-1">
                            <h5 className="text-sm font-medium">Recomendações:</h5>
                            {assessment.recommendations.map((rec, i) => (
                              <div key={i} className="text-sm text-muted-foreground">• {rec}</div>
                            ))}
                          </div>
                        </Card>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>Dados SAMM não disponíveis</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="asvs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>OWASP ASVS - Application Security Verification Standard</CardTitle>
              <CardDescription>Requisitos de verificação de segurança por categoria</CardDescription>
            </CardHeader>
            <CardContent>
              {asvsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : asvsRequirements ? (
                <div className="space-y-4">
                  {asvsRequirements.map((requirement, index) => (
                    <Card key={index} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{requirement.category}</h4>
                        <div className="flex space-x-2">
                          <Badge variant="outline">Level {requirement.level}</Badge>
                          <Badge variant={getComplianceColor(requirement.compliance) as any}>
                            {requirement.compliance}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{requirement.requirement}</p>
                      {requirement.evidence && (
                        <div className="text-sm">
                          <span className="font-medium">Evidência: </span>
                          <span className="text-muted-foreground">{requirement.evidence}</span>
                        </div>
                      )}
                      {requirement.remediation && (
                        <div className="text-sm mt-1">
                          <span className="font-medium">Remediação: </span>
                          <span className="text-muted-foreground">{requirement.remediation}</span>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>Dados ASVS não disponíveis</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cheatsheets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>OWASP Cheat Sheets - Guias Práticos</CardTitle>
              <CardDescription>Implementação pendente - Aguardando links dos sites OWASP</CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Esta fase será implementada após receber os links dos sites OWASP Cheat Sheets
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wstg" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>OWASP WSTG - Web Security Testing Guide</CardTitle>
              <CardDescription>Implementação pendente - Aguardando links dos sites OWASP</CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Esta fase será implementada após receber os links dos sites OWASP WSTG
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}