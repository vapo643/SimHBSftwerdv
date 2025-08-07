# ⚠️ CONFIGURAÇÃO CRÍTICA DO BANCO DE DADOS

## PROBLEMA DETECTADO
O sistema está usando um banco Neon em vez do Supabase. Isso precisa ser corrigido URGENTEMENTE.

## STATUS ATUAL
- ❌ DATABASE_URL está apontando para: `neon.tech`
- ❌ Variáveis PG* estão configuradas para Neon
- ✅ Supabase Client está funcionando via REST API
- ✅ Aplicação está parcialmente funcional

## COMO CORRIGIR

### Opção 1: Atualizar DATABASE_URL (RECOMENDADO)
1. Acesse o painel do Supabase: https://supabase.com/dashboard/projects
2. Clique no projeto: `dvglgxrvhmtsixaabxha`
3. Vá em Settings → Database
4. Copie a "Connection string" → "Transaction pooler"
5. Substitua [YOUR-PASSWORD] pela senha do banco
6. No Replit, vá em Tools → Secrets
7. Atualize DATABASE_URL com a URL correta do Supabase

A URL deve ter este formato:
```
postgresql://postgres.dvglgxrvhmtsixaabxha:[SUA-SENHA]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

### Opção 2: Adicionar SUPABASE_DB_PASSWORD
Se você tem a senha do banco Supabase:
1. No Replit, vá em Tools → Secrets
2. Adicione: `SUPABASE_DB_PASSWORD` = [senha do banco Supabase]
3. Reinicie o servidor

## CONSEQUÊNCIAS SE NÃO CORRIGIR
- Inconsistência de dados entre Neon e Supabase
- Falhas em operações que usam Drizzle diretamente
- Possível perda de dados
- Problemas de segurança e compliance

## VERIFICAÇÃO
Após corrigir, o servidor deve mostrar:
```
✅ Database: Connected (Supabase)
```

Sem nenhum aviso sobre Neon.