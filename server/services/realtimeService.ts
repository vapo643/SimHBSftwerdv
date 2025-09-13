/**
 * Real-time Service para Server-Sent Events (SSE)
 * PAM V1.0 - OPERAÇÃO WEBHOOK RESILIENTE
 * 
 * Gerencia conexões SSE para atualizações em tempo real
 * da interface do usuário quando propostas são atualizadas
 */

import { Response } from 'express';
import { logInfo, logError } from '../lib/logger.js';

interface SSEClient {
  id: string;
  res: Response;
  userId?: string;
  connectedAt: Date;
  lastPing?: Date;
}

interface SSEEvent {
  event: string;
  data: any;
  userId?: string; // Para eventos específicos de usuário
}

class RealtimeService {
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout;
  
  constructor() {
    // Heartbeat para manter conexões ativas
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000); // 30 segundos
    
    logInfo('[REALTIME SERVICE] ✅ Inicializado com heartbeat a cada 30s');
  }

  /**
   * Adicionar cliente SSE
   */
  addClient(clientId: string, res: Response, userId?: string): void {
    // Configurar headers SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Enviar conectado inicial
    res.write(`data: ${JSON.stringify({ 
      event: 'connected', 
      message: 'SSE connection established',
      timestamp: new Date().toISOString() 
    })}\n\n`);

    const client: SSEClient = {
      id: clientId,
      res,
      userId,
      connectedAt: new Date(),
      lastPing: new Date(),
    };

    this.clients.set(clientId, client);
    
    logInfo('[REALTIME SERVICE] 📡 Cliente conectado', {
      clientId,
      userId,
      totalClients: this.clients.size
    });

    // Remover cliente quando conexão for fechada
    res.on('close', () => {
      this.removeClient(clientId);
    });

    res.on('error', (error) => {
      logError('[REALTIME SERVICE] ❌ Erro na conexão SSE', error, { clientId });
      this.removeClient(clientId);
    });
  }

  /**
   * Remover cliente SSE
   */
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.res.end();
      } catch (error) {
        // Conexão já fechada, ignorar erro
      }
      
      this.clients.delete(clientId);
      
      logInfo('[REALTIME SERVICE] 📴 Cliente desconectado', {
        clientId,
        totalClients: this.clients.size,
        connectionDuration: Date.now() - client.connectedAt.getTime()
      });
    }
  }

  /**
   * Enviar evento para todos os clientes conectados
   */
  sendEvent(event: SSEEvent): void {
    if (this.clients.size === 0) {
      logInfo('[REALTIME SERVICE] ℹ️ Nenhum cliente conectado para receber evento', { event: event.event });
      return;
    }

    const eventData = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    let sentCount = 0;
    const deadClients: string[] = [];

    for (const [clientId, client] of this.clients) {
      // Filtrar por usuário se especificado
      if (event.userId && client.userId !== event.userId) {
        continue;
      }

      try {
        const message = `data: ${JSON.stringify({ type: eventData.event, data: eventData.data, timestamp: eventData.timestamp })}\n\n`;
        client.res.write(message);
        sentCount++;
        
        logInfo('[REALTIME SERVICE] 📤 Evento enviado para cliente', {
          clientId,
          event: event.event,
          userId: client.userId
        });
      } catch (error) {
        logError('[REALTIME SERVICE] ❌ Erro ao enviar evento para cliente', error as Error, { clientId });
        deadClients.push(clientId);
      }
    }

    // Remover clientes com conexões mortas
    deadClients.forEach(clientId => this.removeClient(clientId));

    logInfo('[REALTIME SERVICE] 🚀 Evento distribuído', {
      event: event.event,
      sentToClients: sentCount,
      totalClients: this.clients.size,
      deadClientsRemoved: deadClients.length
    });
  }

  /**
   * Enviar evento específico para proposta atualizada
   */
  sendProposalUpdated(proposalId: string, status: string, userId?: string): void {
    this.sendEvent({
      event: 'PROPOSAL_UPDATED',
      data: {
        proposalId,
        status,
        action: 'status_changed'
      },
      userId
    });
  }

  /**
   * Enviar evento específico para assinatura concluída
   */
  sendProposalSigned(proposalId: string, userId?: string): void {
    this.sendEvent({
      event: 'PROPOSAL_SIGNED',
      data: {
        proposalId,
        status: 'ASSINATURA_CONCLUIDA',
        action: 'ccb_signed'
      },
      userId
    });
  }

  /**
   * Enviar heartbeat para manter conexões ativas
   */
  private sendHeartbeat(): void {
    if (this.clients.size === 0) {
      return;
    }

    const deadClients: string[] = [];
    
    for (const [clientId, client] of this.clients) {
      try {
        client.res.write(`data: ${JSON.stringify({ 
          event: 'heartbeat', 
          timestamp: new Date().toISOString() 
        })}\n\n`);
        
        client.lastPing = new Date();
      } catch (error) {
        deadClients.push(clientId);
      }
    }

    // Remover clientes mortos
    deadClients.forEach(clientId => this.removeClient(clientId));

    if (deadClients.length > 0) {
      logInfo('[REALTIME SERVICE] 💓 Heartbeat executado', {
        activeClients: this.clients.size,
        deadClientsRemoved: deadClients.length
      });
    }
  }

  /**
   * Obter estatísticas das conexões
   */
  getStats() {
    return {
      connectedClients: this.clients.size,
      clients: Array.from(this.clients.values()).map(client => ({
        id: client.id,
        userId: client.userId,
        connectedAt: client.connectedAt,
        lastPing: client.lastPing,
        connectionAge: Date.now() - client.connectedAt.getTime()
      }))
    };
  }

  /**
   * Cleanup service
   */
  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Fechar todas as conexões
    for (const [clientId] of this.clients) {
      this.removeClient(clientId);
    }
    
    logInfo('[REALTIME SERVICE] 🔄 Service destroyed');
  }
}

// Singleton instance
export const realtimeService = new RealtimeService();

// Graceful shutdown
process.on('SIGTERM', () => {
  realtimeService.destroy();
});

process.on('SIGINT', () => {
  realtimeService.destroy();
});