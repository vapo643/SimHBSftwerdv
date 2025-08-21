// FASE 0 - Health Check Endpoint
// Author: GEM 02 (Dev Specialist)  
// Date: 21/08/2025
// Critical Priority: P0

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { logInfo, logError, logMetric } from '../lib/logger';
import os from 'os';
import fs from 'fs';

const router = Router();

// Interface para o health check response
interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  checks: {
    database?: {
      status: 'healthy' | 'unhealthy';
      latency?: number;
      error?: string;
    };
    supabase?: {
      status: 'healthy' | 'unhealthy';
      latency?: number;
      error?: string;
    };
    filesystem?: {
      status: 'healthy' | 'unhealthy';
      writable?: boolean;
      error?: string;
    };
    memory?: {
      status: 'healthy' | 'unhealthy';
      usage?: string;
      available?: string;
    };
    externalApis?: {
      bancoInter?: {
        status: 'healthy' | 'unhealthy' | 'unknown';
      };
      clickSign?: {
        status: 'healthy' | 'unhealthy' | 'unknown';
      };
    };
  };
  metrics?: {
    cpu: {
      usage: string;
      loadAverage: number[];
    };
    memory: {
      total: string;
      free: string;
      used: string;
      percentage: number;
    };
    disk?: {
      available: string;
    };
  };
}

// Health check principal
router.get('/health', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  const health: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0',
    checks: {}
  };
  
  try {
    // 1. Database Check (via Supabase)
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      const dbStart = Date.now();
      try {
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_KEY
        );
        
        // Teste simples de query
        const { error } = await supabase
          .from('users')
          .select('count')
          .limit(1)
          .single();
        
        if (error) throw error;
        
        const latency = Date.now() - dbStart;
        health.checks.database = { 
          status: 'healthy',
          latency 
        };
        
        logMetric('health.database.latency', latency, 'ms');
      } catch (error: any) {
        health.status = 'unhealthy';
        health.checks.database = { 
          status: 'unhealthy',
          error: error.message 
        };
        logError('❌ Health check failed - Database', error);
      }
    }
    
    // 2. Supabase Storage Check
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      const storageStart = Date.now();
      try {
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_KEY
        );
        
        // Verificar se o bucket documents existe
        const { data, error } = await supabase
          .storage
          .getBucket('documents');
        
        if (error) throw error;
        
        const latency = Date.now() - storageStart;
        health.checks.supabase = { 
          status: 'healthy',
          latency 
        };
      } catch (error: any) {
        health.status = 'degraded';
        health.checks.supabase = { 
          status: 'unhealthy',
          error: error.message 
        };
      }
    }
    
    // 3. Filesystem Check
    try {
      const testFile = './logs/.health-check';
      fs.writeFileSync(testFile, new Date().toISOString());
      fs.unlinkSync(testFile);
      
      health.checks.filesystem = { 
        status: 'healthy',
        writable: true 
      };
    } catch (error: any) {
      health.status = 'degraded';
      health.checks.filesystem = { 
        status: 'unhealthy',
        writable: false,
        error: error.message 
      };
    }
    
    // 4. Memory Check
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercentage = (usedMem / totalMem) * 100;
    
    health.checks.memory = {
      status: memPercentage > 90 ? 'unhealthy' : 'healthy',
      usage: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      available: `${Math.round(freeMem / 1024 / 1024)}MB`
    };
    
    if (memPercentage > 90) {
      health.status = 'degraded';
    }
    
    // 5. External APIs (basic check - não fazer requests reais)
    health.checks.externalApis = {
      bancoInter: { 
        status: process.env.INTER_CLIENT_ID ? 'unknown' : 'unhealthy' 
      },
      clickSign: { 
        status: process.env.CLICKSIGN_API_KEY ? 'unknown' : 'unhealthy' 
      }
    };
    
    // 6. System Metrics
    health.metrics = {
      cpu: {
        usage: `${Math.round(os.loadavg()[0] * 100)}%`,
        loadAverage: os.loadavg()
      },
      memory: {
        total: `${Math.round(totalMem / 1024 / 1024)}MB`,
        free: `${Math.round(freeMem / 1024 / 1024)}MB`,
        used: `${Math.round(usedMem / 1024 / 1024)}MB`,
        percentage: Math.round(memPercentage)
      }
    };
    
    // Log do health check
    const totalLatency = Date.now() - startTime;
    logInfo('🏥 Health check completed', {
      status: health.status,
      latency: totalLatency,
      checks: Object.keys(health.checks)
    });
    
    logMetric('health.check.latency', totalLatency, 'ms');
    logMetric('health.check.status', health.status === 'healthy' ? 1 : 0, 'boolean');
    
    // Status code baseado na saúde
    const statusCode = health.status === 'healthy' ? 200 : 
                       health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(health);
    
  } catch (error: any) {
    logError('❌ Health check failed completely', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Liveness probe (simples - apenas verifica se o servidor está rodando)
router.get('/health/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

// Readiness probe (verifica se o servidor está pronto para receber tráfego)
router.get('/health/ready', async (req: Request, res: Response) => {
  try {
    // Verificar apenas database
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );
      
      const { error } = await supabase
        .from('users')
        .select('count')
        .limit(1)
        .single();
      
      if (error) throw error;
    }
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

export default router;