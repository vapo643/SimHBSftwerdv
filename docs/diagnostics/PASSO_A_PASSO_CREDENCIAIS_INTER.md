# 🏦 PASSO A PASSO - CREDENCIAIS BANCO INTER

**Situação**: Você já tem conta empresarial no Banco Inter  
**Objetivo**: Encontrar as credenciais corretas de produção

---

## 🔍 **PORTAIS PARA ACESSAR**

### **1. Portal Principal do Inter Empresarial**
**URL**: https://internetbanking.bancointer.com.br
- Login com suas credenciais empresariais
- Procurar seção "APIs" ou "Integrações"
- Pode estar em "Produtos e Serviços" → "APIs"

### **2. Portal de Desenvolvedores**
**URL**: https://developers.inter.co
- Fazer login com conta empresarial
- Se não conseguir, usar mesmo login do Internet Banking

### **3. Portal Open Banking** 
**URL**: https://openbanking.bancointer.com.br
- Específico para APIs financeiras
- Pode conter as credenciais de cobrança

---

## 📋 **O QUE PROCURAR**

### **Seções no Portal:**
- "Minhas Aplicações"
- "APIs Habilitadas" 
- "Credenciais"
- "Certificados"
- "Integrações"
- "Open Banking"
- "Cobrança"

### **Informações Necessárias:**
```
✅ Client ID (formato: 12345678-1234-1234-1234-123456789012)
✅ Client Secret (string longa, tipo JWT)
✅ Certificado Digital (.pfx ou .pem)
✅ Senha do Certificado
✅ Ambiente (Produção/Sandbox)
```

---

## 🎯 **ROTEIRO DE BUSCA**

### **Passo 1: Login no Portal Principal**
1. Acesse: https://internetbanking.bancointer.com.br
2. Faça login com suas credenciais empresariais
3. Procure menu "Produtos" ou "Serviços"
4. Procure "APIs", "Integrações" ou "Open Banking"

### **Passo 2: Verificar Portal de Desenvolvedores**
1. Acesse: https://developers.inter.co
2. Tente login com mesmas credenciais
3. Se não funcionar, verificar se há opção "Conta Empresarial"
4. Procurar "Aplicações" ou "Credenciais"

### **Passo 3: Contatar Suporte (se não encontrar)**
**Telefone**: (11) 3003-4070
**Fale**: "Preciso das credenciais de API de cobrança para integração"
**Informe**: CNPJ da empresa

---

## 🚨 **POSSÍVEIS PROBLEMAS**

### **1. Não encontro seção de APIs**
- APIs podem não estar habilitadas para sua conta
- Contatar gerente ou suporte para habilitar

### **2. Só vejo APIs de consulta**
- API de cobrança precisa ser contratada separadamente
- Solicitar habilitação de "API Cobrança" ou "Boleto"

### **3. Credenciais expiradas**
- Certificados têm validade (1-2 anos)
- Solicitar renovação no portal ou via suporte

---

## 📞 **CONTATOS DIRETOS**

### **Suporte Técnico APIs**
- **Email**: developers@inter.co
- **Telefone**: (11) 3003-4070
- **WhatsApp**: (11) 3003-4070

### **O que falar:**
```
"Olá, sou cliente empresarial do Inter (CNPJ: XXXXX).
Preciso das credenciais de produção para a API de Cobrança.
Já tenho conta empresarial ativa.
Podem me orientar onde encontrar ou renovar as credenciais?"
```

---

## ⚡ **TESTE RÁPIDO**

Depois de obter novas credenciais:

1. **Configurar secrets** no Replit
2. **Testar** com nosso script
3. **Se funcionar** → Produção ready!

---

## 🎯 **PRÓXIMA AÇÃO IMEDIATA**

1. **Acessar portal empresarial** do Inter
2. **Procurar seção APIs/Integrações**
3. **Se não encontrar** → Ligar (11) 3003-4070
4. **Solicitar credenciais de produção** para API Cobrança

**O sistema está 100% pronto, só precisamos das credenciais corretas!**