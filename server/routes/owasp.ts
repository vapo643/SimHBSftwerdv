// OWASP Assessment API Routes
import { Router } from 'express';
import { jwtAuthMiddleware, AuthenticatedRequest } from '../lib/jwt-auth-middleware.js';
import { OWASPAssessmentService } from '../services/owaspAssessmentService.js';
import multer from 'multer';
import path from 'path';

const router = Router();
const owaspService = new OWASPAssessmentService();

// Configure multer for OWASP document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), 'owasp_documents'));
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `owasp_${timestamp}${ext}`);
  }
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
    fileSize: 50 * 1024 * 1024 // 50MB max
  }
});

// Helper function to check admin role
const requireAdmin = (req: AuthenticatedRequest, res: any, next: any) => {
  if (req.user?.role !== 'ADMINISTRADOR') {
    return res.status(403).json({
      success: false,
      error: 'Acesso restrito a administradores'
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
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[OWASP SAMM] Assessment error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao processar avaliação SAMM'
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
      error: 'Erro ao gerar relatório SAMM'
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
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[OWASP ASVS] Requirements error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao processar requisitos ASVS'
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
      error: 'Erro ao gerar plano estratégico'
    });
  }
});

// POST /api/owasp/upload - Upload OWASP Document (PDF)
router.post('/upload', requireAdmin, upload.single('owaspDocument'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo PDF foi enviado'
      });
    }

    const { framework } = req.body;
    if (!framework || !['SAMM', 'ASVS', 'CHEAT_SHEETS', 'WSTG', 'GENERAL'].includes(framework)) {
      return res.status(400).json({
        success: false,
        error: 'Framework OWASP inválido. Use: SAMM, ASVS, CHEAT_SHEETS, WSTG, ou GENERAL'
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
        processedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[OWASP UPLOAD] Document processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao processar documento OWASP'
    });
  }
});

// GET /api/owasp/status - Status do Assessment OWASP
router.get('/status', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    // Calcular status baseado nos assessments existentes
    const sammAssessment = await owaspService.processSAMMAssessment();
    const asvsRequirements = await owaspService.processASVSRequirements();
    
    const totalSAMMGap = sammAssessment.reduce((sum, assessment) => sum + assessment.gap, 0);
    const totalSAMMPossible = sammAssessment.length * 3;
    const sammMaturityScore = Math.round(((totalSAMMPossible - totalSAMMGap) / totalSAMMPossible) * 100);
    
    const compliantASVS = asvsRequirements.filter(r => r.compliance === 'COMPLIANT').length;
    const asvsComplianceScore = Math.round((compliantASVS / asvsRequirements.length) * 100);
    
    const highPriorityGaps = sammAssessment.filter(a => a.priority === 'HIGH').length;
    const nonCompliantASVS = asvsRequirements.filter(r => r.compliance === 'NON_COMPLIANT').length;
    
    res.json({
      success: true,
      data: {
        overall: {
          sammMaturityScore,
          asvsComplianceScore,
          overallSecurityScore: Math.round((sammMaturityScore + asvsComplianceScore) / 2)
        },
        priorities: {
          highPriorityGaps,
          nonCompliantRequirements: nonCompliantASVS
        },
        phases: {
          'Phase 1 - SAMM Assessment': 'COMPLETED',
          'Phase 2 - ASVS Requirements': 'COMPLETED',
          'Phase 3 - Cheat Sheets': 'PENDING',
          'Phase 4 - WSTG Testing': 'PENDING'
        },
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[OWASP STATUS] Status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao verificar status OWASP'
    });
  }
});

export default router;