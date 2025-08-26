import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileSearch,
  Bug,
  Lock,
  Users,
  Key,
  Cookie,
  Code,
  AlertCircle,
  Database,
  Globe,
  Terminal,
  Cpu,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

interface WstgCategory {
  id: string;
  name: string;
  description: string;
  totalTests: number;
  completedTests: number;
  vulnerableTests: number;
  secureTests: number;
}

interface WstgStatus {
  totalTests: number;
  completedTests: number;
  secureTests: number;
  vulnerableTests: number;
  compliancePercentage: number;
  categories: WstgCategory[];
}

const getCategoryIcon = (categoryId: string) => {
  const icons: Record<string, any> = {
    'WSTG-INFO': FileSearch,
    'WSTG-CONF': Cpu,
    'WSTG-IDNT': Users,
    'WSTG-ATHN': Key,
    'WSTG-ATHZ': Lock,
    'WSTG-SESS': Cookie,
    'WSTG-INPV': Code,
    'WSTG-ERRH': AlertCircle,
    'WSTG-CRYP': Shield,
    'WSTG-BUSLOGIC': Database,
    'WSTG-CLIENT': Globe,
    'WSTG-API': Terminal,
  };
  return icons[categoryId] || Shield;
};

export function WstgPage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery<WstgStatus>({
    queryKey: ['/api/owasp/wstg/status'],
    queryFn: () => apiRequest('/api/owasp/wstg/status'),
  });

  const processMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/owasp/wstg/process', {
        method: 'POST',
        body: {},
      });
      return response;
    },
    onMutate: () => {
      setIsProcessing(true);
    },
    onSuccess: () => {
      toast({
        title: 'WSTG Processing Started',
        description: 'Processing 210 WSTG test cases. This may take several minutes.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/owasp/wstg/status'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Processing Error',
        description: error.message || 'Failed to process WSTG URLs',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsProcessing(false);
    },
  });

  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600 dark:text-green-400';
    if (percentage >= 70) return 'text-yellow-600 dark:text-yellow-400';
    if (percentage >= 50) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getCategoryProgress = (category: WstgCategory) => {
    if (category.totalTests === 0) return 0;
    return Math.round((category.completedTests / category.totalTests) * 100);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Shield className="mx-auto mb-4 h-12 w-12 animate-pulse text-muted-foreground" />
          <p className="text-muted-foreground">Loading WSTG status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-2 text-4xl font-bold">OWASP WSTG Implementation</h1>
          <p className="text-muted-foreground">
            Web Security Testing Guide v4.2 - 210 Security Tests
          </p>
        </div>

        {/* Overall Progress */}
        <Card className="mb-8 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Overall Compliance</h2>
              <p className="text-muted-foreground">
                {status?.completedTests || 0} of {status?.totalTests || 210} tests completed
              </p>
            </div>
            <div
              className={`text-5xl font-bold ${getStatusColor(status?.compliancePercentage || 0)}`}
            >
              {status?.compliancePercentage || 0}%
            </div>
          </div>

          <Progress value={status?.compliancePercentage || 0} className="mb-4 h-4" />

          <div className="mt-6 grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="mb-2 flex items-center justify-center">
                <Clock className="mr-2 h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold">{status?.totalTests || 210}</span>
              </div>
              <p className="text-sm text-muted-foreground">Total Tests</p>
            </div>
            <div className="text-center">
              <div className="mb-2 flex items-center justify-center">
                <CheckCircle className="mr-2 h-5 w-5 text-green-600" />
                <span className="text-2xl font-bold text-green-600">
                  {status?.secureTests || 0}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Secure</p>
            </div>
            <div className="text-center">
              <div className="mb-2 flex items-center justify-center">
                <Bug className="mr-2 h-5 w-5 text-red-600" />
                <span className="text-2xl font-bold text-red-600">
                  {status?.vulnerableTests || 0}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Vulnerable</p>
            </div>
            <div className="text-center">
              <div className="mb-2 flex items-center justify-center">
                <Clock className="mr-2 h-5 w-5 text-yellow-600" />
                <span className="text-2xl font-bold text-yellow-600">
                  {(status?.totalTests || 210) - (status?.completedTests || 0)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </div>
        </Card>

        {/* Action Button */}
        <div className="mb-8 flex justify-center">
          <Button
            size="lg"
            onClick={() => processMutation.mutate()}
            disabled={isProcessing || processMutation.isPending}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {isProcessing ? (
              <>
                <Clock className="mr-2 h-5 w-5 animate-spin" />
                Processing 210 URLs...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-5 w-5" />
                Start WSTG Analysis
              </>
            )}
          </Button>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {status?.categories.map((category) => {
            const Icon = getCategoryIcon(category.id);
            const progress = getCategoryProgress(category);

            return (
              <Card key={category.id} className="p-6 transition-shadow hover:shadow-lg">
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex items-center">
                    <Icon className="mr-3 h-8 w-8 text-primary" />
                    <div>
                      <h3 className="font-semibold">{category.name}</h3>
                      <p className="text-sm text-muted-foreground">{category.id}</p>
                    </div>
                  </div>
                  <span className={`text-2xl font-bold ${getStatusColor(progress)}`}>
                    {progress}%
                  </span>
                </div>

                <p className="mb-4 text-sm text-muted-foreground">{category.description}</p>

                <Progress value={progress} className="mb-4 h-2" />

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {category.completedTests}/{category.totalTests} tests
                  </span>
                  <div className="flex gap-4">
                    {category.secureTests > 0 && (
                      <span className="text-green-600">✓ {category.secureTests}</span>
                    )}
                    {category.vulnerableTests > 0 && (
                      <span className="text-red-600">✗ {category.vulnerableTests}</span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Info Alert */}
        <Alert className="mt-8">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>OWASP WSTG v4.2</strong> provides comprehensive security testing methodology.
            Processing all 210 test cases will perform automated vulnerability analysis and generate
            detailed security reports aligned with ASVS Level 3 requirements.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
