# ClickSign Webhook Implementation Guide

## Visão Geral

Implementamos um sistema robusto de webhooks para o ClickSign com as seguintes características:

### 🔒 Segurança
- **Validação HMAC**: Verificação de assinatura SHA-256 para garantir autenticidade
- **Validação de Timestamp**: Rejeita requisições com mais de 5 minutos
- **Proteção contra Replay**: Sistema de deduplicação de eventos

### 📋 Eventos Suportados

#### Eventos de Documento
- `document.created` - Documento criado no ClickSign
- `document.signed` - Documento assinado (dispara geração de boleto)
- `document.finished` - Todos os signatários assinaram
- `document.cancelled` - Assinatura cancelada
- `document.refused` - Assinatura recusada

#### Eventos de Signatário
- `signer.signed` - Signatário específico assinou
- `signer.viewed` - Signatário visualizou o documento

#### Eventos de Lista
- `list.created` - Lista de assinatura criada
- `list.updated` - Lista atualizada
- `auto_close.deadline` - Prazo de assinatura expirado

## 🔧 Configuração

### 1. Variável de Ambiente
```bash
# Adicione ao seu .env
CLICKSIGN_WEBHOOK_SECRET=seu-webhook-secret-aqui
```

### 2. Configurar Webhook no ClickSign

**Produção:**
```
URL: https://seu-dominio.com/api/clicksign/webhook
```

**Sandbox:**
```
URL: https://seu-dominio.com/api/clicksign/webhook
```

### 3. Eventos para Selecionar no ClickSign
- ✅ document.created
- ✅ document.signed
- ✅ document.finished
- ✅ document.cancelled
- ✅ document.refused
- ✅ signer.signed
- ✅ signer.viewed
- ✅ list.created
- ✅ list.updated
- ✅ auto_close.deadline

## 🚀 Fluxo Automático

### Assinatura → Boleto
1. Cliente assina CCB no ClickSign
2. Webhook `document.signed` é disparado
3. Sistema valida assinatura HMAC
4. Sistema gera boleto automaticamente via Banco Inter
5. Cliente recebe cobrança por email/WhatsApp

## 📊 Logs e Monitoramento

Todos os eventos são registrados com:
- Timestamp em horário de Brasília
- ID da proposta relacionada
- Status anterior e novo
- Descrição detalhada da ação

### Exemplos de Logs
```
[CLICKSIGN WEBHOOK] Processing event: document.signed
[CLICKSIGN WEBHOOK] ✅ Document signed for proposal: 12345
[CLICKSIGN → INTER] Triggering boleto generation for proposal: 12345
[CLICKSIGN → INTER] ✅ Boleto created successfully: INTER-67890
```

## 🛡️ Tratamento de Erros

- **Assinatura inválida**: Retorna 401 Unauthorized
- **Timestamp expirado**: Retorna 401 Unauthorized
- **Evento duplicado**: Retorna 200 OK (idempotente)
- **Proposta não encontrada**: Retorna 404 Not Found
- **Erro na geração de boleto**: Registra erro mas não bloqueia webhook

## 🔍 Debug

Para debugar webhooks em desenvolvimento:

1. Use ngrok ou similar para expor localhost:
```bash
ngrok http 5000
```

2. Configure a URL do ngrok no ClickSign sandbox

3. Monitore os logs do servidor para ver eventos chegando

## 📝 Estrutura do Payload

```json
{
  "event": "document.signed",
  "data": {
    "document": {
      "key": "abc123",
      "status": "signed",
      "finished_at": "2025-01-31T10:00:00"
    },
    "signer": {
      "key": "xyz789",
      "email": "cliente@email.com",
      "name": "Nome do Cliente",
      "sign_at": "2025-01-31T10:00:00"
    }
  },
  "occurred_at": "2025-01-31T10:00:00"
}
```

## ✅ Status de Implementação

- ✅ Validação de segurança HMAC
- ✅ Validação de timestamp
- ✅ Deduplicação de eventos
- ✅ Processamento de todos os tipos de eventos
- ✅ Integração com Banco Inter para geração de boletos
- ✅ Logs detalhados de auditoria
- ✅ Tratamento robusto de erros

## 🏪 Pronto para Produção

O sistema de webhooks está 100% pronto para deploy na Eleeve. Todos os eventos são processados de forma segura e confiável, com integração completa ao fluxo de pagamentos.