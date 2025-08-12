# Erros de Banco de Dados

## [DB_001] Column does not exist

### 🚨 Sintoma
```
❌ QueryError: column "acao" does not exist in table "proposta_logs"
```

### 🔍 Causa
- Schema desatualizado - colunas foram renomeadas
- Migration não executada
- Código usando nomes antigos de colunas

### ✅ Solução Testada

#### 1. Verificar schema atual
```sql
\d proposta_logs;
-- ou
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'proposta_logs';
```

#### 2. Atualizar queries para usar nomes corretos
```javascript
// ❌ INCORRETO - coluna "acao" não existe mais
INSERT INTO proposta_logs (proposta_id, acao, detalhes)

// ✅ CORRETO - usar colunas atuais
INSERT INTO proposta_logs (proposta_id, status_anterior, status_novo, detalhes)
```

#### 3. Executar migration se necessário
```bash
npm run db:push
```

### 🛡️ Prevenção
- Sempre verificar schema antes de alterar queries
- Usar Drizzle schema como fonte da verdade
- Testes de integração para validar queries

### 📅 Última Atualização
2025-08-07 - Schema atualizado em proposta_logs

---

## [DB_002] Foreign key constraint violation

### 🚨 Sintoma
```
❌ Foreign key constraint violation: Key (autor_id) is not present in table "profiles"
```

### 🔍 Causa
- UUID inválido para autor_id
- Usuário foi deletado mas logs referenciam ele
- Dados de teste com UUIDs fictícios

### ✅ Solução Testada

#### 1. Verificar se usuário existe
```sql
SELECT id, email FROM profiles WHERE id = 'UUID_USUARIO';
```

#### 2. Usar UUID de usuário válido
```sql
-- Buscar usuário válido
SELECT id FROM profiles LIMIT 1;

-- Usar nas queries
INSERT INTO proposta_logs (proposta_id, status_anterior, status_novo, autor_id)
VALUES ('proposta-id', 'anterior', 'novo', 'usuario-valido-uuid');
```

#### 3. Para logs automáticos, usar usuário sistema
```javascript
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
```

### 🛡️ Prevenção
- Validar UUIDs antes de inserir
- Criar usuário "sistema" para logs automáticos
- Soft delete para usuários para manter referências

### 📅 Última Atualização
2025-08-07 - Validação de UUIDs implementada