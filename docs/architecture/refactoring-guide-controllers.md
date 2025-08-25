# Guia de Refatoração: Eliminando Violações Controller-Database

## 🎯 Objetivo
Eliminar as 122 violações onde controllers acessam banco de dados diretamente, estabelecendo a arquitetura correta: **Controller → Service → Repository → Database**

## 📊 Status Atual
- **122 violações** de controllers acessando `server/lib/supabase.ts` diretamente
- **Impacto**: Violação do Princípio de Responsabilidade Única (SRP)
- **Risco**: Acoplamento alto, baixa testabilidade, manutenibilidade comprometida

## ✅ Padrão Arquitetural Correto

### Camadas e Responsabilidades

```
┌──────────────┐
│  Controller  │ → Validação de entrada, HTTP handling, autenticação
└──────┬───────┘
       ↓
┌──────────────┐
│   Service    │ → Lógica de negócio, orquestração, validações complexas
└──────┬───────┘
       ↓
┌──────────────┐
│  Repository  │ → Acesso a dados, queries, operações CRUD
└──────┬───────┘
       ↓
┌──────────────┐
│   Database   │ → Persistência
└──────────────┘
```

## 🔄 Processo de Refatoração Passo a Passo

### Passo 1: Criar Repository Base
```typescript
// server/repositories/base.repository.ts
export abstract class BaseRepository<T> {
  protected tableName: string;
  
  constructor(tableName: string) {
    this.tableName = tableName;
  }
  
  // Métodos CRUD genéricos
  async findAll(filters?: Record<string, any>): Promise<T[]>
  async findById(id: string | number): Promise<T | null>
  async create(data: Partial<T>): Promise<T>
  async update(id: string | number, data: Partial<T>): Promise<T>
  async delete(id: string | number): Promise<void>
}
```

### Passo 2: Criar Repository Específico
```typescript
// server/repositories/[entidade].repository.ts
export class EntidadeRepository extends BaseRepository<Entidade> {
  constructor() {
    super("nome_tabela");
  }
  
  // Métodos específicos da entidade
  async findByCustomField(value: string): Promise<Entidade[]> {
    // Query específica
  }
}

export const entidadeRepository = new EntidadeRepository();
```

### Passo 3: Criar Service
```typescript
// server/services/[entidade]Service.ts
import { entidadeRepository } from "../repositories/[entidade].repository";

export class EntidadeService {
  async getAll(filters?: any) {
    // Lógica de negócio
    // Validações
    // Chamada ao repository
    return await entidadeRepository.findAll(filters);
  }
  
  async create(data: any, userId: string) {
    // Validações de negócio
    // Auditoria
    // Chamada ao repository
    const created = await entidadeRepository.create(data);
    // Log de segurança
    return created;
  }
}

export const entidadeService = new EntidadeService();
```

### Passo 4: Refatorar Controller
```typescript
// ANTES (Violação):
import { db } from "../lib/supabase"; // ❌ Acesso direto

router.get("/entidades", async (req, res) => {
  const data = await db.from("entidades").select("*"); // ❌
  res.json(data);
});

// DEPOIS (Correto):
import { entidadeService } from "../services/entidadeService"; // ✅

router.get("/entidades", async (req, res) => {
  try {
    const data = await entidadeService.getAll(req.query); // ✅
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

## 📝 Checklist de Refatoração por Controller

### Controllers Prioritários (Mais violações)
1. [ ] `server/routes/propostas.ts` - Alto impacto
2. [ ] `server/routes/pagamentos/index.ts` - Crítico para negócio
3. [ ] `server/routes/inter.ts` - Integração bancária
4. [ ] `server/routes/auth/index.ts` - Segurança crítica
5. [ ] `server/routes/cobrancas.ts` - Processo core

### Padrão de Nomenclatura
- **Repository**: `[entidade].repository.ts` → Singular, camelCase
- **Service**: `[entidade]Service.ts` → Singular, sufixo "Service"
- **Controller**: `[entidade].ts` ou `[entidade]-routes.ts` → Mantém existente

## 🚀 Script de Validação

Execute após cada refatoração:
```bash
node validate-architecture.js | grep "controllers-should-not-have-business-logic"
```

## 📈 Métricas de Sucesso
- [ ] 0 imports diretos de `db` ou `supabase` em controllers
- [ ] 100% dos controllers usando services
- [ ] Validação arquitetural sem violações de boundary
- [ ] Testes unitários possíveis com mocks de services

## ⚠️ Cuidados Especiais

### Transações
Services devem gerenciar transações quando múltiplas operações são necessárias:
```typescript
async createWithRelations(data: any) {
  // Service coordena transação
  return await db.transaction(async (trx) => {
    const main = await mainRepository.create(data.main, trx);
    const related = await relatedRepository.create(data.related, trx);
    return { main, related };
  });
}
```

### Autenticação e Autorização
- **Controller**: Verifica autenticação básica (usuário logado)
- **Service**: Aplica regras de negócio de autorização
- **Repository**: Nunca faz verificações de segurança

### Cache
Services gerenciam cache, não controllers ou repositories:
```typescript
class ProductService {
  private cache = new Map();
  
  async getProduct(id: string) {
    if (this.cache.has(id)) return this.cache.get(id);
    const product = await productRepository.findById(id);
    this.cache.set(id, product);
    return product;
  }
}
```

## 🎯 Exemplo Completo Implementado
✅ **Refatorado com sucesso:**
- `server/routes/observacoes-refactored.ts` - Controller exemplo
- `server/services/observacoesService.ts` - Service layer
- `server/repositories/observacoes.repository.ts` - Data access
- `server/repositories/base.repository.ts` - Base abstrata

Use estes como referência para refatorar os demais controllers.

## 📊 Progresso
- [x] Base Repository criado
- [x] Exemplo de refatoração completo (observações)
- [ ] 120 controllers restantes para refatorar
- [ ] Validação arquitetural limpa

## 🔄 Próximos Passos
1. Priorizar controllers por criticidade de negócio
2. Criar repositories e services correspondentes
3. Refatorar em lotes de 5-10 controllers
4. Executar validação após cada lote
5. Documentar padrões específicos encontrados