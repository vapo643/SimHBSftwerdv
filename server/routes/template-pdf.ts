/**
 * Template PDF Routes
 * Serves the CCB template PDF for visual mapping
 */

import { Router } from 'express';
import { jwtAuthMiddleware } from '../lib/jwt-auth-middleware';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

// Protect all routes
router.use(jwtAuthMiddleware);

/**
 * Serve the CCB template PDF for visual mapping
 */
router.get('/ccb-template.pdf', async (req, res) => {
  try {
    const templatePath = path.resolve(process.cwd(), 'server/templates/template_ccb.pdf');
    
    // Check if template exists
    await fs.access(templatePath);
    
    // Set appropriate headers
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="template_ccb.pdf"',
      'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    });

    // Send the file
    res.sendFile(templatePath);
    
    console.log('📄 [TEMPLATE PDF] Template CCB served for visual mapping');

  } catch (error) {
    console.error('❌ [TEMPLATE PDF] Error serving template:', error);
    res.status(404).json({ error: 'Template PDF not found' });
  }
});

/**
 * Get template info (dimensions, pages, etc.)
 */
router.get('/template-info', async (req, res) => {
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

export default router;