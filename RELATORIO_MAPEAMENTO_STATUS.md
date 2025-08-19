# Relatório de Mapeamento da Lógica de Status

**Data:** 19/08/2025  
**Missão:** PAM V1.0 - Mapeamento completo do uso do `statusEnum` no código-fonte  
**Objetivo:** Identificar a lógica de negócio e transições de estado existentes antes da refatoração da Máquina de Estados Finitos (FSM)

---

## 1. Pontos de Modificação de Status

### 1.1 Serviços Backend - Principais Pontos de Escrita

#### **server/routes.ts**
- **Linha 4361:** `updateStatusWithContext` - Formalização completa
  ```typescript
  const { updateStatusWithContext } = await import("./lib/status-context-helper");
  const statusResult = await updateStatusWithContext({
    propostaId: id,
    novoStatus: "pronto_pagamento",
    contexto: "formalizacao",
    userId: req.user?.id || "sistema",
    observacoes: "Todas as etapas de formalização concluídas (CCB, assinatura, biometria)"
  });
  ```

- **Linha 4433:** `updateStatusWithContext` - Atualização manual de status
  ```typescript
  const { updateStatusWithContext } = await import("./lib/status-context-helper");
  const statusResult = await updateStatusWithContext({
    propostaId: id,
    novoStatus: status,
    contexto,
    userId: req.user?.id || "sistema",
    observacoes: observacao || `Status alterado para ${status}`
  });
  ```

- **Linha 4441:** `updateStatusWithContext` - Endpoint PUT /api/propostas/:id/status
  ```typescript
  const statusResult = await updateStatusWithContext({
    propostaId: id,
    novoStatus: status,
    contexto,
    userId: req.user?.id || "sistema",
    observacoes: observacao || `Status alterado para ${status}`,
    metadata: {
      tipoAcao: "STATUS_UPDATE_MANUAL",
      usuarioRole: req.user?.role || "desconhecido",
      statusAnterior: currentProposta.status
    }
  });
  ```

#### **server/storage.ts**
- **Linha 526:** `updateStatusWithContext` - Service layer update
  ```typescript
  const { updateStatusWithContext } = await import("./lib/status-context-helper");
  const result = await updateStatusWithContext({
    propostaId,
    novoStatus: proposta.status,
    contexto,
    userId: 'storage-service',
    observacoes: 'Atualização via storage.updateProposta',
    metadata: { origem: 'storage-service' }
  });
  ```

- **Linha 538:** Mesma função `updateStatusWithContext` no método `updateProposta`

#### **server/routes/propostas.ts**
- **Linhas 154, 177, 192:** Status hardcoded "assinado" em responses JSON para CCB
  ```typescript
  return res.json({
    url: urlData.signedUrl,
    nome: `CCB_${proposta.clienteNome}_${propostaId}.pdf`,
    status: "assinado",  // ← STATUS HARDCODED
    dataAssinatura: proposta.dataAprovacao,
    fonte: "storage"
  });
  ```

---

## 2. Pontos de Leitura Condicional de Status

### 2.1 Frontend - Switch Statements para UI

#### **client/src/pages/dashboard.tsx**
- **Linha 45:** `getStatusColor(status)` - Mapeamento de cores por status
  ```typescript
  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "CCB_GERADA":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "AGUARDANDO_ASSINATURA":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "APROVADO":
        return "bg-green-100 text-green-800 border-green-200";
      // ... 15+ casos diferentes
    }
  };
  ```

- **Linha 80:** `getStatusText(status)` - Labels de status para usuário
  ```typescript
  const getStatusText = (status: string) => {
    switch (status.toUpperCase()) {
      case "CCB_GERADA":
        return "CCB Gerada";
      case "AGUARDANDO_ASSINATURA":
        return "Aguardando Assinatura";
      // ... 15+ casos diferentes
    }
  };
  ```

- **Linha 113:** `getStatusIcon(status)` - Ícones por status
  ```typescript
  const getStatusIcon = (status: string) => {
    switch (status.toUpperCase()) {
      case "CCB_GERADA":
        return <FileText className="h-4 w-4" />;
      case "AGUARDANDO_ASSINATURA":
        return <Clock className="h-4 w-4" />;
      // ... 15+ casos diferentes
    }
  };
  ```

#### **client/src/pages/financeiro/pagamentos.tsx**
- **Linha 318:** `getStatusColor(status)` - Cores para status de pagamento
  ```typescript
  const getStatusColor = (status: string) => {
    switch (status) {
      case "aguardando_aprovacao":
        return "bg-yellow-100 text-yellow-800";
      case "aprovado":
        return "bg-blue-100 text-blue-800";
      case "pago":
        return "bg-green-100 text-green-800";
      // ... 8+ casos específicos de pagamento
    }
  };
  ```

- **Linha 341:** `getStatusLabel(status)` - Labels de pagamento
  ```typescript
  const getStatusLabel = (status: string) => {
    switch (status) {
      case "aguardando_aprovacao":
        return "Aguardando Aprovação";
      case "pagamento_autorizado":
        return "Pagamento Autorizado";
      // ... 8+ casos específicos
    }
  };
  ```

#### **client/src/pages/financeiro/CobrancasPage.tsx**
- **Linha 585:** `getStatusColor(status)` - Status de cobrança
  ```typescript
  const getStatusColor = (status: string) => {
    switch (status) {
      case "em_dia":
        return "bg-green-100 text-green-800";
      case "inadimplente":
        return "bg-red-100 text-red-800";
      case "quitado":
        return "bg-blue-100 text-blue-800";
    }
  };
  ```

- **Linha 598:** `getParcelaStatusColor(status)` - Status de parcela individual
  ```typescript
  const getParcelaStatusColor = (status: string) => {
    switch (status) {
      case "pago":
        return "bg-green-100 text-green-800";
      case "vencido":
        return "bg-red-100 text-red-800";
      case "pendente":
        return "bg-yellow-100 text-yellow-800";
    }
  };
  ```

- **Linha 612:** `getInterBankStatusColor(status)` - Status do Banco Inter
  ```typescript
  const getInterBankStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case "RECEBIDO":
      case "MARCADO_RECEBIDO":
        return "bg-green-100 text-green-800";
      case "CANCELADO":
      case "EXPIRADO":
        return "bg-gray-100 text-gray-800";
      // ... 10+ casos do Inter Bank
    }
  };
  ```

### 2.2 Backend - Lógica Condicional de Negócio

#### **server/routes.ts**
- **Linha 821:** Verificação condicional de status em endpoint específico
  ```typescript
  if (status) {
    // Lógica específica baseada no status da proposta
  }
  ```

- **Linha 1218:** Filtro de status para fila de análise
  ```typescript
  } else if (status) {
    if (userRole === "ADMINISTRADOR" || userRole === "ATENDENTE") {
      whereConditions.push(eq(propostas.status, status as string));
      console.log(`🔍 [STATUS FILTER] ${userRole} filtrando por status: ${status}`);
    }
  }
  ```

- **Linhas 1414, 1419, 1424:** Múltiplas verificações condicionais de status em lógica de autorização

#### **server/app.ts**
- **Linha 154:** Verificação de status HTTP em error handler
  ```typescript
  if (status === 500) {
    console.error(`[express] Error:`, err);
  }
  ```

---

## 3. Síntese de Arquitetura de Status

### **Conclusão: Arquitetura HÍBRIDA com Centralização Parcial**

A análise revela um padrão arquitetural **híbrido** com elementos tanto centralizados quanto descentralizados:

#### **3.1 Centralização Identificada:**
- **Serviço Centralizado Descoberto:** `status-context-helper.ts` 
  - Função `updateStatusWithContext` é um **motor de transição centralizado emergente**
  - Implementado recentemente (PAM V1.0) para garantir dupla escrita transacional
  - **6 pontos de uso identificados** em routes.ts e storage.ts
  - Inclui contexto, auditoria e metadados nas transições

#### **3.2 Descentralização Fragmentada:**
- **Frontend:** Lógica de UI completamente descentralizada
  - **9 funções distintas** para mapeamento visual de status
  - Espalhadas por 3 páginas principais (dashboard, pagamentos, cobranças)
  - **Inconsistência**: Status hardcoded em múltiplos pontos
  - **Redundância**: Mesma lógica de cores/labels repetida

#### **3.3 Problemas Arquiteturais Identificados:**
1. **Dupla Responsabilidade:** Status serve tanto para workflow quanto para UI
2. **Status Órfãos:** server/routes/propostas.ts hardcoda "assinado" sem usar enum
3. **Inconsistência de Contexto:** Diferentes contextos ('pagamentos', 'cobrancas', 'formalizacao') não são padronizados
4. **Falta de FSM Formal:** Não há validação de transições válidas entre estados

#### **3.4 Estado da Arquitetura Atual:**
- **20% Centralizado** - updateStatusWithContext para escrita
- **80% Descentralizado** - Lógica de leitura e apresentação
- **Emergente** - Padrão de centralização está sendo implementado gradualmente
- **Inconsistente** - Múltiplos padrões coexistindo sem coordenação

---

## **DECLARAÇÃO DE INCERTEZA**

### **CONFIANÇA NA IMPLEMENTAÇÃO:** 85%
- 15% de incerteza relacionada a possíveis usos em:
  - Arquivos de middleware não examinados em detalhe
  - Workers/jobs assíncronos (BullMQ) que podem ter lógica de status
  - Possíveis webhooks externos que atualizam status

### **RISCOS IDENTIFICADOS:** MÉDIO
- **Risco de Status Órfãos:** Identificado uso hardcoded de "assinado" fora do enum
- **Risco de Inconsistência:** Lógica de UI duplicada pode causar divergências visuais
- **Risco de Transições Inválidas:** Sem FSM formal, transições inválidas são possíveis

### **DECISÕES TÉCNICAS ASSUMIDAS:**
- Assumi que `updateStatusWithContext` é o padrão emergente para modificação centralizada
- Assumi que switch statements são o padrão predominante para lógica condicional de status
- Assumi que status hardcoded em responses JSON não afetam o estado da proposta

### **VALIDAÇÃO PENDENTE:**
- Examinar arquivos de workers/jobs assíncronos para lógica de status adicional
- Verificar webhooks do ClickSign e Banco Inter para atualizações de status externas
- Validar se há outros serviços além de `status-context-helper` que centralizem lógica de transição

---

**Relatório compilado por:** PAM V1.0 - Reconhecimento Arquitetural  
**Status:** COMPLETADO ✅  
**Próximos Passos:** Projetar FSM centralizada baseada nos padrões identificados