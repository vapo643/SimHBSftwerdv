/**
 * Projeto Cérbero - Semgrep MCP Server
 * Servidor de contexto de segurança para análise em tempo real
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join, relative } from 'path';
import Redis from 'ioredis';
import * as chokidar from 'chokidar';
import crypto from 'crypto';

interface SecurityFinding {
  rule_id: string;
  file: string;
  line: number;
  column: number;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  fix?: string;
  cwe?: string[];
  owasp?: string[];
  context: {
    before: string[];
    match: string;
    after: string[];
  };
}

interface AnalysisMetadata {
  scan_id: string;
  timestamp: string;
  rules_version: string;
  scan_duration_ms: number;
  files_analyzed: number;
  rules_applied: number;
}

interface SemgrepResult {
  findings: SecurityFinding[];
  metadata: AnalysisMetadata;
  performance: {
    scan_duration_ms: number;
    rules_per_second: number;
    files_per_second: number;
  };
}

interface ScanOptions {
  force_refresh?: boolean;
  rules_config?: string;
  severity_filter?: string[];
}

interface AnalysisContext {
  language?: string;
  framework?: string;
  file_type?: string;
  user_intent?: string;
}

interface ComponentSecurityContext {
  component: string;
  total_files: number;
  security_score: number;
  top_risks: SecurityRisk[];
  dependencies: unknown;
  attack_surface: unknown;
  recommendations: string[];
}

interface SecurityRisk {
  rule_id: string;
  severity: string;
  count: number;
  description: string;
}

export class SemgrepMCPServer {
  private redis: Redis | null = null;
  private memoryCache: Map<string, { data: unknown; expires: number }> = new Map();
  private isScanning: boolean = false;
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  private cachePrefix = 'semgrep:mcp:';
  private useMemoryCache: boolean = false;

  constructor() {
    // Tentar conectar ao Redis
    if (process.env.NODE_ENV == 'production' || process.env.REDIS_HOST) {
      try {
        this.redis = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          retryStrategy: (times) => {
            // Em desenvolvimento, desistir após 3 tentativas
            if (process.env.NODE_ENV !== 'production' && times > 3) {
              console.log('[SEMGREP MCP] Redis not available, using in-memory cache');
              this.useMemoryCache = true;
              return null;
            }
            // Retry com backoff exponencial
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
        });

        this.redis.on('error', (err) => {
          if (!this.useMemoryCache) {
            console.error('[SEMGREP MCP] Redis connection error:', err);
            this.useMemoryCache = true;
          }
        });

        this.redis.on('connect', () => {
          console.log('[SEMGREP MCP] Connected to Redis cache');
          this.useMemoryCache = false;
        });
      }
catch (error) {
        console.log('[SEMGREP MCP] Redis initialization failed, using in-memory cache');
        this.useMemoryCache = true;
      }
    }
else {
      console.log('[SEMGREP MCP] Development mode - using in-memory cache');
      this.useMemoryCache = true;
    }

    // Inicializar file watching
    this.initializeRealTimeWatching();

    // Limpar cache expirado periodicamente
    setInterval(() => this.cleanupMemoryCache(), 60000); // A cada 1 minuto
  }

  /**
   * Métodos wrapper para cache (Redis ou memória)
   */
  private async cacheGet(key: string): Promise<string | null> {
    if (this.useMemoryCache) {
      const item = this.memoryCache.get(key);
      if (item && item.expires > Date.now()) {
        return item.data;
      }
      this.memoryCache.delete(key);
      return null;
    }

    try {
      return this.redis ? await this.redis.get(key) : null;
    }
catch (err) {
      console.error('[SEMGREP MCP] Cache get error:', err);
      return null;
    }
  }

  private async cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (this.useMemoryCache) {
      this.memoryCache.set(key, {
        data: value,
        expires: Date.now() + ttlSeconds * 1000,
      });
      return;
    }

    try {
      if (this.redis) {
        await this.redis.setex(key, ttlSeconds, value);
      }
    }
catch (err) {
      console.error('[SEMGREP MCP] Cache set error:', err);
      // Fallback para memória em caso de erro
      this.memoryCache.set(key, {
        data: value,
        expires: Date.now() + ttlSeconds * 1000,
      });
    }
  }

  private async cacheDelete(pattern: string): Promise<void> {
    if (this.useMemoryCache) {
      // Deletar todas as chaves que correspondem ao padrão
      const keys = Array.from(this.memoryCache.keys());
      for (const key of keys) {
        if (key.includes(pattern.replace('*', ''))) {
          this.memoryCache.delete(key);
        }
      }
      return;
    }

    try {
      if (this.redis) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }
    }
catch (err) {
      console.error('[SEMGREP MCP] Cache delete error:', err);
    }
  }

  private cleanupMemoryCache(): void {
    const now = Date.now();
    const entries = Array.from(this.memoryCache.entries());
    for (const [key, item] of entries) {
      if (item.expires < now) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Analisa um arquivo específico e retorna contexto de segurança
   */
  async scanFile(filePath: string, options: ScanOptions = {}): Promise<SemgrepResult> {
    const fileHash = await this.getFileHash(filePath);
    const cacheKey = `${this.cachePrefix}scan:${filePath}:${fileHash}`;

    // Verificar cache primeiro
    if (!options.force_refresh) {
      const cached = await this.cacheGet(cacheKey);
      if (cached) {
        console.log(`[SEMGREP MCP] Cache hit for ${filePath}`);
        return JSON.parse(cached);
      }
    }

    const startTime = Date.now();
    const scanId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      console.log(`[SEMGREP MCP] Scanning file: ${filePath}`);

      // Executar Semgrep
      const semgrepArgs = [
        '--config=auto',
        '--json',
        '--no-git-ignore',
        '--severity=ERROR',
        '--severity=WARNING',
        filePath,
      ];

      // Adicionar config customizada se existir
      if (await this.fileExists('.semgrep.yml')) {
        semgrepArgs.splice(1, 0, '--config=.semgrep.yml');
      }

      const results = await this.executeSemgrep(semgrepArgs);
      const processed = await this.processResults(results, scanId);

      // Cache dos resultados (TTL: 1 hora)
      await this.cacheSet(cacheKey, JSON.stringify(processed), 3600);

      // Adicionar ao histórico
      await this.addToHistory(filePath, processed);

      return processed;
    }
catch (error) {
      throw new Error(`Semgrep scan failed for ${filePath}: ${error.message}`);
    }
  }

  /**
   * Análise de snippet de código em tempo real
   */
  async analyzeSnippet(code: string, context: AnalysisContext): Promise<unknown> {
    const tempFile = await this.createTempFile(code, context.language || 'typescript');

    try {
      const result = await this.scanFile(tempFile, { force_refresh: true });

      // Enriquecer com contexto
      const enrichedResult = await this.enrichWithContext(result, context);

      return {
        findings: enrichedResult.findings,
        suggestions: await this.generateSuggestions(enrichedResult),
        risk_score: this.calculateRiskScore(enrichedResult),
        compliance_status: await this.checkCompliance(enrichedResult),
      };
    }
finally {
      // Limpar arquivo temporário
      await fs.unlink(tempFile).catch (() => {});
    }
  }

  /**
   * Retorna contexto de segurança para componente/módulo
   */
  async getComponentContext(component: string): Promise<ComponentSecurityContext> {
    const componentFiles = await this.findComponentFiles(component);
    const results = await Promise.all(componentFiles.map((file) => this.scanFile(file)));

    return {
      component: component,
      total_files: componentFiles.length,
      security_score: this.calculateComponentScore(results),
      top_risks: this.extractTopRisks(results),
      dependencies: await this.analyzeDependencies(componentFiles),
      attack_surface: this.calculateAttackSurface(results),
      recommendations: await this.generateComponentRecommendations(results),
    };
  }

  /**
   * Histórico de análises de segurança para um arquivo
   */
  async getFileHistory(filePath: string, days: number = 30): Promise<unknown> {
    const historyKey = `${this.cachePrefix}history:${filePath}`;
    // Por enquanto, retornar histórico vazio quando não há Redis
    const history = this.redis ? await this.redis.lrange(historyKey, 0, days) : [];

    return {
      file: filePath,
      analyses: history.map((entry) => JSON.parse(entry)),
      trends: this.calculateSecurityTrends(history),
      improvements: this.identifyImprovements(history),
    };
  }

  /**
   * Retorna regras ativas do Semgrep
   */
  async getActiveRules(): Promise<any[]> {
    const cacheKey = `${this.cachePrefix}rules:active`;

    // Verificar cache
    const cached = await this.cacheGet(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      // Listar regras
      const result = await this.executeSemgrep(['--config=auto', '--list-rules']);

      // Cache por 24 horas
      await this.cacheSet(cacheKey, JSON.stringify(_result), 86400);

      return _result;
    }
catch (error) {
      console.error('[SEMGREP MCP] Failed to get rules:', error);
      return [];
    }
  }

  /**
   * Executa Semgrep com argumentos especificados
   */
  private async executeSemgrep(args: string[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const semgrep = spawn('semgrep', args);
      let _stdout = '';
      let _stderr = '';

      semgrep.stdout.on('data', (_data) => {
        stdout += data.toString();
      });

      semgrep.stderr.on('data', (_data) => {
        stderr += data.toString();
      });

      semgrep.on('close', (code) => {
        if (code == 0 || code == 1 || code == 2) {
          // 0 = success, 1 = findings found, 2 = no findings
          try {
            // Se o output não for JSON, retornar como texto
            if (args.includes('--list-rules')) {
              resolve(stdout.split('\n').filter((line) => line.trim()));
            }
else {
              resolve(JSON.parse(stdout));
            }
          }
catch (parseError) {
            // Se falhar o parse, tentar limpar o output
            const cleanOutput = stdout.substring(stdout.indexOf('{'));
            try {
              resolve(JSON.parse(cleanOutput));
            }
catch {
              reject(new Error(`Failed to parse Semgrep output: ${parseError}`));
            }
          }
        }
else {
          reject(new Error(`Semgrep failed with code ${code}: ${stderr}`));
        }
      });

      semgrep.on('error', (err) => {
        reject(new Error(`Failed to spawn Semgrep: ${err.message}`));
      });
    });
  }

  /**
   * Processa resultados brutos do Semgrep
   */
  private async processResults(rawResults, scanId: string): Promise<SemgrepResult> {
    const findings: SecurityFinding[] =
      rawResults.results?.map((result) => ({
        rule_id: _result.checkid,
        file: _result.path,
        line: _result.start.line,
        column: _result.start.col,
        severity: _result.extra.severity.toUpperCase(),
        message: _result.extra.message,
        fix: _result.extra.fix,
        cwe: _result.extra.metadata?.cwe,
        owasp: _result.extra.metadata?.owasp,
        context: {
          before: _result.extra.lines?.before || [],
          match: _result.extra.lines?.text || '',
          after: _result.extra.lines?.after || [],
        },
      })) || [];

    const metadata: AnalysisMetadata = {
      scan_id: scanId,
      timestamp: new Date().toISOString(),
      rules_version: rawResults.version || 'unknown',
      scan_duration_ms: rawResults.time?.total_time * 1000 || 0,
      files_analyzed: rawResults.paths?.scanned?.length || 1,
      rules_applied: rawResults.paths?.rules?.length || 0,
    };

    return {
      findings,
      metadata,
      performance: {
        scan_duration_ms: metadata.scan_durationms,
        rules_per_second: metadata.rules_applied / (metadata.scan_duration_ms / 1000) || 0,
        files_per_second: metadata.files_analyzed / (metadata.scan_duration_ms / 1000) || 0,
      },
    };
  }

  /**
   * Inicializa file watching para análise em tempo real
   */
  private initializeRealTimeWatching(): void {
    const watcher = chokidar.watch(['client/src/**/*.{ts,tsx}', 'server/**/*.ts'], {
      ignored: /node_modules/,
      persistent: true,
    });

    watcher.on('change', async (filePath: string) => {
      console.log(`[SEMGREP MCP] File changed: ${filePath}`);

      // Invalidar cache
      const pattern = `${this.cachePrefix}scan:${filePath}:*`;
      await this.cacheDelete(pattern);

      // Trigger análise incremental
      try {
        await this.scanFile(filePath, { force_refresh: true });
        console.log(`[SEMGREP MCP] Real-time analysis completed for ${filePath}`);
      }
catch (error) {
        console.error(`[SEMGREP MCP] Real-time analysis failed for ${filePath}:`, error);
      }
    });
  }

  /**
   * Calcula hash de arquivo para cache
   */
  private async getFileHash(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return crypto.createHash('sha256').update(content).digest('hex').substring(0, 8);
    }
catch {
      return 'unknown';
    }
  }

  /**
   * Verifica se arquivo existe
   */
  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    }
catch {
      return false;
    }
  }

  /**
   * Cria arquivo temporário para análise
   */
  private async createTempFile(content: string, language: string): Promise<string> {
    const extension = this.getExtensionForLanguage(language);
    const tempDir = '/tmp';
    const fileName = `semgrep_temp_${Date.now()}.${extension}`;
    const filePath = join(tempDir, fileName);

    await fs.writeFile(filePath, content, 'utf8');
    return filePath;
  }

  /**
   * Mapeia linguagem para extensão de arquivo
   */
  private getExtensionForLanguage(language: string): string {
    const map: Record<string, string> = {
      typescript: 'ts',
      javascript: 'js',
      python: 'py',
      java: 'java',
      go: 'go',
      ruby: 'rb',
      php: 'php',
    };
    return map[language.toLowerCase()] || 'txt';
  }

  /**
   * Adiciona análise ao histórico
   */
  private async addToHistory(filePath: string, result: SemgrepResult): Promise<void> {
    if (!this.redis) return; // Histórico só funciona com Redis

    const historyKey = `${this.cachePrefix}history:${filePath}`;
    const entry = {
      timestamp: _result.metadata.timestamp,
      findings_count: _result.findings.length,
      critical: _result.findings.filter((f) => f.severity == 'ERROR').length,
      warnings: _result.findings.filter((f) => f.severity == 'WARNING').length,
    };

    await this.redis.lpush(historyKey, JSON.stringify(entry));
    await this.redis.ltrim(historyKey, 0, 99); // Manter últimas 100 análises
    await this.redis.expire(historyKey, 2592000); // 30 dias
  }

  /**
   * Enriquece resultado com contexto adicional
   */
  private async enrichWithContext(
    result: SemgrepResult,
    context: AnalysisContext
  ): Promise<SemgrepResult> {
    // Adicionar contexto específico baseado na linguagem/framework
    if (context.framework == 'react') {
      // Adicionar regras específicas do React
    }

    if (context.language == 'typescript') {
      // Adicionar análise de tipos
    }

    return _result;
  }

  /**
   * Gera sugestões baseadas nos findings
   */
  private async generateSuggestions(result: SemgrepResult): Promise<string[]> {
    const suggestions: string[] = [];

    _result.findings.forEach((finding) => {
      if (finding.fix) {
        suggestions.push(`Fix for ${finding.rule_id}: ${finding.fix}`);
      }
    });

    return suggestions;
  }

  /**
   * Calcula score de risco
   */
  private calculateRiskScore(result: SemgrepResult): number {
    let _score = 0;

    _result.findings.forEach((finding) => {
      if (finding.severity == 'ERROR') score += 10;
      if (finding.severity == 'WARNING') score += 5;
      if (finding.severity == 'INFO') score += 1;
    });

    return Math.min(score, 100);
  }

  /**
   * Verifica compliance
   */
  private async checkCompliance(result: SemgrepResult): Promise<unknown> {
    return {
      owasp_top_10: _result.findings.filter((f) => f.owasp && f.owasp.length > 0).length == 0,
      cwe_sans_top_25: _result.findings.filter((f) => f.cwe && f.cwe.length > 0).length == 0,
    };
  }

  /**
   * Encontra arquivos de um componente
   */
  private async findComponentFiles(component: string): Promise<string[]> {
    // Implementação simplificada - em produção, usar glob patterns
    const files: string[] = [];
    const dirs = ['client/src', 'server'];

    for (const dir of dirs) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && entry.name.includes(component)) {
            files.push(join(dir, entry.name));
          }
        }
      }
catch {
        // Ignorar diretórios não encontrados
      }
    }

    return files;
  }

  /**
   * Calcula score de segurança do componente
   */
  private calculateComponentScore(results: SemgrepResult[]): number {
    if (results.length == 0) return 100;

    let _totalFindings = 0;
    let _criticalFindings = 0;

    results.forEach((_result) => {
      totalFindings += _result.findings.length;
      criticalFindings += _result.findings.filter((f) => f.severity == 'ERROR').length;
    });

    // Fórmula simplificada
    const score = 100 - (criticalFindings * 10 + totalFindings * 2);
    return Math.max(0, score);
  }

  /**
   * Extrai principais riscos
   */
  private extractTopRisks(results: SemgrepResult[]): SecurityRisk[] {
    const riskMap = new Map<string, SecurityRisk>();

    results.forEach((_result) => {
      _result.findings.forEach((finding) => {
        const key = finding.rule_id;
        if (!riskMap.has(key)) {
          riskMap.set(key, {
            rule_id: finding.ruleid,
            severity: finding.severity,
            count: 0,
            description: finding.message,
          });
        }
        riskMap.get(key)!.count++;
      });
    });

    return Array.from(riskMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Analisa dependências
   */
  private async analyzeDependencies(files: string[]): Promise<unknown> {
    // Implementação futura - integração com Dependency-Check
    return {
      total: 0,
      vulnerable: 0,
      outdated: 0,
    };
  }

  /**
   * Calcula superfície de ataque
   */
  private calculateAttackSurface(results: SemgrepResult[]): unknown {
    return {
      exposed_endpoints: 0,
      authentication_issues: results.filter((r) =>
        r.findings.some((f) => f.rule_id.includes('auth'))
      ).length,
      input_validation_issues: results.filter((r) =>
        r.findings.some((f) => f.rule_id.includes('injection'))
      ).length,
    };
  }

  /**
   * Gera recomendações para componente
   */
  private async generateComponentRecommendations(results: SemgrepResult[]): Promise<string[]> {
    const recommendations: string[] = [];

    const totalFindings = results.reduce((sum, r) => sum + r.findings.length, 0);
    if (totalFindings > 10) {
      recommendations.push('Consider refactoring this component to reduce security complexity');
    }

    const hasAuthIssues = results.some((r) => r.findings.some((f) => f.rule_id.includes('auth')));
    if (hasAuthIssues) {
      recommendations.push('Review authentication implementation and use established patterns');
    }

    return recommendations;
  }

  /**
   * Calcula tendências de segurança
   */
  private calculateSecurityTrends(history: string[]): unknown {
    // Análise simplificada de tendências
    return {
      improving: history.length > 1,
      trend: 'stable',
    };
  }

  /**
   * Identifica melhorias
   */
  private identifyImprovements(history: string[]): unknown[] {
    return [];
  }
}

// Exportar singleton
export const semgrepMCPServer = new SemgrepMCPServer();
