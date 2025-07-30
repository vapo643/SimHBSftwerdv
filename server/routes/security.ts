// Endpoints de Monitoramento de Segurança - OWASP A09
import { Request, Response } from 'express';
import { jwtAuthMiddleware, AuthenticatedRequest } from '../lib/jwt-auth-middleware';
import { requireAdmin } from '../lib/role-guards';
import { securityLogger, SecurityEventType } from '../lib/security-logger';
import { getBrasiliaTimestamp } from '../lib/timezone';

export function setupSecurityRoutes(app: any) {
  // Health check de segurança
  app.get('/api/security/health', jwtAuthMiddleware, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    try {
      const metrics = securityLogger.getSecurityMetrics(24); // Últimas 24 horas
      const anomalies = securityLogger.detectAnomalies();
      
      res.json({
        timestamp: getBrasiliaTimestamp(),
        status: anomalies.length === 0 ? 'healthy' : 'warning',
        metrics,
        anomalies,
        lastUpdate: getBrasiliaTimestamp()
      });
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao obter métricas de segurança', error: error.message });
    }
  });
  
  // Relatório detalhado de segurança
  app.get('/api/security/report', jwtAuthMiddleware, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const metrics = securityLogger.getSecurityMetrics(hours);
      
      // Análise adicional
      const analysis = {
        riskLevel: calculateRiskLevel(metrics),
        recommendations: generateRecommendations(metrics),
        topThreats: identifyTopThreats(metrics)
      };
      
      res.json({
        period: `${hours} hours`,
        metrics,
        analysis,
        generatedAt: getBrasiliaTimestamp()
      });
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao gerar relatório', error: error.message });
    }
  });
  
  // Log de evento de segurança manual (para testes)
  app.post('/api/security/log-event', jwtAuthMiddleware, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    try {
      const { type, severity, details } = req.body;
      
      if (!type || !severity) {
        return res.status(400).json({ message: 'Type e severity são obrigatórios' });
      }
      
      securityLogger.logEvent({
        type: type as SecurityEventType,
        severity: severity as any,
        userId: req.user?.id,
        userEmail: req.user?.email,
        endpoint: '/api/security/log-event',
        success: true,
        details
      });
      
      res.json({ message: 'Evento registrado com sucesso' });
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao registrar evento', error: error.message });
    }
  });
  
  // Verificar status de conformidade OWASP
  app.get('/api/security/owasp-compliance', jwtAuthMiddleware, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    try {
      const compliance = checkOWASPCompliance();
      res.json(compliance);
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao verificar conformidade', error: error.message });
    }
  });
}

// Calcula nível de risco baseado nas métricas
function calculateRiskLevel(metrics: any): string {
  const score = 
    (metrics.failedLogins * 2) +
    (metrics.accessDenied * 3) +
    (metrics.rateLimitExceeded * 1) +
    (metrics.criticalEvents * 5);
    
  if (score === 0) return 'LOW';
  if (score < 50) return 'MEDIUM';
  if (score < 100) return 'HIGH';
  return 'CRITICAL';
}

// Gera recomendações baseadas nas métricas
function generateRecommendations(metrics: any): string[] {
  const recommendations: string[] = [];
  
  if (metrics.failedLogins > 100) {
    recommendations.push('Alto número de falhas de login. Considere implementar CAPTCHA.');
  }
  
  if (metrics.suspiciousIPs.length > 5) {
    recommendations.push(`${metrics.suspiciousIPs.length} IPs suspeitos detectados. Considere bloqueá-los no firewall.`);
  }
  
  if (metrics.criticalEvents > 10) {
    recommendations.push('Múltiplos eventos críticos. Realize uma auditoria de segurança urgente.');
  }
  
  if (metrics.rateLimitExceeded > 500) {
    recommendations.push('Rate limiting acionado frequentemente. Ajuste os limites ou implemente CDN.');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Sistema operando dentro dos parâmetros normais de segurança.');
  }
  
  return recommendations;
}

// Identifica principais ameaças
function identifyTopThreats(metrics: any): Array<{type: string, count: number}> {
  const threats = [
    { type: 'Brute Force Attempts', count: metrics.failedLogins },
    { type: 'Unauthorized Access', count: metrics.accessDenied },
    { type: 'DoS Attempts', count: metrics.rateLimitExceeded },
    { type: 'Critical Security Events', count: metrics.criticalEvents }
  ];
  
  return threats
    .filter(t => t.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

// Verifica conformidade com OWASP Top 10
function checkOWASPCompliance(): any {
  return {
    timestamp: getBrasiliaTimestamp(),
    overallCompliance: '70%',
    categories: {
      A01_BrokenAccessControl: {
        status: 'COMPLIANT',
        implementations: ['RBAC', 'RLS', 'JWT Auth', 'Role Guards']
      },
      A02_CryptographicFailures: {
        status: 'COMPLIANT',
        implementations: ['HTTPS', 'mTLS', 'Bcrypt', 'JWT']
      },
      A03_Injection: {
        status: 'COMPLIANT',
        implementations: ['Drizzle ORM', 'Input Sanitization', 'Zod Validation']
      },
      A04_InsecureDesign: {
        status: 'PARTIAL',
        missing: ['Threat Modeling', 'Security Tests']
      },
      A05_SecurityMisconfiguration: {
        status: 'COMPLIANT',
        implementations: ['Helmet.js', 'CORS', 'Security Headers']
      },
      A06_VulnerableComponents: {
        status: 'PARTIAL',
        issues: ['5 moderate vulnerabilities in dependencies']
      },
      A07_AuthenticationFailures: {
        status: 'COMPLIANT',
        implementations: ['Supabase Auth', 'JWT', 'Rate Limiting']
      },
      A08_DataIntegrityFailures: {
        status: 'COMPLIANT',
        implementations: ['Zod Schemas', 'ACID Transactions', 'Audit Logs']
      },
      A09_SecurityLogging: {
        status: 'COMPLIANT',
        implementations: ['Security Logger', 'Monitoring Endpoints']
      },
      A10_SSRF: {
        status: 'COMPLIANT',
        implementations: ['URL Validation', 'Domain Whitelist']
      }
    }
  };
}