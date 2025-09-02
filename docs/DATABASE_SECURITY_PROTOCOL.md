# 🚨 PROTOCOLO DE SEGURANÇA DE DATABASE - VERSÃO DEFINITIVA

## PROBLEMA IDENTIFICADO (2025-09-02)

**INCIDENTE CRÍTICO:** Durante execução de testes de integração, o sistema executou `TRUNCATE TABLE ... CASCADE` no banco de produção, causando perda total de dados.

**CAUSA RAIZ:** O sistema de testes estava configurado para usar `DATABASE_URL` (produção) em vez de `TEST_DATABASE_URL` (teste).

## SOLUÇÃO IMPLEMENTADA

### 1. MODIFICAÇÃO EM `tests/lib/db-helper.ts`

**ANTES (PERIGOSO):**
```typescript
const databaseUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
```

**DEPOIS (SEGURO):**
```typescript
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error('FATAL: TEST_DATABASE_URL obrigatório para testes. NUNCA usar DATABASE_URL de produção.');
}
```

### 2. PROTOCOLO DE AMBIENTE OBRIGATÓRIO

#### VARIÁVEIS DE AMBIENTE EXIGIDAS:
- **PRODUÇÃO**: `DATABASE_URL` → Banco principal Supabase
- **TESTE**: `TEST_DATABASE_URL` → Banco separado com sufixo `_test`

#### VALIDAÇÕES OBRIGATÓRIAS:
1. `NODE_ENV === 'test'` (verificado)
2. `TEST_DATABASE_URL` configurado (novo)
3. URL não pode conter dados de produção (verificado)

### 3. COMO CONFIGURAR AMBIENTES SEGUROS

#### Para DESENVOLVIMENTO/PRODUÇÃO:
```bash
DATABASE_URL=postgresql://user:pass@host:5432/simpix_prod
```

#### Para TESTES:
```bash
TEST_DATABASE_URL=postgresql://user:pass@host:5432/simpix_test
```

## RESPOSTA À PERGUNTA: "COMO ATUALIZAR EM TEMPO REAL?"

### ESTRATÉGIA RECOMENDADA:

1. **MESMO PROJETO, BANCOS SEPARADOS**
   - Manter código no mesmo Replit
   - `DATABASE_URL` para desenvolvimento/produção
   - `TEST_DATABASE_URL` para testes isolados

2. **VANTAGENS:**
   - ✅ Desenvolvimento em tempo real
   - ✅ Zero chance de deletar produção
   - ✅ Testes isolados
   - ✅ Mesmo código base

3. **IMPLEMENTAÇÃO:**
   - Criar banco Supabase separado para testes
   - Configurar `TEST_DATABASE_URL` nos secrets
   - Sistema automaticamente usa banco correto por ambiente

## PROIBIÇÕES PERMANENTES

1. **NEON DATABASE**: Proibido para sempre conforme replit.md
2. **MOCKS EM PRODUÇÃO**: Usar sempre dados reais
3. **TRUNCATE SEM VALIDAÇÃO**: Operação só permitida com validações triplas

## VALIDAÇÃO DE FUNCIONAMENTO

Execute este comando para testar o protocolo:
```bash
NODE_ENV=test npm test -- --grep "database"
```

Se ver erro "TEST_DATABASE_URL não configurado", está funcionando corretamente!