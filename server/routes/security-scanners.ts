/**
 * Security Scanners API Routes
 * Endpoints for SCA (Dependency Check) and SAST (Semgrep) integration
 */

import { Router, Request, Response } from 'express';
import { promises as fs } from 'fs';
import { join } from 'path';
import { _jwtAuthMiddleware } from '../lib/jwt-auth-middleware';
import { AuthenticatedRequest } from '../../shared/types/express';

const _router = Router();

// Middleware for admin access
const __requireAdmin = (req: AuthenticatedRequest, res: unknown, next) => {
  if (req.user?.role !== 'ADMINISTRADOR') {
    return res.status(403).json({
      success: false,
      error: 'Acesso restrito a administradores',
    });
  }
  next();
};

// Apply authentication middleware
router.use(_jwtAuthMiddleware);

/**
 * GET /api/security-scanners/sca/latest
 * Get latest OWASP Dependency Check report
 */
router.get('/sca/latest', _requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    // Common paths where dependency-check reports might be stored
    const _reportPaths = [
      'dependency-check-report.json',
      '.security/dependency-check-report.json',
      'reports/dependency-check-report.json',
      'target/dependency-check-report.json',
    ];

    let _reportData = null;
    let _reportPath = null;

    // Try to find the report in common locations
    for (const path of reportPaths) {
      try {
        const _fullPath = join(process.cwd(), path);
        const _data = await fs.readFile(fullPath, 'utf-8');
        reportData = JSON.parse(_data);
        reportPath = path;
        break;
      } catch (e) {
        // Continue trying other paths
      }
    }

    if (!reportData) {
      // If no report found, return empty data structure
      return res.json({
        success: true,
        data: {
          reportFound: false,
          vulnerabilities: {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            total: 0,
          },
          lastScan: null,
          message: 'Nenhum relatório encontrado. Execute run-dependency-check.sh primeiro.',
        },
      });
    }

    // Parse vulnerability counts from report
    const _vulnerabilities = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total: 0,
    };

    // Process dependencies if they exist
    if (reportData.dependencies && Array.isArray(reportData.dependencies)) {
      reportData.dependencies.forEach((dep) => {
        if (dep.vulnerabilities && Array.isArray(dep.vulnerabilities)) {
          dep.vulnerabilities.forEach((vuln) => {
            vulnerabilities.total++;

            // Check CVSS score or severity
            if (vuln.cvssv3?.baseScore >= 9.0 || vuln.cvssv2?.score >= 9.0) {
              vulnerabilities.critical++;
            } else if (vuln.cvssv3?.baseScore >= 7.0 || vuln.cvssv2?.score >= 7.0) {
              vulnerabilities.high++;
            } else if (vuln.cvssv3?.baseScore >= 4.0 || vuln.cvssv2?.score >= 4.0) {
              vulnerabilities.medium++;
            } else {
              vulnerabilities.low++;
            }
          });
        }
      });
    }

    res.json({
      success: true,
      data: {
        reportFound: true,
        _vulnerabilities,
        lastScan: reportData.reportDate || new Date().toISOString(),
        projectInfo: reportData.projectInfo || {},
        _reportPath,
      },
    });
  } catch (error) {
    console.error('[SCA] Error reading dependency check report:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao ler relatório de dependências',
    });
  }
});

/**
 * POST /api/security-scanners/sca/run
 * Trigger new dependency check scan
 */
router.post('/sca/run', _requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    // Check if script exists first
    const _scriptPath = join(process.cwd(), '.security/run-dependency-check.sh');

    try {
      await fs.access(scriptPath);
    } catch (e) {
      return res.status(500).json({
        success: false,
        error: 'Script de análise não encontrado',
      });
    }

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const _execAsync = promisify(exec);

    // Send immediate response
    res.json({
      success: true,
      message: 'Análise de dependências iniciada. Verifique novamente em alguns segundos.',
    });

    // Run analysis in background
    execAsync('bash .security/run-dependency-check.sh', {
      cwd: process.cwd(),
    })
      .then(({ stdout, stderr }) => {
        console.log('[SCA] Analysis completed:', stdout);
        if (stderr) console.error('[SCA] Warnings:', stderr);
      })
      .catch((error) => {
        console.error('[SCA] Analysis failed:', error);
      });
  } catch (error) {
    console.error('[SCA] Error running dependency check:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao executar análise de dependências',
    });
  }
});

export default router;
