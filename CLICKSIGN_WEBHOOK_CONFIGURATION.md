# 📌 CONFIGURAÇÃO DO WEBHOOK CLICKSIGN - GUIA RÁPIDO

## 1️⃣ URL do Webhook

**⚠️ Para desenvolvimento (teste):**
```
https://workspace.gabrielserri238.repl.co/api/clicksign/webhook
```

**🏢 Para produção (use o domínio oficial):**
```
https://seudominiooficial.com.br/api/clicksign/webhook
```

**Exemplo para Eleeve:**
```
https://sistema.eleeve.com.br/api/clicksign/webhook
```

## 2️⃣ No Painel ClickSign

1. Acesse: **Configurações → Webhooks → Novo Webhook**

2. Configure:
   - **URL**: Cole a URL acima
   - **Método**: POST
   - **Formato**: JSON

3. **Eventos Obrigatórios** (marque estes):
   - ✅ `envelope.finished` ⭐ **MAIS IMPORTANTE**
   - ✅ `envelope.created`
   - ✅ `envelope.updated`
   - ✅ `envelope.cancelled`
   - ✅ `envelope.expired`
   - ✅ `signer.signed`
   - ✅ `signer.refused`

4. **Após salvar**, o ClickSign vai mostrar:
   - **Webhook Secret** - Copie este valor!

## 3️⃣ Me Forneça

1. **Webhook Secret** (obrigatório):
   ```
   CLICKSIGN_WEBHOOK_SECRET=cole_aqui_o_secret_gerado
   ```

2. **IPs do ClickSign** (opcional mas recomendado):
   - Pergunte ao suporte: "Quais IPs vocês usam para webhooks?"
   ```
   CLICKSIGN_ALLOWED_IPS=ip1,ip2,ip3
   ```

## 4️⃣ Teste Rápido

No painel do ClickSign:
1. Clique em "Testar Webhook"
2. Escolha evento `envelope.finished`
3. Envie

Você verá nos logs:
```
[CLICKSIGN WEBHOOK v3] 🎉 Envelope FINISHED
[CLICKSIGN → INTER] 🚀 Triggering automatic boleto
```

## ✅ Pronto!

O webhook está configurado para:
- Receber notificações quando CCB for assinado
- Disparar geração automática de boleto no Inter
- Atualizar status da proposta em tempo real

**Status**: Sistema 100% pronto para receber webhooks!