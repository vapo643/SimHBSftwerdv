# 🚨 SUPER PROMPT COMPLETO: Problema Crítico do Download de PDF - Banco Inter API

## 📌 CONTEXTO EXECUTIVO
**Sistema**: Simpix Credit Management System  
**Problema**: Download de PDF de boletos falha persistentemente há 30+ dias  
**Impacto**: Funcionalidade crítica bloqueada, requisito "mandatory, absolute and non-negotiable"  
**Ambiente**: Node.js/TypeScript, Express, PostgreSQL, Supabase  
**API Externa**: Banco Inter API v3 (produção)  

## 🔴 PROBLEMA ATUAL CRÍTICO

### Comportamento Observado:
1. **Requisição GET para PDF**: `/cobranca/v3/cobrancas/{codigoSolicitacao}/pdf`
2. **Resposta**: HTTP 200 OK mas com JSON ao invés de PDF
3. **Headers da Resposta**: `content-type: application/json` (esperado: `application/pdf`)
4. **Tamanho**: ~55KB de dados JSON ao invés de PDF binário

### Log Real do Erro (12/08/2025):
```
[INTER] 🌐 FULL URL: https://cdpj.partners.bancointer.com.br/cobranca/v3/cobrancas/73e76cfe-f8f8-4638-ac83-d8e809e06eef/pdf
[INTER] 🔧 METHOD: GET
[INTER] 📊 STATUS: 200 OK
[INTER] 📋 RESPONSE HEADERS: {
  'content-type': 'application/json',  // ❌ PROBLEMA: Deveria ser application/pdf
  date: 'Tue, 12 Aug 2025 18:56:04 GMT',
  server: 'istio-envoy',
  'x-rate-limit-remaining': '118',
}
[INTER] 📦 Response buffer size: 55182 bytes
[INTER] ❌ Unexpected response format: { type: 'object', isBuffer: false }
```

## 📚 HISTÓRICO COMPLETO DE TENTATIVAS (30+ dias)

### 1. TENTATIVA: Headers Accept (FALHOU)
```typescript
// Tentamos todos os formatos de Accept header
headers['Accept'] = 'application/pdf'  // ❌ Retorna erro 406
headers['Accept'] = 'application/json' // ❌ Retorna JSON ao invés de PDF
headers['Accept'] = '*/*'              // ❌ Retorna JSON
headers['Accept'] = 'application/pdf, application/json' // ❌ Retorna JSON
```

### 2. TENTATIVA: Certificados mTLS (FALHOU)
```typescript
// Configuração atual dos certificados
const httpsAgent = new https.Agent({
  cert: formatCertificate(process.env.INTER_CERTIFICATE!),
  key: formatPrivateKey(process.env.INTER_PRIVATE_KEY!),
  rejectUnauthorized: true,
  keepAlive: true,
  secureProtocol: 'TLSv1_2_method'
});
```
**Resultado**: Autenticação funciona, mas PDF continua vindo como JSON

### 3. TENTATIVA: Response Type (FALHOU)
```typescript
// Axios com responseType
const response = await axios.get(url, {
  responseType: 'arraybuffer',  // ❌ Ainda recebe JSON
  responseType: 'blob',         // ❌ Ainda recebe JSON
  responseType: 'stream'        // ❌ Ainda recebe JSON
});
```

### 4. TENTATIVA: User-Agent Específico (FALHOU)
```typescript
headers['User-Agent'] = 'SIMPIX-Inter-Integration/1.0'
headers['User-Agent'] = 'Mozilla/5.0'
headers['User-Agent'] = 'PostmanRuntime/7.26.8'
```
**Resultado**: Nenhuma diferença, sempre retorna JSON

### 5. TENTATIVA: Header x-conta-corrente (FALHOU)
```typescript
headers['x-conta-corrente'] = '346470536'  // Conta corrente real
```
**Resultado**: Header aceito mas não afeta o formato da resposta

### 6. TENTATIVA: Endpoints Alternativos (FALHOU)
```typescript
// Tentamos variações do endpoint
'/cobranca/v3/cobrancas/{id}/pdf'
'/cobranca/v2/boletos/{nossoNumero}/pdf'
'/banking/v2/boletos/{id}/pdf'
```
**Resultado**: v3 retorna JSON, v2 retorna 404, banking não existe

### 7. TENTATIVA: Regeneração do Boleto (PARCIAL)
- Deletamos 24 boletos com códigos inválidos
- Regeneramos com UUIDs válidos
- Boletos agora têm `codigoSolicitacao` correto
- **MAS**: PDF ainda retorna como JSON

### 8. TENTATIVA: Token OAuth Diferente (FALHOU)
```typescript
// Tentamos diferentes scopes
scope: 'boleto-cobranca.read'
scope: 'boleto-cobranca.read boleto-cobranca.write'
scope: 'boleto.read'
```
**Resultado**: Token gerado com sucesso, mas PDF continua como JSON

## 🔍 ANÁLISE TÉCNICA PROFUNDA

### O Que FUNCIONA ✅:
1. **Autenticação OAuth**: Token gerado corretamente com mTLS
2. **Criação de Boletos**: API cria boletos com sucesso
3. **Consulta de Boletos**: GET retorna dados completos do boleto
4. **Webhooks**: Recebemos notificações corretamente
5. **Código de Barras/Linha Digitável**: Gerados e funcionais
6. **PIX**: QR Code e copia-cola funcionando

### O Que NÃO FUNCIONA ❌:
1. **Download do PDF**: SEMPRE retorna JSON ao invés de PDF binário
2. **Content-Type**: API sempre responde com `application/json`
3. **Accept Header**: Ignorado ou causa erro 406

## 🧬 CÓDIGO ATUAL COMPLETO

### interBankService.ts (Método de Download):
```typescript
async obterPdfCobranca(codigoSolicitacao: string): Promise<Buffer> {
  console.log('[INTER] 🔍 STEP 2: Tentando baixar PDF...');
  
  const token = await this.getAccessToken();
  const url = `${this.apiUrl}/cobranca/v3/cobrancas/${codigoSolicitacao}/pdf`;
  
  console.log('[INTER] 📋 Usando Accept: application/json conforme exigido pela API');
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json', // ⚠️ API retorna 406 com application/pdf
    'User-Agent': 'SIMPIX-Inter-Integration/1.0',
    'Content-Type': 'application/json'
  };

  if (this.contaCorrente) {
    headers['x-conta-corrente'] = this.contaCorrente;
  }

  try {
    const httpsAgent = new https.Agent({
      cert: formatCertificate(this.certificate),
      key: formatPrivateKey(this.privateKey),
      rejectUnauthorized: true
    });

    const response = await axios.get(url, {
      headers,
      httpsAgent,
      responseType: 'arraybuffer', // Esperamos binário mas recebemos JSON
      maxBodyLength: Infinity,
      timeout: 30000
    });

    console.log(`[INTER] 📊 STATUS: ${response.status} ${response.statusText}`);
    console.log(`[INTER] 📋 RESPONSE HEADERS:`, response.headers);
    
    // PROBLEMA: response.data é JSON, não PDF
    if (response.headers['content-type']?.includes('application/json')) {
      console.log('[INTER] ❌ API retornou JSON ao invés de PDF');
      throw new Error('Formato de resposta inesperado da API');
    }

    return Buffer.from(response.data);
  } catch (error) {
    console.error('[INTER] ❌ Failed to get PDF:', error);
    throw error;
  }
}
```

## 🎯 HIPÓTESES DO PROBLEMA

### Hipótese 1: Configuração de Conta
- A conta pode não ter permissão para gerar PDFs
- Pode ser necessário habilitar algo no painel do Banco Inter

### Hipótese 2: Endpoint Deprecated
- O endpoint `/pdf` pode estar deprecated mas ainda responde
- Pode haver um novo endpoint não documentado

### Hipótese 3: Header Específico
- Pode existir um header proprietário não documentado
- Exemplo: `x-inter-pdf-format: true`

### Hipótese 4: Processo em Duas Etapas
- Talvez seja necessário primeiro solicitar geração do PDF
- Depois fazer download em endpoint separado

### Hipótese 5: Problema de Ambiente
- API de produção pode ter comportamento diferente
- Sandbox pode ter PDF habilitado mas produção não

## 📊 DADOS TÉCNICOS COMPLETOS

### Ambiente:
```json
{
  "node_version": "20.x",
  "typescript": "5.x",
  "axios": "1.7.x",
  "express": "4.x",
  "database": "PostgreSQL com Supabase",
  "api_url": "https://cdpj.partners.bancointer.com.br",
  "auth_type": "OAuth 2.0 com mTLS",
  "certificates": "PEM format, single-line converted to multi-line"
}
```

### Credenciais (ofuscadas):
```
CLIENT_ID: 05fc3816-9a8f-4a2d-8b28-277cd3617cc2
CLIENT_SECRET: bbb82b01-****
CONTA_CORRENTE: 346470536
CERTIFICATE: -----BEGIN CERTIFICATE-----...
PRIVATE_KEY: -----BEGIN PRIVATE KEY-----...
```

### Exemplo de Cobrança Válida:
```json
{
  "codigoSolicitacao": "73e76cfe-f8f8-4638-ac83-d8e809e06eef",
  "seuNumero": "SX65500-1",
  "nossoNumero": "90398347529",
  "dataEmissao": "2025-08-12",
  "dataVencimento": "2025-09-11",
  "valorNominal": 833.33,
  "situacao": "A_RECEBER",
  "codigoBarras": "07796120100000833330001112134234790398347529",
  "linhaDigitavel": "07790001161213423479303983475298612010000083333"
}
```

## 🆘 SOLUÇÃO NECESSÁRIA

### Precisamos descobrir:
1. **Por que a API retorna JSON quando pedimos PDF?**
2. **Existe alguma configuração de conta necessária?**
3. **Há um header especial não documentado?**
4. **O endpoint está correto ou mudou?**
5. **Existe processo diferente para obter o PDF?**

### Ações Sugeridas:
1. **Contato com Suporte Técnico Inter**: Perguntar especificamente sobre o endpoint PDF
2. **Análise de Tráfego**: Capturar requisições do app oficial do Inter
3. **Teste com Postman/Insomnia**: Isolar o problema fora do código
4. **Verificar Painel Admin**: Procurar configurações de API/PDF
5. **Documentação Atualizada**: Verificar se há docs mais recentes

## 🔥 URGÊNCIA
Este problema está bloqueando produção há 30+ dias. O cliente definiu como "mandatory, absolute and non-negotiable". Precisamos de uma solução definitiva URGENTE.

## 📝 NOTAS ADICIONAIS

### O que já confirmamos:
- ✅ Não é problema de autenticação (token válido)
- ✅ Não é problema de certificado (mTLS funcionando)
- ✅ Não é problema de permissões (conseguimos criar/consultar boletos)
- ✅ Não é problema de código do boleto (UUIDs válidos)
- ✅ Não é problema de rede (requisição chega e retorna 200)

### O que suspeitamos:
- ⚠️ API pode ter mudado comportamento recentemente
- ⚠️ Pode haver flag de conta para habilitar PDFs
- ⚠️ Endpoint pode estar em migração/deprecated
- ⚠️ Pode precisar de header proprietário específico

## 🎯 OBJETIVO FINAL
Conseguir fazer download do PDF do boleto em formato binário (application/pdf) para exibir ao usuário no navegador ou permitir download direto.

---

**URGENTE**: Preciso de ajuda para resolver este problema crítico. Por favor, analise todo o contexto e sugira soluções que ainda não tentamos.