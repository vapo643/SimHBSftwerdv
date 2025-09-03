# BLUEPRINT VISÃO CLARA V1.0
**🎯 OPERAÇÃO VISÃO CLARA - FASE 2: PLANEAMENTO UNIFICADO**

---

## **SUMÁRIO EXECUTIVO**

**ID da Missão:** MIS-VC-1.2  
**Status:** BLUEPRINT ARQUITETURAL APROVADO  
**Data:** 2025-09-03  
**Arquiteto:** Replit Agent (Modo: Arquiteto de Soluções)

**Intenção Estratégica:**  
Estabelecer um contrato de dados robusto e à prova de futuro entre o backend e frontend do fluxo de Análise de Crédito, eliminando todas as divergências identificadas na Fase 1 e formalizando as correções aplicadas.

---

## **ESTADO ATUAL CONFIRMADO (BASELINE)**

### ✅ **CORREÇÕES JÁ APLICADAS - FASE 1**

| **Vetor** | **Problema** | **Solução Aplicada** | **Status** |
|-----------|--------------|----------------------|------------|
| **VETOR 1** | Query da Fila sem JOIN `parceiros` | ✅ JOIN adicionado no `ProposalRepository.ts` (linhas 171-183) | **RESOLVIDO** |
| **VETOR 1** | Controller ignorava `queue=analysis` | ✅ Processamento implementado no controller | **RESOLVIDO** |
| **VETOR 2** | Campos TAC, IOF, Valor Total ausentes | ✅ Adicionados no getById (linhas 116-117) | **RESOLVIDO** |
| **VETOR 2** | Campo Renda Mensal como N/A | ✅ Mapeamento corrigido | **RESOLVIDO** |
| **VETOR 2** | Campo Loja como N/A | ✅ JOIN com lojas implementado | **RESOLVIDO** |
| **VETOR 3** | Finalidade/Garantia NULL na tela | ✅ Exibição "Não informado" implementada | **RESOLVIDO** |
| **VETOR 3** | Formulário não enviava finalidade/garantia | ✅ Campos Select corrigidos com value prop | **RESOLVIDO** |

### ⚠️ **PROBLEMAS REMANESCENTES**

| **Vetor** | **Problema** | **Evidência Técnica** | **Impact Level** |
|-----------|--------------|----------------------|------------------|
| **VETOR 4** | Botão "Pendenciar" → HTTP 400 | Endpoint retorna 501 "em desenvolvimento" (linha 253-256) | **P0 - CRÍTICO** |
| **VETOR 4** | Status PENDENTE não aceito pelo FSM | `statusFsmService.ts` não tem transições para 'pendente' | **P0 - CRÍTICO** |

---

## **PLANO DE REMEDIAÇÃO UNIFICADO**

### **🚨 MISSÃO P0: BLINDAGEM DO FLUXO "PENDENCIAR"**
**Prioridade:** CRÍTICA - Bloqueia workflow do analista  
**Complexidade:** BAIXA - Implementação direta  
**Tempo Estimado:** 2 horas

#### **Análise de Root Cause**
```typescript
// PROBLEMA IDENTIFICADO: server/routes/propostas/core.ts (linha 253-256)
return res.status(501).json({
  success: false,
  error: 'Funcionalidade de pendência em desenvolvimento',
});
```

#### **Arquitetura da Solução**

**1. Atualização do StatusFsmService**
```typescript
// Arquivo: server/services/statusFsmService.ts
// Adicionar ao enum ProposalStatus (linha 21-39):
export enum ProposalStatus {
  // ... status existentes ...
  PENDENTE = 'pendente',
  PENDENCIADO = 'pendenciado',
}

// Adicionar às transições válidas (linha 70+):
const transitionGraph: Record<string, string[]> = {
  // Permitir pendenciar de análise
  'aguardando_analise': ['aprovado', 'rejeitado', 'pendente', 'pendenciado', 'suspensa'],
  'em_analise': ['aprovado', 'rejeitado', 'pendente', 'pendenciado', 'suspensa'],
  
  // Estados pendentes podem voltar para análise
  'pendente': ['aguardando_analise', 'em_analise', 'aprovado', 'rejeitado'],
  'pendenciado': ['aguardando_analise', 'em_analise', 'aprovado', 'rejeitado'],
};
```

**2. Implementação do Use Case**
```typescript
// Arquivo: server/modules/proposal/application/use-cases/PendenciarPropostaUseCase.ts
export class PendenciarPropostaUseCase {
  async execute(propostaId: string, motivoPendencia: string, analistaId: string) {
    // 1. Validar proposta existe e está em análise
    // 2. Aplicar transição FSM
    // 3. Salvar motivo da pendência
    // 4. Registrar log de auditoria
    // 5. Disparar evento de domínio
  }
}
```

**3. Correção do Endpoint**
```typescript
// Arquivo: server/routes/propostas/core.ts (substituir linhas 241-262)
} else if (status === 'pendente' || status === 'pendenciado') {
  return controller.pendenciar(req, res); // Implementar controller method
}
```

#### **Critérios de Aceite (PACN V1.0)**
- **Cenário:** Analista visualiza proposta "aguardando_analise" → clica "Pendenciar" → insere motivo → confirma
- **Resultado Esperado:** Status muda para "pendente", motivo salvo, auditoria registrada, HTTP 200 OK
- **Validação:** GET /api/propostas/:id retorna `{ status: "pendente", motivoPendencia: "texto_inserido" }`

---

### **📊 MISSÃO P1: FORMALIZAÇÃO DO CONTRATO DE DADOS DA FILA**
**Prioridade:** ALTA - Garantia de consistência  
**Complexidade:** BAIXA - Validação e documentação  
**Tempo Estimado:** 1 hora

#### **Objetivo**
Formalizar e testar as correções já aplicadas no repositório para garantir que nunca regridam.

#### **Validação Técnica Requerida**
```sql
-- Query que DEVE funcionar após correções aplicadas:
SELECT 
  p.id,
  p.cliente_nome,
  p.valor,
  p.status,
  l.nome_loja,
  l.razao_social as parceiro_razao_social
FROM propostas p
LEFT JOIN lojas l ON p.loja_id = l.id
WHERE p.status IN ('aguardando_analise', 'em_analise', 'pendente')
  AND p.deleted_at IS NULL;
```

#### **Teste de Integração (Mandatory)**
```typescript
// Arquivo: tests/integration/analyst-queue.test.ts
describe('Analyst Queue Data Contract', () => {
  it('should return proposals with complete partner data', async () => {
    const response = await request(app)
      .get('/api/propostas?queue=analysis')
      .expect(200);
    
    expect(response.body).toHaveProperty('proposals');
    expect(response.body.proposals[0]).toHaveProperty('cliente.nome');
    expect(response.body.proposals[0]).toHaveProperty('loja.nomeLoja');
    expect(response.body.proposals[0]).toHaveProperty('loja.razaoSocial');
  });
});
```

---

### **🎯 MISSÃO P2: MANIFESTO DE DADOS DO ANALISTA**
**Prioridade:** MÉDIA - Governança preventiva  
**Complexidade:** BAIXA - Documentação  
**Tempo Estimado:** 1 hora

#### **Objetivo**
Criar fonte única da verdade para todos os campos que devem ser visíveis ao analista.

#### **Deliverable**
```markdown
# Arquivo: architecture/02-technical/data-contracts/analyst-proposal-view.md

## CONTRATO DE DADOS - VISÃO DO ANALISTA

### FILA DE ANÁLISE (/api/propostas?queue=analysis)
| Campo Frontend | Campo Backend | Origem Tabela | Status | Observações |
|----------------|---------------|---------------|--------|-------------|
| cliente.nome | clienteNome | propostas | ✅ | Sempre presente |
| cliente.cpf | clienteCpf | propostas | ✅ | Formatado no frontend |
| loja.nome | nomeLoja | lojas (JOIN) | ✅ | Corrigido em V1.0 |
| loja.razaoSocial | razaoSocial | lojas (JOIN) | ✅ | Corrigido em V1.0 |
| valor | valor | propostas | ✅ | Formatado como currency |
| status | status | propostas | ✅ | Enum validado |

### DETALHE DA PROPOSTA (/api/propostas/:id)
| Campo Frontend | Campo Backend | Origem Tabela | Status | Observações |
|----------------|---------------|---------------|--------|-------------|
| financeiros.tac | valorTac | propostas | ✅ | Corrigido em V1.0 |
| financeiros.iof | valorIof | propostas | ✅ | Corrigido em V1.0 |
| financeiros.valorTotal | valorTotalFinanciado | propostas | ✅ | Corrigido em V1.0 |
| cliente.renda | clienteRenda | propostas | ✅ | Corrigido em V1.0 |
| condicoes.finalidade | finalidade | propostas | ✅ | Fallback: "Não informado" |
| condicoes.garantia | garantia | propostas | ✅ | Fallback: "Não informado" |
```

---

### **🔍 MISSÃO P3: AUDITORIA DE CONSISTÊNCIA DE DADOS**
**Prioridade:** BAIXA - Preventiva  
**Complexidade:** MÉDIA - Análise cross-table  
**Tempo Estimado:** 2 horas

#### **Objetivo**
Identificar discrepâncias entre dados capturados na originação vs. exibidos na análise.

#### **Script de Auditoria**
```sql
-- Propostas com dados inconsistentes
SELECT 
  p.id,
  p.cliente_nome,
  CASE 
    WHEN p.finalidade IS NULL THEN 'MISSING_FINALIDADE'
    WHEN p.garantia IS NULL THEN 'MISSING_GARANTIA'
    WHEN p.cliente_renda IS NULL THEN 'MISSING_RENDA'
    ELSE 'OK'
  END as data_quality_status
FROM propostas p
WHERE p.status IN ('aguardando_analise', 'em_analise')
  AND (p.finalidade IS NULL OR p.garantia IS NULL OR p.cliente_renda IS NULL);
```

---

## **CRONOGRAMA DE EXECUÇÃO**

### **SPRINT 1 - CRITICAL PATH (4 horas)**
1. **[P0] Implementar PendenciarPropostaUseCase** (2h)
2. **[P0] Atualizar StatusFsmService para aceitar 'pendente'** (1h)  
3. **[P0] Corrigir endpoint PUT /:id/status** (1h)

### **SPRINT 2 - VALIDATION & GOVERNANCE (2 horas)**
4. **[P1] Criar teste integração fila de análise** (1h)
5. **[P2] Documentar contrato de dados do analista** (1h)

### **SPRINT 3 - OPTIONAL IMPROVEMENTS (2 horas)**
6. **[P3] Executar auditoria de consistência** (1h)
7. **[P3] Relatório de métricas de qualidade** (1h)

---

## **DEFINIÇÃO DE SUCESSO**

### **Acceptance Criteria (Business)**
- ✅ Analista pode pendenciar propostas sem erro HTTP 400
- ✅ Todas as informações críticas visíveis na fila e detalhes
- ✅ Dados consistentes entre originação e análise
- ✅ Zero regressões nas funcionalidades existentes

### **Technical Success Metrics**
- ✅ 100% dos campos obrigatórios visíveis na UI do analista
- ✅ 0 erros HTTP 400/500 no fluxo de pendência  
- ✅ Cobertura de testes ≥ 95% para novos use cases
- ✅ Tempo de resposta API ≤ 200ms (mantido)

### **Quality Gates**
- ✅ Zero erros LSP antes da conclusão (`get_latest_lsp_diagnostics`)
- ✅ Todos os testes de integração passando
- ✅ Validação PACN V1.0 em cenários de negócio
- ✅ Code review aprovado com foco em security

---

## **RISCOS E MITIGAÇÕES**

| **Risco** | **Probabilidade** | **Impacto** | **Mitigação** |
|-----------|------------------|-------------|---------------|
| Quebra de funcionalidades existentes | BAIXA | ALTO | Testes automatizados extensivos |
| Performance degradada com JOINs | BAIXA | MÉDIO | Monitoramento APM + query optimization |
| Status FSM conflitos | MÉDIA | ALTO | Validação rigorosa de transições |

---

## **CONSIDERAÇÕES ARQUITETURAIS**

### **Design Decisions**
- **DDD**: Manter separação clara entre use cases e controllers
- **FSM**: Centralizar lógica de transições no statusFsmService
- **Data Contracts**: Formalizar interfaces entre camadas
- **Testing**: Priorizar testes de integração para fluxos críticos

### **Non-Functional Requirements**
- **Performance**: Manter tempo resposta < 200ms
- **Security**: Validar autorização em todas as transições
- **Auditability**: Log completo de todas as mudanças de status
- **Maintainability**: Código auto-documentado com TypeScript

---

**🎯 PROTOCOLO DE ATIVAÇÃO:** Este blueprint está pronto para execução imediata seguindo as prioridades P0 → P1 → P2 → P3.

**📋 PRÓXIMOS PASSOS:** Executar Missão P0 (Blindagem do Fluxo Pendenciar) como primeira implementação crítica.

---
*Blueprint aprovado conforme PAM V2.5 - Context Engineering Protocol V2.0*  
*Documento versionado e auditável para referência futura*