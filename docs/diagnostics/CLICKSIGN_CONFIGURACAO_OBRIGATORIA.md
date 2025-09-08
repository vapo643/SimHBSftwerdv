# 🔧 ClickSign - Configurações Obrigatórias no Site

## 📍 O Que Configurar Além da API

Além do token da API, você precisa configurar algumas coisas no painel do ClickSign:

### 1. 🎯 **Webhooks (OBRIGATÓRIO)**

Vá em: **Configurações → API → Webhooks**

Configure o webhook com:

- **URL**: `https://seu-dominio.replit.app/api/clicksign/webhook`
- **Eventos a serem monitorados**:
  - `signer.sign` (Assinatura concluída)
  - `signer.refuse` (Recusa de assinatura)
  - `envelope.finished` (Envelope finalizado)
  - `envelope.cancelled` (Envelope cancelado)
- **Método**: POST
- **Formato**: JSON
- **Secret**: Use o valor do `CLICKSIGN_WEBHOOK_SECRET`

### 2. 🏪 **Configurações da Conta**

Em **Configurações → Conta**:

- ✅ Verifique se sua conta está **ativa**
- ✅ Confirme se tem **créditos suficientes**
- ✅ Verifique se a **assinatura eletrônica** está habilitada

### 3. 🔐 **Configurações de Segurança**

Em **Configurações → Segurança**:

- ✅ **Autenticação por Selfie**: OBRIGATÓRIA para contratos financeiros
- ✅ **Autenticação por SMS**: Recomendada
- ✅ **Validação de CPF**: OBRIGATÓRIA

### 4. 📋 **Templates de Documento** (Opcional)

Se quiser usar templates:

- Vá em **Documentos → Templates**
- Crie templates personalizados para CCB
- Anote o `template_id` para usar na API

### 5. 🌐 **Domínios Permitidos**

Em **Configurações → API → Domínios**:

- Adicione seu domínio Replit: `*.replit.app`
- Para produção: adicione seu domínio customizado

## ⚠️ **ATENÇÃO: Configurações Críticas**

### 🚨 Sandbox vs Produção

**Sandbox (Desenvolvimento)**:

- URL da API: `https://sandbox.clicksign.com/api/v3`
- Webhook URL: `https://seu-app.replit.dev/api/clicksign/webhook`
- Token sandbox (diferente do de produção)

**Produção**:

- URL da API: `https://app.clicksign.com/api/v3`
- Webhook URL: `https://seu-dominio.com/api/clicksign/webhook`
- Token de produção

### 🔄 **Como Testar se está Configurado**

1. **Teste de API**:

   ```bash
   curl -X GET "https://sandbox.clicksign.com/api/v3/account" \
   -H "Authorization: Bearer SEU_TOKEN"
   ```

2. **Teste de Webhook**:
   - Envie um documento para teste
   - Verifique se o webhook está recebendo eventos
   - Consulte os logs no painel ClickSign

### 📝 **Checklist Final**

- [ ] Token da API configurado
- [ ] Webhook configurado com URL correta
- [ ] Secret do webhook configurado
- [ ] Conta ativa com créditos
- [ ] Autenticação por selfie habilitada
- [ ] Domínios permitidos configurados
- [ ] Ambiente (sandbox/produção) correto

## 🆘 **Problemas Comuns**

### Token Inválido

- ✅ Verifique se copiou o token completo
- ✅ Confirme se está usando o token do ambiente correto (sandbox/produção)
- ✅ Verifique se o token não expirou

### Webhook Não Funciona

- ✅ URL deve estar acessível publicamente
- ✅ Deve responder com status 200
- ✅ Validação HMAC deve estar correta

### Assinatura Não Funciona

- ✅ CPF deve estar formatado corretamente (só números)
- ✅ Email deve ser válido
- ✅ Selfie deve estar habilitada

---

**✅ Tudo configurado? Seu ClickSign estará 100% funcional!**
