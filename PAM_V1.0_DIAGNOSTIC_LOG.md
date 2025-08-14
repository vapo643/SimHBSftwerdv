# PAM V1.0 - RELATÓRIO DE DIAGNÓSTICO FORENSE
## Falha na comunicação Backend → Frontend (Carnê Status)

### INSTRUMENTAÇÃO IMPLEMENTADA

**Backend:** `/api/propostas/:id/carne-status`
- ✅ Log do propostaId exato recebido
- ✅ Log do caminho completo no Storage 
- ✅ Log do resultado da verificação no Storage
- ✅ Log do JSON exato enviado ao frontend

**Frontend:** `formalizacao.tsx`
- ✅ Log do propostaId usado para construir URL
- ✅ Log do momento da chamada API
- ✅ Log da resposta completa do backend
- ✅ Log do estado React final definido
- ✅ Log das condições do useEffect
- ✅ Log da renderização de botões

### TESTE EM EXECUÇÃO

**Proposta de Teste:** 88a44696-9b63-42ee-aa81-15f9519d24cb
**Status Esperado:** Carnê existente no Storage
**URL de Teste:** /formalizacao/acompanhamento/88a44696-9b63-42ee-aa81-15f9519d24cb

### COLETA DE EVIDÊNCIAS

**Aguardando navegação para coletar logs completos...**

### LOGS DO BACKEND
```
[Aguardando execução do teste]
```

### LOGS DO FRONTEND
```
[Aguardando execução do teste]
```

### HIPÓTESE INICIAL
O carnê existe no Supabase Storage mas a informação não está chegando corretamente ao estado React que controla a renderização da UI.

### ANÁLISE DEFINITIVA - CAUSA RAIZ IDENTIFICADA

**🚨 PROBLEMA:** Discrepância de clientes Supabase entre endpoints

**EVIDÊNCIA FORENSE:**
1. **Endpoint `/gerar-carne`**: Usa `createServerSupabaseAdminClient()` (admin client)
   - RESULTADO: Encontra carnê ✅ `[CARNE API - PRODUCER] ✅ Carnê já existe: carne-2025-08-13_18-24-48-667.pdf`

2. **Endpoint `/carne-status`**: Usa `import { supabase }` (regular client)
   - RESULTADO: Não encontra carnê ❌ `files found: 0`

**CAUSA:** O client regular tem restrições RLS (Row Level Security) no Storage que impedem acesso a arquivos que o admin client consegue ver.

### CORREÇÃO IMPLEMENTADA

✅ **Alteração no `/api/propostas/:id/carne-status`:**
- Substituído client regular por admin client
- Adicionado log de diagnóstico da correção
- Mantida instrumentação PAM V1.0 para validação

### TESTE DA CORREÇÃO
[Aguardando execução do teste pós-correção]