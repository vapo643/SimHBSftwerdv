/**
 * Server-Sent Events (SSE) Route
 * PAM V1.0 - OPERAÇÃO WEBHOOK RESILIENTE
 * 
 * Fornece atualizações em tempo real via SSE para:
 * - Status de propostas (formalizacao.tsx)
 * - Status de pagamentos (pagamentos.tsx)
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { realtimeService } from '../services/realtimeService.js';
import { jwtAuthMiddleware } from '../lib/jwt-auth-middleware.js';
import { AuthenticatedRequest } from '../../shared/types/express.js';
import { logInfo, logError } from '../lib/logger.js';

const router = express.Router();

/**
 * GET /api/events
 * Estabelece conexão SSE para atualizações em tempo real
 */
router.get('/', jwtAuthMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    const clientId = uuidv4();
    const userId = req.user?.id;
    
    logInfo('[SSE ENDPOINT] 📡 Nova conexão SSE solicitada', {
      clientId,
      userId,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    // Verificar se usuário está autenticado
    if (!userId) {
      logError('[SSE ENDPOINT] ❌ Tentativa de conexão SSE sem autenticação', new Error('User not authenticated'), {
        clientId,
        ip: req.ip
      });
      
      return res.status(401).json({ 
        error: 'Authentication required for real-time events' 
      });
    }

    // Adicionar cliente ao serviço de real-time
    realtimeService.addClient(clientId, res, userId);
    
    logInfo('[SSE ENDPOINT] ✅ Conexão SSE estabelecida com sucesso', {
      clientId,
      userId,
      totalConnections: realtimeService.getStats().connectedClients
    });

  } catch (error) {
    logError('[SSE ENDPOINT] ❌ Erro ao estabelecer conexão SSE', error as Error, {
      userId: req.user?.id,
      ip: req.ip
    });
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to establish SSE connection' 
      });
    }
  }
});

/**
 * GET /api/events/stats
 * Obter estatísticas das conexões SSE (admin only)
 */
router.get('/stats', jwtAuthMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    // Verificar se é admin (simplificado para este exemplo)
    const isAdmin = req.user?.role === 'admin';
    
    if (!isAdmin) {
      return res.status(403).json({ 
        error: 'Admin access required' 
      });
    }

    const stats = realtimeService.getStats();
    
    logInfo('[SSE ENDPOINT] 📊 Estatísticas SSE solicitadas', {
      adminUserId: req.user?.id,
      stats: {
        connectedClients: stats.connectedClients,
        clientsWithUserId: stats.clients.filter(c => c.userId).length
      }
    });

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logError('[SSE ENDPOINT] ❌ Erro ao obter estatísticas SSE', error as Error, {
      adminUserId: req.user?.id
    });
    
    res.status(500).json({ 
      error: 'Failed to retrieve SSE statistics' 
    });
  }
});

/**
 * POST /api/events/test
 * Enviar evento de teste (admin only, para debugging)
 */
router.post('/test', jwtAuthMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    // Verificar se é admin
    const isAdmin = req.user?.role === 'admin';
    
    if (!isAdmin) {
      return res.status(403).json({ 
        error: 'Admin access required' 
      });
    }

    const { event, data, userId } = req.body;
    
    if (!event || !data) {
      return res.status(400).json({ 
        error: 'Event and data are required' 
      });
    }

    // Enviar evento de teste
    realtimeService.sendEvent({
      event,
      data: {
        ...data,
        isTest: true,
        sentBy: req.user?.id
      },
      userId
    });

    logInfo('[SSE ENDPOINT] 🧪 Evento de teste enviado', {
      event,
      adminUserId: req.user?.id,
      targetUserId: userId,
      data
    });

    res.json({
      success: true,
      message: 'Test event sent successfully',
      event,
      sentAt: new Date().toISOString()
    });

  } catch (error) {
    logError('[SSE ENDPOINT] ❌ Erro ao enviar evento de teste', error as Error, {
      adminUserId: req.user?.id,
      body: req.body
    });
    
    res.status(500).json({ 
      error: 'Failed to send test event' 
    });
  }
});

export default router;