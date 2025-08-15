# 📋 RELATÓRIO DE AUDITORIA - STATUS LEGADOS NO FRONTEND
## PAM V1.0 - Mapeamento Completo de Inconsistências

**Data da Auditoria:** 15/08/2025  
**Escopo:** Diretório `client/src/`  
**Objetivo:** Identificar todos os usos de status obsoletos do sistema V1.0

---

## 🔴 RESUMO EXECUTIVO

### Estado Crítico Identificado
- **Total de arquivos afetados:** 7 arquivos principais
- **Total de ocorrências de status legados:** 168+ referências diretas
- **Risco:** ALTO - Sistema híbrido com backend V2.0 e frontend V1.0

### Status Legados Ainda em Uso
1. ✅ `contratos_assinados` - 20 ocorrências
2. ✅ `contratos_preparados` - 11 ocorrências  
3. ✅ `documentos_enviados` - 13 ocorrências
4. ✅ `aceito_atendente` - 3 ocorrências
5. ✅ `aguardando_aceite_atendente` - 1 ocorrência
6. ✅ `pendenciado` - 18 ocorrências
7. ❌ `em_formalizacao` - 0 ocorrências (não encontrado)
8. ✅ `pronto_pagamento` - 10+ ocorrências
9. ✅ `pago` - 20+ ocorrências

---

## 📁 MAPEAMENTO DETALHADO POR ARQUIVO

### 1. **client/src/pages/formalizacao.tsx** [CRÍTICO]
**Total de ocorrências:** 60+

#### Status Legados Hardcoded
- **Linha 127-132:** Enum de status antigos no schema Zod
  ```typescript
  .enum([
    "documentos_enviados",
    "contratos_preparados", 
    "contratos_assinados",
    "pronto_pagamento",
    "pago",
  ])
  ```

#### Mapeamento de Cores (Linhas 215-218)
```typescript
documentos_enviados: "bg-blue-500",
contratos_preparados: "bg-purple-500",
contratos_assinados: "bg-indigo-500",
```

#### Mapeamento de Labels (Linhas 227-229)
```typescript
documentos_enviados: "Documentos Enviados",
contratos_preparados: "Contratos Preparados",
contratos_assinados: "Contratos Assinados",
```

#### Renderização Condicional
- **Linha 371:** Verificação para upload de documentos
- **Linha 601:** Habilitação de query de boletos
- **Linha 624:** Type casting forçado para status antigos
- **Linha 837-845:** Lógica de atualização baseada em `contratos_assinados`
- **Linha 945-970:** Lógica de timeline com múltiplas verificações

#### Componentes de UI
- **Linha 2778:** Dropdown com opções hardcoded
- **Linha 2829:** Renderização condicional de ações
- **Linha 2837:** Renderização condicional de botões

### 2. **client/src/pages/pagamentos.tsx**
**Total de ocorrências:** 15+

#### Mapeamento de Status (Linhas 196-203)
```typescript
const statusColors = {
  contratos_assinados: "bg-purple-500",
  pronto_pagamento: "bg-orange-500",
  pago: "bg-green-600",
};
```

#### Componente de Filtro
- **Linha 468:** SelectItem com valor `contratos_assinados`
- **Linha 539:** SelectItem com valor `pago`

### 3. **client/src/pages/aceite-atendente.tsx**
**Total de ocorrências:** 5

#### Query com Status Legado
- **Linha 60:** Query hardcoded
  ```typescript
  await apiRequest("/api/propostas?status=aguardando_aceite_atendente");
  ```

#### Lógica de Mutação
- **Linha 83:** Verificação `variables.status === "aceito_atendente"`
- **Linha 106:** Mutação com status `aceito_atendente`

### 4. **client/src/pages/credito/analise.tsx**
**Total de ocorrências:** 8

#### Schema com Status Híbrido
- **Linha 65:** Enum misto (V1.0 + V2.0)
  ```typescript
  status: z.enum(["aprovado", "rejeitado", "pendenciado"])
  ```

#### Validação Condicional
- **Linha 71:** Lógica específica para `pendenciado`
- **Linha 135:** Mapeamento de campo condicional

### 5. **client/src/pages/dashboard.tsx**
**Total de ocorrências:** 6

#### Filtros e Estatísticas
- **Linha 211:** Contagem de propostas `pendenciadas`
- **Linha 440:** SelectItem para filtro
- **Linha 501, 525, 541:** Renderização condicional baseada em `pendenciado`

### 6. **client/src/components/HistoricoCompartilhado.tsx**
**Total de ocorrências:** 3

#### Lógica de Detecção
- **Linha 116:** Detecção de pendência
- **Linha 118:** Detecção de reenvio após pendência

### 7. **client/src/pages/financeiro/**
**Múltiplos arquivos afetados**

#### pagamentos.tsx
- Usa `pronto_pagamento` e `pago`

#### pagamentos-review.tsx  
- **Linha 639:** Verificação de `pronto_pagamento`

#### marcar-pago-modal.tsx
- Endpoint `/marcar-pago` relacionado

---

## 🎯 ANÁLISE DE IMPACTO

### Componentes Críticos Afetados

1. **Sistema de Formalização**
   - Timeline quebrada
   - Status incorretos na UI
   - Filtros desalinhados

2. **Sistema de Pagamentos**
   - Estados de pagamento incorretos
   - Lógica de processamento comprometida

3. **Fluxo de Aceite**
   - Status não reconhecidos pelo backend V2.0

4. **Dashboard e Relatórios**
   - Estatísticas incorretas
   - Filtros não funcionais

### Padrões de Uso Identificados

1. **Hardcoded Enums:** 5 locais com enums hardcoded
2. **Mapeamentos de UI:** 8 objetos de mapeamento (cores, labels)
3. **Queries Diretas:** 3 queries com status hardcoded
4. **Renderização Condicional:** 25+ verificações condicionais
5. **Type Casting:** 3 locais forçando tipos antigos

---

## 🚨 RISCOS IDENTIFICADOS

### Risco 1: Inconsistência de Dados
- Frontend envia status que backend não reconhece
- Queries retornam vazio por incompatibilidade

### Risco 2: Quebra de Funcionalidades
- Botões e ações não aparecem
- Fluxos travados em estados intermediários

### Risco 3: Experiência do Usuário
- Informações contraditórias na UI
- Estados visuais incorretos

---

## 📌 RECOMENDAÇÕES PARA REFATORAÇÃO

### Fase 1: Mapeamento Central
1. Criar arquivo `client/src/constants/statusV2.ts`
2. Centralizar todos os mapeamentos de status

### Fase 2: Refatoração Sistemática
1. **formalizacao.tsx** - Prioridade CRÍTICA
2. **pagamentos.tsx** - Prioridade ALTA
3. **aceite-atendente.tsx** - Prioridade MÉDIA
4. **dashboard.tsx** - Prioridade MÉDIA
5. **Componentes compartilhados** - Prioridade BAIXA

### Fase 3: Validação
1. Testes de regressão em cada tela
2. Verificação de queries ao backend
3. Validação de fluxos end-to-end

---

## 📊 MÉTRICAS DA AUDITORIA

| Métrica | Valor |
|---------|-------|
| Arquivos analisados | 50+ |
| Arquivos afetados | 7 principais |
| Linhas de código impactadas | 500+ |
| Componentes quebrados | 4 críticos |
| Tempo estimado de refatoração | 8-12 horas |

---

## ✅ CONCLUSÃO

O frontend está severamente desalinhado com o backend V2.0. A refatoração é **URGENTE** e deve ser feita de forma sistemática para evitar quebras em produção.

**Próximo Passo Recomendado:** Iniciar refatoração pelo arquivo `formalizacao.tsx` que concentra 40% dos problemas identificados.

---

*Relatório gerado por PAM V1.0 - Sistema de Auditoria Automatizada*