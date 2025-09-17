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
import { jwtAuthMiddleware, AuthenticatedRequest } from '../lib/jwt-auth-middleware.js';
import { logInfo, logError } from '../lib/logger.js';

const router = express.Router();

/**
 * 🔧 SSE JWT Middleware - Aceita token via query parameter ou header
 * Necessário pois EventSource não suporta headers customizados
 */
async function sseJwtAuthMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    // Tentar extrair token do query parameter primeiro (para SSE)
    let token = req.query.token as string;
    
    // Se não tem token na query, tentar header (fallback)
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    if (!token) {
      logError('[SSE AUTH] ❌ Token não encontrado em query param nem header', new Error('No token provided'), {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      return res.status(401).json({ 
        error: 'Token de acesso requerido via query parameter ou header' 
      });
    }
    
    // Criar requisição temporária com token no header para usar o middleware existente
    const tempReq = {
      ...req,
      headers: {
        ...req.headers,
        authorization: `Bearer ${token}`
      }
    } as express.Request;
    
    // Usar o middleware JWT existente
    jwtAuthMiddleware(tempReq, res, (error?: any) => {
      if (error) {
        return next(error);
      }
      
      // Copiar dados do usuário autenticado
      (req as AuthenticatedRequest).user = (tempReq as AuthenticatedRequest).user;
      next();
    });
    
  } catch (error) {
    logError('[SSE AUTH] ❌ Erro no middleware SSE JWT', error as Error, {
      ip: req.ip
    });
    
    res.status(500).json({ 
      error: 'Erro interno de autenticação SSE' 
    });
  }
}

/**
 * GET /api/events
 * Estabelece conexão SSE para atualizações em tempo real
 * Aceita JWT via ?token=JWT_TOKEN ou header Authorization: Bearer JWT_TOKEN
 */
router.get('/', sseJwtAuthMiddleware, (req: AuthenticatedRequest, res) => {
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