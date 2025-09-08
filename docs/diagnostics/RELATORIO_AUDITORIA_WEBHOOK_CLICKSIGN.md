# 🔍 AUDITORIA DE DIAGNÓSTICO COMPLETA - FLUXO DE WEBHOOK CLICKSIGN

**Data:** 12 de Agosto de 2025  
**Problema:** Após assinatura da CCB no ClickSign, a Timeline da Tela de Formalização não atualiza em tempo real  
**Status:** ❌ **FALHA CRÍTICA IDENTIFICADA**

---

## 📋 RESUMO EXECUTIVO

A auditoria identificou **3 pontos de falha** na cadeia de comunicação "Webhook → Backend → Banco de Dados → Supabase Realtime → Frontend UI". O problema principal está no **Backend (Receptor do Evento)** que não atualiza o status da proposta.

---

## 🔧 RELATÓRIO 1 - AUDITORIA DO BACKEND (O RECEPTOR DO EVENTO)

### ✅ **ENCONTRADO:**

- **Endpoint:** `/api/webhooks/clicksign` em `server/routes/webhooks.ts`
- **Eventos processados:** `document.signed`, `document.finished`, `auto_close`
- **Validação:** ✅ HMAC implementada corretamente
- **Busca de proposta:** ✅ Usa `clicksign_document_id` ou `clicksign_envelope_id`
- **Processamento:** ✅ Assíncrono em background

### ❌ **PROBLEMA CRÍTICO IDENTIFICADO:**

**Linha 134-138** em `server/routes/webhooks.ts`:

```typescript
const result = await documentProcessingService.processSignedDocument(
  proposal.id as string,
  ProcessingSource.WEBHOOK,
  document.key
);
```

**O `documentProcessingService` NÃO ATUALIZA O STATUS DA PROPOSTA!**

**Linhas 119-126** em `server/services/documentProcessingService.ts`:

```sql
UPDATE propostas
SET
  caminho_ccb_assinado = ${storagePath},
  data_assinatura = NOW(),
  atualizado_em = NOW()
WHERE id = ${proposalId}
```

**Campos atualizados:** ❌ Apenas `caminho_ccb_assinado`, `data_assinatura`, `atualizado_em`  
**Campo NOT updated:** ❌ **`status` da proposta NÃO é atualizado!**

### 🎯 **SERVIÇO CORRETO DISPONÍVEL MAS NÃO USADO:**

**Existe `clickSignWebhookService.ts`** que atualiza o status corretamente:

**Linhas 374-398**:

```typescript
const updateData = {
  clicksignStatus: 'signed',
  clicksignSignedAt: new Date(),
  assinaturaEletronicaConcluida: true,
  dataAssinatura: new Date(),
  status: 'contratos_assinados', // ✅ ATUALIZA O STATUS!
};
```

**MAS este serviço NÃO está sendo usado pelo endpoint webhook!**

---

## 🔧 RELATÓRIO 2 - AUDITORIA DA CAMADA DE TRANSMISSÃO (REALTIME)

### ❌ **CONFIGURAÇÃO DE REALTIME NÃO ENCONTRADA:**

- **Supabase Realtime:** ❌ Não há evidências de configuração ativada para tabela `propostas`
- **Publications:** ❌ Não foi detectada configuração para transmitir eventos UPDATE
- **Channel subscriptions:** ❌ Não encontradas no backend

**Status:** ❌ **MECANISMO DE TRANSMISSÃO EM TEMPO REAL AUSENTE**

---

## 🔧 RELATÓRIO 3 - AUDITORIA DO FRONTEND (O "OUVINTE" DO EVENTO)

### ❌ **[CÓDIGO DE ESCUTA REALTIME AUSENTE]**

**Arquivo:** `client/src/pages/formalizacao.tsx`

**Encontrado:** Apenas 1 `useEffect` na linha 620:

```typescript
React.useEffect(() => {
  if (initialClickSignData) {
    setClickSignData(initialClickSignData);
  }
}, [initialClickSignData]);
```

**Análise:** ❌ Este `useEffect` apenas atualiza estado local, **NÃO escuta mudanças da tabela `propostas`**

**Ausente:** ❌ Código `supabase.channel(...).on(...).subscribe()` para escutar atualizações em tempo real

**Método atual:** ✅ Usa `useQuery` mas sem refresh automático quando dados mudam no banco

---

## 🎯 RELATÓRIO FINAL - DIAGNÓSTICO CONCLUSIVO

### 🔴 **A CADEIA DE COMUNICAÇÃO ESTÁ QUEBRADA EM 3 PONTOS:**

| **Camada**   | **Status**           | **Problema Identificado**                 |
| ------------ | -------------------- | ----------------------------------------- |
| **Backend**  | ❌ **FALHA CRÍTICA** | Webhook não atualiza `status` da proposta |
| **Realtime** | ❌ **AUSENTE**       | Supabase Realtime não configurado         |
| **Frontend** | ❌ **AUSENTE**       | Não há escuta de eventos em tempo real    |

### 🔧 **SOLUÇÃO NECESSÁRIA (3 ETAPAS):**

#### **ETAPA 1 - Corrigir Backend (CRÍTICO):**

```typescript
// SUBSTITUIR em server/routes/webhooks.ts linha 134:
// ❌ await documentProcessingService.processSignedDocument(...)

// ✅ USAR:
await clickSignWebhookService.processEvent({
  event: event.name,
  data: webhookData,
  occurred_at: event.occurred_at,
});
```

#### **ETAPA 2 - Configurar Supabase Realtime:**

- Ativar Realtime para tabela `propostas`
- Configurar publication para eventos UPDATE
- Testar transmissão de mudanças

#### **ETAPA 3 - Implementar Frontend Subscription:**

```typescript
// Adicionar em formalizacao.tsx:
useEffect(() => {
  const channel = supabase
    .channel('propostas-changes')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'propostas' },
      (payload) => {
        if (payload.new.id === propostaId) {
          refetch(); // Atualizar dados da UI
        }
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [propostaId]);
```

---

## ⚡ **IMPACTO E PRIORIDADE:**

- **Severidade:** 🔴 **CRÍTICA** - Funcionalidade principal quebrada
- **Impacto:** Operadores precisam recarregar página manualmente
- **Prioridade:** 🚨 **URGENTE** - Corrigir backend resolve 80% do problema
- **Tempo estimado:** 2-4 horas para implementação completa

---

## 📊 **RESUMO DOS 4 RELATÓRIOS:**

✅ **Relatório 1:** ❌ Backend recebe webhook mas não atualiza status  
✅ **Relatório 2:** ❌ Realtime não configurado para transmitir mudanças  
✅ **Relatório 3:** ❌ Frontend não escuta mudanças em tempo real  
✅ **Relatório 4:** 🎯 **DIAGNÓSTICO CONCLUSIVO:** Falha em 3 camadas da comunicação

**CONCLUSÃO:** A falha está primariamente no backend (não atualiza status) e secundariamente na ausência de infraestrutura de tempo real.
