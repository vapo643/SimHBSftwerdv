/**
 * Template PDF Routes
 * Serves the CCB template PDF for visual mapping
 */

import { Router } from 'express';
import { jwtAuthMiddleware } from '../lib/jwt-auth-middleware';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

// Template info requires auth
router.get('/template-info', jwtAuthMiddleware, async (req, res) => {
  try {
    const templatePath = path.resolve(process.cwd(), 'server/templates/template_ccb.pdf');
    
    // Check if template exists
    await fs.access(templatePath);
    const stats = await fs.stat(templatePath);
    
    res.json({
      exists: true,
      size: stats.size,
      path: '/api/template/ccb-template.pdf',
      pages: 8, // CCB template has 8 pages
      dimensions: {
        width: 595.5,
        height: 842.25
      }
    });

  } catch (error) {
    res.json({
      exists: false,
      error: 'Template not found'
    });
  }
});

/**
 * Test endpoint to verify PDF accessibility (no auth needed for testing)
 */
router.get('/test', async (req, res) => {
  try {
    const templatePath = path.resolve(process.cwd(), 'server/templates/template_ccb.pdf');
    const exists = await fs.access(templatePath).then(() => true).catch(() => false);
    const stats = exists ? await fs.stat(templatePath) : null;
    
    res.json({
      message: 'Template PDF test - OK',
      templatePath,
      exists,
      size: stats?.size || 0,
      pdfUrl: '/api/template/ccb-template.pdf',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Serve the CCB template PDF for visual mapping (no auth for iframe compatibility)
 */
router.get('/ccb-template.pdf', async (req, res) => {
  try {
    const templatePath = path.resolve(process.cwd(), 'server/templates/template_ccb.pdf');
    
    console.log('📄 [TEMPLATE PDF] Request for template:', {
      path: templatePath,
      exists: await fs.access(templatePath).then(() => true).catch(() => false)
    });
    
    // Check if template exists
    await fs.access(templatePath);
    
    // Set appropriate headers for PDF viewing
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="template_ccb.pdf"',
      'Cache-Control': 'public, max-age=3600',
      'X-Frame-Options': 'SAMEORIGIN', // Allow iframe from same origin
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type'
    });

    // Send the file
    res.sendFile(templatePath);
    
    console.log('✅ [TEMPLATE PDF] Template CCB served successfully for visual mapping');

  } catch (error) {
    console.error('❌ [TEMPLATE PDF] Error serving template:', error);
    res.status(404).json({ error: 'Template PDF not found', path: path.resolve(process.cwd(), 'server/templates/template_ccb.pdf') });
  }
});



export default router;