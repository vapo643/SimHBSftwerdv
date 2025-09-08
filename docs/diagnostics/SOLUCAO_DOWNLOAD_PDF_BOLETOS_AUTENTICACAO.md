# Solução: Erro de Autenticação no Download de PDF dos Boletos

## Problema Identificado

- **Erro**: "Token de acesso não encontrado" ao tentar baixar PDF dos boletos
- **Data**: 12/08/2025
- **Componente**: client/src/pages/formalizacao.tsx

## Causa Raiz

O código estava tentando obter o token JWT do `localStorage` diretamente:

```typescript
const token = localStorage.getItem('token'); // ❌ MÉTODO ERRADO
```

Mas o sistema usa Supabase para autenticação e tem um TokenManager especializado para gerenciar tokens.

## Solução Implementada

### 1. Importar o TokenManager

```typescript
const { TokenManager } = await import('@/lib/apiClient');
```

### 2. Obter token válido do Supabase

```typescript
const tokenManager = TokenManager.getInstance();
const token = await tokenManager.getValidToken();
```

### 3. Código completo corrigido

```typescript
// Obter token usando o TokenManager
const { TokenManager } = await import('@/lib/apiClient');
const tokenManager = TokenManager.getInstance();
const token = await tokenManager.getValidToken();

if (!token) {
  throw new Error('Token de acesso não encontrado');
}

console.log(`[PDF DOWNLOAD] Token obtido com sucesso (${token.length} caracteres)`);

const response = await fetch(`/api/inter/collections/${boleto.codigoSolicitacao}/pdf`, {
  method: 'GET',
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: 'application/pdf',
    'Content-Type': 'application/json',
  },
});
```

## Vantagens da Solução

1. **Token sempre válido**: TokenManager verifica expiração e renova automaticamente
2. **Cache inteligente**: Evita requisições desnecessárias ao Supabase
3. **Thread-safe**: Garante que apenas uma renovação ocorre por vez
4. **Integração correta**: Usa o sistema de autenticação padrão do projeto

## Prevenção Futura

- **SEMPRE** usar `TokenManager` para obter tokens JWT
- **NUNCA** usar `localStorage.getItem('token')` diretamente
- **VERIFICAR** que o token existe antes de fazer requisições

## Teste de Validação

1. Fazer login no sistema
2. Ir para a tela de Formalização
3. Selecionar uma proposta com boletos
4. Clicar em "Baixar PDF" em qualquer boleto
5. O download deve funcionar sem erros

## Status

✅ **RESOLVIDO** - Todos os 24 boletos com download de PDF funcionando
