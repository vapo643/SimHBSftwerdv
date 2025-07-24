
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { SYSTEM_QUERIES } from "@/hooks/queries/queryKeys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

export default function SystemHealthPage() {
  const { 
    data: healthData, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: SYSTEM_QUERIES.schemaHealth(),
    queryFn: () => api.get('/api/health/schema'),
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 1,
  });

  const health = healthData?.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Health</h1>
          <p className="text-muted-foreground">
            Database schema validation and system integrity checks
          </p>
        </div>
        <Button 
          onClick={() => refetch()} 
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overall Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isLoading ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : health?.isValid ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            Database Schema Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Validating database schema...</p>
          ) : error ? (
            <div className="text-red-600">
              <p>❌ Schema validation failed</p>
              <pre className="mt-2 text-sm">{error.message}</pre>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={health?.isValid ? "default" : "destructive"}>
                  {health?.isValid ? "HEALTHY" : "ISSUES DETECTED"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Last checked: {new Date(health?.timestamp).toLocaleString()}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="font-medium">Tables Checked</p>
                  <p>{health?.tablesChecked?.length || 0}</p>
                </div>
                <div>
                  <p className="font-medium">Errors</p>
                  <p className="text-red-600">{health?.errors?.length || 0}</p>
                </div>
                <div>
                  <p className="font-medium">Warnings</p>
                  <p className="text-yellow-600">{health?.warnings?.length || 0}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Errors */}
      {health?.errors && health.errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Errors ({health.errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {health.errors.map((error, index) => (
                <div key={index} className="border-l-4 border-red-500 pl-4">
                  <p className="font-medium">{error.table}{error.field && `.${error.field}`}</p>
                  <p className="text-sm text-gray-600">{error.message}</p>
                  {error.suggestion && (
                    <p className="text-xs text-blue-600 mt-1">
                      💡 {error.suggestion}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warnings */}
      {health?.warnings && health.warnings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              Warnings ({health.warnings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {health.warnings.map((warning, index) => (
                <div key={index} className="border-l-4 border-yellow-500 pl-4">
                  <p className="font-medium">{warning.table}{warning.field && `.${warning.field}`}</p>
                  <p className="text-sm text-gray-600">{warning.message}</p>
                  {warning.suggestion && (
                    <p className="text-xs text-blue-600 mt-1">
                      💡 {warning.suggestion}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
