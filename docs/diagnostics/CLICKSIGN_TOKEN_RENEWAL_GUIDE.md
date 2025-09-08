# Guia de Renovação do Token ClickSign

## Problema Identificado

❌ **Token ClickSign inválido ou expirado**

- Status: 401 Unauthorized
- Erro: "Access Token inválido"

## Como Renovar o Token (Baseado na Documentação Oficial)

### 1. Acessar o Ambiente Correto

- **Sandbox (Desenvolvimento)**: https://sandbox.clicksign.com/signup
- **Produção**: https://app.clicksign.com

### 2. Gerar Novo Access Token

1. Faça login na sua conta ClickSign
2. Vá para **Configurações**
3. Acesse a aba **API**
4. Gere um novo **Access Token**

### 3. Associar o Usuário à API

⚠️ **CRÍTICO**: É necessário associar o usuário para utilização da API

- Marque a opção para associar o usuário à API
- Sem esta etapa, o token não funcionará

### 4. Testar o Token

Use nossa ferramenta de teste:

```bash
GET /api/clicksign/test-token
```

Ou teste manualmente no navegador:

```
https://sandbox.clicksign.com/api/v3/envelopes?access_token=SEU_TOKEN_AQUI
```

### 5. Atualizar no Sistema

Atualize a variável de ambiente:

```
CLICKSIGN_API_TOKEN=novo_token_aqui
```

## Headers Corretos (Implementação Atualizada)

```javascript
{
  'Content-Type': 'application/vnd.api+json',
  'Accept': 'application/vnd.api+json',
  'Authorization': 'SEU_TOKEN' // SEM "Bearer"
}
```

## Resposta Esperada (Token Válido)

```json
{
  "data": [],
  "meta": {
    "record_count": 0
  },
  "links": {
    "first": "https://sandbox.clicksign.com/api/v3/envelopes?page%5Bnumber%5D=1&page%5Bsize%5D=20",
    "last": "https://sandbox.clicksign.com/api/v3/envelopes?page%5Bnumber%5D=1&page%5Bsize%5D=20"
  }
}
```

## Documentação Oficial

- **Primeiros Passos**: https://developers.clicksign.com/docs/primeiros-passos
- **Documentação Completa**: https://developers.clicksign.com/reference/comece-agora

## Contato ClickSign

Em caso de dúvidas: ajuda@clicksign.com
