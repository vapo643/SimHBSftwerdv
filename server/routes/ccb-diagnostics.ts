/**
 * Rotas de Diagnóstico para CCB
 * Endpoints para testar e diagnosticar o mapeamento de coordenadas
 */

import { Router } from 'express';
import { 
    diagnoseAcroForms, 
    generateCoordinateGridPDF, 
    testCoordinateMapping 
} from '../utils/ccbDiagnostics.js';
import path from 'path';
import fs from 'fs/promises';

const router = Router();

/**
 * FASE 1: Verifica se o template tem AcroForms
 * GET /api/ccb-diagnostics/check-acroforms
 */
router.get('/check-acroforms', async (req, res) => {
    try {
        console.log('[CCB DIAGNOSTICS] Verificando AcroForms no template...');
        const result = await diagnoseAcroForms();
        
        res.json({
            success: true,
            hasAcroForms: result.hasAcroForms,
            fieldCount: result.fields.length,
            fields: result.fields,
            recommendation: result.hasAcroForms 
                ? '✅ Use os campos AcroForm! Não precisa mapear coordenadas manualmente.'
                : '❌ Sem AcroForms. Prossiga com mapeamento manual de coordenadas.',
        });
    } catch (error: any) {
        console.error('[CCB DIAGNOSTICS] Erro ao verificar AcroForms:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * FASE 2: Gera PDF com grade de coordenadas
 * GET /api/ccb-diagnostics/generate-grid
 */
router.get('/generate-grid', async (req, res) => {
    try {
        console.log('[CCB DIAGNOSTICS] Gerando PDF com grade de coordenadas...');
        const outputPath = await generateCoordinateGridPDF();
        
        // Ler o arquivo gerado
        const pdfBuffer = await fs.readFile(outputPath);
        
        // Enviar o PDF como resposta
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="template_ccb_DEBUG_GRID.pdf"');
        res.send(pdfBuffer);
        
    } catch (error: any) {
        console.error('[CCB DIAGNOSTICS] Erro ao gerar grade:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * FASE 3: Testa preenchimento com coordenadas
 * GET /api/ccb-diagnostics/test-fill
 */
router.get('/test-fill', async (req, res) => {
    try {
        console.log('[CCB DIAGNOSTICS] Testando preenchimento de campos...');
        const outputPath = await testCoordinateMapping();
        
        // Ler o arquivo gerado
        const pdfBuffer = await fs.readFile(outputPath);
        
        // Enviar o PDF como resposta
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="template_ccb_TEST_FILL.pdf"');
        res.send(pdfBuffer);
        
    } catch (error: any) {
        console.error('[CCB DIAGNOSTICS] Erro ao testar preenchimento:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Testa coordenadas específicas enviadas pelo frontend
 * POST /api/ccb-diagnostics/test-coordinates
 */
router.post('/test-coordinates', async (req, res) => {
    try {
        const { coordinates } = req.body;
        
        if (!coordinates || !Array.isArray(coordinates)) {
            return res.status(400).json({
                success: false,
                error: 'Envie um array de coordenadas para testar'
            });
        }
        
        console.log('[CCB DIAGNOSTICS] Testando coordenadas customizadas:', coordinates);
        
        // Implementar teste com coordenadas específicas
        // TODO: Criar função para testar coordenadas específicas
        
        res.json({
            success: true,
            message: 'Funcionalidade em desenvolvimento',
            receivedCoordinates: coordinates
        });
        
    } catch (error: any) {
        console.error('[CCB DIAGNOSTICS] Erro ao testar coordenadas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Retorna informações sobre o template
 * GET /api/ccb-diagnostics/template-info
 */
router.get('/template-info', async (req, res) => {
    try {
        const templatePath = path.resolve(process.cwd(), 'server/templates/template_ccb.pdf');
        const stats = await fs.stat(templatePath);
        
        // Importar PDFDocument para obter informações do PDF
        const { PDFDocument } = await import('pdf-lib');
        const templateBytes = await fs.readFile(templatePath);
        const pdfDoc = await PDFDocument.load(templateBytes);
        
        const pages = pdfDoc.getPages();
        const pageInfo = pages.map((page, index) => {
            const { width, height } = page.getSize();
            return {
                pageNumber: index + 1,
                width: width,
                height: height,
                widthInches: (width / 72).toFixed(2),
                heightInches: (height / 72).toFixed(2),
                format: width === 595.276 && height === 841.890 ? 'A4' : 'Custom'
            };
        });
        
        res.json({
            success: true,
            template: {
                path: templatePath,
                size: `${(stats.size / 1024).toFixed(2)} KB`,
                modified: stats.mtime,
                pageCount: pages.length,
                pages: pageInfo,
                recommendation: '📐 Use /api/ccb-diagnostics/generate-grid para visualizar a grade de coordenadas'
            }
        });
        
    } catch (error: any) {
        console.error('[CCB DIAGNOSTICS] Erro ao obter info do template:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;