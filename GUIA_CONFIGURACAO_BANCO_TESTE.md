# 📋 Guia Passo a Passo: Configuração do Banco de Teste
## Como criar e configurar seu banco Supabase dedicado para testes

---

## 🎯 Objetivo
Criar um banco de dados Supabase separado exclusivamente para testes, garantindo isolamento total do ambiente de produção.

---

## 📝 PASSO 1: Criar Projeto no Supabase

### 1.1 Acesse o Supabase
1. Abra seu navegador e vá para: **https://supabase.com**
2. Clique em **"Sign In"** (canto superior direito)
3. Faça login com sua conta (GitHub, Google ou email)

### 1.2 Criar Novo Projeto
1. No dashboard, clique em **"New project"**
2. Preencha os campos:
   - **Organization:** Selecione sua organização
   - **Project name:** `simpix-test` (ou similar com "test" no nome)
   - **Database Password:** Crie uma senha forte (guarde ela!)
   - **Region:** Escolha a mais próxima (ex: South America São Paulo)
   - **Pricing Plan:** Free tier é suficiente

3. Clique em **"Create new project"**
4. Aguarde 1-2 minutos para o projeto ser criado

---

## 📋 PASSO 2: Obter a Connection String

### 2.1 Acessar Configurações do Banco
1. No painel do projeto, clique em **"Settings"** (ícone de engrenagem)
2. No menu lateral, clique em **"Database"**

### 2.2 Copiar a Connection String
1. Role até a seção **"Connection string"**
2. Selecione o modo **"URI"** (não "PSQL")
3. Você verá algo assim:
   ```
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```

### 2.3 Ajustar a String
1. **Copie** a string completa
2. **Substitua** `[YOUR-PASSWORD]` pela senha que você criou no passo 1.2
3. **Adicione** `-test` ao nome do banco (opcional mas recomendado):
   - De: `/postgres`
   - Para: `/postgres-test`
4. **Adicione** `?pgbouncer=true&connection_limit=1` no final

### Exemplo Final:
```
postgresql://postgres.abcd1234:SuaSenhaForte123!@aws-0-sa-sao-paulo-1.pooler.supabase.com:6543/postgres-test?pgbouncer=true&connection_limit=1
```

---

## 🔧 PASSO 3: Configurar no Projeto

### 3.1 Abrir o arquivo `.env.test`
1. No seu editor, abra o arquivo `.env.test`
2. Localize a linha com `TEST_DATABASE_URL`

### 3.2 Substituir o Placeholder
Substitua:
```env
TEST_DATABASE_URL="postgresql://postgres.XXXXXXXXXXXXX:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres-test?pgbouncer=true&connection_limit=1"
```

Por sua string real:
```env
TEST_DATABASE_URL="postgresql://postgres.abcd1234:SuaSenhaForte123!@aws-0-sa-sao-paulo-1.pooler.supabase.com:6543/postgres-test?pgbouncer=true&connection_limit=1"
```

### 3.3 Salvar o Arquivo
- Salve o arquivo `.env.test`
- **IMPORTANTE:** Não commite este arquivo com credenciais reais no Git!

---

## ✅ PASSO 4: Validar a Configuração

### 4.1 Testar a Conexão
Execute no terminal:
```bash
npm test
```

### 4.2 Verificar os Logs
Você deve ver:
```
[TEST SETUP] ✅ Using isolated test database from TEST_DATABASE_URL
[TEST SETUP] 🔧 Test environment configured:
[TEST SETUP]   - NODE_ENV: test
[TEST SETUP]   - Database: ✅ Test DB
[TEST SETUP] 🛡️ Triple protection active: NODE_ENV=test, isolated DB, runtime guards
```

### 4.3 Se Houver Erro
Verifique:
1. A senha está correta?
2. A URL contém a palavra "test"?
3. O projeto Supabase está ativo?
4. A connection string está completa?

---

## 🛡️ CHECKLIST DE SEGURANÇA

Antes de rodar os testes, confirme:

- [ ] Banco de teste é DIFERENTE do banco de produção
- [ ] URL contém a palavra "test" 
- [ ] Senha está correta e sem espaços
- [ ] Arquivo `.env.test` não será commitado
- [ ] Você está ciente que este banco será LIMPO a cada teste

---

## 🚨 AVISOS IMPORTANTES

### ⚠️ NUNCA:
- Use o mesmo banco para desenvolvimento e teste
- Commite o `.env.test` com credenciais reais
- Use credenciais de produção no `.env.test`
- Remova a palavra "test" da URL

### ✅ SEMPRE:
- Use um projeto Supabase separado para testes
- Mantenha as credenciais seguras
- Verifique a URL antes de executar testes
- Faça backup de dados importantes

---

## 🎯 RESULTADO ESPERADO

Após configuração correta:
1. **Testes executam** em banco isolado
2. **cleanTestDatabase()** funciona sem riscos
3. **Dados de produção** permanecem intactos
4. **Isolamento total** entre ambientes

---

## 📞 SUPORTE

### Problemas Comuns:

**Erro: "Database connection failed"**
- Verifique se a senha está correta
- Confirme que o projeto está ativo no Supabase

**Erro: "DATABASE_URL não contém 'test'"**
- Adicione "-test" ao nome do banco na URL
- Ou inclua "test" em alguma parte da string

**Erro: "NODE_ENV deve ser 'test'"**
- O setup.ts deve estar configurando isso automaticamente
- Verifique se o vitest.config.ts está carregando o setup.ts

---

## ✅ CONCLUSÃO

Seguindo este guia, você terá:
1. Um banco de dados dedicado para testes
2. Isolamento completo de produção
3. Segurança garantida contra perda de dados
4. Ambiente de teste profissional

**Tempo estimado:** 5-10 minutos

---

*Guia criado em: 20/08/2025*
*Para: Sistema Simpix - Isolamento de Teste*