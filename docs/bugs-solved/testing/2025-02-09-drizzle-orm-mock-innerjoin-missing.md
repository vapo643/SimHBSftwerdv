# Bug Fix Report: Missing innerJoin Method in Drizzle ORM Mocks

**Categoria:** Testing  
**Data:** 2025-09-02  
**Prioridade:** P2 (Medium)  
**Status:** ✅ RESOLVIDO

## Sumário Executivo

Testes do endpoint `/api/tabelas-comerciais-disponiveis` falhavam com erro "innerJoin is not a function" devido a mocks incompletos do Drizzle ORM que não incluíam o método `innerJoin` necessário para consultas com relacionamentos.

## Análise Técnica Detalhada

### Código Problemático Original

```typescript
// Mock incompleto - faltava innerJoin
const mockChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockResolvedValue(mockData),
};

dbMock.select.mockReturnValue(mockChain);
```

### Root Cause

- **Mock chain incompleto** não cobria todos os métodos utilizados pela query real
- **Drizzle ORM queries** utilizam `innerJoin` para relacionamentos entre tabelas
- **Falta de mapeamento** entre métodos reais do ORM e métodos mockados
- **Query complexity** não foi antecipada durante criação dos mocks iniciais

### Evidência do Problema

```bash
# Erro em tabelasComerciais.test.ts:
TypeError: dbMock.select(...).from(...).innerJoin is not a function
```

### Query Real Que Causava o Problema

```typescript
// A query real usa innerJoin para relacionar tabelas
const personalizedTables = await db
  .select({
    id: tabelasComerciais.id,
    nomeTabela: tabelasComerciais.nomeTabela,
    parceiroId: tabelasComerciais.parceiroId,
  })
  .from(tabelasComerciais)
  .innerJoin(produtos, eq(produtos.id, tabelasComerciais.produtoId)) // ← Este método faltava no mock
  .where(
    and(eq(tabelasComerciais.produtoId, produtoId), eq(tabelasComerciais.parceiroId, parceiroId))
  )
  .orderBy(tabelasComerciais.nomeTabela);
```

## Solução Implementada

### Mock Builder Function

```typescript
// Função helper para criar mock query builders completos
const createMockQueryBuilder = (mockData: any[] = []) => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(), // ← Método adicionado
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockResolvedValue(mockData),
});
```

### Implementação nos Testes

```typescript
it('should return only personalized tables for a partner with custom tables', async () => {
  // Setup: Mock retorna tabelas personalizadas na primeira consulta
  const personalizedBuilder = createMockQueryBuilder(mockTabelasPersonalizadas);
  dbMock.select.mockReturnValue(personalizedBuilder);

  const response = await request(app)
    .get('/api/tabelas-comerciais-disponiveis')
    .query({ produtoId: 1, parceiroId: 10 })
    .expect(200);

  // Validar que innerJoin foi chamado
  expect(personalizedBuilder.innerJoin).toHaveBeenCalled();
  expect(response.body).toEqual(mockTabelasPersonalizadas);
});
```

### Melhorias Implementadas

1. **Mock completo** com todos os métodos da chain do Drizzle ORM
2. **Helper function** reutilizável para diferentes cenários de teste
3. **Validação comportamental** que verifica se innerJoin foi chamado
4. **Flexibilidade** para simular diferentes resultados de query

## Validação da Correção

### Teste de Regressão

- ✅ Teste `tabelasComerciais.test.ts` passa de 2/10 para 8/10 testes
- ✅ Não há mais erro "innerJoin is not a function"
- ✅ Lógica hierárquica (personalizada → geral) funciona corretamente

### Métricas de Impacto

- **Antes:** TypeError em 100% das execuções dos testes
- **Depois:** 8/10 testes passando, 2 falhas não relacionadas ao mock
- **Cobertura:** 100% dos métodos Drizzle ORM necessários

## Lições Aprendidas

1. **Mapear completamente** todos os métodos utilizados pelo ORM real
2. **Criar helper functions** para mocks complexos e reutilizáveis
3. **Validar comportamento** além de apenas dados retornados
4. **Antecipar complexity** das queries ao criar mocks

## Prevenção de Regressão

### Testing Standards

- [ ] Mocks cobrem 100% dos métodos utilizados?
- [ ] Helper functions para query builders complexos?
- [ ] Validação comportamental além de dados?
- [ ] Documentação de métodos necessários por ORM?

### Code Review Checklist

- [ ] Novos métodos ORM têm correspondente no mock?
- [ ] Query changes refletem em mock updates?
- [ ] Helper functions são reutilizadas quando possível?

### Architecture Decision

**ADR-MOCK-001:** Todos os mocks de ORM devem incluir métodos de chain completos para evitar falhas em queries que utilizam relacionamentos complexos.
