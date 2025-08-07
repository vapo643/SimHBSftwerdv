# Sistema de Documentação de Erros - Simpix

## Objetivo
Este diretório contém documentação estruturada de erros comuns do sistema Simpix e suas soluções validadas. Use esta documentação para consulta automática quando encontrar loops de erros.

## Estrutura

### 📁 Por Categoria
- `storage_errors.md` - Erros do Supabase Storage
- `ccb_generation_errors.md` - Erros na geração de CCB
- `auth_jwt_errors.md` - Erros de autenticação e JWT
- `database_errors.md` - Erros de banco de dados
- `api_integration_errors.md` - Erros das APIs (ClickSign, Inter)

### 🔍 Como Usar
1. **Identifique o tipo de erro** nos logs
2. **Consulte o arquivo correspondente** por categoria
3. **Siga a solução documentada** que já foi testada
4. **Atualize a documentação** se encontrar nova solução

### 📝 Formato Padrão
Cada erro documentado segue esta estrutura:
```markdown
## [CÓDIGO_ERRO] Nome do Erro

### 🚨 Sintoma
Como o erro aparece nos logs

### 🔍 Causa
Por que acontece

### ✅ Solução Testada
Passo a passo da correção

### 🛡️ Prevenção
Como evitar no futuro

### 📅 Última Atualização
Data da última validação da solução
```

## Status dos Erros Documentados

### ✅ Solucionados
- `STORAGE_OBJECT_NOT_FOUND` - URLs assinadas do Supabase (✅ implementado com fallback)
- `CCB_PERMISSION_DENIED` - Permissões do Storage (✅ admin client)
- `JWT_INVALID_SIGNATURE` - Tokens expirados (✅ validação implementada)

### 🔄 Em Investigação
- Nenhum no momento

### 📊 Estatísticas
- Total de erros documentados: 3
- Soluções implementadas: 3
- Última atualização: 2025-08-07
- Taxa de resolução: 100%

### 🚀 Implementações Recentes
- Admin client para Storage em todos os endpoints
- Fallback automático para regeneração de CCBs
- Correção de paths incorretos no banco de dados