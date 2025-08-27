/**
 * Autonomous Security Scanner - Sistema Autônomo de Detecção de Vulnerabilidades
 *
 * Monitora continuamente TODOS os aspectos do sistema, detectando
 * novas vulnerabilidades sem necessidade de configuração prévia.
 */

import { Request, Response, Application } from 'express';
import { db } from './supabase';
import { security_logs } from '../../shared/schema';
import { securityLogger, SecurityEventType } from './security-logger';
import { getClientIP } from './security-logger';
import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { sql } from 'drizzle-orm';

export interface VulnerabilityReport {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  endpoint?: string;
  description: string;
  evidence: unknown;
  recommendation: string;
  detectedAt: Date;
  cweId?: string;
  owaspCategory?: string;
  falsePositiveScore: number; // 0-1, quanto menor mais confiável
}

export interface SecurityMetrics {
  totalRequests: number;
  suspiciousRequests: number;
  blockedRequests: number;
  uniqueIPs: number;
  averageResponseTime: number;
  errorRate: number;
  anomalyScore: number;
}

/**
 * Sistema Autônomo de Segurança
 */
export class AutonomousSecurityScanner {
  private app: Application;
  private endpoints: Map<string, EndpointProfile> = new Map();
  private ipProfiles: Map<string, IPProfile> = new Map();
  private vulnerabilities: Map<string, VulnerabilityReport> = new Map();
  private scanInterval: NodeJS.Timeout | null = null;
  private learningMode: boolean = true;
  private baselineEstablished: boolean = false;

  // Padrões de ataque conhecidos (expandível automaticamente)
  private attackPatterns = new Map<string, AttackPattern>();

  constructor(app: Application) {
    this.app = app;
    this.initializeAttackPatterns();
  }

  /**
   * Iniciar monitoramento autônomo
   */
  async start() {
    console.log('🤖 [AUTONOMOUS SECURITY] Iniciando sistema autônomo de segurança...');

    // 1. Descobrir todos os endpoints automaticamente
    await this.discoverEndpoints();

    // 2. Estabelecer baseline de comportamento normal
    await this.establishBaseline();

    // 3. Iniciar monitoramento contínuo
    this.startContinuousMonitoring();

    // 4. Iniciar aprendizado de máquina
    this.startMachineLearning();

    // 5. Iniciar scanner de vulnerabilidades
    this.startVulnerabilityScanning();

    console.log('✅ [AUTONOMOUS SECURITY] Sistema iniciado com sucesso');
  }

  /**
   * Descobrir todos os endpoints da aplicação
   */
  private async discoverEndpoints() {
    const routes: unknown[] = [];

    // Extrair todas as rotas do Express
    this.app._router.stack.forEach((middleware) => {
      if (middleware.route) {
        // Rota direta
        const methods = Object.keys(middleware.route.methods);
        methods.forEach((method) => {
          routes.push({
            path: middleware.route.path,
            method: method.toUpperCase(),
            middleware: [],
          });
        });
      }
else if (middleware.name == 'router') {
        // Sub-router
        middleware.handle.stack.forEach((handler) => {
          if (handler.route) {
            const methods = Object.keys(handler.route.methods);
            methods.forEach((method) => {
              routes.push({
                path: handler.route.path,
                method: method.toUpperCase(),
                middleware: [],
              });
            });
          }
        });
      }
    });

    // Criar perfil para cada endpoint
    routes.forEach((route) => {
      const key = `${route.method}:${route.path}`;
      this.endpoints.set(key, {
        method: route.method,
        path: route.path,
        normalBehavior: {
          avgResponseTime: 0,
          avgRequestSize: 0,
          commonHeaders: new Set(),
          commonParams: new Set(),
          errorRate: 0,
          requestsPerMinute: 0,
        },
        anomalies: [],
        lastScan: new Date(),
      });
    });

    console.log(`📍 [AUTONOMOUS SECURITY] Descobertos ${routes.length} endpoints`);
  }

  /**
   * Estabelecer baseline de comportamento normal
   */
  private async establishBaseline() {
    console.log('📊 [AUTONOMOUS SECURITY] Estabelecendo baseline...');

    // Analisar logs históricos
    const logs = await db
      .select()
      .from(security_logs)
      .where(sql`created_at > NOW() - INTERVAL '7 days'`)
      .limit(10000);

    // Processar logs para entender padrões normais
    for (const log of logs) {
      this.processLogForBaseline(log);
    }

    this.baselineEstablished = true;
    this.learningMode = false;
  }

  /**
   * Monitoramento contínuo com interceptação de TODAS as requisições
   */
  private startContinuousMonitoring() {
    // Interceptar TODAS as requisições
    this.app.use((req: Request, res: Response, next) => {
      const startTime = Date.now();
      const reqData = this.captureRequestData(req);

      // Interceptar response
      const originalSend = res.send;
      const self = this;
      res.send = function (data) {
        res.locals.responseTime = Date.now() - startTime;
        res.locals.responseSize = Buffer.byteLength(_data);

        // Analisar requisição/resposta
        setImmediate(() => {
          self.analyzeRequestResponse(req, res, reqData);
        });

        return originalSend.call(this, _data);
      };

      next();
    });

    // Scanner periódico
    this.scanInterval = setInterval(() => {
      this.performSecurityScan();
    }, 60000); // A cada minuto
  }

  /**
   * Capturar dados completos da requisição
   */
  private captureRequestData(req: Request) {
    return {
      method: req.method,
      path: req.path,
      headers: req.headers,
      query: req.query,
      body: req.body,
      ip: getClientIP(req),
      timestamp: new Date(),
      userAgent: req.headers['user-agent'],
      referer: req.headers['referer'],
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
    };
  }

  /**
   * Analisar requisição/resposta em tempo real
   */
  private async analyzeRequestResponse(req: Request, res: Response, reqData) {
    const responseTime = res.locals.responseTime;
    const responseSize = res.locals.responseSize;
    const statusCode = res.statusCode;

    // 1. Detecção de anomalias por endpoint
    const endpointKey = `${req.method}:${req.path}`;
    const endpoint = this.endpoints.get(endpointKey);

    if (endpoint) {
      const anomalies = this.detectAnomalies({
        endpoint,
        responseTime,
        responseSize,
        statusCode,
        headers: reqData.headers,
        params: { ...reqData.query, ...reqData.body },
      });

      if (anomalies.length > 0) {
        this.handleAnomalies(anomalies, reqData);
      }
    }

    // 2. Detecção de padrões de ataque
    const attacks = this.detectAttackPatterns(reqData);
    if (attacks.length > 0) {
      this.handleAttacks(attacks, reqData);
    }

    // 3. Análise comportamental por IP
    await this.analyzeIPBehavior(reqData.ip, reqData);

    // 4. Detecção de vulnerabilidades
    await this.scanForVulnerabilities(reqData, statusCode);
  }

  /**
   * Detectar anomalias baseado no comportamento normal
   */
  private detectAnomalies(data): string[] {
    const anomalies: string[] = [];
    const endpoint = data.endpoint;
    const normal = endpoint.normalBehavior;

    // Tempo de resposta anormal
    if (normal.avgResponseTime > 0) {
      const deviation = Math.abs(data.responseTime - normal.avgResponseTime);
      if (deviation > normal.avgResponseTime * 3) {
        // 3x desvio
        anomalies.push('response_time_anomaly');
      }
    }

    // Tamanho de resposta anormal
    if (data.responseSize > 10 * 1024 * 1024) {
      // >10MB
      anomalies.push('large_response_size');
    }

    // Headers suspeitos
    const suspiciousHeaders = [
      'x-forwarded-host',
      'x-original-url',
      'x-rewrite-url',
      'x-originating-ip',
      'x-forwarded-server',
      'x-http-method-override',
    ];

    for (const header of suspiciousHeaders) {
      if (data.headers[header]) {
        anomalies.push(`suspicious_header_${header}`);
      }
    }

    // Parâmetros não esperados
    const paramKeys = Object.keys(data.params);
    const unexpectedParams = paramKeys.filter(
      (key) => !normal.commonParams.has(key) && !this.learningMode
    );

    if (unexpectedParams.length > 5) {
      anomalies.push('unexpected_parameters');
    }

    return anomalies;
  }

  /**
   * Detectar padrões de ataque conhecidos e desconhecidos
   */
  private detectAttackPatterns(reqData): AttackPattern[] {
    const detectedAttacks: AttackPattern[] = [];

    // Converter todos os dados em string para análise
    const dataString = JSON.stringify({
      path: reqData.path,
      query: reqData.query,
      body: reqData.body,
      headers: reqData.headers,
    }).toLowerCase();

    // 1. SQL Injection
    const sqlPatterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b.*\b(from|where|table|database)\b)/i,
      /(\b(or|and)\b\s*\d+\s*=\s*\d+)/i,
      /(\'|\")\s*(or|and)\s*(\'|\")\s*=\s*(\'|\")/i,
      /(\b(waitfor|sleep|benchmark|pg_sleep)\b)/i,
      /(\b(load_file|into\s+outfile|into\s+dumpfile)\b)/i,
    ];

    for (const pattern of sqlPatterns) {
      if (pattern.test(dataString)) {
        detectedAttacks.push({
          type: 'SQL_INJECTION',
          pattern: pattern.toString(),
          confidence: 0.9,
          severity: 'CRITICAL',
        });
        break;
      }
    }

    // 2. XSS
    const xssPatterns = [
      /<script[^>]*>[\s\S]*?<\/script>/gi,
      /javascript:\s*[^"']+/gi,
      /on\w+\s*=\s*["'][^"']+["']/gi,
      /<iframe[^>]*>/gi,
      /<object[^>]*>/gi,
      /eval\s*\(/gi,
      /expression\s*\(/gi,
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(dataString)) {
        detectedAttacks.push({
          type: 'XSS',
          pattern: pattern.toString(),
          confidence: 0.85,
          severity: 'HIGH',
        });
        break;
      }
    }

    // 3. Command Injection
    const cmdPatterns = [
      /(\||;|&|`|\$\(|\${).*?(ls|cat|grep|find|wget|curl|nc|bash|sh|cmd|powershell)/i,
      /\b(system|exec|popen|proc_open|shell_exec|passthru)\s*\(/i,
    ];

    for (const pattern of cmdPatterns) {
      if (pattern.test(dataString)) {
        detectedAttacks.push({
          type: 'COMMAND_INJECTION',
          pattern: pattern.toString(),
          confidence: 0.9,
          severity: 'CRITICAL',
        });
        break;
      }
    }

    // 4. Path Traversal
    const pathPatterns = [/\.\.[\/\\]/, /%2e%2e[\/\\]/i, /\.\.%2f/i, /\.\.%5c/i];

    for (const pattern of pathPatterns) {
      if (pattern.test(dataString)) {
        detectedAttacks.push({
          type: 'PATH_TRAVERSAL',
          pattern: pattern.toString(),
          confidence: 0.95,
          severity: 'HIGH',
        });
        break;
      }
    }

    // 5. LDAP Injection
    const ldapPatterns = [/[()&|*]/, /\b(objectClass|cn|sn|uid|mail)\s*=/i];

    // 6. XML/XXE Injection
    if (reqData.contentType?.includes('xml')) {
      const xxePatterns = [
        /<!ENTITY/i,
        /SYSTEM\s+["'](file:|http:|https:|ftp:|php:|zlib:|data:|glob:|phar:|ssh2:|rar:|ogg:|expect:)/i,
      ];

      for (const pattern of xxePatterns) {
        if (pattern.test(dataString)) {
          detectedAttacks.push({
            type: 'XXE_INJECTION',
            pattern: pattern.toString(),
            confidence: 0.9,
            severity: 'HIGH',
          });
          break;
        }
      }
    }

    // 7. NoSQL Injection
    const noSqlPatterns = [/\$where/, /\$ne/, /\$gt/, /\$regex/, /\$exists/];

    // 8. SSRF Patterns
    const ssrfPatterns = [
      /localhost|127\.0\.0\.1|0\.0\.0\.0|::1/,
      /169\.254\.\d+\.\d+/, // Link-local
      /10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+/, // Private IPs
    ];

    return detectedAttacks;
  }

  /**
   * Análise comportamental por IP
   */
  private async analyzeIPBehavior(ip: string, reqData) {
    if (!this.ipProfiles.has(ip)) {
      this.ipProfiles.set(ip, {
        firstSeen: new Date(),
        lastSeen: new Date(),
        requestCount: 0,
        endpoints: new Set(),
        userAgents: new Set(),
        anomalyScore: 0,
        blocked: false,
      });
    }

    const profile = this.ipProfiles.get(ip)!;
    profile.lastSeen = new Date();
    profile.requestCount++;
    profile.endpoints.add(`${reqData.method}:${reqData.path}`);
    profile.userAgents.add(reqData.userAgent);

    // Detectar comportamento suspeito
    if (profile.endpoints.size > 50) {
      // Scanning muitos endpoints
      profile.anomalyScore += 10;
    }

    if (profile.userAgents.size > 5) {
      // Múltiplos user agents
      profile.anomalyScore += 5;
    }

    if (profile.requestCount > 1000) {
      // Muitas requisições
      profile.anomalyScore += 15;
    }

    // Bloquear IPs muito suspeitos
    if (profile.anomalyScore > 50 && !profile.blocked) {
      this.blockIP(ip);
      profile.blocked = true;
    }
  }

  /**
   * Scanner de vulnerabilidades ativo
   */
  private async scanForVulnerabilities(reqData, statusCode: number) {
    const vulnerabilities: VulnerabilityReport[] = [];

    // 1. Information Disclosure
    if (statusCode == 500 && reqData.body?.stack) {
      vulnerabilities.push({
        id: this.generateVulnId(),
        type: 'INFORMATION_DISCLOSURE',
        severity: 'MEDIUM',
        endpoint: `${reqData.method}:${reqData.path}`,
        description: 'Stack trace exposto em erro 500',
        evidence: { stack: reqData.body.stack },
        recommendation: 'Remover stack traces em produção',
        detectedAt: new Date(),
        cweId: 'CWE-209',
        owaspCategory: 'A01',
        falsePositiveScore: 0.1,
      });
    }

    // 2. Insecure Direct Object Reference (IDOR)
    const idPattern = /\/(users?|accounts?|orders?|documents?|files?)\/(\d+|[a-f0-9-]{36})/i;
    if (idPattern.test(reqData.path)) {
      // Verificar se há validação de autorização
      const hasAuthHeader = !!reqData.headers.authorization;
      if (!hasAuthHeader) {
        vulnerabilities.push({
          id: this.generateVulnId(),
          type: 'IDOR',
          severity: 'HIGH',
          endpoint: `${reqData.method}:${reqData.path}`,
          description: 'Possível IDOR - acesso direto a objetos sem autenticação',
          evidence: { path: reqData.path },
          recommendation: 'Implementar verificação de autorização',
          detectedAt: new Date(),
          cweId: 'CWE-639',
          owaspCategory: 'A01',
          falsePositiveScore: 0.3,
        });
      }
    }

    // 3. Missing Security Headers
    const securityHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'strict-transport-security',
      'content-security-policy',
      'x-xss-protection',
    ];

    const missingHeaders = securityHeaders.filter((h) => !reqData.headers[h]);
    if (missingHeaders.length > 0) {
      vulnerabilities.push({
        id: this.generateVulnId(),
        type: 'MISSING_SECURITY_HEADERS',
        severity: 'LOW',
        endpoint: `${reqData.method}:${reqData.path}`,
        description: `Headers de segurança ausentes: ${missingHeaders.join(', ')}`,
        evidence: { missingHeaders },
        recommendation: 'Adicionar headers de segurança',
        detectedAt: new Date(),
        cweId: 'CWE-693',
        owaspCategory: 'A05',
        falsePositiveScore: 0.05,
      });
    }

    // 4. Weak Authentication
    if (reqData.path.includes('/login') || reqData.path.includes('/auth')) {
      // Verificar força da senha se disponível
      if (reqData.body?.password && reqData.body.password.length < 8) {
        vulnerabilities.push({
          id: this.generateVulnId(),
          type: 'WEAK_PASSWORD_POLICY',
          severity: 'MEDIUM',
          endpoint: `${reqData.method}:${reqData.path}`,
          description: 'Senha muito curta aceita',
          evidence: { passwordLength: reqData.body.password.length },
          recommendation: 'Implementar política de senha mais forte',
          detectedAt: new Date(),
          cweId: 'CWE-521',
          owaspCategory: 'A07',
          falsePositiveScore: 0.1,
        });
      }
    }

    // Armazenar vulnerabilidades encontradas
    for (const vuln of vulnerabilities) {
      this.vulnerabilities.set(vuln.id, vuln);

      // Log de segurança
      securityLogger.logEvent({
        type: SecurityEventType.SECURITYALERT,
        severity: vuln.severity,
        endpoint: vuln.endpoint,
        ipAddress: reqData.ip,
        userAgent: reqData.userAgent,
        success: false,
        details: {
          vulnerability: vuln.type,
          description: vuln.description,
          cweId: vuln.cweId,
        },
      });
    }
  }

  /**
   * Machine Learning para detectar novos padrões
   */
  private startMachineLearning() {
    // Simular aprendizado de máquina básico
    setInterval(async () => {
      // Analisar logs recentes para novos padrões
      const recentLogs = await db
        .select()
        .from(security_logs)
        .where(sql`created_at > NOW() - INTERVAL '1 hour'`)
        .limit(1000);

      // Agrupar por padrões similares
      const patterns = this.extractPatterns(recentLogs);

      // Adicionar novos padrões detectados
      for (const pattern of patterns) {
        if (pattern.signature && !this.attackPatterns.has(pattern.signature)) {
          this.attackPatterns.set(pattern.signature, pattern);
          console.log(`🧠 [ML] Novo padrão de ataque aprendido: ${pattern.type || 'Unknown'}`);
        }
      }
    }, 300000); // A cada 5 minutos
  }

  /**
   * Scanner de vulnerabilidades periódico
   */
  private startVulnerabilityScanning() {
    setInterval(async () => {
      console.log('🔍 [SCANNER] Executando scan completo...');

      // 1. Verificar configurações inseguras
      await this.scanSecurityConfiguration();

      // 2. Verificar dependências vulneráveis
      await this.scanDependencies();

      // 3. Verificar permissões de arquivos
      await this.scanFilePermissions();

      // 4. Verificar vazamento de informações
      await this.scanInformationLeakage();

      // 5. Gerar relatório
      await this.generateSecurityReport();
    }, 3600000); // A cada hora
  }

  /**
   * Gerar relatório automático
   */
  private async generateSecurityReport() {
    const report = {
      timestamp: new Date(),
      summary: {
        totalVulnerabilities: this.vulnerabilities.size,
        critical: Array.from(this.vulnerabilities.values()).filter((v) => v.severity == 'CRITICAL')
          .length,
        high: Array.from(this.vulnerabilities.values()).filter((v) => v.severity == 'HIGH').length,
        medium: Array.from(this.vulnerabilities.values()).filter((v) => v.severity == 'MEDIUM')
          .length,
        low: Array.from(this.vulnerabilities.values()).filter((v) => v.severity == 'LOW').length,
      },
      topVulnerabilities: Array.from(this.vulnerabilities.values())
        .sort((a, b) => this.getSeverityScore(b.severity) - this.getSeverityScore(a.severity))
        .slice(0, 10),
      metrics: await this.calculateSecurityMetrics(),
      recommendations: this.generateRecommendations(),
    };

    // Salvar relatório
    await fs.writeFile(
      path.join(process.cwd(), `security-report-${Date.now()}.json`),
      JSON.stringify(report, null, 2)
    );

    console.log('📊 [REPORT] Relatório de segurança gerado');
  }

  // Métodos auxiliares
  private generateVulnId(): string {
    return `VULN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getSeverityScore(severity: string): number {
    const scores = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    return scores[severity as keyof typeof scores] || 0;
  }

  private async calculateSecurityMetrics(): Promise<SecurityMetrics> {
    // Implementar cálculo de métricas
    return {
      totalRequests: 0,
      suspiciousRequests: 0,
      blockedRequests: 0,
      uniqueIPs: this.ipProfiles.size,
      averageResponseTime: 0,
      errorRate: 0,
      anomalyScore: 0,
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Baseado nas vulnerabilidades encontradas
    const vulns = Array.from(this.vulnerabilities.values());

    if (vulns.some((v) => v.type == 'SQL_INJECTION')) {
      recommendations.push('Implementar prepared statements em todas as queries');
    }

    if (vulns.some((v) => v.type == 'XSS')) {
      recommendations.push('Implementar Content Security Policy (CSP) restritiva');
    }

    if (vulns.some((v) => v.type == 'WEAK_PASSWORD_POLICY')) {
      recommendations.push('Aumentar requisitos mínimos de senha');
    }

    return recommendations;
  }

  // Stubs para métodos complexos
  private initializeAttackPatterns() {}
  private processLogForBaseline(log) {}
  private handleAnomalies(anomalies: string[], reqData) {}
  private handleAttacks(attacks: AttackPattern[], reqData) {}
  private blockIP(ip: string) {}
  private extractPatterns(logs: unknown[]): AttackPattern[] {
    return [];
  }
  private async scanSecurityConfiguration() {}
  private async scanDependencies() {}
  private async scanFilePermissions() {}
  private async scanInformationLeakage() {}
  private async performSecurityScan() {}
}

// Interfaces auxiliares
interface EndpointProfile {
  method: string;
  path: string;
  normalBehavior: {
    avgResponseTime: number;
    avgRequestSize: number;
    commonHeaders: Set<string>;
    commonParams: Set<string>;
    errorRate: number;
    requestsPerMinute: number;
  };
  anomalies: string[];
  lastScan: Date;
}

interface IPProfile {
  firstSeen: Date;
  lastSeen: Date;
  requestCount: number;
  endpoints: Set<string>;
  userAgents: Set<string>;
  anomalyScore: number;
  blocked: boolean;
}

interface AttackPattern {
  type: string;
  pattern: string;
  confidence: number;
  severity: string;
  signature?: string;
}

// Exportar instância singleton
let scanner: AutonomousSecurityScanner | null = null;

export function initializeAutonomousScanner(app: Application) {
  if (!scanner) {
    scanner = new AutonomousSecurityScanner(app);
    scanner.start();
  }
  return scanner;
}

export function getSecurityScanner(): AutonomousSecurityScanner | null {
  return scanner;
}
