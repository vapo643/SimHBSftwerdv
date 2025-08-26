/**
 * Projeto Cérbero - Semgrep MCP API Routes
 * Endpoints RESTful para análise de segurança em tempo real
 */

import { Router, Request, Response } from 'express';
import { semgrepMCPServer } from '../security/semgrep-mcp-server';
import { jwtAuthMiddleware } from '../lib/jwt-auth-middleware';

const router = Router();

// Test endpoint for validation (no auth required)
router.get('/test-validation', async (req, res) => {
  try {
    // Test basic functionality by scanning a simple file
    const testResult = await semgrepMCPServer.scanFile('package.json', { force_refresh: true });

    res.json({
      success: true,
      message: 'Projeto Cérbero - Validation Test Successful',
      timestamp: new Date().toISOString(),
      test_scan: {
        findings_count: testResult.findings.length,
        scan_duration_ms: testResult.metadata.scan_duration_ms,
      },
      version: '2.0',
      phase: '1&2 Complete',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Aplicar autenticação em todas as outras rotas
router.use(jwtAuthMiddleware);

/**
 * GET /api/security/mcp/scan/*
 * Analisa arquivo específico
 */
router.get('/scan/*', async (req: Request, res: Response) => {
  try {
    const filePath = req.params[0]; // Captura o path completo após /scan/
    const options = {
      force_refresh: req.query.refresh === 'true',
      severity_filter: req.query.severity ? [req.query.severity as string] : undefined,
    };

    console.log(`[MCP API] Scan request for: ${filePath}`);

    const result = await semgrepMCPServer.scanFile(filePath, options);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      file: filePath,
      analysis: result,
    });
  } catch (error: any) {
    console.error('[MCP API] Scan error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/security/mcp/analyze
 * Análise de snippet em tempo real
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { code, context } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Code snippet is required',
      });
    }

    console.log(`[MCP API] Analyzing code snippet (${code.length} chars)`);

    const result = await semgrepMCPServer.analyzeSnippet(code, context || {});

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      analysis: result,
    });
  } catch (error: any) {
    console.error('[MCP API] Analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/security/mcp/context/:component
 * Contexto de segurança por componente
 */
router.get('/context/:component', async (req: Request, res: Response) => {
  try {
    const component = req.params.component;

    console.log(`[MCP API] Getting context for component: ${component}`);

    const context = await semgrepMCPServer.getComponentContext(component);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      context,
    });
  } catch (error: any) {
    console.error('[MCP API] Context error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/security/mcp/history/*
 * Histórico de análises
 */
router.get('/history/*', async (req: Request, res: Response) => {
  try {
    const filePath = req.params[0];
    const days = parseInt(req.query.days as string) || 30;

    console.log(`[MCP API] Getting history for: ${filePath} (${days} days)`);

    const history = await semgrepMCPServer.getFileHistory(filePath, days);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      history,
    });
  } catch (error: any) {
    console.error('[MCP API] History error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/security/mcp/rules
 * Lista regras ativas do Semgrep
 */
router.get('/rules', async (req: Request, res: Response) => {
  try {
    console.log('[MCP API] Getting active rules');

    const rules = await semgrepMCPServer.getActiveRules();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      rules: {
        total: rules.length,
        by_severity: rules.reduce((acc: any, rule: any) => {
          acc[rule.severity || 'unknown'] = (acc[rule.severity || 'unknown'] || 0) + 1;
          return acc;
        }, {}),
        by_category: rules.reduce((acc: any, rule: any) => {
          acc[rule.category || 'unknown'] = (acc[rule.category || 'unknown'] || 0) + 1;
          return acc;
        }, {}),
        list: rules,
      },
    });
  } catch (error: any) {
    console.error('[MCP API] Rules error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/security/mcp/health
 * Health check do servidor MCP
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    status: 'healthy',
    service: 'Semgrep MCP Server',
    version: '1.0.0',
  });
});

export default router;
