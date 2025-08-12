# 🔐 GUIA COMPLETO - SECRETS BANCO INTER

**Data**: 31 de Julho de 2025  
**Status**: Credenciais atuais não funcionam (HTTP 400)  
**Ação**: Obter credenciais corretas no portal do Inter

---

## 📊 **STATUS ATUAL DOS SECRETS**

| Secret | Status | Precisa Atualizar | Observação |
|--------|---------|------------------|------------|
| `INTER_CLIENT_ID` | ✅ Configurado | 🔄 **SIM** | Atual não funciona |
| `INTER_CLIENT_SECRET` | ✅ Configurado | 🔄 **SIM** | Atual não funciona |
| `INTER_CERTIFICATE` | ✅ Configurado | 🔄 **SIM** | Atual não funciona |
| `INTER_PRIVATE_KEY` | ✅ Configurado | 🔄 **SIM** | Atual não funciona |
| `INTER_WEBHOOK_SECRET` | ❌ Faltando | ➕ **ADICIONAR** | Necessário |
| `INTER_CONTA_CORRENTE` | ✅ Configurado | ❓ **VERIFICAR** | Pode estar correto |

---

## 🎯 **SECRETS PARA ATUALIZAR**

### **1. INTER_CLIENT_ID** 🔄
**Status**: Precisa atualizar (atual não funciona)

**Formato Correto:**
```
12345678-1234-1234-1234-123456789abc
```
- UUID/GUID format
- 36 caracteres com hífens
- Letras minúsculas

**Onde Encontrar no Portal:**
```
Portal: https://developers.inter.co ou https://internetbanking.bancointer.com.br

Caminho:
1. Login → Aplicações/APIs → Minhas Aplicações
2. Ou: Produtos → APIs → Credenciais
3. Ou: Integrações → API Cobrança → Client ID

Seção: "Credenciais da Aplicação" ou "Client Credentials"
Campo: "Client ID" ou "Application ID"
```

---

### **2. INTER_CLIENT_SECRET** 🔄
**Status**: Precisa atualizar (atual não funciona)

**Formato Correto:**
```
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9...
```
- String longa (200+ caracteres)
- Pode ser formato JWT ou string aleatória
- Case-sensitive

**Onde Encontrar no Portal:**
```
Portal: https://developers.inter.co ou https://internetbanking.bancointer.com.br

Caminho:
1. Login → Aplicações/APIs → Minhas Aplicações
2. Clicar na aplicação criada
3. Seção "Credenciais" ou "Client Secret"

ATENÇÃO: 
- Client Secret só aparece na criação ou regeneração
- Se não conseguir ver, precisa regenerar
- Guardar imediatamente quando aparecer
```

---

### **3. INTER_CERTIFICATE** 🔄
**Status**: Precisa atualizar (atual não funciona)

**Formato Correto:**
```
-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKoK/OvqDMGmMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
BAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX
aWRnaXRzIFB0eSBMdGQwHhcNMTcwODI4MTQxNTMwWhcNMTgwODI4MTQxNTMwWjBF
MQswCQYDVQQGEwJBVTETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50
ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB
...mais linhas...
-----END CERTIFICATE-----
```
- Inicia com `-----BEGIN CERTIFICATE-----`
- Termina com `-----END CERTIFICATE-----`
- Conteúdo em Base64 entre as linhas
- Múltiplas linhas

**Onde Encontrar no Portal:**
```
Portal: https://developers.inter.co ou https://internetbanking.bancointer.com.br

Caminho:
1. Login → Certificados → Certificados Digitais
2. Ou: Aplicações → Certificado mTLS
3. Ou: Segurança → Certificados

Ações:
- Download do arquivo .pfx ou .p12
- Converter para .pem se necessário
- Ou copiar conteúdo se já estiver em formato texto

Comando conversão (se baixar .pfx):
openssl pkcs12 -in certificado.pfx -out certificado.pem -clcerts -nokeys
```

---

### **4. INTER_PRIVATE_KEY** 🔄
**Status**: Precisa atualizar (atual não funciona)

**Formato Correto:**
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKB
wQfVDgdwsbtqnqQXfO6v0K1eqRlEWwDc7X/+bMY5Q7Z9Kk1+pHq2Q2VvK7Y8WQ6J
X8R4+8/Ck7E5rN9F1Q7V6J1aK8K7B8CZ1Xs+o7V5aZ+K6Z1aQ7J+XK7VY8Q7Z9J
...mais linhas...
-----END PRIVATE KEY-----
```
- Inicia com `-----BEGIN PRIVATE KEY-----`
- Termina com `-----END PRIVATE KEY-----`
- Conteúdo em Base64 entre as linhas
- Múltiplas linhas

**Onde Encontrar no Portal:**
```
Portal: Mesmo lugar do certificado

Caminho:
1. Login → Certificados → Certificados Digitais
2. Download do arquivo .pfx ou .p12
3. Extrair chave privada

Comando conversão (se baixar .pfx):
openssl pkcs12 -in certificado.pfx -out chave_privada.pem -nocerts -nodes

ATENÇÃO:
- Chave privada geralmente vem junto com certificado
- Se arquivo .pfx, precisa extrair separadamente
- Manter segurança máxima desta chave
```

---

## ➕ **SECRETS PARA ADICIONAR**

### **5. INTER_WEBHOOK_SECRET** ➕
**Status**: Faltando (obrigatório)

**Formato Correto:**
```
webhook_secret_production_2025_abc123
```
- String aleatória de 20-50 caracteres
- Alfanumérica (a-z, A-Z, 0-9)
- Sem caracteres especiais
- Você define esta string

**Onde Configurar no Portal:**
```
Portal: https://developers.inter.co

Caminho:
1. Login → Aplicações → Sua Aplicação
2. Webhooks → Configurar Webhook
3. URL: https://SEU_DOMINIO.replit.app/api/inter/webhook
4. Secret: webhook_secret_production_2025_abc123
5. Eventos: Boleto Cobrança, PIX

ATENÇÃO:
- Você escolhe o valor do secret
- Usar para validar webhooks
- Mesmo valor deve ir no secret do Replit
```

---

## ❓ **SECRETS PARA VERIFICAR**

### **6. INTER_CONTA_CORRENTE** ❓
**Status**: Configurado (verificar se está correto)

**Formato Correto:**
```
12345678
```
- Apenas números
- 6-8 dígitos
- Sem hífen ou dígito verificador
- Exemplo: 1234567 (sem o -8)

**Onde Encontrar no Portal:**
```
Portal: https://internetbanking.bancointer.com.br

Caminho:
1. Login → Conta Corrente → Dados da Conta
2. Ou: Extrato → Dados da Conta
3. Número da conta SEM o dígito verificador

Exemplo: Se conta é 1234567-8, usar apenas 1234567
```

---

## 🎯 **ORDEM DE BUSCA NO PORTAL**

### **Primeira Tentativa: Portal Desenvolvedores**
1. Acesse: https://developers.inter.co
2. Login com credenciais empresariais
3. Procurar: "Aplicações" → "Minhas Aplicações"
4. Se não encontrar aplicações, criar nova

### **Segunda Tentativa: Internet Banking**
1. Acesse: https://internetbanking.bancointer.com.br
2. Login empresarial
3. Procurar: "Produtos" → "APIs" → "Integrações"
4. Ou: "Serviços" → "Open Banking"

### **Terceira Tentativa: Contato Direto**
**Telefone**: (11) 3003-4070
**Dizer**: "Preciso das credenciais de API Cobrança, CNPJ: SEU_CNPJ"

---

## ✅ **CHECKLIST DE VERIFICAÇÃO**

Depois de obter as credenciais:

```
□ INTER_CLIENT_ID (formato UUID)
□ INTER_CLIENT_SECRET (string longa)
□ INTER_CERTIFICATE (-----BEGIN CERTIFICATE-----)
□ INTER_PRIVATE_KEY (-----BEGIN PRIVATE KEY-----)
□ INTER_WEBHOOK_SECRET (você define)
□ INTER_CONTA_CORRENTE (só números)
```

---

## 🚀 **TESTE FINAL**

Após configurar todos os secrets:
```bash
node test-inter-production.cjs
```

Se retornar ✅ SUCESSO → **Sistema pronto para produção!**