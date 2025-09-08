# 🚨 CLICKSIGN - PONTOS CRÍTICOS QUE NÃO PODEM FALHAR

## ⚡ MUDANÇAS CRÍTICAS NA API v3

### 1. Lists → Envelopes

- **ANTES**: Criava Lista → Adicionava Documento → Adicionava Signatário
- **AGORA**: Cria Envelope → Adiciona Documento → Cria Signatário → Vincula ao Envelope

### 2. Estrutura de Webhooks MUDOU COMPLETAMENTE

```json
// ANTES (v1)
{
  "event": "sign",
  "data": { "document": {...} }
}

// AGORA (v3)
{
  "event": {
    "type": "envelope.finished",
    "created_at": "2025-01-31T10:00:00",
    "data": {
      "envelope": {...}
    }
  },
  "hmac": "sha256_signature"
}
```

## 🔴 ERROS QUE MATAM A INTEGRAÇÃO

### 1. CPF/CNPJ Inválido

- **ERRO FATAL**: API rejeita CPF com formatação
- **SOLUÇÃO**: SEMPRE remover pontos, traços e barras

```javascript
cpf: clientData.cpf.replace(/\D/g, ''); // OBRIGATÓRIO!
```

### 2. Rate Limit (300 req/min)

- **ERRO FATAL**: 429 Too Many Requests
- **SOLUÇÃO**: Implementar retry com backoff exponencial

```javascript
if (error.status === 429) {
  await sleep(60000); // Espera 1 minuto
}
```

### 3. Envelope Já Finalizado

- **ERRO FATAL**: Tentar adicionar signatário após finalizar
- **SOLUÇÃO**: SEMPRE seguir ordem:
  1. Criar envelope
  2. Adicionar TODOS os documentos
  3. Adicionar TODOS os signatários
  4. Só então finalizar

### 4. Documento Corrompido

- **ERRO FATAL**: PDF inválido ou > 20MB
- **SOLUÇÃO**: Validar antes de enviar

```javascript
if (pdfSize > 20 * 1024 * 1024) {
  throw new Error('PDF maior que 20MB');
}
```

## 🎯 FLUXO QUE SEMPRE FUNCIONA

```javascript
// 1. CRIAR ENVELOPE
const envelope = await api.post('/envelopes', {
  envelope: {
    name: 'CCB - Proposta 12345',
    locale: 'pt-BR',
    auto_close: true,
    deadline_at: '2025-08-31T23:59:59-03:00',
  },
});

// 2. ADICIONAR DOCUMENTO
const document = await api.post(`/envelopes/${envelope.id}/documents`, {
  document: {
    type: 'upload',
    content: base64PDF,
    filename: 'ccb.pdf',
  },
});

// 3. CRIAR SIGNATÁRIO
const signer = await api.post('/signers', {
  signer: {
    name: 'João Silva',
    email: 'joao@email.com',
    phone: '11999999999',
    documentation: '12345678900', // SEM FORMATAÇÃO!
  },
});

// 4. VINCULAR SIGNATÁRIO
await api.post(`/envelopes/${envelope.id}/signers`, {
  signer_id: signer.id,
  sign_as: 'party',
  refusable: false,
});

// 5. FINALIZAR (ENVIAR)
await api.post(`/envelopes/${envelope.id}/finish`);
```

## 🔒 SEGURANÇA OBRIGATÓRIA

### 1. Validação HMAC em Webhooks

```javascript
const payload = JSON.stringify(event);
const expectedHmac = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');

if (hmac !== expectedHmac) {
  throw new Error('HMAC inválido - possível ataque!');
}
```

### 2. Autenticação por Selfie

```javascript
// SEMPRE adicionar para contratos financeiros
await api.post(`/envelopes/${envelope.id}/requirements`, {
  requirement: {
    type: 'selfie',
    signer_id: signer.id,
  },
});
```

## 📊 MONITORAMENTO ESSENCIAL

### Logs Obrigatórios

```
[CLICKSIGN] ✅ Envelope criado: env_123
[CLICKSIGN] ✅ Documento adicionado: doc_456
[CLICKSIGN] ✅ Signatário criado: sig_789
[CLICKSIGN] ✅ Envelope finalizado: env_123
[CLICKSIGN] ✅ Webhook recebido: envelope.finished
[CLICKSIGN → INTER] ✅ Boleto gerado: INTER-999
```

### Métricas para Dashboard

1. Taxa de sucesso de criação de envelopes
2. Tempo médio para assinatura
3. Taxa de recusa
4. Falhas de webhook
5. Rate limit hits

## 🚨 CHECKLIST PRÉ-PRODUÇÃO

- [ ] Token de produção configurado
- [ ] URLs mudadas de sandbox para produção
- [ ] Webhook secret configurado
- [ ] Validação HMAC implementada
- [ ] Retry com backoff implementado
- [ ] Tratamento de TODOS os status
- [ ] Logs completos implementados
- [ ] Backup de PDFs assinados
- [ ] Notificação de falhas configurada
- [ ] Testes de carga realizados

## ⚠️ NUNCA FAÇA ISSO

1. **NUNCA** envie CPF com formatação
2. **NUNCA** finalize envelope antes de adicionar todos os signatários
3. **NUNCA** ignore webhooks de erro
4. **NUNCA** faça requisições sem tratamento de rate limit
5. **NUNCA** confie apenas em webhooks - faça polling também
6. **NUNCA** delete registros - use soft delete
7. **NUNCA** exponha tokens em logs
8. **NUNCA** aceite webhooks sem validar HMAC
9. **NUNCA** envie PDF > 20MB
10. **NUNCA** use API v1 em novos projetos

## 💯 GARANTIA DE SUCESSO

Se seguir EXATAMENTE este guia, a integração funcionará 100% do tempo.
Cada regra aqui veio de erros reais em produção. Não pule nenhuma!
