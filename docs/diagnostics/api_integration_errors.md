# Erros de Integração com APIs Externas

## [CLICKSIGN_001] Webhook signature validation failed

### 🚨 Sintoma
```
❌ [CLICKSIGN] Webhook signature validation failed
```

### 🔍 Causa
- CLICKSIGN_WEBHOOK_SECRET incorreto ou ausente
- Payload do webhook foi alterado em trânsito
- Algoritmo de validação HMAC incorreto

### ✅ Solução Testada

#### 1. Verificar secret configurado
```javascript
const webhookSecret = process.env.CLICKSIGN_WEBHOOK_SECRET;
console.log('Webhook secret configurado:', !!webhookSecret);
```

#### 2. Validar assinatura HMAC
```javascript
const crypto = require('crypto');
const expectedSignature = crypto
  .createHmac('sha256', webhookSecret)
  .update(JSON.stringify(req.body))
  .digest('hex');

const receivedSignature = req.headers['x-clicksign-signature'];
console.log('Expected:', expectedSignature);
console.log('Received:', receivedSignature);
```

#### 3. Configurar webhook no ClickSign
- URL: `https://seu-dominio.com/api/webhooks/clicksign`
- Events: `document.signed`, `document.refused`
- Secret: Mesmo valor do .env

### 🛡️ Prevenção
- Logs detalhados de webhooks recebidos
- Testes de assinatura HMAC
- Monitoramento de webhooks falhados

### 📅 Última Atualização
2025-08-07 - Webhook HMAC validado

---

## [INTER_001] OAuth token expired

### 🚨 Sintoma
```
❌ [INTER] Response status 401: Token expired
```

### 🔍 Causa
- Access token do Inter expirou (válido por 1 hora)
- Não há refresh automático implementado
- Credenciais de autenticação incorretas

### ✅ Solução Testada

#### 1. Renovar token OAuth
```javascript
const tokenResponse = await fetch('https://cdpj.partners.bancointer.com.br/oauth/v2/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: new URLSearchParams({
    client_id: process.env.INTER_CLIENT_ID,
    client_secret: process.env.INTER_CLIENT_SECRET,
    grant_type: 'client_credentials',
    scope: 'boleto-cobranca.read boleto-cobranca.write'
  })
});
```

#### 2. Implementar renovação automática
```javascript
if (response.status === 401) {
  console.log('🔄 Token expirado, renovando...');
  await this.renewAccessToken();
  // Retentar requisição original
  return this.makeRequest(endpoint, options);
}
```

### 🛡️ Prevenção
- Cache de token com expiração
- Renovação automática 5 min antes de expirar
- Retry automático em caso de 401

### 📅 Última Atualização
2025-08-07 - Renovação automática implementada

---

## [INTER_002] mTLS Certificate error

### 🚨 Sintoma
```
❌ [INTER] Certificate validation failed
```

### 🔍 Causa
- Certificado mTLS expirado ou inválido
- Certificado não configurado corretamente
- Formato do certificado incorreto

### ✅ Solução Testada

#### 1. Verificar certificado
```bash
# Verificar validade
openssl x509 -in certificate.pem -text -noout | grep "Not After"

# Verificar formato
file certificate.pem
```

#### 2. Configurar HTTPS Agent
```javascript
const https = require('https');
const fs = require('fs');

const cert = fs.readFileSync('path/to/certificate.pem');
const key = fs.readFileSync('path/to/private-key.pem');

const agent = new https.Agent({
  cert: cert,
  key: key,
  ca: fs.readFileSync('path/to/ca-certificate.pem')
});
```

### 🛡️ Prevenção
- Monitoramento de expiração de certificados
- Renovação automática quando possível
- Testes regulares de conectividade mTLS

### 📅 Última Atualização
2025-08-07 - Certificados configurados