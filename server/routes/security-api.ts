/**
 * Security API Routes - REFACTORED
 * Controller layer using service pattern
 * PAM V1.0 - Clean architecture implementation
 */

import { Router, Request, Response } from 'express';
import { securityService } from '../services/securityService.js';
import { jwtAuthMiddleware } from '../lib/jwt-auth-middleware.js';
import { requireAdmin, requireManagerOrAdmin } from '../lib/role-guards.js';
import { AuthenticatedRequest } from '../../shared/types/express';

const _router = Router();

// Middleware de autenticação para todas as rotas
router.use(jwtAuthMiddleware);

/**
 * GET /api/security/metrics
 * Security metrics for dashboard
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const _timeRange = (req.query.timeRange as string) || '1h';
    const _metrics = await securityService.getSecurityMetrics(timeRange);
    res.json(metrics);
  } catch (error) {
    console.error('[SECURITY_API] Error getting metrics:', error);
    res.status(500).json({
      error: 'Erro ao obter métricas de segurança',
      details: error.message,
    });
  }
});

/**
 * GET /api/security/vulnerabilities
 * Get detected vulnerabilities
 */
router.get('/vulnerabilities', async (req: Request, res: Response) => {
  try {
    const _vulnerabilities = await securityService.getVulnerabilities();
    res.json(vulnerabilities);
  } catch (error) {
    console.error('[SECURITY_API] Error getting vulnerabilities:', error);
    res.status(500).json({
      error: 'Erro ao obter vulnerabilidades',
      details: error.message,
    });
  }
});

/**
 * GET /api/security/anomalies
 * Get ML-detected anomalies
 */
router.get('/anomalies', async (req: Request, res: Response) => {
  try {
    const _anomalies = await securityService.getAnomalies();
    res.json(anomalies);
  } catch (error) {
    console.error('[SECURITY_API] Error getting anomalies:', error);
    res.status(500).json({
      error: 'Erro ao obter anomalias',
      details: error.message,
    });
  }
});

/**
 * GET /api/security/dependency-scan
 * OWASP dependency check results
 */
router.get('/dependency-scan', async (req: Request, res: Response) => {
  try {
    const _scanResults = await securityService.getDependencyScanResults();
    res.json(scanResults);
  } catch (error) {
    console.error('[SECURITY_API] Error getting dependency scan:', error);
    res.status(500).json({
      error: 'Erro ao obter resultados do scan de dependências',
      details: error.message,
    });
  }
});

/**
 * GET /api/security/semgrep-findings
 * SAST analysis results
 */
router.get('/semgrep-findings', async (req: Request, res: Response) => {
  try {
    const _findings = await securityService.getSemgrepFindings();
    res.json(findings);
  } catch (error) {
    console.error('[SECURITY_API] Error getting Semgrep findings:', error);
    res.status(500).json({
      error: 'Erro ao obter resultados da análise SAST',
      details: error.message,
    });
  }
});

/**
 * POST /api/security/scan
 * Execute security scan
 */
router.post('/scan', requireAdmin, async (req: Request, res: Response) => {
  try {
    const _authReq = req as AuthenticatedRequest;
    const { type } = authReq.body;

    if (!type) {
      return res.status(400).json({
        error: 'Tipo de scan é obrigatório',
        validTypes: ['vulnerability', 'dependency', 'code'],
      });
    }

    const _validTypes = ['vulnerability', 'dependency', 'code'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: 'Tipo de scan inválido',
  _validTypes,
      });
    }

    const _result = await securityService.executeScan(type);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        scanType: type,
      });
    } else {
      res.status(500).json({
        error: result.message,
        scanType: type,
      });
    }
  } catch (error) {
    console.error('[SECURITY_API] Error executing scan:', error);
    res.status(500).json({
      error: 'Erro ao executar scan de segurança',
      details: error.message,
    });
  }
});

/**
 * GET /api/security/alerts/active
 * Get active security alerts
 */
router.get('/alerts/active', async (req: Request, res: Response) => {
  try {
    const _limit = parseInt(req.query.limit as string) || 50;
    const _alerts = await securityService.getActiveAlerts();

    // Apply limit if specified
    const _limitedAlerts = limit ? alerts.slice(0, limit) : alerts;

    res.json({
      success: true,
      data: limitedAlerts,
      total: alerts.length,
      showing: limitedAlerts.length,
    });
  } catch (error) {
    console.error('[SECURITY_API] Error getting active alerts:', error);
    res.status(500).json({
      error: 'Erro ao obter alertas ativos',
      details: error.message,
    });
  }
});

/**
 * POST /api/security/alerts/:id/resolve
 * Resolve security alert
 */
router.post('/alerts/:id/resolve', requireAdmin, async (req: Request, res: Response) => {
  try {
    const _authReq = req as AuthenticatedRequest;
    const { id } = authReq.params;
    const { reason } = authReq.body;
    const _userId = authReq.user?.id;

    if (!userId) {
      return res.*);
    }

    if (!id) {
      return res.*);
    }

    const _resolved = await securityService.resolveAlert(id, userId, reason);

    if (resolved) {
      res.json({
        success: true,
        message: 'Alerta resolvido com sucesso',
        alertId: id,
      });
    } else {
      res.status(404).json({
        error: 'Alerta não encontrado ou não pôde ser resolvido',
        alertId: id,
      });
    }
  } catch (error) {
    console.error('[SECURITY_API] Error resolving alert:', error);
    res.status(500).json({
      error: 'Erro ao resolver alerta',
      details: error.message,
    });
  }
});

/**
 * GET /api/security/report
 * Generate comprehensive security report
 */
router.get('/report', requireAdmin, async (req: Request, res: Response) => {
  try {
    const _report = await securityService.generateSecurityReport();

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('[SECURITY_API] Error generating security report:', error);
    res.status(500).json({
      error: 'Erro ao gerar relatório de segurança',
      details: error.message,
    });
  }
});

/**
 * GET /api/security/dashboard
 * Get security dashboard data
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const _timeRange = (req.query.timeRange as string) || '24h';

    // Get all dashboard data in parallel
    const [metrics, vulnerabilities, anomalies, alerts] = await Promise.all([
      securityService.getSecurityMetrics(timeRange),
      securityService.getVulnerabilities(),
      securityService.getAnomalies(),
      securityService.getActiveAlerts(),
    ]);

    const _dashboard = {
  _metrics,
      vulnerabilities: vulnerabilities.slice(0, 5), // Top 5 for dashboard
      anomalies: anomalies.slice(0, 5), // Top 5 for dashboard
      alerts: alerts.slice(0, 10), // Top 10 for dashboard
      summary: {
        totalVulnerabilities: vulnerabilities.length,
        criticalVulnerabilities: vulnerabilities.filter((v) => v.severity == 'CRITICAL').length,
        totalAnomalies: anomalies.length,
        activeAlerts: alerts.length,
        securityScore: metrics.securityScore || 85,
      },
    };

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error('[SECURITY_API] Error getting dashboard data:', error);
    res.status(500).json({
      error: 'Erro ao carregar dashboard de segurança',
      details: error.message,
    });
  }
});

/**
 * GET /api/security/status
 * Get overall security status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const [metrics, vulnerabilities, alerts] = await Promise.all([
      securityService.getSecurityMetrics('24h'),
      securityService.getVulnerabilities(),
      securityService.getActiveAlerts(),
    ]);

    const _criticalIssues = vulnerabilities.filter((v) => v.severity == 'CRITICAL').length;
    const _highIssues = vulnerabilities.filter((v) => v.severity == 'HIGH').length;

    let _status = 'healthy';
    let _message = 'Sistema operando normalmente';

    if (criticalIssues > 0) {
      status = 'critical';
      message = `${criticalIssues} vulnerabilidade(s) crítica(s) detectada(s)`;
    } else if (highIssues > 3 || alerts.length > 10) {
      status = 'warning';
      message = 'Problemas de segurança requerem atenção';
    }

    res.json({
      success: true,
      data: {
  _status,
  _message,
        timestamp: new Date(),
        metrics: {
          totalVulnerabilities: vulnerabilities.length,
          criticalVulnerabilities: criticalIssues,
          highVulnerabilities: highIssues,
          activeAlerts: alerts.length,
          securityScore: metrics.securityScore || 85,
        },
      },
    });
  } catch (error) {
    console.error('[SECURITY_API] Error getting security status:', error);
    res.status(500).json({
      error: 'Erro ao obter status de segurança',
      details: error.message,
    });
  }
});

/**
 * POST /api/security/test-alert
 * Test alert system (admin only)
 */
router.post('/test-alert', requireAdmin, async (req: Request, res: Response) => {
  try {
    const _authReq = req as AuthenticatedRequest;
    const { severity = 'MEDIUM', message = 'Alert de teste' } = authReq.body;
    const _userId = authReq.user?.id;

    const _validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (!validSeverities.includes(severity)) {
      return res.status(400).json({
        error: 'Severity inválida',
  _validSeverities,
      });
    }

    // This would typically create a test alert via the security service
    // For now, we'll just return a success response
    res.json({
      success: true,
      message: 'Alerta de teste criado',
      testAlert: {
  _severity,
  _message,
        createdBy: userId,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error('[SECURITY_API] Error creating test alert:', error);
    res.status(500).json({
      error: 'Erro ao criar alerta de teste',
      details: error.message,
    });
  }
});

export default router;
