# Erros de Geração de CCB

## [CCB_001] Template PDF não encontrado

### 🚨 Sintoma

```
❌ [CCB] Erro ao ler template: ENOENT: no such file or directory, open 'server/templates/template_ccb.pdf'
```

### 🔍 Causa

- Arquivo template_ccb.pdf foi removido ou movido
- Caminho incorreto para o template
- Permissões de arquivo incorretas

### ✅ Solução Testada

#### 1. Verificar se arquivo existe

```bash
ls -la server/templates/template_ccb.pdf
```

#### 2. Restaurar template se necessário

```bash
# Verificar se existe backup
ls -la attached_assets/ | grep -i ccb
# Copiar template correto
cp attached_assets/template_ccb.pdf server/templates/
```

#### 3. Validar permissões

```bash
chmod 644 server/templates/template_ccb.pdf
```

### 🛡️ Prevenção

- Nunca deletar arquivos da pasta templates/
- Fazer backup dos templates antes de alterações
- Adicionar validação de existência do template no service

### 📅 Última Atualização

2025-08-07 - Template validado e funcionando

---

## [CCB_002] Dados de proposta incompletos

### 🚨 Sintoma

```
❌ [CCB] Erro: Dados da proposta incompletos para geração de CCB
```

### 🔍 Causa

- cliente_data ou condicoes_data são null/undefined
- Proposta não tem dados mínimos necessários
- Erro na query de busca dos dados

### ✅ Solução Testada

#### 1. Verificar dados da proposta

```sql
SELECT
  id,
  cliente_data,
  condicoes_data,
  valor_emprestimo,
  prazo_meses
FROM propostas
WHERE id = 'PROPOSTA_ID';
```

#### 2. Validar estrutura dos dados JSONB

```sql
SELECT
  cliente_data->>'nome' as nome_cliente,
  condicoes_data->>'taxa_juros' as taxa_juros,
  JSON_TYPEOF(cliente_data) as tipo_cliente_data,
  JSON_TYPEOF(condicoes_data) as tipo_condicoes_data
FROM propostas
WHERE id = 'PROPOSTA_ID';
```

#### 3. Adicionar validação no service

```javascript
if (!proposalData.cliente_data || !proposalData.condicoes_data) {
  throw new Error('Dados da proposta incompletos para geração de CCB');
}
```

### 🛡️ Prevenção

- Validar dados obrigatórios antes da geração
- Implementar logs detalhados dos dados recebidos
- Criar testes unitários para casos de dados incompletos

### 📅 Última Atualização

2025-08-07 - Validações implementadas
