#!/usr/bin/env python3
"""
Projeto Cérbero - OWASP Dependency Check v12.1.0 Integration with Exception Management
Executa scan de vulnerabilidades e aplica exceções documentadas
Compatível com OWASP Dependency-Check v12.1.0
"""

import yaml
import json
import sys
import subprocess
import os
from datetime import datetime
from typing import List, Dict, Any

class VulnerabilityExceptionManager:
    def __init__(self, config_path: str = '.security/vulnerability-exceptions.yml'):
        self.config_path = config_path
        self.exceptions = []
        self.load_exceptions()
    
    def load_exceptions(self):
        """Carrega exceções do arquivo YAML"""
        try:
            with open(self.config_path, 'r') as f:
                config = yaml.safe_load(f)
                self.exceptions = config.get('exceptions', [])
                self.global_settings = config.get('global_settings', {})
                self.validate_exceptions()
        except FileNotFoundError:
            print(f"⚠️  Arquivo de exceções não encontrado: {self.config_path}")
            self.exceptions = []
        except Exception as e:
            print(f"❌ Erro ao carregar exceções: {e}")
            sys.exit(1)
    
    def validate_exceptions(self):
        """Valida e remove exceções expiradas"""
        now = datetime.now()
        valid_exceptions = []
        
        for exception in self.exceptions:
            # Verificar expiração
            if 'expiry_date' in exception:
                expiry = datetime.fromisoformat(exception['expiry_date'].replace('Z', '+00:00'))
                if expiry < now:
                    print(f"⚠️  Exceção expirada ignorada: {exception['id']}")
                    continue
            
            # Verificar necessidade de revisão
            if 'review_date' in exception:
                review = datetime.fromisoformat(exception['review_date'].replace('Z', '+00:00'))
                if review < now:
                    print(f"⚠️  Exceção requer revisão: {exception['id']}")
                    exception['requires_review'] = True
            
            valid_exceptions.append(exception)
        
        self.exceptions = valid_exceptions
    
    def is_vulnerability_excepted(self, cve_id: str, package: str, severity: str, score: float) -> bool:
        """Verifica se uma vulnerabilidade está excetuada"""
        for exception in self.exceptions:
            if (exception['id'] == cve_id and 
                exception['package'] == package and
                not exception.get('requires_review', False)):
                
                print(f"✅ Vulnerabilidade excetuada: {cve_id} em {package}")
                print(f"   Justificativa: {exception['justification'][:100]}...")
                print(f"   Aprovado por: {exception['approved_by']}")
                return True
        
        return False


class DependencyCheckRunner:
    def __init__(self, exception_manager: VulnerabilityExceptionManager):
        self.exception_manager = exception_manager
        self.report_path = 'reports/dependency-check-report.json'
        
    def run_dependency_check(self):
        """Executa OWASP Dependency Check"""
        print("🔍 Executando OWASP Dependency-Check...")
        
        # Criar diretório de relatórios se não existir
        os.makedirs('reports', exist_ok=True)
        
        # Comando do Dependency Check
        cmd = [
            'dependency-check',
            '--project', 'Simpix Credit Management',
            '--scan', '.',
            '--format', 'JSON',
            '--format', 'HTML',
            '--out', 'reports/',
            '--failOnCVSS', '0',  # Não falhar automaticamente
            '--enableExperimental',
            '--exclude', '**/.security/**',
            '--exclude', '**/node_modules/**',
            '--exclude', '**/dist/**'
        ]
        
        try:
            # Executar scan
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode not in [0, 1]:  # 1 = vulnerabilidades encontradas
                print(f"❌ Erro ao executar Dependency Check: {result.stderr}")
                return False
                
            print("✅ Scan concluído com sucesso")
            return True
            
        except FileNotFoundError:
            print("❌ OWASP Dependency-Check não encontrado. Por favor, instale-o primeiro.")
            print("   Visite: https://owasp.org/www-project-dependency-check/")
            return False
        except Exception as e:
            print(f"❌ Erro inesperado: {e}")
            return False
    
    def process_results(self) -> tuple[int, int, List[Dict]]:
        """Processa resultados e aplica exceções"""
        try:
            with open(self.report_path, 'r') as f:
                report = json.load(f)
        except FileNotFoundError:
            print(f"❌ Relatório não encontrado: {self.report_path}")
            return 0, 0, []
        except json.JSONDecodeError:
            print(f"❌ Erro ao ler relatório JSON")
            return 0, 0, []
        
        critical_unexcepted = 0
        high_unexcepted = 0
        vulnerabilities_found = []
        
        dependencies = report.get('dependencies', [])
        
        for dependency in dependencies:
            vulnerabilities = dependency.get('vulnerabilities', [])
            
            for vuln in vulnerabilities:
                cve_id = vuln.get('name', 'UNKNOWN')
                package = dependency.get('fileName', 'unknown')
                severity = vuln.get('severity', 'UNKNOWN')
                
                # Obter score CVSS
                cvss_score = 0
                if 'cvssv3' in vuln:
                    cvss_score = vuln['cvssv3'].get('baseScore', 0)
                elif 'cvssv2' in vuln:
                    cvss_score = vuln['cvssv2'].get('score', 0)
                
                # Verificar se está excetuada
                is_excepted = self.exception_manager.is_vulnerability_excepted(
                    cve_id, package, severity, cvss_score
                )
                
                if not is_excepted:
                    vuln_info = {
                        'cve': cve_id,
                        'package': package,
                        'severity': severity,
                        'score': cvss_score,
                        'description': vuln.get('description', '')
                    }
                    vulnerabilities_found.append(vuln_info)
                    
                    if cvss_score >= 9.0 or severity == 'CRITICAL':
                        critical_unexcepted += 1
                    elif cvss_score >= 7.0 or severity == 'HIGH':
                        high_unexcepted += 1
        
        return critical_unexcepted, high_unexcepted, vulnerabilities_found
    
    def generate_summary(self, critical: int, high: int, vulns: List[Dict]):
        """Gera resumo dos resultados"""
        print("\n📊 RESUMO DA ANÁLISE DE DEPENDÊNCIAS")
        print("=" * 50)
        print(f"Vulnerabilidades Críticas não excetuadas: {critical}")
        print(f"Vulnerabilidades Altas não excetuadas: {high}")
        print(f"Total de vulnerabilidades não excetuadas: {len(vulns)}")
        
        if len(vulns) > 0:
            print("\n⚠️  VULNERABILIDADES ENCONTRADAS:")
            for vuln in vulns[:10]:  # Mostrar apenas as 10 primeiras
                print(f"\n• {vuln['cve']} (CVSS: {vuln['score']})")
                print(f"  Pacote: {vuln['package']}")
                print(f"  Severidade: {vuln['severity']}")
                print(f"  Descrição: {vuln['description'][:150]}...")
            
            if len(vulns) > 10:
                print(f"\n... e mais {len(vulns) - 10} vulnerabilidades")
        
        print("\n📄 Relatório completo disponível em: reports/dependency-check-report.html")


def main():
    """Função principal"""
    print("🚀 Projeto Cérbero - Sistema de Gestão de Vulnerabilidades")
    print("=" * 60)
    
    # Carregar exceções
    exception_manager = VulnerabilityExceptionManager()
    
    # Executar Dependency Check
    runner = DependencyCheckRunner(exception_manager)
    
    if not runner.run_dependency_check():
        sys.exit(1)
    
    # Processar resultados
    critical, high, vulnerabilities = runner.process_results()
    
    # Gerar resumo
    runner.generate_summary(critical, high, vulnerabilities)
    
    # Decidir se deve falhar o build
    if critical > 0 or high > 0:
        print("\n❌ Build FALHOU devido a vulnerabilidades não excetuadas")
        print("   Para adicionar exceções, edite: .security/vulnerability-exceptions.yml")
        sys.exit(1)
    else:
        print("\n✅ Análise de dependências PASSOU (com exceções aplicadas)")
        sys.exit(0)


if __name__ == "__main__":
    main()