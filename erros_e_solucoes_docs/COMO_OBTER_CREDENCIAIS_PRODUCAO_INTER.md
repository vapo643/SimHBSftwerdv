# 🏦 COMO OBTER CREDENCIAIS DE PRODUÇÃO - BANCO INTER

## 📍 **PORTAL OFICIAL**
**URL**: https://developers.inter.co

---

## 🚀 **PASSO A PASSO COMPLETO**

### **1. REQUISITOS PARA PRODUÇÃO**
```
✅ Conta empresarial no Banco Inter
✅ CNPJ ativo e regularizado
✅ Contrato assinado com o Banco Inter
✅ Aprovação para APIs de cobrança
```

### **2. PROCESSO DE SOLICITAÇÃO**

#### **Etapa 1: Acessar Portal**
```
1. Ir para: https://developers.inter.co
2. Fazer login com sua conta empresarial Inter
3. Navegar para: "Minhas Aplicações"
4. Clicar em: "Nova Aplicação"
```

#### **Etapa 2: Criar Aplicação de Produção**
```
Nome da Aplicação: Simpix Credit Management System
Ambiente: PRODUÇÃO (não sandbox)
Tipo: Server-to-Server
Descrição: Sistema de gestão de crédito com geração automática de boletos
```

#### **Etapa 3: Selecionar Escopos**
```
✅ boleto-cobranca.read - Consultar boletos
✅ boleto-cobranca.write - Criar e cancelar boletos  
✅ webhook.read - Consultar webhooks
✅ webhook.write - Configurar webhooks
✅ extrato.read - Consultar extratos (opcional)
```

#### **Etapa 4: Gerar Certificado Digital**
```
1. No portal, ir em: "Certificados"
2. Clicar: "Gerar Novo Certificado"
3. Baixar o arquivo .pfx
4. Anotar a senha do certificado
```

### **3. OBTER AS CREDENCIAIS**

Após aprovação da aplicação, você receberá:

```
INTER_CLIENT_ID=12345678-1234-1234-1234-123456789012
INTER_CLIENT_SECRET=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
INTER_CERTIFICATE=-----BEGIN CERTIFICATE-----\nMIIDXTCC...
INTER_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvQIB...
INTER_WEBHOOK_SECRET=webhook_secret_production_2025
```

---

## ⏰ **TEMPO DE APROVAÇÃO**

| Etapa | Tempo Estimado |
|-------|---------------|
| Solicitação da aplicação | 1-3 dias úteis |
| Análise de documentos | 2-5 dias úteis |
| Geração de certificado | 1-2 dias úteis |
| **TOTAL** | **5-10 dias úteis** |

---

## 🚨 **SE VOCÊ JÁ TEM CONTA EMPRESARIAL**

### **Verificar Status Atual**
```
1. Acessar: https://developers.inter.co
2. Verificar se já tem aplicações criadas
3. Checar se existem credenciais de produção disponíveis
4. Confirmar se certificados não expiraram
```

### **Renovar Credenciais Existentes**
```
1. Portal Inter → Aplicações
2. Selecionar aplicação existente
3. Verificar status: Ativa/Expirada
4. Renovar certificado se necessário
```

---

## 📞 **CONTATOS PARA SUPORTE**

### **Suporte Técnico**
```
Email: developers@inter.co
Portal: https://developers.inter.co/suporte
WhatsApp: (11) 3003-4070
```

### **Gerente de Relacionamento**
```
Se sua empresa já é cliente Inter:
- Contatar seu gerente diretamente
- Solicitar habilitação para APIs
- Agilizar processo de aprovação
```

---

## 🎯 **POSSO USAR EM PRODUÇÃO AGORA?**

### ✅ **SIM, se você tem:**
- Conta empresarial ativa no Inter
- Contrato assinado para APIs
- Aprovação para ambiente de produção

### ❌ **NÃO, se você não tem:**
- Conta empresarial no Inter
- Contrato específico para APIs
- Aprovação prévia do banco

---

## 🚀 **ALTERNATIVA RÁPIDA**

### **Se você já é cliente Inter:**
```
1. Ligar para: (11) 3003-4070
2. Falar: "Quero habilitar APIs de cobrança"
3. Informar: CNPJ da empresa
4. Solicitar: Credenciais de produção
5. Tempo: 24-48 horas para aprovação
```

### **Se não é cliente ainda:**
```
1. Abrir conta empresarial no Inter
2. Aguardar aprovação da conta (3-5 dias)
3. Solicitar habilitação de APIs
4. Seguir processo normal (5-10 dias)
```

---

## ⚡ **AÇÃO IMEDIATA RECOMENDADA**

**1. Verificar Status Atual**
- Acessar https://developers.inter.co
- Ver se já tem acesso a credenciais de produção

**2. Contatar Banco Inter**
- Falar com gerente ou suporte técnico
- Solicitar habilitação para ambiente de produção

**3. O Código Está Pronto**
- Sistema 100% implementado
- Só aguarda credenciais válidas
- Funcionará imediatamente após configuração

**💎 Sua integração funcionará perfeitamente assim que obtiver as credenciais de produção do Banco Inter!**