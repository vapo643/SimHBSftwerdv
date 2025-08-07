/**
 * Field Positioner API Routes
 * Handles saving and retrieving field positioning data
 */

import { Router } from 'express';
import { jwtAuthMiddleware } from '../lib/jwt-auth-middleware';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

// Protect all routes
router.use(jwtAuthMiddleware);

/**
 * Save field positions to ccbCoordinates.ts file
 */
router.post('/save-positions', async (req, res) => {
  try {
    const { positions } = req.body;
    
    if (!positions || !Array.isArray(positions)) {
      return res.status(400).json({ error: 'Positions array is required' });
    }

    console.log(`💾 [FIELD POSITIONER] Saving ${positions.length} field positions`);

    // Group positions by page
    const grouped = positions.reduce((acc: any, field: any) => {
      const pageKey = `page${field.page}`;
      if (!acc[pageKey]) acc[pageKey] = {};
      
      acc[pageKey][field.name] = {
        x: Math.round(field.x),
        y: Math.round(field.y), // Y is already in PDF coordinates from frontend conversion
        fontSize: field.fontSize || 11,
        ...(field.bold && { bold: true }),
        ...(field.align && field.align !== 'left' && { align: field.align }),
        ...(field.maxWidth && { maxWidth: field.maxWidth })
      };
      
      return acc;
    }, {});

    // Generate new coordinates file content
    const fileContent = `/**
 * Coordenadas CCB - MAPEAMENTO VISUAL
 * 
 * Gerado automaticamente pelo sistema de posicionamento drag-and-drop
 * Data de geração: ${new Date().toISOString()}
 * 
 * IMPORTANTE: Coordenadas são onde o TEXTO INICIA (primeira letra)
 * Sistema PDF: origem no canto inferior esquerdo, Y cresce para cima
 */

export interface CCBFieldConfig {
  x: number;
  y: number;
  fontSize?: number;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;
}

export interface CCBCoordinates {
  page1: Record<string, CCBFieldConfig>;
  page2: Record<string, CCBFieldConfig>;
  page3: Record<string, CCBFieldConfig>;
  page4: Record<string, CCBFieldConfig>;
  page5: Record<string, CCBFieldConfig>;
  page6: Record<string, CCBFieldConfig>;
  page7: Record<string, CCBFieldConfig>;
  page8: Record<string, CCBFieldConfig>;
}

export const ccbCoordinates: CCBCoordinates = ${JSON.stringify({
  page1: grouped.page1 || {},
  page2: grouped.page2 || {},
  page3: grouped.page3 || {},
  page4: grouped.page4 || {},
  page5: grouped.page5 || {},
  page6: grouped.page6 || {},
  page7: grouped.page7 || {},
  page8: grouped.page8 || {}
}, null, 2)};
`;

    // Write to file
    const filePath = path.resolve(process.cwd(), 'server/config/ccbCoordinates.ts');
    await fs.writeFile(filePath, fileContent, 'utf8');

    console.log(`✅ [FIELD POSITIONER] Coordinates saved to ${filePath}`);
    
    res.json({ 
      success: true, 
      message: 'Coordenadas salvas com sucesso',
      fieldsCount: positions.length,
      pagesModified: Object.keys(grouped)
    });

  } catch (error) {
    console.error('❌ [FIELD POSITIONER] Error saving positions:', error);
    res.status(500).json({ error: 'Erro ao salvar posições dos campos' });
  }
});

/**
 * Load current field positions from ccbCoordinates.ts
 */
router.get('/load-positions', async (req, res) => {
  try {
    // Import current coordinates
    const { ccbCoordinates } = await import('../config/ccbCoordinates');
    
    // Convert to frontend format
    const positions: any[] = [];
    
    Object.entries(ccbCoordinates).forEach(([pageKey, pageFields]) => {
      const pageNumber = parseInt(pageKey.replace('page', ''));
      
      Object.entries(pageFields as Record<string, any>).forEach(([fieldName, config]) => {
        positions.push({
          id: `${fieldName}_${pageNumber}`,
          name: fieldName,
          x: config.x,
          y: config.y, // Already in PDF coordinates
          fontSize: config.fontSize || 11,
          bold: config.bold || false,
          align: config.align || 'left',
          page: pageNumber,
          sampleText: fieldName, // Use field name as sample text
          maxWidth: config.maxWidth
        });
      });
    });

    console.log(`📥 [FIELD POSITIONER] Loaded ${positions.length} field positions`);
    
    res.json({ positions });

  } catch (error) {
    console.error('❌ [FIELD POSITIONER] Error loading positions:', error);
    res.json({ positions: [] }); // Return empty array if no coordinates exist
  }
});

/**
 * Get template image URL (if available)
 */
router.get('/template-image/:page', async (req, res) => {
  try {
    const { page } = req.params;
    
    // Check if template image exists for this page
    const imagePath = path.resolve(process.cwd(), `server/templates/ccb_page_${page}.png`);
    
    try {
      await fs.access(imagePath);
      // If image exists, serve it
      res.sendFile(imagePath);
    } catch {
      // If no image exists, return placeholder
      res.status(404).json({ error: 'Template image not found' });
    }

  } catch (error) {
    console.error('❌ [FIELD POSITIONER] Error serving template image:', error);
    res.status(500).json({ error: 'Erro ao carregar imagem do template' });
  }
});

export default router;