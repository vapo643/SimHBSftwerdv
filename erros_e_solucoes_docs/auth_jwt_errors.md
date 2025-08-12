# Erros de Autenticação e JWT

## [AUTH_001] Token inválido ou expirado

### 🚨 Sintoma
```
🔐 JWT VALIDATION: {
  hasError: true,
  errorType: 'invalid JWT: unable to parse or verify signature, token signature is invalid: signature is invalid',
  hasUser: false,
  userId: undefined,
  timestamp: '2025-08-07T14:55:50.513Z'
}
```

### 🔍 Causa
1. **Token expirado** - JWT passou do tempo de validade
2. **Chave secreta alterada** - JWT_SECRET mudou após geração do token
3. **Token malformado** - Formato inválido ou corrompido
4. **Token de desenvolvimento** usado em produção

### ✅ Solução Testada

#### 1. Para usuários - Fazer novo login
```javascript
// Client-side: Limpar token e redirecionar
localStorage.removeItem('auth-token');
window.location.href = '/login';
```

#### 2. Para desenvolvimento - Gerar novo token
```bash
# Via curl para login
curl -X POST "http://localhost:5000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"admin123"}'
```

#### 3. Verificar configuração do JWT_SECRET
```javascript
// Confirmar que JWT_SECRET está definido
console.log('JWT_SECRET definido:', !!process.env.JWT_SECRET);
```

### 🛡️ Prevenção
- Implementar refresh tokens para renovação automática
- Alertar usuário antes do token expirar
- Logs detalhados de falhas de autenticação
- Middleware para capturar e tratar erros JWT

### 📅 Última Atualização
2025-08-07 - Middleware de validação funcionando

---

## [AUTH_002] CSRF Token Missing

### 🚨 Sintoma
```
❌ CSRF token missing or invalid
```

### 🔍 Causa
- Requisição sem header X-CSRF-Token
- Token CSRF inválido ou expirado
- Configuração incorreta do middleware CSRF

### ✅ Solução Testada

#### 1. Para desenvolvimento - Desabilitar CSRF temporariamente
```javascript
// No server/index.ts
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 [DEV] CSRF disabled in development');
  // Comentar middleware CSRF
}
```

#### 2. Para produção - Incluir token nas requisições
```javascript
// Client-side
const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
fetch('/api/endpoint', {
  headers: {
    'X-CSRF-Token': csrfToken
  }
});
```

### 🛡️ Prevenção
- Configurar corretamente CSRF em produção
- Documentar endpoints que precisam de CSRF
- Testes automatizados para validar CSRF

### 📅 Última Atualização
2025-08-07 - CSRF configurado para desenvolvimento