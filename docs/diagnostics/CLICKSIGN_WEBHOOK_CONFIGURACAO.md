# Configuração do Webhook ClickSign

## URL do Webhook

Configure no painel do ClickSign:

```
https://SEU_DOMINIO/api/clicksign/webhook
```

## Configuração no Painel ClickSign

1. Acesse: **Configurações → Webhooks**
2. Clique em **"Adicionar Webhook"**
3. Configure:
   - **URL**: https://SEU_DOMINIO/api/clicksign/webhook
   - **Eventos a receber**: Marque TODOS:
     - ✅ upload (documento enviado)
     - ✅ sign (documento assinado)
     - ✅ auto_close (documento finalizado automaticamente)
     - ✅ deadline (prazo próximo)
     - ✅ cancel (documento cancelado)
     - ✅ refusal (assinatura recusada)
     - ✅ document_closed (documento fechado)
   - **Secret**: Gere um secret seguro (exemplo: `openssl rand -hex 32`)
   - **Status**: Ativo

4. Salve o webhook

## Variável de Ambiente

Adicione ao `.env`:

```
CLICKSIGN_WEBHOOK_SECRET=seu_secret_gerado_aqui
```

## Eventos Importantes

### 1. sign (Assinatura)

- **Quando**: Cliente assina o documento
- **Ação**: Atualiza `assinaturaEletronicaConcluida = true`
- **Timeline**: Aparece "✍️ Documento assinado"

### 2. auto_close (Finalização)

- **Quando**: Todos assinaram
- **Ação**: Atualiza status e gera boleto automaticamente
- **Timeline**: Aparece "✅ Documento finalizado"

### 3. refusal (Recusa)

- **Quando**: Cliente recusa assinar
- **Ação**: Marca como recusado
- **Timeline**: Aparece "❌ Documento recusado"

## Testando o Webhook

1. Use o **ngrok** para testar localmente:

```bash
ngrok http 5000
```

2. Configure a URL do ngrok no ClickSign:

```
https://abc123.ngrok.io/api/clicksign/webhook
```

3. Envie um documento e assine para testar

## Logs de Debug

Monitore os logs do servidor:

```
[CLICKSIGN WEBHOOK] Processing event: sign
[CLICKSIGN WEBHOOK] ✍️ Document signed for proposal: ID
[CLICKSIGN WEBHOOK] ✅ Updated proposal ID - assinatura_eletronica_concluida = true
```

## Segurança

O webhook implementa:

- ✅ Validação HMAC SHA-256
- ✅ Validação de timestamp (máx 5 min)
- ✅ Prevenção de duplicatas
- ✅ Rate limiting
- ✅ Validação de IP (opcional)

## Troubleshooting

### Webhook não está atualizando

1. Verifique se o webhook está configurado no ClickSign
2. Confirme que o secret está correto no `.env`
3. Verifique os logs do servidor
4. Teste com ngrok para debug

### Erro de assinatura inválida

1. O secret no `.env` deve ser idêntico ao configurado no ClickSign
2. Não adicione espaços ou quebras de linha

### Timeline não aparece

1. Verifique se o webhook está recebendo os eventos
2. Confirme que a proposta existe no banco
3. Verifique os logs de erro
