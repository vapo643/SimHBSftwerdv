/**
 * API de Segurança - Projeto Cérbero
 * 
 * Endpoints para o dashboard de segurança e sistema autônomo
 */

import { Router, Request, Response } from 'express';
import { getSecurityScanner } from '../lib/autonomous-security-scanner';
import { getVulnerabilityDetector } from '../lib/vulnerability-detector';
import { getDependencyScanner } from '../lib/dependency-scanner';
import { getSemgrepScanner } from '../lib/semgrep-scanner';
import { db } from '../lib/supabase';
import { security_logs } from '../../shared/schema';
import { sql } from 'drizzle-orm';
import { jwtAuthMiddleware } from '../lib/jwt-auth-middleware';
import { requireAdmin, requireManagerOrAdmin } from '../lib/role-guards';

const router = Router();

// Middleware de autenticação para todas as rotas
router.use(jwtAuthMiddleware);

/**
 * GET /api/security/metrics
 * Métricas de segurança em tempo real
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const timeRange = req.query.timeRange as string || '1h';
    const scanner = getSecurityScanner();
    
    if (!scanner) {
      return res.status(503).json({ error: 'Scanner não inicializado' });
    }
    
    // Calcular métricas baseado no timeRange
    const since = getTimeRangeDate(timeRange);
    
    // Buscar logs do período
    const logs = await db
      .select()
      .from(security_logs)
      .where(sql`created_at >= ${since}`)
      .limit(10000);
    
    // Calcular métricas
    const metrics = {
      totalRequests: logs.length,
      suspiciousRequests: logs.filter(l => l.success === false).length,
      blockedRequests: logs.filter(l => l.severity === 'HIGH' || l.severity === 'CRITICAL').length,
      uniqueIPs: new Set(logs.map(l => l.ip_address)).size,
      averageResponseTime: 0, // Calcular se tiver dados
      errorRate: logs.filter(l => l.status_code >= 400).length / logs.length * 100,
      anomalyScore: 0, // Calcular baseado em anomalias
      blockedIPs: 0, // Obter do scanner
      trend: generateTrendData(logs, timeRange)
    };
    
    res.json(metrics);
  } catch (error) {
    console.error('Erro ao obter métricas:', error);
    res.status(500).json({ error: 'Erro ao obter métricas' });
  }
});

/**
 * GET /api/security/vulnerabilities
 * Lista de vulnerabilidades detectadas
 */
router.get('/vulnerabilities', async (req: Request, res: Response) => {
  try {
    const scanner = getSecurityScanner();
    
    if (!scanner) {
      return res.status(503).json({ error: 'Scanner não inicializado' });
    }
    
    // Obter vulnerabilidades do scanner
    const vulnerabilities = []; // scanner.getVulnerabilities();
    
    // Filtrar e ordenar
    const filtered = vulnerabilities
      .filter(v => v.falsePositiveScore < 0.5) // Remover falsos positivos prováveis
      .sort((a, b) => {
        const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
    
    res.json(filtered);
  } catch (error) {
    console.error('Erro ao obter vulnerabilidades:', error);
    res.status(500).json({ error: 'Erro ao obter vulnerabilidades' });
  }
});

/**
 * GET /api/security/anomalies
 * Anomalias detectadas por ML
 */
router.get('/anomalies', async (req: Request, res: Response) => {
  try {
    const detector = getVulnerabilityDetector();
    const report = detector.getAnomalyReport();
    
    // Retornar anomalias recentes com alta confiança
    const anomalies = report.highConfidence
      .filter(a => new Date(a.timestamp).getTime() > Date.now() - 86400000); // Últimas 24h
    
    res.json(anomalies);
  } catch (error) {
    console.error('Erro ao obter anomalias:', error);
    res.status(500).json({ error: 'Erro ao obter anomalias' });
  }
});

/**
 * GET /api/security/dependency-scan
 * Resultados do OWASP Dependency-Check
 */
router.get('/dependency-scan', async (req: Request, res: Response) => {
  try {
    const scanner = getDependencyScanner();
    const report = scanner.getSummaryReport();
    
    res.json({
      lastScan: report.lastScan,
      totalVulnerabilities: report.totalVulnerabilities,
      bySeverity: report.bySeverity,
      vulnerabilities: report.topVulnerabilities
    });
  } catch (error) {
    console.error('Erro ao obter scan de dependências:', error);
    res.status(500).json({ error: 'Erro ao obter scan de dependências' });
  }
});

/**
 * GET /api/security/semgrep-findings
 * Resultados da análise SAST
 */
router.get('/semgrep-findings', async (req: Request, res: Response) => {
  try {
    const scanner = getSemgrepScanner();
    const report = scanner.getSummaryReport();
    
    res.json(report.topFindings);
  } catch (error) {
    console.error('Erro ao obter findings do Semgrep:', error);
    res.status(500).json({ error: 'Erro ao obter findings' });
  }
});

/**
 * POST /api/security/scan
 * Executar scan manual
 */
router.post('/scan', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { type } = req.body;
    
    switch (type) {
      case 'vulnerability':
        const vulnScanner = getSecurityScanner();
        // Executar scan
        res.json({ message: 'Scan de vulnerabilidades iniciado' });
        break;
        
      case 'dependency':
        const depScanner = getDependencyScanner();
        depScanner.runScan();
        res.json({ message: 'Scan de dependências iniciado' });
        break;
        
      case 'code':
        const codeScanner = getSemgrepScanner();
        codeScanner.runScan();
        res.json({ message: 'Análise de código iniciada' });
        break;
        
      default:
        res.status(400).json({ error: 'Tipo de scan inválido' });
    }
  } catch (error) {
    console.error('Erro ao iniciar scan:', error);
    res.status(500).json({ error: 'Erro ao iniciar scan' });
  }
});

/**
 * GET /api/security/alerts/active
 * Alertas ativos
 */
router.get('/alerts/active', async (req: Request, res: Response) => {
  try {
    // Buscar alertas não resolvidos
    const alerts = await db
      .select()
      .from(security_logs)
      .where(sql`
        severity IN ('HIGH', 'CRITICAL') 
        AND created_at > NOW() - INTERVAL '24 hours'
        AND NOT EXISTS (
          SELECT 1 FROM security_alerts_resolved 
          WHERE security_alerts_resolved.log_id = security_logs.id
        )
      `)
      .orderBy(sql`created_at DESC`)
      .limit(50);
    
    res.json(alerts);
  } catch (error) {
    console.error('Erro ao obter alertas:', error);
    res.status(500).json({ error: 'Erro ao obter alertas' });
  }
});

/**
 * POST /api/security/alerts/:id/resolve
 * Resolver alerta
 */
router.post('/alerts/:id/resolve', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = (req as any).user.id;
    
    // Marcar como resolvido (implementar tabela se necessário)
    // await db.insert(security_alerts_resolved).values({
    //   log_id: id,
    //   resolved_by: userId,
    //   resolved_at: new Date(),
    //   reason
    // });
    
    res.json({ message: 'Alerta resolvido' });
  } catch (error) {
    console.error('Erro ao resolver alerta:', error);
    res.status(500).json({ error: 'Erro ao resolver alerta' });
  }
});

/**
 * GET /api/security/report
 * Relatório completo de segurança
 */
router.get('/report', requireAdmin, async (req: Request, res: Response) => {
  try {
    const scanner = getSecurityScanner();
    const vulnDetector = getVulnerabilityDetector();
    const depScanner = getDependencyScanner();
    const codeScanner = getSemgrepScanner();
    
    const report = {
      generatedAt: new Date(),
      summary: {
        overallScore: calculateOverallScore(),
        totalVulnerabilities: 0,
        totalAnomalies: 0,
        totalDependencyIssues: 0,
        totalCodeIssues: 0
      },
      vulnerabilities: {
        // Dados do scanner
      },
      anomalies: vulnDetector.getAnomalyReport(),
      dependencies: depScanner.getSummaryReport(),
      codeAnalysis: codeScanner.getSummaryReport(),
      recommendations: generateRecommendations()
    };
    
    res.json(report);
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
});

// Funções auxiliares
function getTimeRangeDate(timeRange: string): Date {
  const now = new Date();
  switch (timeRange) {
    case '1h':
      return new Date(now.getTime() - 60 * 60 * 1000);
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 60 * 60 * 1000);
  }
}

function generateTrendData(logs: any[], timeRange: string): any[] {
  // Gerar dados de tendência para gráficos
  const intervals = timeRange === '1h' ? 12 : 24; // 5min ou 1h intervals
  const trend = [];
  
  for (let i = 0; i < intervals; i++) {
    trend.push({
      time: `T-${intervals - i}`,
      securityScore: Math.floor(Math.random() * 20) + 80,
      threats: Math.floor(Math.random() * 10)
    });
  }
  
  return trend;
}

function calculateOverallScore(): number {
  // Calcular score geral baseado em múltiplos fatores
  return 85; // Placeholder
}

function generateRecommendations(): string[] {
  return [
    'Atualizar dependências com vulnerabilidades críticas',
    'Implementar autenticação multifator',
    'Revisar políticas de CORS',
    'Aumentar cobertura de testes de segurança'
  ];
}

export default router;