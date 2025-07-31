/**
 * Security Scanners API Routes
 * Endpoints for SCA (Dependency Check) and SAST (Semgrep) integration
 */

import { Router, Request, Response } from 'express'
import { promises as fs } from 'fs'
import { join } from 'path'
import { jwtAuthMiddleware } from '../lib/jwt-auth-middleware'

interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
    role: string
  }
}

const router = Router()

// Middleware for admin access
const requireAdmin = (req: AuthenticatedRequest, res: any, next: any) => {
  if (req.user?.role !== 'ADMINISTRADOR') {
    return res.status(403).json({
      success: false,
      error: 'Acesso restrito a administradores'
    })
  }
  next()
}

// Apply authentication middleware
router.use(jwtAuthMiddleware)

/**
 * GET /api/security-scanners/sca/latest
 * Get latest OWASP Dependency Check report
 */
router.get('/sca/latest', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    // Common paths where dependency-check reports might be stored
    const reportPaths = [
      'dependency-check-report.json',
      '.security/dependency-check-report.json',
      'reports/dependency-check-report.json',
      'target/dependency-check-report.json'
    ]
    
    let reportData = null
    let reportPath = null
    
    // Try to find the report in common locations
    for (const path of reportPaths) {
      try {
        const fullPath = join(process.cwd(), path)
        const data = await fs.readFile(fullPath, 'utf-8')
        reportData = JSON.parse(data)
        reportPath = path
        break
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
            total: 0
          },
          lastScan: null,
          message: 'Nenhum relatório encontrado. Execute run-dependency-check.sh primeiro.'
        }
      })
    }
    
    // Parse vulnerability counts from report
    const vulnerabilities = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total: 0
    }
    
    // Process dependencies if they exist
    if (reportData.dependencies && Array.isArray(reportData.dependencies)) {
      reportData.dependencies.forEach((dep: any) => {
        if (dep.vulnerabilities && Array.isArray(dep.vulnerabilities)) {
          dep.vulnerabilities.forEach((vuln: any) => {
            vulnerabilities.total++
            
            // Check CVSS score or severity
            if (vuln.cvssv3?.baseScore >= 9.0 || vuln.cvssv2?.score >= 9.0) {
              vulnerabilities.critical++
            } else if (vuln.cvssv3?.baseScore >= 7.0 || vuln.cvssv2?.score >= 7.0) {
              vulnerabilities.high++
            } else if (vuln.cvssv3?.baseScore >= 4.0 || vuln.cvssv2?.score >= 4.0) {
              vulnerabilities.medium++
            } else {
              vulnerabilities.low++
            }
          })
        }
      })
    }
    
    res.json({
      success: true,
      data: {
        reportFound: true,
        vulnerabilities,
        lastScan: reportData.reportDate || new Date().toISOString(),
        projectInfo: reportData.projectInfo || {},
        reportPath
      }
    })
    
  } catch (error) {
    console.error('[SCA] Error reading dependency check report:', error)
    res.status(500).json({
      success: false,
      error: 'Erro ao ler relatório de dependências'
    })
  }
})

/**
 * POST /api/security-scanners/sca/run
 * Trigger new dependency check scan
 */
router.post('/sca/run', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { spawn } = await import('child_process')
    
    // Run dependency check script
    const script = spawn('bash', ['.security/run-dependency-check.sh'], {
      cwd: process.cwd()
    })
    
    let output = ''
    let error = ''
    
    script.stdout.on('data', (data) => {
      output += data.toString()
    })
    
    script.stderr.on('data', (data) => {
      error += data.toString()
    })
    
    script.on('close', (code) => {
      if (code === 0) {
        res.json({
          success: true,
          message: 'Análise de dependências iniciada com sucesso',
          output
        })
      } else {
        res.status(500).json({
          success: false,
          error: `Script falhou com código ${code}: ${error}`
        })
      }
    })
    
  } catch (error) {
    console.error('[SCA] Error running dependency check:', error)
    res.status(500).json({
      success: false,
      error: 'Erro ao executar análise de dependências'
    })
  }
})

export default router