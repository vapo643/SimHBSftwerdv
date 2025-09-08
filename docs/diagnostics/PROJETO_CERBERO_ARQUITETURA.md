# Projeto Cérbero - Arquitetura de Segurança DevSecOps

## 🛡️ Visão Geral

O Projeto Cérbero é um "sistema imunológico" avançado de segurança que integra análise estática (SAST) e análise de composição de software (SCA) no pipeline de desenvolvimento do Simpix Credit Management System.

## 📊 Status de Implementação

### ✅ Fase 1 - OWASP Dependency-Check (COMPLETA)

- **Sistema de Exceções de Vulnerabilidades**: Implementado com YAML configurável
- **Integração CI/CD**: GitHub Actions executando análise automatizada
- **Gestão de Dívida Técnica**: Exceções com data de expiração e justificativa
- **Threshold de Segurança**: CVSS ≥ 7.0 falha automaticamente

### 🚀 Fase 2 - Semgrep MCP Server (COMPLETA)

- **Servidor TypeScript**: Análise em tempo real com cache Redis/memória
- **API RESTful**: Endpoints completos para análise de segurança
- **Regras Customizadas**: 10+ regras específicas para sistema de crédito
- **Integração AI-Ready**: Contexto de segurança para LLMs

## 🏗️ Arquitetura Técnica

### Componentes Principais

```
┌─────────────────────────────────────────────────────────┐
│                    Projeto Cérbero                      │
├─────────────────────┬───────────────────────────────────┤
│  OWASP Dep-Check   │        Semgrep MCP Server        │
├─────────────────────┼───────────────────────────────────┤
│ • Python Script     │ • TypeScript Server              │
│ • YAML Exceptions   │ • Redis/Memory Cache             │
│ • GitHub Actions    │ • Real-time Analysis             │
│ • CVE Management    │ • Custom Rules Engine            │
└─────────────────────┴───────────────────────────────────┘
```

### Fluxo de Dados

1. **Desenvolvimento**
   - Desenvolvedor escreve código
   - Semgrep MCP analisa em tempo real
   - Feedback instantâneo via API

2. **Commit/PR**
   - GitHub Actions triggera análise
   - OWASP Dependency-Check verifica dependências
   - Semgrep executa análise completa

3. **Produção**
   - Monitoramento contínuo
   - Alertas de novas vulnerabilidades
   - Relatórios de compliance

## 🔧 Configuração e Uso

### Semgrep MCP Server

#### Endpoints Disponíveis

```bash
# Health Check
GET /api/security/mcp/health

# Análise de arquivo
GET /api/security/mcp/scan/{filePath}

# Análise de código snippet
POST /api/security/mcp/analyze
{
  "code": "string",
  "context": {
    "language": "typescript",
    "framework": "express",
    "user_intent": "string"
  }
}

# Contexto de componente
GET /api/security/mcp/context/{component}

# Histórico de segurança
GET /api/security/mcp/history/{filePath}

# Regras ativas
GET /api/security/mcp/rules
```

#### Autenticação

Todos os endpoints requerem token JWT:

```bash
Authorization: Bearer <jwt-token>
```

### OWASP Dependency-Check

#### Executar análise local

```bash
cd .security
./run-dependency-check.sh
```

#### Gerenciar exceções

Editar `.security/vulnerability-exceptions.yml`:

```yaml
exceptions:
  - cve_id: 'CVE-2023-12345'
    justification: 'Falso positivo - não afeta nossa implementação'
    expires: '2025-06-30'
    cvss_threshold: 7.0
```

## 📈 Métricas de Segurança

### Cobertura Atual

- **Análise Estática (SAST)**: 100% do código TypeScript/JavaScript
- **Análise de Dependências (SCA)**: 100% das dependências npm
- **Regras Customizadas**: 10+ regras específicas para crédito
- **Tempo de Resposta**: <500ms para análise incremental

### Vulnerabilidades Detectadas

- SQL Injection em queries de propostas
- Exposição de dados PII (CPF/CNPJ) em logs
- Upload de arquivos sem validação adequada
- Autenticação fraca em endpoints admin
- Geração de IDs previsíveis
- Hardcoded secrets

## 🎯 Benefícios

1. **Detecção Precoce**: Vulnerabilidades identificadas durante desenvolvimento
2. **Contexto para AI**: LLMs recebem informações de segurança em tempo real
3. **Compliance Automatizado**: OWASP ASVS e PCI-DSS
4. **Redução de Custos**: Correções mais baratas no início do ciclo
5. **Educação Contínua**: Desenvolvedores aprendem padrões seguros

## 🚀 Próximos Passos

### Fase 3 - Integração Completa (Planejada)

- [ ] Dashboard unificado de segurança
- [ ] Integração com IDE (VS Code extension)
- [ ] Machine Learning para detecção de anomalias
- [ ] Automação de correções simples

### Fase 4 - Expansão (Futura)

- [ ] DAST (Dynamic Application Security Testing)
- [ ] Container scanning
- [ ] Infrastructure as Code scanning
- [ ] Supply chain security

## 📚 Referências

- [OWASP Dependency-Check](https://owasp.org/www-project-dependency-check/)
- [Semgrep Documentation](https://semgrep.dev/docs/)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
- [Model Context Protocol](https://github.com/anthropics/model-context-protocol)

## 🤝 Contribuindo

Para adicionar novas regras de segurança:

1. Editar `.semgrep.yml`
2. Adicionar teste em `tests/security/`
3. Documentar em `SECURITY_RULES.md`
4. Criar PR com justificativa

---

**Projeto Cérbero** - Protegendo o futuro do crédito digital 🛡️
