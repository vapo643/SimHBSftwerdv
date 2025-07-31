# 📁 PASSO A PASSO - UPLOAD CERTIFICADO NO REPLIT

**Objetivo**: Fazer upload do arquivo .pfx e extrair as chaves para os secrets

---

## 🔧 **PASSO 1: UPLOAD DO ARQUIVO .pfx**

### **Método 1: Drag & Drop (Mais Fácil)**
1. **Baixe o arquivo .pfx** do portal do Inter
2. **Abra o painel de arquivos** do Replit (lado esquerdo)
3. **Arraste o arquivo .pfx** para a pasta raiz do projeto
4. **Confirme o upload** quando aparecer

### **Método 2: Upload via Interface**
1. **Clique no ícone "+"** no painel de arquivos
2. **Selecione "Upload file"**
3. **Escolha o arquivo .pfx** baixado
4. **Aguarde o upload** concluir

### **Resultado Esperado:**
```
📁 Projeto/
  ├── certificado_inter.pfx  ← Arquivo aqui
  ├── server/
  ├── client/
  └── ...
```

---

## 🔐 **PASSO 2: EXTRAIR CHAVES DO CERTIFICADO**

### **Informações Necessárias:**
- **Nome do arquivo**: `certificado_inter.pfx` (ou nome que você deu)
- **Senha do certificado**: Fornecida pelo banco quando baixou

### **Script de Extração (Vou criar para você):**
Um script que extrai automaticamente:
- Certificate (parte pública)
- Private Key (parte privada)

---

## ⚡ **COMANDOS AUTOMÁTICOS**

Depois do upload, vou criar scripts que fazem:

1. **Ler o arquivo .pfx**
2. **Solicitar a senha**
3. **Extrair o certificado**
4. **Extrair a chave privada**
5. **Mostrar o formato correto** para os secrets

---

## 📋 **FORMATO DOS SECRETS EXTRAÍDOS**

### **INTER_CERTIFICATE**
```
-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKoK/OvqDMGmMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
BAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX
aWRnaXRzIFB0eSBMdGQwHhcNMTcwODI4MTQxNTMwWhcNMTgwODI4MTQxNTMwWjBF
...conteúdo Base64...
-----END CERTIFICATE-----
```

### **INTER_PRIVATE_KEY**
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKB
wQfVDgdwsbtqnqQXfO6v0K1eqRlEWwDc7X/+bMY5Q7Z9Kk1+pHq2Q2VvK7Y8WQ6J
...conteúdo Base64...
-----END PRIVATE KEY-----
```

---

## 🎯 **PRÓXIMOS PASSOS**

1. **Faça o upload** do arquivo .pfx agora
2. **Me informe o nome** do arquivo carregado
3. **Eu criarei scripts** para extrair as chaves
4. **Você fornecerá a senha** quando solicitado
5. **Copiaremos os valores** para os secrets

---

## 🔒 **SEGURANÇA**

- **Arquivo .pfx**: Será excluído após extração
- **Chaves extraídas**: Só ficam nos secrets (seguros)
- **Senha**: Não é armazenada em lugar nenhum
- **Processo**: Totalmente local no Replit

---

## ✅ **CHECKLIST**

```
□ Baixar arquivo .pfx do portal Inter
□ Fazer upload para o Replit
□ Informar nome do arquivo
□ Aguardar scripts de extração
□ Fornecer senha do certificado
□ Copiar valores para secrets
□ Excluir arquivo .pfx original
```

**AÇÃO IMEDIATA**: Faça o upload do arquivo .pfx e me informe quando estiver pronto!