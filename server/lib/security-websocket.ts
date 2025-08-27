/**
 * WebSocket para eventos de segurança em tempo real
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server as HTTPServer } from 'http';
import { getSecurityScanner } from './autonomous-security-scanner';
import { getVulnerabilityDetector } from './vulnerability-detector';
import { getDependencyScanner } from './dependency-scanner';
import { getSemgrepScanner } from './semgrep-scanner';

interface SecurityWebSocketMessage {
  type: 'anomaly' | 'vulnerability' | 'critical-alert' | 'scan-status';
  data: unknown;
  timestamp: Date;
}

export class SecurityWebSocketManager {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  constructor(server: HTTPServer) {
    this.wss = new WebSocketServer({
      _server,
      path: '/ws/security',
    });

    this.setupWebSocket();
    this.setupEventListeners();
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('🔌 [Security WS] Nova conexão WebSocket');
      this.clients.add(ws);

      // Enviar estado inicial
      ws.send(
        JSON.stringify({
          type: 'connection',
          data: { status: 'connected' },
          timestamp: new Date(),
        })
      );

      ws.on('close', () => {
        console.log('🔌 [Security WS] Conexão fechada');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('❌ [Security WS] Erro:', error);
        this.clients.delete(ws);
      });
    });
  }

  private setupEventListeners() {
    // TODO: Implementar sistema de eventos para scanners de segurança
    // Por enquanto, apenas logamos que o sistema está pronto
    console.log(
      '🔌 [Security WS] Event listeners configurados (aguardando implementação de EventEmitter nos scanners)'
    );

    // Enviar status inicial para clientes conectados
    setInterval(() => {
      this.broadcast({
        type: 'scan-status',
        data: { status: 'monitoring', timestamp: new Date() },
        timestamp: new Date(),
      });
    }, 30000); // A cada 30 segundos
  }

  private broadcast(message: SecurityWebSocketMessage) {
    const _messageStr = JSON.stringify(message);

    this.clients.forEach((ws) => {
      if (ws.readyState == WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  }

  public sendAlert(alert) {
    this.broadcast({
      type: 'critical-alert',
      data: alert,
      timestamp: new Date(),
    });
  }
}

let wsManager: SecurityWebSocketManager | null = null;

export function setupSecurityWebSocket(server: HTTPServer): SecurityWebSocketManager {
  if (!wsManager) {
    wsManager = new SecurityWebSocketManager(server);
  }
  return wsManager;
}

export function getSecurityWebSocketManager(): SecurityWebSocketManager | null {
  return wsManager;
}
