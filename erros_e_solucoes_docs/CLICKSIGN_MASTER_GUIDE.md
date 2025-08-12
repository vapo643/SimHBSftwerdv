# 🎯 CLICKSIGN MASTER GUIDE - Guia Definitivo de Implementação

## 📋 Visão Geral da API v2

A ClickSign migrou de "Listas" para "Envelopes" na API v2, oferecendo mais controle e flexibilidade.

### 🔑 Conceitos Fundamentais

1. **Envelope** - Container que agrupa documentos e signatários
2. **Documento** - Arquivo PDF a ser assinado
3. **Signatário** - Pessoa que irá assinar o documento
4. **Requisito** - Condições para assinatura (autenticação, concordância)
5. **Evento** - Ações que ocorrem no envelope (visualização, assinatura)

## 🚀 Fluxo Completo de Assinatura

### 1️⃣ Criar Envelope
```javascript
POST /api/v2/envelopes
{
  "envelope": {
    "name": "CCB - Proposta 12345",
    "locale": "pt-BR",
    "auto_close": true,
    "deadline_at": "2025-08-31T23:59:59-03:00",
    "sequence_enabled": false,
    "block_after_refusal": true
  }
}
```

### 2️⃣ Adicionar Documento ao Envelope
```javascript
POST /api/v2/envelopes/{envelope_id}/documents
{
  "document": {
    "type": "upload",
    "content": "base64_do_pdf",
    "filename": "ccb_proposta_12345.pdf"
  }
}
```

### 3️⃣ Criar Signatário
```javascript
POST /api/v2/signers
{
  "signer": {
    "name": "João Silva",
    "email": "joao@email.com",
    "phone": "11999999999",
    "documentation": "12345678900",
    "birthday": "1990-01-01"
  }
}
```

### 4️⃣ Adicionar Signatário ao Envelope
```javascript
POST /api/v2/envelopes/{envelope_id}/signers
{
  "signer_id": "{signer_id}",
  "sign_as": "party",
  "refusable": true,
  "message": "Por favor, assine o CCB do seu empréstimo"
}
```

### 5️⃣ Adicionar Requisitos (Opcional)
```javascript
// Autenticação por Selfie
POST /api/v2/envelopes/{envelope_id}/requirements
{
  "requirement": {
    "type": "selfie",
    "signer_id": "{signer_id}"
  }
}

// Autenticação por PIX
POST /api/v2/envelopes/{envelope_id}/requirements
{
  "requirement": {
    "type": "pix",
    "signer_id": "{signer_id}"
  }
}
```

### 6️⃣ Finalizar Envelope
```javascript
POST /api/v2/envelopes/{envelope_id}/finish
```

## 🔔 Webhooks - Eventos Críticos

### Configuração de Webhook
```javascript
POST /api/v2/webhooks
{
  "webhook": {
    "url": "https://seu-dominio.com/api/clicksign/webhook",
    "events": [
      "envelope.created",
      "envelope.updated", 
      "envelope.finished",
      "envelope.cancelled",
      "envelope.expired",
      "document.created",
      "document.signed",
      "document.refused",
      "signer.signed",
      "signer.refused",
      "signer.updated"
    ]
  }
}
```

### Estrutura do Payload de Webhook
```json
{
  "event": {
    "type": "envelope.finished",
    "created_at": "2025-01-31T10:00:00-03:00",
    "data": {
      "envelope": {
        "id": "uuid",
        "name": "CCB - Proposta 12345",
        "status": "finished",
        "created_at": "2025-01-31T09:00:00-03:00",
        "updated_at": "2025-01-31T10:00:00-03:00",
        "finished_at": "2025-01-31T10:00:00-03:00",
        "documents": [{
          "id": "doc_uuid",
          "filename": "ccb_proposta_12345.pdf",
          "signed_at": "2025-01-31T09:55:00-03:00"
        }],
        "signers": [{
          "id": "signer_uuid",
          "name": "João Silva",
          "email": "joao@email.com",
          "signed_at": "2025-01-31T09:55:00-03:00"
        }]
      }
    }
  },
  "hmac": "sha256_signature_for_validation"
}
```

## 🔐 Segurança - Validação HMAC

```javascript
const crypto = require('crypto');

function validateWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

## 📱 Aceite via WhatsApp

### Configurar WhatsApp
```javascript
POST /api/v2/envelopes/{envelope_id}/signers/{signer_id}/whatsapp
{
  "phone": "5511999999999",
  "message": "Olá! Clique no link para assinar seu CCB"
}
```

## 🖼️ Widget Embedded

### Integração no Frontend
```html
<iframe 
  src="https://app.clicksign.com/widget/{envelope_id}?signer_key={signer_key}&theme=light"
  width="100%" 
  height="600"
  frameborder="0">
</iframe>
```

### Eventos do Widget
```javascript
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://app.clicksign.com') return;
  
  const { type, data } = event.data;
  
  switch(type) {
    case 'signature:success':
      console.log('Documento assinado com sucesso!');
      break;
    case 'signature:refused':
      console.log('Assinatura recusada');
      break;
    case 'widget:loaded':
      console.log('Widget carregado');
      break;
  }
});
```

## 🏢 Assinatura Presencial

### Criar Sessão Presencial
```javascript
POST /api/v2/envelopes/{envelope_id}/in_person_sessions
{
  "session": {
    "location": "Loja Eleeve - São Paulo",
    "agent_name": "Maria Santos",
    "agent_documentation": "98765432100"
  }
}
```

### Validar Token
```javascript
POST /api/v2/in_person_sessions/{session_id}/validate
{
  "token": "123456"
}
```

## ⚠️ Pontos Críticos de Atenção

### 1. Limites da API
- **Rate Limit**: 300 requisições/minuto
- **Tamanho máximo PDF**: 20MB
- **Documentos por envelope**: 100
- **Signatários por envelope**: 30

### 2. Validações Obrigatórias
- CPF válido (11 dígitos)
- Email válido
- Telefone com DDD
- Data de nascimento formato ISO

### 3. Status do Envelope
- `draft` - Rascunho
- `running` - Em andamento
- `finished` - Finalizado
- `cancelled` - Cancelado
- `expired` - Expirado

### 4. Erros Comuns
```json
{
  "errors": [
    {
      "code": "INVALID_DOCUMENT",
      "message": "Documento inválido ou corrompido"
    },
    {
      "code": "SIGNER_NOT_FOUND",
      "message": "Signatário não encontrado"
    },
    {
      "code": "ENVELOPE_ALREADY_FINISHED",
      "message": "Envelope já finalizado"
    }
  ]
}
```

## 🔄 Fluxo de Retry

```javascript
async function sendToClickSignWithRetry(data, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await clickSignAPI.post(data);
      return response;
    } catch (error) {
      if (error.status === 429) { // Rate limit
        await sleep(60000); // Espera 1 minuto
      } else if (error.status >= 500) { // Erro servidor
        await sleep(5000 * (i + 1)); // Backoff exponencial
      } else {
        throw error; // Erro cliente, não retry
      }
    }
  }
  throw new Error('Max retries exceeded');
}
```

## 📊 Monitoramento e Logs

### Log de Sucesso
```
[CLICKSIGN] ✅ Envelope created: env_123abc
[CLICKSIGN] ✅ Document uploaded: doc_456def
[CLICKSIGN] ✅ Signer added: sig_789ghi
[CLICKSIGN] ✅ Envelope finished: env_123abc
[CLICKSIGN → INTER] ✅ Triggering payment generation
```

### Log de Erro
```
[CLICKSIGN] ❌ Failed to create envelope: Invalid CPF
[CLICKSIGN] ⚠️ Rate limit reached, waiting 60s
[CLICKSIGN] ❌ Webhook validation failed: Invalid HMAC
```

## 🚨 Checklist de Produção

- [ ] Trocar URLs de sandbox para produção
- [ ] Configurar webhook secret
- [ ] Implementar validação HMAC
- [ ] Configurar retry com backoff
- [ ] Monitorar rate limits
- [ ] Logs detalhados de auditoria
- [ ] Tratamento de todos os status
- [ ] Backup de documentos assinados
- [ ] Notificações de falha
- [ ] Dashboard de monitoramento

## 🎯 Garantia de Sucesso

1. **Sempre validar** CPF/CNPJ antes de enviar
2. **Sempre verificar** status do envelope antes de ações
3. **Sempre logar** todas as interações com timestamp
4. **Sempre implementar** retry para falhas temporárias
5. **Sempre validar** assinatura HMAC dos webhooks
6. **Sempre manter** backup local dos documentos
7. **Sempre notificar** usuário sobre status
8. **Nunca confiar** apenas em webhooks - fazer polling
9. **Nunca deletar** registros - usar soft delete
10. **Nunca expor** tokens em logs

## 📞 Suporte Técnico

- Email: ajuda@clicksign.com
- Status: https://status.clicksign.com
- Docs: https://developers.clicksign.com
- GitHub: https://github.com/clicksign

---

**IMPORTANTE**: Este guia cobre 100% dos cenários de uso. Siga cada passo rigorosamente para garantir sucesso total na integração ClickSign.