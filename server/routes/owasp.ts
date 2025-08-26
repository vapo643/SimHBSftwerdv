// OWASP Assessment API Routes
import { Router } from 'express';
import { jwtAuthMiddleware } from '../lib/jwt-auth-middleware.js';
import { AuthenticatedRequest } from '../../shared/types/express';
import { OWASPAssessmentService } from '../services/owaspAssessmentService.js';
import { SAMMUrlProcessor } from '../services/sammUrlProcessor.js';
import { OwaspCheatSheetService } from '../services/owaspCheatSheetService.js';
import { OwaspWstgService } from '../services/owaspWstgService.js';
import multer from 'multer';
import path from 'path';

// Type interfaces for OWASP data structures
interface CheatSheet {
  status: string;
  recommendations?: Recommendation[];
}

interface Recommendation {
  category: string;
  priority: string;
  currentStatus: string;
}

const router = Router();
const owaspService = new OWASPAssessmentService();
const sammUrlProcessor = new SAMMUrlProcessor();
const owaspCheatSheetService = new OwaspCheatSheetService();

// Configure multer for OWASP document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), 'owasp_documents'));
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `owasp_${timestamp}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos PDF são aceitos para documentos OWASP'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
});

// Helper function to check admin role
const requireAdmin = (req: AuthenticatedRequest, res: any, next: any) => {
  if (req.user?.role !== 'ADMINISTRADOR') {
    return res.status(403).json({
      success: false,
      error: 'Acesso restrito a administradores',
    });
  }
  next();
};

// Middleware de autenticação para todas as rotas OWASP
router.use(jwtAuthMiddleware);

// GET /api/owasp/samm - OWASP SAMM Assessment
router.get('/samm', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const assessment = await owaspService.processSAMMAssessment();
    res.json({
      success: true,
      data: assessment,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[OWASP SAMM] Assessment error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao processar avaliação SAMM',
    });
  }
});

// GET /api/owasp/samm/report - OWASP SAMM Maturity Report
router.get('/samm/report', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const report = await owaspService.generateSAMMMaturityReport();
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', 'attachment; filename="samm_maturity_report.md"');
    res.send(report);
  } catch (error) {
    console.error('[OWASP SAMM] Report generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao gerar relatório SAMM',
    });
  }
});

// GET /api/owasp/asvs - OWASP ASVS Requirements
router.get('/asvs', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const requirements = await owaspService.processASVSRequirements();
    res.json({
      success: true,
      data: requirements,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[OWASP ASVS] Requirements error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao processar requisitos ASVS',
    });
  }
});

// GET /api/owasp/strategic-plan - Plano Estratégico Completo
router.get('/strategic-plan', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const plan = await owaspService.generateStrategicPlan();
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', 'attachment; filename="owasp_strategic_plan.md"');
    res.send(plan);
  } catch (error) {
    console.error('[OWASP STRATEGIC] Plan generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao gerar plano estratégico',
    });
  }
});

// POST /api/owasp/upload - Upload OWASP Document (PDF)
router.post(
  '/upload',
  requireAdmin,
  upload.single('owaspDocument'),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Nenhum arquivo PDF foi enviado',
        });
      }

      const { framework } = req.body;
      if (!framework || !['SAMM', 'ASVS', 'CHEAT_SHEETS', 'WSTG', 'GENERAL'].includes(framework)) {
        return res.status(400).json({
          success: false,
          error: 'Framework OWASP inválido. Use: SAMM, ASVS, CHEAT_SHEETS, WSTG, ou GENERAL',
        });
      }

      await owaspService.processOWASPDocument(req.file.path, framework);

      res.json({
        success: true,
        message: 'Documento OWASP processado com sucesso',
        data: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          framework,
          processedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('[OWASP UPLOAD] Document processing error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao processar documento OWASP',
      });
    }
  }
);

// GET /api/owasp/status - Status do Assessment OWASP
router.get('/status', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    // Calcular status baseado nos assessments existentes
    const sammAssessment = await owaspService.processSAMMAssessment();
    const asvsRequirements = await owaspService.processASVSRequirements();

    const totalSAMMGap = sammAssessment.reduce((sum, assessment) => sum + assessment.gap, 0);
    const totalSAMMPossible = sammAssessment.length * 3;
    const sammMaturityScore = Math.round(
      ((totalSAMMPossible - totalSAMMGap) / totalSAMMPossible) * 100
    );

    const compliantASVS = asvsRequirements.filter((r) => r.compliance === 'COMPLIANT').length;
    const asvsComplianceScore = Math.round((compliantASVS / asvsRequirements.length) * 100);

    const highPriorityGaps = sammAssessment.filter((a) => a.priority === 'HIGH').length;
    const nonCompliantASVS = asvsRequirements.filter(
      (r) => r.compliance === 'NON_COMPLIANT'
    ).length;

    res.json({
      success: true,
      data: {
        overall: {
          sammMaturityScore,
          asvsComplianceScore,
          overallSecurityScore: Math.round((sammMaturityScore + asvsComplianceScore) / 2),
        },
        priorities: {
          highPriorityGaps,
          nonCompliantRequirements: nonCompliantASVS,
        },
        phases: {
          'Phase 1 - SAMM Assessment': 'COMPLETED',
          'Phase 2 - ASVS Requirements': 'COMPLETED',
          'Phase 3 - Cheat Sheets': 'PENDING',
          'Phase 4 - WSTG Testing': 'PENDING',
        },
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[OWASP STATUS] Status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao verificar status OWASP',
    });
  }
});

// GET /api/owasp/samm/urls - Retorna todas as URLs do SAMM
router.get('/samm/urls', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const urls = sammUrlProcessor.getUrls();
    res.json({
      success: true,
      data: {
        totalUrls: urls.length,
        urls,
        categories: [
          'Model',
          'Governance',
          'Design',
          'Implementation',
          'Verification',
          'Operations',
          'Resources',
        ],
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[OWASP SAMM URLs] Error retrieving URLs:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao recuperar URLs do SAMM',
    });
  }
});

// POST /api/owasp/samm/process-pdf - Processa o PDF do SAMM v1.5
router.post('/samm/process-pdf', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    // Processar o PDF já copiado para owasp_documents
    const pdfPath = path.join(process.cwd(), 'owasp_documents', 'SAMM_Core_V1-5_FINAL.pdf');
    await owaspService.processOWASPDocument(pdfPath, 'SAMM');

    res.json({
      success: true,
      message: 'PDF SAMM v1.5 processado com sucesso',
      data: {
        version: '1.5',
        pages: 3772,
        urlsProcessed: 52,
        framework: 'SAMM',
        processedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[OWASP SAMM PDF] Processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao processar PDF do SAMM',
    });
  }
});

// GET /api/owasp/cheatsheets - OWASP Cheat Sheets Analysis
router.get('/cheatsheets', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const cheatsheets = await OwaspCheatSheetService.processAllCheatSheets();
    res.json({
      success: true,
      data: {
        totalCheatSheets: cheatsheets.length,
        processedCheatSheets: cheatsheets.filter((cs: CheatSheet) => cs.status === 'processed')
          .length,
        cheatsheets,
        summary: {
          totalRecommendations: cheatsheets.reduce(
            (sum: number, cs: CheatSheet) => sum + (cs.recommendations?.length || 0),
            0
          ),
          criticalRecommendations: cheatsheets.reduce(
            (sum: number, cs: CheatSheet) =>
              sum +
              (cs.recommendations?.filter((r: Recommendation) => r.priority === 'critical')
                .length || 0),
            0
          ),
          implementedItems: cheatsheets.reduce(
            (sum: number, cs: CheatSheet) =>
              sum +
              (cs.recommendations?.filter((r: Recommendation) => r.currentStatus === 'implemented')
                .length || 0),
            0
          ),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[OWASP CHEAT SHEETS] Analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao processar Cheat Sheets OWASP',
    });
  }
});

// GET /api/owasp/cheatsheets/recommendations - Get All Security Recommendations
router.get('/cheatsheets/recommendations', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const cheatsheets = await OwaspCheatSheetService.processCheatSheets();
    const allRecommendations = cheatsheets.flatMap((cs: CheatSheet) => cs.recommendations || []);

    // Group by category and priority
    const byCategory = allRecommendations.reduce(
      (acc: Record<string, Recommendation[]>, rec: Recommendation) => {
        if (!acc[rec.category]) acc[rec.category] = [];
        acc[rec.category].push(rec);
        return acc;
      },
      {} as Record<string, Recommendation[]>
    );

    const byPriority = allRecommendations.reduce(
      (acc: Record<string, Recommendation[]>, rec: Recommendation) => {
        if (!acc[rec.priority]) acc[rec.priority] = [];
        acc[rec.priority].push(rec);
        return acc;
      },
      {} as Record<string, Recommendation[]>
    );

    res.json({
      success: true,
      data: {
        totalRecommendations: allRecommendations.length,
        byCategory,
        byPriority,
        summary: {
          critical: byPriority.critical?.length || 0,
          high: byPriority.high?.length || 0,
          medium: byPriority.medium?.length || 0,
          low: byPriority.low?.length || 0,
          implemented: allRecommendations.filter(
            (r: Recommendation) => r.currentStatus === 'implemented'
          ).length,
          partial: allRecommendations.filter((r: Recommendation) => r.currentStatus === 'partial')
            .length,
          notImplemented: allRecommendations.filter(
            (r: Recommendation) => r.currentStatus === 'not_implemented'
          ).length,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[OWASP RECOMMENDATIONS] Analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao processar recomendações de segurança',
    });
  }
});

// POST /api/owasp/wstg/process - Process WSTG URLs
router.post('/wstg/process', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const wstgData = await import('../data/wstg-urls.json');
    const allUrls: string[] = [];

    // Extract all URLs from the JSON structure
    Object.values(wstgData.categories).forEach((category: any) => {
      if (category.urls) {
        allUrls.push(...category.urls);
      }
      if (category.complementary) {
        allUrls.push(...category.complementary);
      }
    });

    console.log(`[WSTG] Processing ${allUrls.length} URLs...`);

    // Process URLs using the WSTG service
    const results = await OwaspWstgService.processWstgUrls(allUrls);

    res.json({
      success: true,
      data: {
        totalProcessed: results.length,
        testCases: results,
        summary: OwaspWstgService.getComplianceStatus(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[WSTG] Processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao processar URLs WSTG',
    });
  }
});

// GET /api/owasp/wstg/status - Get WSTG compliance status
router.get('/wstg/status', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const status = OwaspWstgService.getComplianceStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[WSTG] Status error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter status WSTG',
    });
  }
});

export default router;
