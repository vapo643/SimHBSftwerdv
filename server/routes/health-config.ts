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
  // OPERAÇÃO PHOENIX: Validação rigorosa de configuração
  const configHealth = {
    supabaseUrlsMatch: process.env.VITE_SUPABASE_URL === process.env.SUPABASE_URL,
    hasJwtSecret: !!process.env.SUPABASE_JWT_SECRET,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseAnonKey: !!process.env.SUPABASE_ANON_KEY,
    hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    architectureType: 'CANONICAL' // Arquitetura limpa implementada
  };

  const healthy = configHealth.supabaseUrlsMatch && 
                  configHealth.hasJwtSecret && 
                  configHealth.hasSupabaseUrl &&
                  configHealth.hasSupabaseAnonKey;

  res.status(healthy ? 200 : 503).json({ // 503 Service Unavailable se misconfigurado
    status: healthy ? 'HEALTHY' : 'MISCONFIGURED',
    details: configHealth,
    timestamp: new Date().toISOString(),
    recommendation: healthy ? 'HEALTHY' : 'CONFIGURATION_REQUIRED'
  });
});

export default router;