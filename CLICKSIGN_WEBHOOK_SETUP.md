# 📋 CONFIGURAÇÃO DO WEBHOOK CLICKSIGN

## 🌐 URL do Webhook

Sua URL de webhook para configurar no ClickSign é:

```
https://workspace.gabrielserri238.repl.co/api/clicksign/webhook
```

## 🔐 Informações Necessárias para Configuração

### 1. No Painel do ClickSign

Acesse: **Configurações → Webhooks → Adicionar Webhook**

**Preencha os seguintes campos:**

1. **URL do Webhook**: 
   ```
   https://workspace.gabrielserri238.repl.co/api/clicksign/webhook
   ```

2. **Eventos para Monitorar** (marque todos estes):
   - ✅ `envelope.created` - Quando envelope é criado
   - ✅ `envelope.updated` - Quando envelope é atualizado
   - ✅ `envelope.finished` - Quando todos assinam ⭐ CRÍTICO
   - ✅ `envelope.cancelled` - Quando envelope é cancelado
   - ✅ `envelope.expired` - Quando envelope expira
   - ✅ `document.created` - Quando documento é adicionado
   - ✅ `document.signed` - Quando documento é assinado
   - ✅ `document.refused` - Quando assinatura é recusada
   - ✅ `signer.signed` - Quando signatário assina
   - ✅ `signer.refused` - Quando signatário recusa
   - ✅ `signer.updated` - Quando dados do signatário mudam

3. **Webhook Secret** (IMPORTANTE):
   - O ClickSign vai gerar um secret automaticamente
   - Copie este secret e me forneça para eu configurar

### 2. Variáveis de Ambiente Necessárias

Preciso que você me forneça:

```bash
# 1. Webhook Secret (gerado pelo ClickSign)
CLICKSIGN_WEBHOOK_SECRET=seu_webhook_secret_aqui

# 2. IPs permitidos (opcional, mas recomendado)
# Pergunte ao suporte do ClickSign quais IPs eles usam
CLICKSIGN_ALLOWED_IPS=ip1,ip2,ip3
```

## 🔄 Fluxo do Webhook

### Quando `envelope.finished` é recebido:
1. ✅ Marca proposta como "contratos_assinados"
2. ✅ Atualiza campo `assinaturaEletronicaConcluida = true`
3. ✅ Registra data/hora da assinatura
4. ✅ **Dispara geração automática do boleto no Banco Inter**
5. ✅ Cria log de auditoria

### Segurança Implementada:
- 🔒 Validação HMAC SHA-256
- 🔒 Validação de timestamp (5 minutos)
- 🔒 Proteção contra replay attack
- 🔒 Rate limiting (100 req/min/IP)
- 🔒 IP whitelist (se configurado)

## 📊 Teste do Webhook

Após configurar no ClickSign:

1. **Teste Manual no ClickSign**:
   - No painel de webhooks, clique em "Testar"
   - Escolha um evento (ex: `envelope.finished`)
   - Envie o teste

2. **Verifique os Logs**:
   ```
   [CLICKSIGN WEBHOOK v3] Processing event: envelope.finished
   [CLICKSIGN WEBHOOK v3] ✅ Event processed successfully
   ```

## ⚡ Próximos Passos

1. Configure o webhook no painel ClickSign
2. Me forneça o **Webhook Secret**
3. (Opcional) Me forneça os IPs do ClickSign
4. Faça um teste de envio

## 🚨 Importante

- O webhook já está **100% preparado** para receber eventos
- Segurança **máxima** implementada
- Integração com Banco Inter **automática**
- Todos os eventos da API v3 são suportados

**Status**: ✅ PRONTO PARA CONFIGURAÇÃO