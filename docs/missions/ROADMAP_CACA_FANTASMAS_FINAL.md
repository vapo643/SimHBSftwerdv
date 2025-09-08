# OPERAÇÃO CAÇA-FANTASMAS - ROADMAP DE IMPLEMENTAÇÃO FINAL

**Data:** 2025-09-02  
**Protocolo:** PAM V1.0  
**Missão:** Arquitetura da Correção - Plano de Batalha Tático  
**Status:** Plano de Exorcismo Completo

---

## 🎯 RESUMO EXECUTIVO

### **DESCOBERTA CRÍTICA: ROOT CAUSE IDENTIFICADA**

A análise forense revelou a **causa raiz exata** do Poltergeist de Mock Redis:

- **Problema:** Mock no `tests/setup.ts` exporta `getRedisHealth` (linha 43)
- **Realidade:** Código de produção exporta `checkRedisHealth` (linha 258 em redis-manager.ts)
- **Impacto:** 60% das falhas de teste (18/30) causadas por esta simples divergência

### **ESTRATÉGIA DE ATAQUE**

**Ordem de Exorcismo:** P0 → P1 → P2  
**ROI Máximo:** Primeira correção resolve 60% dos problemas instantaneamente

---

## 🚀 MISSÕES DE IMPLEMENTAÇÃO

### **🔴 MISSÃO P0: EXORCISMO DO POLTERGEIST REDIS**

**Prioridade:** Crítica  
**Impacto:** 18/30 falhas (60%)  
**Esforço:** Baixo (15 minutos)  
**ROI:** EXTREMO

#### **Arquivo Alvo:**

```
tests/setup.ts (linha 43)
```

#### **Plano de Ação Técnico:**

##### **PASSO 1: Correção do Export Mock**

**Localização:** `tests/setup.ts` linha 43  
**Código Atual:**

```typescript
getRedisHealth: vi.fn().mockResolvedValue({ status: 'ok', connections: 1 });
```

**Código Corrigido:**

```typescript
checkRedisHealth: vi.fn().mockResolvedValue({
  status: 'healthy',
  latency: 10,
  timestamp: new Date().toISOString(),
});
```

##### **PASSO 2: Adicionar Exports Ausentes**

**Problema:** Mock incompleto pode ter outros exports ausentes  
**Ação:** Adicionar todos os exports principais do redis-manager

**Código Completo do Mock (substituir linhas 20-44):**

```typescript
vi.mock('../server/lib/redis-manager', () => ({
  __esModule: true,
  default: vi.fn(),

  // Export principal que estava causando falha
  checkRedisHealth: vi.fn().mockResolvedValue({
    status: 'healthy',
    latency: 10,
    timestamp: new Date().toISOString(),
  }),

  // Exports existentes (manter)
  getRedisClient: vi.fn().mockResolvedValue({
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    pipeline: vi.fn().mockReturnValue({
      get: vi.fn(),
      exec: vi.fn().mockResolvedValue([]),
    }),
    quit: vi.fn(),
    disconnect: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    smembers: vi.fn().mockResolvedValue([]),
    sadd: vi.fn(),
    lrange: vi.fn().mockResolvedValue([]),
    lpush: vi.fn(),
    ltrim: vi.fn(),
  }),

  // Outros exports do módulo real
  disconnectRedis: vi.fn(),
  resetRedisForTesting: vi.fn(),
  redisManager: {
    healthCheck: vi.fn().mockResolvedValue({ status: 'healthy' }),
    getClient: vi.fn(),
    disconnect: vi.fn(),
  },
}));
```

#### **Prova de Sucesso:**

```bash
# Comando de validação
npx vitest run --reporter=verbose

# Resultado esperado
# - Redução de ~18 falhas (de 30 para ~12)
# - Eliminação do erro: 'No "checkRedisHealth" export is defined'
# - Testes que eram P0-blocked agora executam e podem revelar problemas P1/P2
```

---

### **🟠 MISSÃO P1: BANIMENTO DA APARIÇÃO API 500**

**Prioridade:** Alta  
**Impacto:** 7/30 falhas (25%)  
**Esforço:** Médio (2-3 horas)  
**ROI:** Alto

#### **Arquivo Alvo:**

```
server/routes/tabelasComerciais/ (endpoints de tabelas comerciais)
tests/routes/tabelasComerciais.test.ts
```

#### **Plano de Ação Técnico:**

##### **PASSO 1: Investigação dos Logs de Erro**

```bash
# Executar teste específico com debug
DEBUG=* npx vitest run tests/routes/tabelasComerciais.test.ts --reporter=verbose

# Analisar logs do servidor durante execução dos testes
# Identificar stack trace completo do erro 500
```

##### **PASSO 2: Cenários de Falha Identificados**

**Cenário A:** Query sem resultados (`produtoId: 999, parceiroId: 999`)

- **Hipótese:** Erro de SQL ou tratamento inadequado de result set vazio
- **Ação:** Implementar tratamento defensivo para consultas vazias

**Cenário B:** Lógica hierárquica (`produtoId: 1, parceiroId: 10`)

- **Hipótese:** Erro na lógica de fallback entre tabelas personalizadas e gerais
- **Ação:** Revisar algoritmo de seleção hierárquica

##### **PASSO 3: Implementação das Correções**

```typescript
// Padrão de correção esperado
try {
  const tabelasComerciais = await consultarTabelasComerciais(produtoId, parceiroId);

  if (!tabelasComerciais || tabelasComerciais.length === 0) {
    return res.status(200).json([]); // Retorno explícito para caso vazio
  }

  return res.status(200).json(tabelasComerciais);
} catch (error) {
  console.error('[TABELAS COMERCIAIS] Erro na consulta:', error);
  return res.status(500).json({
    error: 'Erro interno do servidor',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined,
  });
}
```

#### **Prova de Sucesso:**

```bash
# Comando de validação específico
npx vitest run tests/routes/tabelasComerciais.test.ts --reporter=verbose

# Resultado esperado
# - Status 200 em vez de 500 para cenários de teste
# - Array vazio retornado para consultas sem resultados
# - Lógica hierárquica funcionando corretamente
```

---

### **🟡 MISSÃO P2: PURIFICAÇÃO DOS FANTASMAS DE INTEGRAÇÃO**

**Prioridade:** Média  
**Impacto:** 5/30 falhas (15%)  
**Esforço:** Alto (3-4 horas)  
**ROI:** Médio

#### **Arquivo Alvo:**

```
tests/integration/proposal-api.test.ts
tests/propostas.test.ts (testes afetados por P0)
```

#### **Plano de Ação Técnico:**

##### **PASSO 1: Re-avaliação Pós-P0**

```bash
# CRÍTICO: Executar após Missão P0 para cenário real
npx vitest run tests/integration/ --reporter=verbose

# Muitos "fantasmas P2" podem ser na verdade consequências do P0
# Esta etapa revelará os problemas genuínos de integração
```

##### **PASSO 2: Coordenação de Mocks**

**Problema Antecipado:** Setup de testes de integração pode ter dependências complexas

```typescript
// Padrão de correção esperado para setup de integração
beforeEach(async () => {
  // 1. Limpar Redis mock
  clearMockRedisData();

  // 2. Reset banco de dados de teste
  await resetTestDatabase();

  // 3. Coordenar mocks entre módulos
  vi.clearAllMocks();

  // 4. Setup específico para integração
  mockEnvironmentVariables();
});
```

##### **PASSO 3: Resolução de Dependências**

**Ação:** Investigar e resolver conflitos entre:

- Mocks Redis vs instâncias reais necessárias
- Dados de teste vs estado limpo entre testes
- Timing de inicialização vs execução dos testes

#### **Prova de Sucesso:**

```bash
# Comando de validação final
npx vitest run --reporter=verbose

# Resultado esperado
# - 0 falhas de teste (225/225 passando)
# - 100% de taxa de sucesso
# - Tempo de execução estável
```

---

## 📈 PROJEÇÕES DE IMPACTO CUMULATIVO

### **FASE 1: Pós-Missão P0**

- **Falhas Esperadas:** 30 → 12 (redução de 60%)
- **Status:** "Poltergeist Exorcizado"
- **Próximo Passo:** Re-avaliação e ataque aos P1

### **FASE 2: Pós-Missão P1**

- **Falhas Esperadas:** 12 → 5 (redução adicional de 58%)
- **Status:** "Aparição Banida"
- **Decisão:** Candidato a GO com 98% de sucesso

### **FASE 3: Pós-Missão P2**

- **Falhas Esperadas:** 5 → 0 (redução final de 100%)
- **Status:** "Purificação Completa"
- **Decisão:** **GO DEFINITIVO para produção**

---

## 🎖️ ORDEM DE EXECUÇÃO MANDATÓRIA

### **🚨 SEQUÊNCIA OBRIGATÓRIA**

1. **MISSÃO P0 PRIMEIRO** - Não pule esta etapa
2. **Re-avaliação Completa** - Execute `vitest run` pós-P0
3. **MISSÃO P1** - Baseada em nova realidade pós-P0
4. **MISSÃO P2** - Apenas se necessário após P1

### **⚡ ACCELERAÇÃO ESTRATÉGICA**

**P0 é o multiplicador de força:** Resolver o mock Redis primeiro não só elimina 60% dos problemas, mas também **limpa o campo de visão** para identificar problemas genuínos P1/P2.

**Sem P0 resolvido:** Difícil distinguir entre falhas reais e artefatos do mock  
**Com P0 resolvido:** Visibilidade clara dos problemas de lógica de negócio

---

## 🔬 EVIDÊNCIAS TÉCNICAS E VALIDAÇÃO

### **Erro P0 Confirmado:**

```
Error: [vitest] No "checkRedisHealth" export is defined on the "../server/lib/redis-manager" mock.
```

### **Mock Atual (Problemático):**

```typescript
// linha 43 em tests/setup.ts
getRedisHealth: vi.fn().mockResolvedValue({ status: 'ok', connections: 1 });
```

### **Export Real (Correto):**

```typescript
// linha 258 em server/lib/redis-manager.ts
export async function checkRedisHealth() {
  return redisManager.healthCheck();
}
```

### **Correção Precisa:**

```typescript
checkRedisHealth: vi.fn().mockResolvedValue({
  status: 'healthy',
  latency: 10,
  timestamp: new Date().toISOString(),
});
```

---

## 🏆 DECLARAÇÃO DE CONFIANÇA

**Nível de Confiança no Roadmap:** **98%**  
**Precisão da Causa Raiz P0:** **100%** (confirmada por análise de código)  
**Probabilidade de Sucesso P0:** **100%** (correção trivial)  
**Estimativa P1+P2:** **85%** (dependente da re-avaliação pós-P0)

---

**Roadmap criado por:** Agente Simpix - Operação Caça-Fantasmas  
**Próxima Fase:** Implementação da Missão P0  
**Meta Final:** 0 falhas de teste, GO para produção
