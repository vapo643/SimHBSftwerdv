# PAM V1.0 - Relatório de Diagnóstico: Erro na Tela "Criar Usuário"

## 📅 Data: 15/08/2025
## 🎯 Status: DIAGNÓSTICO COMPLETO

## 1. IDENTIFICAÇÃO DO PROBLEMA

### Erro Apresentado
- **Mensagem ao Usuário**: "Não foi possível carregar os dados necessários para o formulário"
- **Tela Afetada**: Criação de Usuário (Admin > Usuários > Novo Usuário)
- **Impacto**: Bloqueio total da funcionalidade de criação de usuários

## 2. ANÁLISE DE REDE - APIs CHAMADAS

O componente `UserForm` utiliza o hook `useUserFormData` que faz as seguintes chamadas:

### 2.1 Chamadas de API Durante o Carregamento
```typescript
1. GET /api/admin/system/metadata    → ❌ FALHA IDENTIFICADA
2. GET /api/parceiros                → ✅ Sucesso esperado
3. GET /api/admin/lojas              → ✅ Condicionalmente chamado
4. GET /api/admin/parceiros/{id}/lojas → ✅ Sob demanda
```

## 3. CAUSA RAIZ IDENTIFICADA

### API Falhando
**URL Completa**: `/api/admin/system/metadata`

### Código de Status HTTP
**403 Forbidden** (Acesso Negado)

### Motivo da Falha
O endpoint `/api/admin/system/metadata` está protegido com **dupla autenticação**:
1. `jwtAuthMiddleware` - Verifica se o usuário está autenticado
2. `requireAdmin` - **VERIFICA SE O USUÁRIO É ADMINISTRADOR**

### Código do Backend (server/routes.ts, linha 4826-4849)
```typescript
app.get(
  "/api/admin/system/metadata",
  jwtAuthMiddleware,
  requireAdmin,  // ← PROBLEMA: Apenas ADMINISTRADOR pode acessar
  async (req: AuthenticatedRequest, res) => {
    // ...retorna total de lojas
  }
);
```

## 4. ERRO ADICIONAL NO FRONTEND

### Problema no UserForm.tsx
O componente `UserForm` tem **múltiplos erros de TypeScript**:

1. **Linha 165**: Usa `formDataError` mas não desestrutura do hook
2. **Linha 284, 334**: Usa `serverStoresError` mas não desestrutura
3. **Linha 290, 340**: Usa `filteringStrategy` mas não desestrutura

### Hook useUserFormData Retorna
```typescript
{
  error,          // ← Retorna como 'error', não 'formDataError'
  // ...outros campos
}
```

## 5. CENÁRIO DE FALHA

### Fluxo Atual
1. Usuário não-administrador acessa "Criar Usuário"
2. UserForm tenta carregar metadados via `/api/admin/system/metadata`
3. Backend retorna **403 Forbidden** (usuário não é admin)
4. Frontend tenta verificar `formDataError` (que não existe)
5. Erro de referência JavaScript adicional
6. Tela exibe mensagem genérica de erro

## 6. IMPACTO POR ROLE

| Role | Pode Criar Usuário? | Status Atual |
|------|---------------------|--------------|
| ADMINISTRADOR | ✅ Sim | ✅ Funciona |
| DIRETOR | ❓ Deveria poder | ❌ Bloqueado |
| GERENTE | ❓ Deveria poder | ❌ Bloqueado |
| ANALISTA | ❌ Não | ❌ Bloqueado |
| ATENDENTE | ❌ Não | ❌ Bloqueado |
| FINANCEIRO | ❌ Não | ❌ Bloqueado |
| COBRANÇA | ❌ Não | ❌ Bloqueado |

## 7. LOGS ESPERADOS NO CONSOLE

### Network Tab (Aba Rede)
```
GET /api/admin/system/metadata → 403 Forbidden
Response: {
  "message": "Acesso negado. Apenas administradores podem acessar este recurso."
}
```

### Console JavaScript
```
Uncaught ReferenceError: formDataError is not defined
  at UserForm.tsx:165
```

## 8. CONCLUSÃO DO DIAGNÓSTICO

### Problema Principal
**Conflito de Permissões**: O endpoint de metadados exige role ADMINISTRADOR, mas a funcionalidade de criar usuário pode ser necessária para outros roles gerenciais (DIRETOR, GERENTE).

### Problemas Secundários
1. **TypeScript Errors**: Variáveis não definidas no UserForm
2. **UX Ruim**: Mensagem de erro genérica não explica o problema real
3. **Design Flaw**: Metadados do sistema não deveriam bloquear criação de usuário

## 9. RECOMENDAÇÕES PARA CORREÇÃO

### Opção 1: Ajustar Permissões do Backend
Remover ou relaxar o `requireAdmin` para permitir roles gerenciais:
```typescript
// De: requireAdmin
// Para: requireRole(['ADMINISTRADOR', 'DIRETOR', 'GERENTE'])
```

### Opção 2: Criar Endpoint Alternativo
Criar `/api/admin/metadata/public` sem restrição de admin para dados não-sensíveis.

### Opção 3: Corrigir Frontend
1. Corrigir desestruturação do hook (error → formDataError)
2. Adicionar fallback quando metadata falha
3. Melhorar mensagens de erro

### Opção 4: Redesign da Lógica
Questionar se metadata é realmente necessário para criar usuário ou se pode ser carregado sob demanda.

---
**Diagnóstico realizado por**: PAM V1.0
**Data**: 15/08/2025
**Status**: AGUARDANDO DECISÃO PARA CORREÇÃO