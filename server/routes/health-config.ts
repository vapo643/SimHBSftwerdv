/**
 * OPUS PROTOCOL - Health Config Endpoint
 * Validação de configuração crítica conforme Operation Phoenix
 */

import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /api/health/live  
 * Liveness probe - basic application health
 */
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'LIVE',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * GET /api/health/ready
 * Readiness probe - application ready to serve traffic
 */
router.get('/ready', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'READY',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

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
        dev_secrets: !!process.env.DEV_JWT_SECRET || !!process.env.DEV_JTW_SECRET || !!process.env.DEV_SUPABASE_URL,
        prod_secrets: !!process.env.PROD_JWT_SECRET || !!process.env.PROD_SUPABASE_URL
      }
    },
    recommendation: urlsMatch ? 'HEALTHY' : 'CHECK_URLS'
  });
});

export default router;