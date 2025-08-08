/**
 * OWASP Dependency-Check Integration
 *
 * Integração com OWASP Dependency-Check para análise
 * contínua de vulnerabilidades em dependências.
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import { EventEmitter } from "events";

const execAsync = promisify(exec);

export interface DependencyVulnerability {
  dependency: string;
  version: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  cve: string;
  description: string;
  recommendation: string;
  cvssScore: number;
  cweId?: string;
}

export interface DependencyScanResult {
  timestamp: Date;
  totalDependencies: number;
  vulnerableDependencies: number;
  vulnerabilities: DependencyVulnerability[];
  reportPath: string;
}

export class DependencyScanner extends EventEmitter {
  private scanInterval: NodeJS.Timeout | null = null;
  private lastScanResult: DependencyScanResult | null = null;
  private isScanning = false;

  constructor() {
    super();
  }

  /**
   * Iniciar monitoramento contínuo de dependências
   */
  async start() {
    console.log("🔍 [DEPENDENCY-CHECK] Iniciando scanner de dependências...");

    // Verificar se Dependency-Check está instalado
    const isInstalled = await this.checkInstallation();
    if (!isInstalled) {
      await this.installDependencyCheck();
    }

    // Executar scan inicial
    await this.runScan();

    // Agendar scans periódicos (a cada 6 horas)
    this.scanInterval = setInterval(
      () => {
        this.runScan();
      },
      6 * 60 * 60 * 1000
    );

    // Monitorar mudanças no package.json
    this.watchPackageChanges();
  }

  /**
   * Verificar se Dependency-Check está instalado
   */
  private async checkInstallation(): Promise<boolean> {
    try {
      await execAsync("dependency-check --version");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Instalar OWASP Dependency-Check
   */
  private async installDependencyCheck() {
    console.log("📦 [DEPENDENCY-CHECK] Instalando OWASP Dependency-Check...");

    try {
      // Download e instalação via script
      const installScript = `
        #!/bin/bash
        VERSION="9.0.7"
        curl -L "https://github.com/jeremylong/DependencyCheck/releases/download/v\${VERSION}/dependency-check-\${VERSION}-release.zip" -o dependency-check.zip
        unzip -q dependency-check.zip
        rm dependency-check.zip
        chmod +x dependency-check/bin/dependency-check.sh
        ln -sf $(pwd)/dependency-check/bin/dependency-check.sh /usr/local/bin/dependency-check
      `;

      await fs.writeFile("install-dependency-check.sh", installScript);
      await execAsync("chmod +x install-dependency-check.sh && ./install-dependency-check.sh");
      await fs.unlink("install-dependency-check.sh");

      console.log("✅ [DEPENDENCY-CHECK] Instalação concluída");
    } catch (error) {
      console.error("❌ [DEPENDENCY-CHECK] Erro na instalação:", error);
      this.emit("error", { type: "installation", error });
    }
  }

  /**
   * Executar scan de dependências
   */
  async runScan(): Promise<DependencyScanResult | null> {
    if (this.isScanning) {
      console.log("⏳ [DEPENDENCY-CHECK] Scan já em andamento...");
      return null;
    }

    this.isScanning = true;
    console.log("🔍 [DEPENDENCY-CHECK] Iniciando scan de dependências...");

    try {
      const timestamp = new Date();
      const reportDir = path.join(process.cwd(), "security-reports");
      await fs.mkdir(reportDir, { recursive: true });

      // Executar Dependency-Check
      const command = `dependency-check \
        --project "Simpix" \
        --scan . \
        --out ${reportDir} \
        --format JSON \
        --format HTML \
        --suppression dependency-check-suppression.xml \
        --enableExperimental \
        --nodePackageSkipDevDependencies \
        --nodeAuditSkipDevDependencies`;

      await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });

      // Processar resultados
      const jsonReport = await fs.readFile(
        path.join(reportDir, "dependency-check-report.json"),
        "utf-8"
      );

      const report = JSON.parse(jsonReport);
      const vulnerabilities = this.parseVulnerabilities(report);

      const result: DependencyScanResult = {
        timestamp,
        totalDependencies: report.dependencies?.length || 0,
        vulnerableDependencies: vulnerabilities.length,
        vulnerabilities,
        reportPath: path.join(reportDir, "dependency-check-report.html"),
      };

      this.lastScanResult = result;

      // Emitir eventos
      if (vulnerabilities.length > 0) {
        this.emit("vulnerabilities-found", result);

        // Alertar sobre vulnerabilidades críticas
        const critical = vulnerabilities.filter(v => v.severity === "CRITICAL");
        if (critical.length > 0) {
          this.emit("critical-vulnerabilities", critical);
        }
      }

      console.log(
        `✅ [DEPENDENCY-CHECK] Scan concluído: ${vulnerabilities.length} vulnerabilidades encontradas`
      );

      return result;
    } catch (error) {
      console.error("❌ [DEPENDENCY-CHECK] Erro no scan:", error);
      this.emit("error", { type: "scan", error });
      return null;
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Processar vulnerabilidades do relatório
   */
  private parseVulnerabilities(report: any): DependencyVulnerability[] {
    const vulnerabilities: DependencyVulnerability[] = [];

    if (!report.dependencies) return vulnerabilities;

    report.dependencies.forEach((dep: any) => {
      if (dep.vulnerabilities && dep.vulnerabilities.length > 0) {
        dep.vulnerabilities.forEach((vuln: any) => {
          vulnerabilities.push({
            dependency: dep.fileName || dep.description,
            version: dep.version || "unknown",
            severity: this.mapSeverity(vuln.severity),
            cve: vuln.name,
            description: vuln.description,
            recommendation: this.generateRecommendation(vuln),
            cvssScore: vuln.cvssv3?.baseScore || vuln.cvssv2?.score || 0,
            cweId: vuln.cwes?.[0],
          });
        });
      }
    });

    // Ordenar por severidade
    return vulnerabilities.sort((a, b) => {
      const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Mapear severidade
   */
  private mapSeverity(severity: string): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
    const normalized = severity.toUpperCase();
    if (["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(normalized)) {
      return normalized as any;
    }

    // Mapear por score CVSS
    const score = parseFloat(severity);
    if (!isNaN(score)) {
      if (score >= 9.0) return "CRITICAL";
      if (score >= 7.0) return "HIGH";
      if (score >= 4.0) return "MEDIUM";
      return "LOW";
    }

    return "MEDIUM"; // Default
  }

  /**
   * Gerar recomendação
   */
  private generateRecommendation(vuln: any): string {
    const recommendations = [];

    if (vuln.name.includes("CVE")) {
      recommendations.push(
        `Verificar detalhes em https://cve.mitre.org/cgi-bin/cvename.cgi?name=${vuln.name}`
      );
    }

    if (vuln.severity === "CRITICAL" || vuln.cvssv3?.baseScore >= 9.0) {
      recommendations.push("AÇÃO IMEDIATA NECESSÁRIA: Atualizar ou remover dependência");
    } else if (vuln.severity === "HIGH" || vuln.cvssv3?.baseScore >= 7.0) {
      recommendations.push("Atualizar dependência o mais rápido possível");
    } else {
      recommendations.push("Avaliar necessidade de atualização baseado no contexto de uso");
    }

    return recommendations.join(". ");
  }

  /**
   * Monitorar mudanças no package.json
   */
  private watchPackageChanges() {
    const packagePath = path.join(process.cwd(), "package.json");

    fs.watch(packagePath, async eventType => {
      if (eventType === "change") {
        console.log("📦 [DEPENDENCY-CHECK] package.json modificado, executando novo scan...");
        await this.runScan();
      }
    });
  }

  /**
   * Verificar vulnerabilidade específica
   */
  async checkSpecificDependency(packageName: string): Promise<DependencyVulnerability[]> {
    if (!this.lastScanResult) {
      await this.runScan();
    }

    return (
      this.lastScanResult?.vulnerabilities.filter(v =>
        v.dependency.toLowerCase().includes(packageName.toLowerCase())
      ) || []
    );
  }

  /**
   * Gerar relatório resumido
   */
  getSummaryReport(): {
    lastScan: Date | null;
    totalVulnerabilities: number;
    bySeverity: Record<string, number>;
    topVulnerabilities: DependencyVulnerability[];
  } {
    const vulnerabilities = this.lastScanResult?.vulnerabilities || [];
    const bySeverity: Record<string, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    vulnerabilities.forEach(v => {
      bySeverity[v.severity]++;
    });

    return {
      lastScan: this.lastScanResult?.timestamp || null,
      totalVulnerabilities: vulnerabilities.length,
      bySeverity,
      topVulnerabilities: vulnerabilities.slice(0, 10),
    };
  }

  /**
   * Criar arquivo de supressão
   */
  async createSuppressionFile(suppressions: Array<{ cve: string; reason: string }>) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<suppressions xmlns="https://jeremylong.github.io/DependencyCheck/dependency-suppression.1.3.xsd">
${suppressions
  .map(
    s => `
  <suppress>
    <cve>${s.cve}</cve>
    <notes>${s.reason}</notes>
  </suppress>
`
  )
  .join("")}
</suppressions>`;

    await fs.writeFile("dependency-check-suppression.xml", xml);
  }

  /**
   * Parar scanner
   */
  stop() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }
}

// Exportar instância singleton
let scanner: DependencyScanner | null = null;

export function getDependencyScanner(): DependencyScanner {
  if (!scanner) {
    scanner = new DependencyScanner();
  }
  return scanner;
}
