/**
 * OPUS PROTOCOL - Health Config Endpoint
 * Validação de configuração crítica conforme Operation Phoenix
 */

import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /api/health/config
 * Endpoint de validação de configuração conforme protocolo Opus
 */
router.get('/config', (req: Request, res: Response) => {
  const urlsMatch = process.env.VITE_SUPABASE_URL?.includes(
    process.env.SUPABASE_URL?.split('.')[0].split('//')[1] || ''
  );
  
  res.json({
    status: 'OPERATIONAL',
    timestamp: new Date().toISOString(),
    config: {
      hasJwtSecret: !!process.env.SUPABASE_JWT_SECRET,
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      urlsAligned: urlsMatch,
      contamination: {
        dev_secrets: !!process.env.DEV_JWT_SECRET || !!process.env.DEV_JTW_SECRET,
        prod_secrets: !!process.env.PROD_JWT_SECRET
      }
    },
    recommendation: urlsMatch ? 'HEALTHY' : 'CHECK_URLS'
  });
});

export default router;