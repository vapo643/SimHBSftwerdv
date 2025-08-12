# 🔧 CONFIGURAÇÃO DO SUPABASE REALTIME

## ⚡ AÇÕES NECESSÁRIAS NO PAINEL DO SUPABASE

### 1. ATIVAR REALTIME PARA TABELA `propostas`

1. Acesse o [Painel do Supabase](https://app.supabase.com)
2. Navegue até **Database** → **Replication**
3. Procure a tabela `propostas`
4. **ATIVE** o toggle "Enable Realtime" para esta tabela
5. Marque as opções:
   - ✅ **INSERT** (para novos registros)
   - ✅ **UPDATE** (para atualizações de status) 
   - ✅ **DELETE** (para exclusões)

### 2. VERIFICAR PUBLICAÇÃO

1. No mesmo painel, verifique se existe a publicação `supabase_realtime`
2. Confirme que a tabela `propostas` está incluída nesta publicação
3. Se não estiver, execute no SQL Editor:

```sql
-- Criar publicação se não existir
CREATE PUBLICATION supabase_realtime FOR TABLE propostas;

-- Ou adicionar à publicação existente
ALTER PUBLICATION supabase_realtime ADD TABLE propostas;

-- Verificar se está configurado
SELECT * FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'propostas';
```

### 3. TESTAR REALTIME

Execute no SQL Editor para testar:

```sql
-- Criar um update de teste
UPDATE propostas 
SET status = 'contratos_assinados',
    atualizado_em = NOW()
WHERE id = 'SEU_ID_DE_TESTE'
LIMIT 1;
```

O frontend deve receber o evento imediatamente se configurado corretamente.

## ✅ CHECKLIST DE VALIDAÇÃO

- [ ] Realtime ativado para tabela `propostas`
- [ ] Eventos UPDATE marcados
- [ ] Publicação `supabase_realtime` incluindo `propostas`
- [ ] Teste de UPDATE executado com sucesso
- [ ] Frontend recebendo eventos (verificar console do navegador)

## 🚨 IMPORTANTE

Após ativar o Realtime, pode levar até 1 minuto para as mudanças propagarem completamente.