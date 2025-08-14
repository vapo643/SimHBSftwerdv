# AUDITORIA ARQUITETURAL - SISTEMA DE STATUS V2.0
## Migração para Fonte Única da Verdade com Atualização por Eventos

**Data da Auditoria:** 14/08/2025  
**Arquiteto Responsável:** Sistema PAM V1.0  
**Status:** ANÁLISE E PLANEJAMENTO

---

## 1. MAPEAMENTO DO NOVO WORKFLOW DE STATUS

### 1.1 Fluxo Canônico com Gatilhos Técnicos

| Novo Status | Gatilho Técnico | Local de Implementação | Evento Específico |
|------------|-----------------|----------------------|-------------------|
| `RASCUNHO` | Criação inicial da proposta | `POST /api/propostas` | Sucesso na inserção no banco |
| `EM_ANALISE` | Submissão para análise | `PATCH /api/propostas/:id/submeter` | Validação completa dos dados |
| `APROVADO` | Aprovação manual/automática | `PATCH /api/propostas/:id/aprovar` | Decisão de crédito positiva |
| `REPROVADO` | Reprovação manual/automática | `PATCH /api/propostas/:id/reprovar` | Decisão de crédito negativa |
| `CCB_GERADA` | Geração do PDF da CCB | `pdfGeneratorService.ts` | Sucesso em `generateCCB()` |
| `AGUARDANDO_ASSINATURA` | Envio para ClickSign | `clickSignService.ts` | Sucesso em `sendDocument()` |
| `ASSINATURA_PENDENTE` | Cliente visualizou mas não assinou | Webhook ClickSign | Evento `document.viewed` |
| `ASSINATURA_CONCLUIDA` | CCB totalmente assinada | Webhook ClickSign | Evento `document.signed` |
| `BOLETOS_EMITIDOS` | Todos boletos gerados | `interBankService.ts` | Sucesso em `generateBoletos()` |
| `PAGAMENTO_PENDENTE` | Aguardando primeiro pagamento | Webhook Banco Inter | Evento `cobranca.criada` |
| `PAGAMENTO_PARCIAL` | Pelo menos 1 parcela paga | Webhook Banco Inter | Evento `cobranca.paga` |
| `INADIMPLENTE` | Atraso > 30 dias | Job Scheduler | Cron diário de verificação |
| `QUITADO` | Todas parcelas pagas | Webhook Banco Inter | Última `cobranca.paga` |
| `CANCELADO` | Cancelamento manual/automático | `PATCH /api/propostas/:id/cancelar` | Ação administrativa |

### 1.2 Diagrama de Transições Válidas

```
RASCUNHO → EM_ANALISE → APROVADO → CCB_GERADA → AGUARDANDO_ASSINATURA → ASSINATURA_CONCLUIDA → BOLETOS_EMITIDOS → PAGAMENTO_PENDENTE → QUITADO
                    ↓                                                ↓
                REPROVADO                                   ASSINATURA_PENDENTE
                    ↓                                                ↓
                CANCELADO ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
```

---

## 2. ANÁLISE DE IMPACTO (GAP ANALYSIS)

### 2.1 Pontos de Modificação Necessários

| Arquivo | Função/Endpoint | Modificação Necessária | Status Atual | Prioridade |
|---------|-----------------|----------------------|--------------|------------|
| `server/services/pdfGeneratorService.ts` | `generateCCB()` | Adicionar atualização para `CCB_GERADA` após sucesso | Não implementado | CRÍTICA |
| `server/services/clickSignService.ts` | `sendToClickSign()` | Mudar status para `AGUARDANDO_ASSINATURA` | Não implementado | CRÍTICA |
| `server/services/clickSignWebhookService.ts` | `handleAutoClose()` | Já atualiza para `contratos_assinados` | ✅ Parcialmente implementado | CRÍTICA |
| `server/services/clickSignWebhookService.ts` | `triggerBoletoGeneration()` | Já dispara geração automática | ✅ Implementado | CRÍTICA |
| `server/services/interBankService.ts` | `emitirCobranca()` | Adicionar atualização para `BOLETOS_EMITIDOS` | Não implementado | CRÍTICA |
| `server/routes/webhooks/inter.ts` | `cobranca-paga` | Já atualiza para `pago` quando todas pagas | ✅ Implementado | CRÍTICA |
| `server/routes/propostas.ts` | Múltiplos endpoints | Remover lógica de flags booleanas | Pendente | ALTA |
| `server/routes/cobrancas.ts` | `GET /api/cobrancas` | Simplificar para usar apenas `status` | ⚠️ Usando EXISTS subquery | ALTA |
| `server/routes/pagamentos.ts` | `GET /api/pagamentos` | Simplificar para usar apenas `status` | Pendente | ALTA |
| `server/routes/formalizacao.ts` | Todos endpoints | Usar novo fluxo de status | Pendente | MÉDIA |
| `client/src/pages/financeiro/CobrancasPage.tsx` | Filtros | Adaptar para novo modelo | Pendente | MÉDIA |

### 2.2 Campos Obsoletos a Remover

```typescript
// Campos que se tornarão desnecessários após migração:
- ccbGerado: boolean
- assinaturaEletronicaConcluida: boolean  
- prontoPagamento: boolean
- formalizacaoIniciada: boolean
- formalizacaoConcluida: boolean
```

---

## 3. PLANEJAMENTO DA MIGRAÇÃO DO BANCO DE DADOS

### 3.1 Novo Enum de Status

```sql
-- Adicionar novos status ao enum
ALTER TYPE status_proposta ADD VALUE 'CCB_GERADA';
ALTER TYPE status_proposta ADD VALUE 'AGUARDANDO_ASSINATURA';
ALTER TYPE status_proposta ADD VALUE 'ASSINATURA_PENDENTE';
ALTER TYPE status_proposta ADD VALUE 'ASSINATURA_CONCLUIDA';
ALTER TYPE status_proposta ADD VALUE 'BOLETOS_EMITIDOS';
ALTER TYPE status_proposta ADD VALUE 'PAGAMENTO_PENDENTE';
ALTER TYPE status_proposta ADD VALUE 'PAGAMENTO_PARCIAL';
ALTER TYPE status_proposta ADD VALUE 'INADIMPLENTE';
ALTER TYPE status_proposta ADD VALUE 'QUITADO';
```

### 3.2 Script de Migração de Dados

```sql
-- Migração dos status existentes para o novo modelo
UPDATE propostas SET status = 'CCB_GERADA' 
WHERE ccb_gerado = true AND assinatura_eletronica_concluida = false;

UPDATE propostas SET status = 'ASSINATURA_CONCLUIDA'
WHERE ccb_gerado = true AND assinatura_eletronica_concluida = true;

UPDATE propostas SET status = 'BOLETOS_EMITIDOS'
WHERE id IN (SELECT DISTINCT proposta_id FROM inter_collections);
```

### 3.3 Tabela de Auditoria de Transições

```sql
CREATE TABLE status_transitions (
    id SERIAL PRIMARY KEY,
    proposta_id UUID NOT NULL,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    triggered_by VARCHAR(100) NOT NULL, -- 'api', 'webhook', 'manual', 'scheduler'
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (proposta_id) REFERENCES propostas(id)
);
```

---

## 4. ARQUITETURA DA QUERY UNIVERSAL

### 4.1 Nova Query Simplificada para Cobranças

```typescript
// ANTES (complexo e propenso a erros):
const propostas = await db
  .select()
  .from(propostas)
  .where(
    and(
      sql`${propostas.deletedAt} IS NULL`,
      eq(propostas.ccbGerado, true),
      eq(propostas.assinaturaEletronicaConcluida, true),
      inArray(propostas.status, ["aprovado", "pronto_pagamento", "pago"]),
      sql`EXISTS (SELECT 1 FROM inter_collections WHERE ...)`
    )
  );

// DEPOIS (simples e confiável):
const propostas = await db
  .select()
  .from(propostas)
  .where(
    and(
      sql`${propostas.deletedAt} IS NULL`,
      inArray(propostas.status, ["BOLETOS_EMITIDOS", "PAGAMENTO_PENDENTE", "PAGAMENTO_PARCIAL", "INADIMPLENTE", "QUITADO"])
    )
  );
```

### 4.2 Benefícios da Nova Arquitetura

1. **Simplicidade:** Uma única verificação de status substitui múltiplas condições
2. **Confiabilidade:** Status é a fonte única da verdade
3. **Performance:** Menos JOINs e condições complexas
4. **Manutenibilidade:** Lógica centralizada nos gatilhos de eventos
5. **Rastreabilidade:** Toda mudança de status é auditada

---

## 5. PLANO DE IMPLEMENTAÇÃO FASEADO

### Fase 1: Preparação (Sem Breaking Changes)
- Adicionar novos status ao enum
- Criar tabela de auditoria
- Implementar logging de transições

### Fase 2: Implementação Paralela
- Adicionar lógica de atualização de status nos gatilhos
- Manter flags booleanas temporariamente
- Executar ambos sistemas em paralelo

### Fase 3: Validação
- Comparar resultados dos dois sistemas
- Identificar e corrigir discrepâncias
- Testes extensivos em staging

### Fase 4: Migração
- Executar script de migração de dados
- Ativar novo sistema
- Desativar flags booleanas

### Fase 5: Limpeza
- Remover campos obsoletos
- Remover lógica antiga
- Otimizar queries

---

## 6. RISCOS E MITIGAÇÕES

| Risco | Impacto | Probabilidade | Mitigação |
|-------|---------|---------------|-----------|
| Perda de dados durante migração | CRÍTICO | Baixa | Backup completo + rollback plan |
| Inconsistência de status | ALTO | Média | Validação paralela antes de switch |
| Webhooks perdidos | ALTO | Média | Queue persistente + retry logic |
| Performance degradada | MÉDIO | Baixa | Índices otimizados no campo status |
| Resistência à mudança | MÉDIO | Alta | Documentação + treinamento |

---

## 7. MÉTRICAS DE SUCESSO

1. **Redução de bugs relacionados a status:** Meta > 90%
2. **Tempo de resposta das queries:** Melhoria > 50%
3. **Complexidade ciclomática:** Redução > 70%
4. **Cobertura de testes:** Meta > 95%
5. **Satisfação do desenvolvedor:** Aumento mensurável

---

## 8. MAPEAMENTO DE WEBHOOKS EXISTENTES

### 8.1 ClickSign Webhooks Implementados

| Evento | Handler Atual | Status Atualizado | Ação Disparada |
|--------|--------------|-------------------|----------------|
| `auto_close` | `handleAutoClose()` | `contratos_assinados` | Dispara geração de boletos |
| `document_closed` | `handleDocumentClosed()` | `contratos_assinados` | Dispara geração de boletos |
| `sign` | `handleSign()` | Mantém status | Registra log apenas |
| `cancel` | `handleCancel()` | Não altera | Registra cancelamento |
| `refusal` | `handleRefusal()` | Não altera | Registra recusa |

### 8.2 Banco Inter Webhooks Implementados

| Evento | Handler | Status Atualizado | Condição |
|--------|---------|-------------------|-----------|
| `cobranca-paga` | `/webhooks/inter` | `pago` | Quando todas parcelas pagas |
| `cobranca-vencida` | `/webhooks/inter` | Não altera | Apenas atualiza collection |
| `cobranca-cancelada` | `/webhooks/inter` | Não altera | Apenas atualiza collection |

### 8.3 Gaps Identificados nos Webhooks

1. **ClickSign:** Falta evento para quando documento é visualizado (`document.viewed`)
2. **Banco Inter:** Falta lógica para marcar proposta como `INADIMPLENTE`
3. **Ambos:** Sem implementação de retry resiliente ou dead letter queue

## 9. CONCLUSÃO E PRÓXIMOS PASSOS

Este documento representa o blueprint completo para a migração do nosso sistema de status para um modelo baseado em eventos. A implementação deve seguir rigorosamente as fases descritas, com validação extensiva em cada etapa.

**Aprovação Necessária Para:**
1. Criação dos novos status no enum
2. Implementação da tabela de auditoria
3. Início da Fase 1

**Documento preparado por:** Sistema PAM V1.0  
**Para revisão de:** Arquiteto Chefe  
**Status:** AGUARDANDO APROVAÇÃO