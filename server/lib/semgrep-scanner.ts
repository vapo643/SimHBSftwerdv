/**
 * Semgrep Integration - SAST com IA
 *
 * Integração com Semgrep para análise estática de código
 * com detecção inteligente de vulnerabilidades.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fsPromises from 'fs/promises';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

const _execAsync = promisify(exec);

export interface SemgrepFinding {
  id: string;
  rule: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  file: string;
  line: number;
  column: number;
  message: string;
  code: string;
  category: string;
  cweId?: string;
  owaspId?: string;
  fixSuggestion?: string;
}

export interface SemgrepScanResult {
  timestamp: Date;
  totalFindings: number;
  criticalFindings: number;
  findings: SemgrepFinding[];
  scanDuration: number;
}

export class SemgrepScanner extends EventEmitter {
  private scanInterval: NodeJS.Timeout | null = null;
  private lastScanResult: SemgrepScanResult | null = null;
  private isScanning = false;
  private customRules: Map<string, string> = new Map();

  // Rulesets otimizados para o projeto
  private rulesets = [
    'auto', // Detecção automática
    'security-audit',
    'owasp-top-ten',
    'nodejs',
    'typescript',
    'react',
    'jwt',
    'sql-injection',
    'xss',
    'secrets',
  ];

  constructor() {
    super();
    this.initializeCustomRules();
  }

  /**
   * Inicializar regras customizadas
   */
  private initializeCustomRules() {
    // Regras específicas para o projeto Simpix
    this.customRules.set(
      'simpix-jwt-validation',
      `
rules:
  - id: simpix-jwt-token-exposure
    pattern-either:
      - pattern: console.log($...ARGS)
      - pattern: console.error($...ARGS)
      - pattern: console.debug($...ARGS)
    metavar-regex:
      ARGS: .*[jJ][wW][tT].*|.*token.*|.*Token.*
    message: "JWT token sendo logado - risco de exposição"
    severity: ERROR
    languages: [typescript, javascript]
    
  - id: simpix-hardcoded-secret
    pattern-either:
      - pattern: |
          $KEY = "..."
      - pattern: |
          $KEY = '...'
    metavar-regex:
      KEY: .*SECRET.*|.*KEY.*|.*TOKEN.*|.*PASSWORD.*
    message: "Possível secret hardcoded"
    severity: ERROR
    languages: [typescript, javascript]
`
    );

    this.customRules.set(
      'simpix-sql-injection',
      `
rules:
  - id: simpix-unsafe-sql
    patterns:
      - pattern-either:
          - pattern: db.execute(\`... \${$VAR} ...\`)
          - pattern: db.query(\`... \${$VAR} ...\`)
          - pattern: sql\`... \${$VAR} ...\`
      - pattern-not: db.execute(\`... \${sql.identifier($VAR)} ...\`)
    message: "SQL injection - use prepared statements"
    severity: ERROR
    languages: [typescript, javascript]
`
    );

    this.customRules.set(
      'simpix-auth-bypass',
      `
rules:
  - id: simpix-missing-auth-check
    patterns:
      - pattern: |
          app.$METHOD("...", async (req, res) => {
            ...
          })
      - pattern-not: |
          app.$METHOD("...", $AUTH, async (req, res) => {
            ...
          })
      - metavar-regex:
          METHOD: post|put|delete|patch
    message: "Endpoint sem middleware de autenticação"
    severity: WARNING
    languages: [typescript, javascript]
`
    );
  }

  /**
   * Iniciar monitoramento contínuo
   */
  async start() {
    console.log('🔍 [SEMGREP] Iniciando scanner SAST...');

    // Verificar instalação
    const _isInstalled = await this.checkInstallation();
    if (!isInstalled) {
      await this.installSemgrep();
    }

    // Criar regras customizadas
    await this.createCustomRulesFile();

    // Executar scan inicial
    await this.runScan();

    // Monitorar mudanças no código
    this.watchCodeChanges();

    // Scans periódicos (a cada 30 minutos)
    this.scanInterval = setInterval(
      () => {
        this.runScan();
      },
      30 * 60 * 1000
    );
  }

  /**
   * Verificar se Semgrep está instalado
   */
  private async checkInstallation(): Promise<boolean> {
    try {
      await execAsync('semgrep --version');
      return true;
    }
catch {
      return false;
    }
  }

  /**
   * Instalar Semgrep
   */
  private async installSemgrep() {
    console.log('📦 [SEMGREP] Instalando Semgrep...');

    try {
      // Instalar via pip
      await execAsync('pip install semgrep');
      console.log('✅ [SEMGREP] Instalação concluída');
    }
catch (error) {
      console.error('❌ [SEMGREP] Erro na instalação:', error);
      this.emit('error', { type: 'installation', error });
    }
  }

  /**
   * Criar arquivo de regras customizadas
   */
  private async createCustomRulesFile() {
    const _rulesDir = path.join(process.cwd(), '.semgrep');
    await fsPromises.mkdir(rulesDir, { recursive: true });

    // Salvar cada conjunto de regras
    for (const [name, rules] of Array.from(this.customRules)) {
      await fsPromises.writeFile(path.join(rulesDir, `${name}.yml`), rules);
    }
  }

  /**
   * Executar scan
   */
  async runScan(): Promise<SemgrepScanResult | null> {
    if (this.isScanning) {
      console.log('⏳ [SEMGREP] Scan já em andamento...');
      return null;
    }

    this.isScanning = true;
    console.log('🔍 [SEMGREP] Iniciando análise SAST...');

    const _startTime = Date.now();

    try {
      const _resultsPath = path.join(process.cwd(), 'semgrep-results.json');

      // Construir comando
      const _command = `semgrep \
        --config=auto \
        --config=.semgrep/ \
        --json \
        --output=${resultsPath} \
        --severity=INFO \
        --metrics=off \
        --no-git-ignore \
        --timeout=300 \
        --max-memory=2048 \
        --jobs=4 \
        --exclude=node_modules \
        --exclude=dist \
        --exclude=build \
        .`;

      // Executar Semgrep
      await execAsync(command, {
        maxBuffer: 50 * 1024 * 1024,
        env: { ...process.env, SEMGREP_SEND_METRICS: 'off' },
      });

      // Processar resultados
      const _results = JSON.parse(await fsPromises.readFile(resultsPath, 'utf-8'));

      const _findings = this.parseFindings(results);
      const _scanDuration = Date.now() - startTime;

      const _result: SemgrepScanResult = {
        timestamp: new Date(),
        totalFindings: findings.length,
        criticalFindings: findings.filter((f) => f.severity == 'ERROR').length,
  _findings,
  _scanDuration,
      };

      this.lastScanResult = result;

      // Analisar novos findings
      await this.analyzeNewFindings(findings);

      // Emitir eventos
      if (findings.length > 0) {
        this.emit('findings',_result);

        const _critical = findings.filter((f) => f.severity == 'ERROR');
        if (critical.length > 0) {
          this.emit('critical-findings', critical);
        }
      }

      console.log(
        `✅ [SEMGREP] Scan concluído: ${findings.length} problemas encontrados em ${scanDuration}ms`
      );

      // Limpar arquivo temporário
      await fsPromises.unlink(resultsPath).catch (() => {});

      return _result;
    }
catch (error) {
      console.error('❌ [SEMGREP] Erro no scan:', error);
      this.emit('error', { type: 'scan', error });
      return null;
    }
finally {
      this.isScanning = false;
    }
  }

  /**
   * Processar findings
   */
  private parseFindings(results): SemgrepFinding[] {
    const findings: SemgrepFinding[] = [];

    if (!results.results) return findings;

    results.results.forEach((result) => {
      findings.push({
        id: `SEMGREP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        rule: _result.check_id,
        severity: this.mapSeverity(_result.extra.severity),
        file: _result.path,
        line: _result.start.line,
        column: _result.start.col,
        message: _result.extra.message,
        code: _result.extra.lines || '',
        category: this.categorizeRule(_result.check_id),
        cweId: _result.extra.metadata?.cwe,
        owaspId: _result.extra.metadata?.owasp,
        fixSuggestion: _result.extra.fix || this.generateFixSuggestion(_result),
      });
    });

    return findings.sort((a, b) => {
      const _severityOrder = { ERROR: 3, WARNING: 2, INFO: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Mapear severidade
   */
  private mapSeverity(severity: string): 'INFO' | 'WARNING' | 'ERROR' {
    switch (severity.toUpperCase()) {
      case 'ERROR': {
        break;
        }
        break;
      }
      case 'CRITICAL': {
        break;
        }
      }
      case 'HIGH': {
        break;
        }
        return 'ERROR';
      case 'WARNING': {
        break;
        }
        break;
      }
      case 'MEDIUM': {
        break;
        }
        return 'WARNING';
      default:
        return 'INFO';
    }
  }

  /**
   * Categorizar regra
   */
  private categorizeRule(ruleId: string): string {
    if (ruleId.includes('sql')) return 'SQL Injection';
    if (ruleId.includes('xss')) return 'Cross-Site Scripting';
    if (ruleId.includes('jwt') || ruleId.includes('auth')) return 'Authentication';
    if (ruleId.includes('secret') || ruleId.includes('key')) return 'Secrets';
    if (ruleId.includes('injection')) return 'Injection';
    if (ruleId.includes('crypto')) return 'Cryptography';
    return 'Security';
  }

  /**
   * Gerar sugestão de correção
   */
  private generateFixSuggestion(result): string {
    const _rule = _result.check_id;

    const suggestions: Record<string, string> = {
      'simpix-jwt-token-exposure':
        'Remova logs contendo tokens JWT. Use um logger que filtre dados sensíveis.',
      'simpix-hardcoded-secret':
        'Mova secrets para variáveis de ambiente. Use process.env.NOME_DA_VARIAVEL',
      'simpix-unsafe-sql': 'Use prepared statements ou query builders como Drizzle ORM',
      'simpix-missing-auth-check':
        'Adicione middleware de autenticação: app.post("/rota", _jwtAuthMiddleware, handler)',
      'javascript.express.security.audit.xss.ejs.var-in-script-tag':
        'Escape dados do usuário antes de inserir no HTML',
      'javascript.lang.security.audit.path-traversal':
        'Valide e sanitize caminhos de arquivo. Use path.join() e verifique se está dentro do diretório esperado',
    };

    return suggestions[rule] || 'Revise o código para corrigir a vulnerabilidade identificada';
  }

  /**
   * Analisar novos findings
   */
  private async analyzeNewFindings(findings: SemgrepFinding[]) {
    // Comparar com scan anterior
    if (!this.lastScanResult) return;

    const _previousIds = new Set(
      this.lastScanResult.findings.map((f) => `${f.rule}:${f.file}:${f.line}`)
    );

    const _newFindings = findings.filter((f) => !previousIds.has(`${f.rule}:${f.file}:${f.line}`));

    if (newFindings.length > 0) {
      console.log(`🆕 [SEMGREP] ${newFindings.length} novos problemas detectados`);
      this.emit('new-findings', newFindings);

      // Aprender com novos padrões
      this.learnFromFindings(newFindings);
    }
  }

  /**
   * Aprender com findings para melhorar detecção
   */
  private learnFromFindings(findings: SemgrepFinding[]) {
    // Agrupar por categoria
    const _byCategory = new Map<string, number>();
    findings.forEach((f) => {
      byCategory.set(f.category, (byCategory.get(f.category) || 0) + 1);
    });

    // Identificar padrões recorrentes
    byCategory.forEach((count, category) => {
      if (count > 5) {
        console.log(`📊 [SEMGREP] Padrão recorrente detectado: ${category} (${count} ocorrências)`);
        // Aqui poderia ajustar regras ou criar novas baseadas no padrão
      }
    });
  }

  /**
   * Monitorar mudanças no código
   */
  private watchCodeChanges() {
    const _directories = ['server', 'client/src', 'shared'];

    directories.forEach((dir) => {
      const _fullPath = path.join(process.cwd(), dir);

      // Criar callback separadamente para evitar problemas de tipagem
      const _watchCallback = (eventType: string, filename?: string) => {
        if (filename && (filename.endsWith('.ts') || filename.endsWith('.tsx'))) {
          console.log(`📝 [SEMGREP] Arquivo modificado: ${filename}`);

          // Debounce para evitar múltiplos scans
          if (this.scanTimeout) clearTimeout(this.scanTimeout);

          this.scanTimeout = setTimeout(() => {
            console.log('🔍 [SEMGREP] Executando scan incremental...');
            this.runIncrementalScan(path.join(fullPath, filename || ''));
          }, 5000);
        }
      };

      try {
        fs.watch(fullPath, { recursive: true }, watchCallback as fs.WatchListener<string>);
      }
catch (error) {
        console.warn(`⚠️ [SEMGREP] Não foi possível monitorar diretório: ${fullPath}`, error);
      }
    });
  }

  private scanTimeout: NodeJS.Timeout | null = null;

  /**
   * Scan incremental de arquivo específico
   */
  private async runIncrementalScan(filePath: string) {
    try {
      const _command = `semgrep \
        --config=auto \
        --config=.semgrep/ \
        --json \
        --severity=INFO \
        --metrics=off \
        ${filePath}`;

      const { stdout } = await execAsync(command);
      const _results = JSON.parse(stdout);
      const _findings = this.parseFindings(results);

      if (findings.length > 0) {
        console.log(`⚠️  [SEMGREP] ${findings.length} problemas em ${filePath}`);
        this.emit('incremental-findings', { file: filePath, findings });
      }
    }
catch (error) {
      // Ignorar erros em scans incrementais
    }
  }

  /**
   * Obter relatório resumido
   */
  getSummaryReport(): {
    lastScan: Date | null;
    totalFindings: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    topFindings: SemgrepFinding[];
  } {
    const _findings = this.lastScanResult?.findings || [];

    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {
      ERROR: 0,
      WARNING: 0,
      INFO: 0,
    };

    findings.forEach((f) => {
      byCategory[f.category] = (byCategory[f.category] || 0) + 1;
      bySeverity[f.severity]++;
    });

    return {
      lastScan: this.lastScanResult?.timestamp || null,
      totalFindings: findings.length,
  _byCategory,
  _bySeverity,
      topFindings: findings.slice(0, 10),
    };
  }

  /**
   * Parar scanner
   */
  stop() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }
  }
}

// Exportar instância singleton
let scanner: SemgrepScanner | null = null;

export function getSemgrepScanner(): SemgrepScanner {
  if (!scanner) {
    scanner = new SemgrepScanner();
  }
  return scanner;
}
