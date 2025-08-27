# 🚨 ROADMAP DE CORREÇÃO ESLint CRÍTICO - OPERAÇÃO AÇO LÍQUIDO
**Protocolo:** PEO V2.0 - Ação Corretiva Pré-Deploy  
**Data:** 27 de agosto de 2025  
**Urgência:** CRÍTICA - Deploy hoje dependente desta execução  
**Estratégia:** Abordagem Híbrida Pragmática (Consenso entre auditores)

---

## 📊 SÍNTESE DOS VEREDITOS DE AUDITORIA

### CONSENSO ENTRE AUDITORES
**Pontos de Acordo:**
- ✅ 7 erros P0 (bloqueadores críticos) identificados unanimemente
- ✅ Sistema funcionalmente estável (7-CHECK FULL aprovado)
- ✅ Maioria dos erros (~94%) são débito técnico aceitável
- ✅ Deploy tecnicamente viável após correções pontuais

**Divergência Principal:**
- **Auditor 1:** 3 erros P1 (abordagem pragmática - 10 total)
- **Auditor 2:** 18 erros P1 (abordagem conservadora - 25 total)

### ESTRATÉGIA ADOTADA: HÍBRIDA INTELIGENTE
**Critério de Decisão:** Corrigir P0 + P1 críticos (funcionalidades core bancárias)
- **P0 (Unanimidade):** 7 erros - CORREÇÃO OBRIGATÓRIA
- **P1 (Core Bancário):** 8 erros selecionados - CORREÇÃO OBRIGATÓRIA  
- **P1 (Não-Core):** 10 erros - ACEITAR para deploy urgente
- **Total a corrigir:** 15 erros (middle ground inteligente)

---

## 🎯 PLANO DE EXECUÇÃO - 15 CORREÇÕES CRÍTICAS

### FASE 1: CORREÇÕES P0 (BLOQUEADORES ABSOLUTOS)
**Timeline:** 2-3 horas  
**Status:** CRÍTICO - Sistema não pode ir para produção com estes erros

#### 1.1 Violação de Hooks React (6 ocorrências)
```yaml
Arquivo: client/src/pages/propostas/editar.tsx
Erro: react-hooks/rules-of-hooks
Impacto: Edição de Propostas de Crédito (CORE)
Risco: Crash garantido + corrupção de dados financeiros
```

**Ação Específica:**
```typescript
// ❌ ERRADO (atual)
if (condition) {
  const [state, setState] = useState();
}

// ✅ CORRETO (implementar)
const [state, setState] = useState();
if (condition) {
  // lógica condicional aqui
}
```

#### 1.2 Optional Chaining Inseguro (1 ocorrência)
```yaml
Arquivo: client/src/pages/credito/analise.tsx  
Erro: no-unsafe-optional-chaining
Impacto: Análise de Crédito (CORE)
Risco: TypeError + white screen em produção
```

**Ação Específica:**
```typescript
// ❌ ERRADO (atual)
result = obj?.property.method()

// ✅ CORRETO (implementar)
result = obj?.property?.method() ?? defaultValue
```

---

### FASE 2: CORREÇÕES P1 CORE BANCÁRIO (8 ocorrências)
**Timeline:** 1-2 horas  
**Status:** ALTO RISCO - Funcionalidades bancárias críticas afetadas

#### 2.1 API Client Security (1 ocorrência)
```yaml
Arquivo: client/src/lib/apiClient.ts
Erro: no-prototype-builtins  
Impacto: Infraestrutura de comunicação API
Risco: Vulnerabilidade de segurança
```

**Ação Específica:**
```typescript
// ❌ ERRADO (atual)
obj.hasOwnProperty(key)

// ✅ CORRETO (implementar)
Object.prototype.hasOwnProperty.call(obj, key)
```

#### 2.2 Erros de Escopo Lógico (2 ocorrências)
```yaml
Arquivos: 
- client/src/pages/fila-analise.tsx (no-case-declarations)
- client/src/pages/parceiros/detalhe.tsx (no-redeclare)
Impacto: Fila de Análise + Detalhe de Parceiros
Risco: ReferenceError + comportamento indefinido
```

**Ação Específica:**
```typescript
// ❌ ERRADO (no-case-declarations)
switch (type) {
  case 'A':
    const result = process();
    
// ✅ CORRETO
switch (type) {
  case 'A': {
    const result = process();
  }
```

#### 2.3 Dependencies Críticas useEffect (5 ocorrências)
```yaml
Arquivos:
- client/src/pages/formalizacao.tsx (3 ocorrências)
- client/src/hooks/useProposalEffects.ts (2 ocorrências)
Impacto: Formalização de contratos + Lógica core de propostas
Risco: Dados obsoletos em contratos financeiros
```

**Ação Específica:**
```typescript
// ❌ ERRADO (atual)
useEffect(() => {
  processContract(data);
}, []); // dependência ausente

// ✅ CORRETO (implementar)  
useEffect(() => {
  processContract(data);
}, [data]); // dependência adicionada
```

---

### FASE 3: VALIDAÇÃO E DEPLOY
**Timeline:** 30 minutos  
**Status:** OBRIGATÓRIO - Confirmação de correções

#### 3.1 Validação Técnica
```bash
# Verificar correções ESLint
npx eslint client/src/pages/propostas/editar.tsx
npx eslint client/src/pages/credito/analise.tsx  
npx eslint client/src/lib/apiClient.ts
npx eslint client/src/pages/fila-analise.tsx
npx eslint client/src/pages/parceiros/detalhe.tsx
npx eslint client/src/pages/formalizacao.tsx
npx eslint client/src/hooks/useProposalEffects.ts

# Verificar build
npm run build

# Verificar TypeScript  
npm run check
```

#### 3.2 Teste Funcional Focado
```yaml
Áreas a Validar:
1. Edição de propostas de crédito
2. Análise de crédito
3. Formalização de contratos
4. Fila de análise
5. Comunicação API
```

---

## 🚫 ERROS ACEITOS PARA DEPLOY URGENTE

### P1 NÃO-CORE (10 erros aceitos)
```yaml
Categoria: Scripts de migração/boletos (TSConfig)
Justificativa: Scripts não fazem parte do build de produção
Status: Backlog pós-deploy

Categoria: exhaustive-deps não-críticos
Justificativa: Áreas validadas funcionalmente no 7-CHECK
Status: Sprint subsequente

Categoria: Parsing errors em demo/
Justificativa: Diretórios não-produção
Status: Configuração futura
```

### P2/P3 (468 erros aceitos)
```yaml
- @typescript-eslint/no-explicit-any (163): Débito técnico
- @typescript-eslint/no-unused-vars (160): Código morto
- no-undef em demo/ (123): Configuração
- jsx-a11y/* (5): Acessibilidade
- Demais (17): Convenções/estilo
```

---

## ⏱️ CRONOGRAMA DE EXECUÇÃO

### DIA 0 (HOJE) - CRÍTICO
```
09:00-12:00 | FASE 1: Correção P0 (7 erros)
13:00-15:00 | FASE 2: Correção P1 Core (8 erros)  
15:00-15:30 | FASE 3: Validação e Deploy
15:30-16:00 | Deploy de Produção
```

### DIA +1 - MONITORAMENTO
```
09:00-10:00 | Verificação de logs de produção
10:00-11:00 | Análise de métricas de estabilidade
Resultado: Relatório de health pós-deploy
```

### SPRINT +1 - DÉBITO TÉCNICO
```
Semana 1: Correção exhaustive-deps restantes (P1)
Semana 2: Plano de redução de no-explicit-any (P2)
Semana 3: Limpeza de código morto (P3)
```

---

## 🎯 CRITÉRIOS DE SUCESSO

### PRÉ-DEPLOY (OBRIGATÓRIO)
- [ ] 0 erros P0 no ESLint
- [ ] 0 erros P1 core no ESLint  
- [ ] Build de produção bem-sucedido
- [ ] Testes funcionais críticos passando
- [ ] LSP diagnostics limpo

### PÓS-DEPLOY (MONITORAMENTO)
- [ ] 0 crashes relacionados aos erros corrigidos
- [ ] Funcionalidades core operando normalmente
- [ ] Logs de produção sem erros JavaScript críticos
- [ ] Métricas de performance mantidas

---

## 📋 RESPONSABILIDADES E EXECUÇÃO

### EXECUTOR TÉCNICO
- **Persona:** Desenvolvedor Senior especialista em React/TypeScript
- **Foco:** Correções pontuais e cirúrgicas
- **Método:** Correção erro por erro, validação individual

### VALIDADOR TÉCNICO  
- **Persona:** QA Lead com experiência bancária
- **Foco:** Testes de regressão em áreas afetadas
- **Método:** Smoke tests + validação funcional crítica

### DECISOR DE DEPLOY
- **Persona:** Arquiteto/Lead técnico
- **Foco:** Aprovação final baseada em critérios objetivos
- **Método:** Checklist de critérios de sucesso

---

## 🔒 PROTOCOLO DE SEGURANÇA

### FALLBACK STRATEGY
Se correções excederem timeline ou introduzirem novos bugs:
1. **Rollback imediato** para versão anterior estável
2. **Reagendamento** do deploy para D+1
3. **Análise profunda** das correções que falharam
4. **Novo cronograma** com maior buffer de tempo

### RISK MITIGATION
- **Branch dedicado** para correções (feature/eslint-critical-fixes)
- **Code review obrigatório** antes de merge
- **Deploy em staging** antes de produção
- **Rollback plan** documentado e testado

---

## ✅ AUTORIZAÇÃO DE EXECUÇÃO

**ROADMAP APROVADO PARA EXECUÇÃO IMEDIATA**

**Justificativa:**
- Consenso entre auditores sobre criticidade dos 7 erros P0
- Abordagem híbrida equilibra urgência e segurança
- Correções são pontuais e de baixo risco
- Sistema já validado funcionalmente (7-CHECK FULL)

**Próximo passo:** Iniciar execução das correções conforme cronograma estabelecido.

---

**ASSINATURA DIGITAL:** Sistema de Gestão de Qualidade Simpix  
**TIMESTAMP:** 2025-08-27T23:30:00-03:00  
**PROTOCOLO:** ROADMAP-ESL-CRIT-001