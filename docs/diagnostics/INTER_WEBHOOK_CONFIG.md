# Configuração do Webhook Banco Inter

## URLs dos Webhooks

### ClickSign (Assinaturas)
- **URL**: `https://SEU_DOMINIO/webhooks/clicksign`
- **Função**: Recebe notificações quando documentos são assinados
- **Eventos**: `document.signed`, `signer.signed`, etc.

### Banco Inter (Pagamentos)
- **URL**: `https://SEU_DOMINIO/webhooks/inter`
- **Função**: Recebe notificações quando boletos são pagos
- **Eventos**: `cobranca-paga`, `cobranca-vencida`, `cobranca-cancelada`

## Configuração no Portal do Banco Inter

1. Acesse o portal do Inter Empresarial
2. Vá para a seção de APIs/Integrações
3. Configure o webhook com a URL: `https://SEU_DOMINIO/webhooks/inter`
4. Selecione os eventos desejados:
   - ✅ Cobrança Paga
   - ✅ Cobrança Vencida
   - ✅ Cobrança Cancelada

## Fluxo Completo

1. **Assinatura**: ClickSign → Webhook → Gera boleto Inter
2. **Pagamento**: Banco Inter → Webhook → Atualiza status proposta

## Status Atual

- ✅ Webhook ClickSign: Funcionando
- ❌ Webhook Inter: Aguardando URL de produção
- ❌ OAuth2 Inter: Erro 400 (credenciais precisam ser verificadas)

## Problema Principal

O erro 400 na autenticação OAuth2 indica que:
- As credenciais podem não estar corretas
- O certificado pode não estar associado às credenciais
- A aplicação pode não estar ativa no portal do Inter

**Próximos passos**: Verificar no portal do Inter se a aplicação está ativa e se as credenciais estão corretas.