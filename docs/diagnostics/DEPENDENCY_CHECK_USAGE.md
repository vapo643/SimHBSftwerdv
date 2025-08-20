# OWASP Dependency-Check v12.1.0 - Guia de Uso

## 🚀 Instalação Rápida

### Opção 1: Script Automatizado (Recomendado)
```bash
cd .security
./update-dependency-check.sh
```

### Opção 2: Homebrew (macOS)
```bash
brew update && brew install dependency-check
```

### Opção 3: Download Manual
Download direto: https://github.com/dependency-check/DependencyCheck/releases/download/v12.1.0/dependency-check-12.1.0-release.zip

## 📊 Executando Análises

### Análise Básica
```bash
dependency-check --project "Simpix Credit System" --scan . --format ALL
```

### Análise com Exceções (Projeto Cérbero)
```bash
cd .security
./run-dependency-check.sh
```

### Análise Específica por Linguagem
```bash
# Apenas JavaScript/Node.js
dependency-check --project "Simpix" --scan . --enableExperimental --disableAssembly

# Com supressão de falsos positivos
dependency-check --project "Simpix" --scan . --suppression .security/suppressions.xml
```

## 🔧 Configurações Avançadas

### Formatos de Relatório
- **HTML**: Relatório visual interativo
- **JSON**: Para integração com ferramentas
- **XML**: Para CI/CD pipelines
- **CSV**: Para análise em planilhas
- **SARIF**: Para GitHub Security tab

### Exemplo com Múltiplos Formatos
```bash
dependency-check \
  --project "Simpix" \
  --scan . \
  --format HTML \
  --format JSON \
  --format SARIF \
  --out ./security-reports
```

## 📋 Gestão de Exceções

### Arquivo de Exceções (.security/vulnerability-exceptions.yml)
```yaml
exceptions:
  - cve_id: "CVE-2023-45857"
    justification: "Axios - vulnerabilidade não afeta nosso uso (apenas server-side)"
    expires: "2025-12-31"
    cvss_threshold: 7.0
    
  - cve_id: "CVE-2024-12345"
    justification: "Falso positivo - dependência de desenvolvimento apenas"
    expires: "2025-06-30"
    cvss_threshold: 9.0
```

### Critérios para Exceções
1. **Falsos Positivos**: Vulnerabilidades que não se aplicam ao contexto
2. **Mitigações Implementadas**: Quando controles compensatórios existem
3. **Dependências de Dev**: Vulnerabilidades em ferramentas de desenvolvimento
4. **Aguardando Patch**: Temporário enquanto aguarda correção do vendor

## 🎯 Integração CI/CD

### GitHub Actions
```yaml
- name: OWASP Dependency Check
  uses: dependency-check/Dependency-Check_Action@main
  with:
    project: 'Simpix'
    path: '.'
    format: 'ALL'
    args: >
      --enableRetired
      --enableExperimental
```

### Jenkins
```groovy
dependencyCheck additionalArguments: '''
  --project "Simpix"
  --scan "."
  --format "ALL"
''', odcInstallation: 'dependency-check-12.1.0'
```

## 📈 Interpretando Resultados

### Níveis de Severidade (CVSS v3)
- **Crítico**: 9.0 - 10.0 (ação imediata)
- **Alto**: 7.0 - 8.9 (correção em 48h)
- **Médio**: 4.0 - 6.9 (correção em 1 semana)
- **Baixo**: 0.1 - 3.9 (próximo release)

### Métricas Importantes
1. **Total de Dependências**: Número de bibliotecas analisadas
2. **Vulnerabilidades Únicas**: CVEs distintos encontrados
3. **Dependências Vulneráveis**: Bibliotecas com pelo menos 1 CVE
4. **CVSS Médio**: Score médio das vulnerabilidades

## 🛠️ Troubleshooting

### Problema: Análise muito lenta
```bash
# Use cache local
dependency-check --project "Simpix" --scan . --data ./odc-data
```

### Problema: Muitos falsos positivos
```bash
# Criar arquivo de supressão
dependency-check --project "Simpix" --scan . --format XML --out . 
# Editar dependency-check-report.xml e marcar falsos positivos
# Gerar suppression.xml
```

### Problema: Proxy corporativo
```bash
dependency-check \
  --project "Simpix" \
  --scan . \
  --proxyserver proxy.company.com \
  --proxyport 8080
```

## 📚 Recursos Adicionais

- **Documentação Oficial**: https://jeremylong.github.io/DependencyCheck/
- **Base de Dados NVD**: https://nvd.nist.gov/
- **CVSS Calculator**: https://nvd.nist.gov/vuln-metrics/cvss/v3-calculator
- **Suporte**: https://github.com/jeremylong/DependencyCheck/issues

---

**Projeto Cérbero** - Dependency-Check v12.1.0 🛡️