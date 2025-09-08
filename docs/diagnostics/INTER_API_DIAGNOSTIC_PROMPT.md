# 🔴 DIAGNÓSTICO PROFUNDO: Erro Persistente OAuth2 - Banco Inter API v3

## CONTEXTO CRÍTICO

Estamos enfrentando um erro **persistente e repetitivo** há vários dias ao tentar autenticar com a API do Banco Inter. O erro 400 (Bad Request) ocorre na etapa inicial de autenticação OAuth2, impedindo completamente a geração de boletos bancários em produção.

## PROBLEMA PRINCIPAL

```
[INTER] 📡 Response status: 400
[INTER] ❌ Error response body: (vazio)
[INTER] 🔍 Bad Request - possible causes:
[INTER]   - Invalid grant_type or scope
[INTER]   - Invalid client credentials
[INTER]   - Missing required parameters
```

## IMPLEMENTAÇÃO ATUAL DETALHADA

### 1. Arquitetura do Sistema

- **Framework**: Node.js/Express com TypeScript
- **Cliente HTTP**: Fetch API nativo do Node.js
- **Autenticação**: OAuth 2.0 com mTLS (Mutual TLS)
- **Ambiente**: Produção no Replit

### 2. Fluxo de Autenticação Implementado

```typescript
// URL de autenticação
const tokenUrl = 'https://cdpj.partners.bancointer.com.br/oauth/v2/token';

// Parâmetros enviados (form-urlencoded)
{
  client_id: '05fc3816-9a8f-4a2d-8b28-277cd3617cc2',
  client_secret: 'bbb82b01-2ca0-407f-a21c-0e1dff659d42',
  grant_type: 'client_credentials',
  scope: 'boleto-cobranca.read boleto-cobranca.write webhook.read webhook.write'
}

// Headers
{
  'Content-Type': 'application/x-www-form-urlencoded',
  'Accept': 'application/json'
}

// mTLS Configuration
- Certificate: PEM format (convertido de single-line para multi-line)
- Private Key: PEM format (convertido de single-line para multi-line)
- Passphrase: não utilizada
- rejectUnauthorized: true
```

### 3. Certificados mTLS

- **Origem**: Baixados do Internet Banking do Banco Inter
- **Formato**: .crt e .key em formato PEM
- **Validação**: Certificados validados com OpenSSL
- **Armazenamento**: Environment variables (INTER_CERTIFICATE e INTER_PRIVATE_KEY)

### 4. Tentativas de Solução Já Realizadas

#### ✅ Validações Confirmadas:

1. Client ID e Client Secret corretos (36 caracteres cada)
2. Certificados válidos e não expirados
3. URLs corretas conforme documentação oficial
4. Formato de requisição seguindo RFC 6749 (OAuth 2.0)
5. Scopes válidos conforme documentação

#### ❌ Tentativas Sem Sucesso:

1. Diferentes formatos de certificado (com/sem headers, line breaks)
2. Variações no agente HTTPS (diferentes configurações TLS)
3. Headers adicionais (User-Agent, X-Inter-\*, etc.)
4. Diferentes bibliotecas HTTP (axios, node-fetch, https nativo)
5. Codificação URL manual vs automática
6. Ordem diferente dos parâmetros
7. Remoção/adição de espaços nos scopes
8. Tentativa com certificado em formato base64
9. Uso de proxy para debug
10. Diferentes versões do Node.js

### 5. Logs Completos do Erro

```
[INTER] 🔑 Requesting new access token...
[INTER] 🌐 Token URL: cdpj.partners.bancointer.com.br/oauth/v2/token
[INTER] 📄 Using form-based authentication per official docs
[INTER] 🔓 Certificate configured: ✅ Present
[INTER] 🔑 Private Key configured: ✅ Present
[INTER] 📊 Client ID length: 36 chars
[INTER] 📊 Client Secret length: 36 chars
[INTER] 📝 Form parameters: client_id=***, grant_type=client_credentials, scope=boleto-cobranca.read boleto-cobranca.write webhook.read webhook.write
[INTER] 📝 Form body string length: 203 chars
[INTER] 📝 Form body preview: client_id=05fc3816-9a8f-4a2d-8b28-277cd3617cc2&client_secret=bbb82b01-2ca0-407f-a21c-0e1dff659d42&gr...
[INTER] 🔒 Using mTLS certificate authentication
[INTER] 🔄 Formatting certificates with proper line breaks...
[INTER] 📋 Certificate is single-line PEM, adding line breaks...
[INTER] ✅ Certificate formatted with line breaks
[INTER] 🔑 Private key is single-line PEM, adding line breaks...
[INTER] ✅ Private key formatted with line breaks
[INTER] ✅ Certificates formatted and ready
[INTER] 🚀 Making mTLS request with custom agent...
[INTER] 📡 Response status: 400
[INTER] 📡 Response headers: Headers {
  traceparent: '00-72555a00aff2919ac0f603dce306a458-14fa70b32ce7602f-00',
  date: 'Mon, 04 Aug 2025 17:26:11 GMT',
  'content-length': '0'
}
[INTER] ❌ Error response body:
```

### 6. Peculiaridades Observadas

1. **Response body vazio**: O erro 400 não retorna nenhum corpo de resposta
2. **Header traceparent**: Indica que a requisição está chegando ao servidor
3. **Content-length: 0**: Confirma que não há corpo de resposta
4. **Sem mensagem de erro**: Impossível saber o motivo exato do erro

### 7. Código de Implementação Atual

```typescript
private async getAccessToken(): Promise<void> {
  const tokenUrl = `https://${this.baseUrl}/oauth/v2/token`;

  const params = new URLSearchParams({
    client_id: this.clientId,
    client_secret: this.clientSecret,
    grant_type: 'client_credentials',
    scope: 'boleto-cobranca.read boleto-cobranca.write webhook.read webhook.write'
  });

  const agent = new https.Agent({
    cert: formattedCert,
    key: formattedKey,
    rejectUnauthorized: true,
    securityOptions: 'SSL_OP_NO_SSLv3',
    ALPNProtocols: ['http/1.1']
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: params.toString(),
    agent
  });
}
```

## PERGUNTAS PARA INVESTIGAÇÃO

1. **Certificados mTLS**:
   - Existe alguma validação específica do CN (Common Name) do certificado?
   - O certificado precisa estar em alguma lista de certificados autorizados?
   - Há requisitos específicos para o formato ou encoding?

2. **OAuth2 Flow**:
   - O Banco Inter requer algum header proprietário não documentado?
   - Existe rate limiting ou blacklist de IPs?
   - O client_id precisa estar vinculado ao certificado de alguma forma?

3. **Ambiente Replit**:
   - Pode haver alguma incompatibilidade com o ambiente Replit?
   - IPs do Replit podem estar bloqueados?
   - Certificados client-side podem ter restrições em ambientes cloud?

4. **Debugging**:
   - Como obter logs mais detalhados do lado do servidor Inter?
   - Existe algum endpoint de validação de certificados?
   - Há exemplos funcionais em produção que podemos comparar?

## DOCUMENTAÇÃO CONSULTADA

1. [Documentação Oficial API Inter](https://developers.inter.co/references/autenticacao)
2. [Guia de Integração Boletos](https://developers.inter.co/references/cobrancas)
3. RFC 6749 - OAuth 2.0 Framework
4. RFC 8705 - OAuth 2.0 Mutual-TLS

## OBJETIVO DA ANÁLISE

Precisamos identificar a **causa raiz** do erro 400 e encontrar uma solução definitiva. O sistema está em produção e precisa gerar boletos automaticamente após assinatura eletrônica via ClickSign.

## INFORMAÇÕES ADICIONAIS

- **Urgência**: Sistema em produção com clientes aguardando
- **Impacto**: Impossibilidade total de gerar boletos bancários
- **Alternativas**: Não há - o Banco Inter é requisito do cliente

Por favor, analise profundamente este problema e sugira:

1. Possíveis causas não exploradas
2. Métodos de debugging avançados
3. Soluções alternativas ou workarounds
4. Contatos ou canais de suporte específicos
5. Exemplos de implementações funcionais similares

**NOTA IMPORTANTE**: Este erro tem sido consistente por vários dias, através de múltiplas tentativas e abordagens diferentes. Precisamos de uma análise que vá além das soluções óbvias.
