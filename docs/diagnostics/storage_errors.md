# Erros de Storage - Supabase

## [STORAGE_001] StorageApiError: Object not found

### 🚨 Sintoma

```
❌ [FORMALIZACAO] Erro ao gerar URL assinada: StorageApiError: Object not found
    at <anonymous> (/home/runner/workspace/node_modules/@supabase/storage-js/src/lib/fetch.ts:30:16)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5) {
  __isStorageError: true,
  status: 400
}
```

### 🔍 Causa

1. **Caminho do arquivo incorreto** - O arquivo não existe no path especificado
2. **Arquivo deletado** - CCB foi removido mas banco ainda referencia o caminho
3. **Inconsistência entre banco e storage** - Banco tem caminho antigo
4. **Permissões incorretas** - Cliente comum tentando acessar arquivo privado

### ✅ Solução Testada

#### 1. Verificar se arquivo existe no Storage

```sql
SELECT caminho_ccb, ccb_gerado_em FROM propostas WHERE id = 'PROPOSTA_ID';
```

#### 2. Usar client admin para gerar URLs assinadas

```javascript
// ❌ INCORRETO - client comum
const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 3600);

// ✅ CORRETO - client admin
import { createServerSupabaseAdminClient } from '../lib/supabase';
const adminSupabase = createServerSupabaseAdminClient();
const { data, error } = await adminSupabase.storage.from('documents').createSignedUrl(path, 3600);
```

#### 3. Fallback para regeneração

```javascript
if (error && error.status === 400) {
  console.log('🔄 Arquivo não encontrado, regenerando CCB...');
  const newCcb = await ccbGenerationService.generateCCB(proposalId, true);
  return newCcb.publicUrl;
}
```

### 🛡️ Prevenção

1. **Sempre usar admin client** para operações de Storage
2. **Verificar existência** antes de gerar URL
3. **Implementar fallback** para regeneração automática
4. **Logs detalhados** para debug

### 📅 Última Atualização

2025-08-07 - Solução validada e implementada

---

## [STORAGE_002] Permission denied - Private bucket access

### 🚨 Sintoma

```
❌ Permission denied accessing private bucket
```

### 🔍 Causa

Cliente comum tentando acessar bucket privado sem usar admin client

### ✅ Solução Testada

Sempre usar `createServerSupabaseAdminClient()` para operações de Storage:

```javascript
import { createServerSupabaseAdminClient } from '../lib/supabase';

const adminSupabase = createServerSupabaseAdminClient();
const { data, error } = await adminSupabase.storage.from('documents').upload(filePath, fileBuffer);
```

### 🛡️ Prevenção

- Padronizar uso do admin client para Storage
- Documentar claramente quando usar cada tipo de client

### 📅 Última Atualização

2025-08-07 - Implementado em ccbGenerationService.ts
