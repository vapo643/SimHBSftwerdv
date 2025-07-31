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
  data: any;
  timestamp: Date;
}

export class SecurityWebSocketManager {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  
  constructor(server: HTTPServer) {
    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws/security' 
    });
    
    this.setupWebSocket();
    this.setupEventListeners();
  }
  
  private setupWebSocket() {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('🔌 [Security WS] Nova conexão WebSocket');
      this.clients.add(ws);
      
      // Enviar estado inicial
      ws.send(JSON.stringify({
        type: 'connection',
        data: { status: 'connected' },
        timestamp: new Date()
      }));
      
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
    // Ouvir eventos do scanner de segurança
    const scanner = getSecurityScanner();
    if (scanner) {
      scanner.on('anomaly', (data) => {
        this.broadcast({
          type: 'anomaly',
          data,
          timestamp: new Date()
        });
      });
      
      scanner.on('vulnerability', (data) => {
        this.broadcast({
          type: 'vulnerability',
          data,
          timestamp: new Date()
        });
      });
      
      scanner.on('critical', (data) => {
        this.broadcast({
          type: 'critical-alert',
          data,
          timestamp: new Date()
        });
      });
    }
    
    // Ouvir eventos do detector de vulnerabilidades
    const detector = getVulnerabilityDetector();
    detector.on('anomaly-detected', (data) => {
      this.broadcast({
        type: 'anomaly',
        data,
        timestamp: new Date()
      });
    });
    
    // Ouvir eventos do scanner de dependências
    const depScanner = getDependencyScanner();
    depScanner.on('vulnerability-found', (data) => {
      this.broadcast({
        type: 'vulnerability',
        data: { source: 'dependency-check', ...data },
        timestamp: new Date()
      });
    });
    
    // Ouvir eventos do Semgrep
    const semgrepScanner = getSemgrepScanner();
    semgrepScanner.on('critical-findings', (findings) => {
      this.broadcast({
        type: 'critical-alert',
        data: { source: 'semgrep', findings },
        timestamp: new Date()
      });
    });
  }
  
  private broadcast(message: SecurityWebSocketMessage) {
    const messageStr = JSON.stringify(message);
    
    this.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  }
  
  public sendAlert(alert: any) {
    this.broadcast({
      type: 'critical-alert',
      data: alert,
      timestamp: new Date()
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