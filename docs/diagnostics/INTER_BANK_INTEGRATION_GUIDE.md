# 🏦 Guia Completo de Integração Banco Inter - Sistema Simpix

## 📋 Sumário Executivo

Este documento consolida todo o conhecimento necessário para integração completa com as APIs do Banco Inter, garantindo operação sem falhas para o sistema Simpix.

## 🎯 APIs Essenciais para o Sistema de Crédito

### 1. **Autenticação OAuth 2.0** (CRÍTICO)

- **Endpoint**: `POST https://cdpj.partners.bancointer.com.br/oauth/v2/token`
- **Tipo**: Client Credentials Flow com mTLS
- **Certificado**: Requerido (PFX/P12)
- **Scopes Necessários**:
  - `boleto-cobranca.read`
  - `boleto-cobranca.write`
  - `webhook.write`

### 2. **Cobrança BolePix** (ESSENCIAL)

- **Criar Boleto**: `POST /cobranca/v3/cobrancas`
- **Consultar Boleto**: `GET /cobranca/v3/cobrancas/{codigoSolicitacao}`
- **Baixar PDF**: `GET /cobranca/v3/cobrancas/{codigoSolicitacao}/pdf`
- **Cancelar Boleto**: `POST /cobranca/v3/cobrancas/{codigoSolicitacao}/cancelar`

### 3. **Webhook de Cobrança** (CRÍTICO)

- **Configurar Webhook**: `PUT /cobranca/v3/webhook`
- **Consultar Webhook**: `GET /cobranca/v3/webhook`
- **Remover Webhook**: `DELETE /cobranca/v3/webhook`
- **Listar Callbacks**: `GET /cobranca/v3/webhook/callbacks`

### 4. **PIX** (OPCIONAL)

- **Criar Cobrança PIX**: `PUT /pix/v2/cob/{txid}`
- **Consultar QR Code**: `GET /pix/v2/loc/{id}/qrcode`
- **Webhook PIX**: `PUT /pix/v2/webhook/{chave}`

## 🔐 Fluxo de Autenticação Detalhado

### 1. Preparação do Certificado

```javascript
// Configuração mTLS
const httpsAgent = new https.Agent({
  cert: fs.readFileSync('certificado.crt'),
  key: fs.readFileSync('certificado.key'),
  rejectUnauthorized: true,
});
```

### 2. Obtenção do Token

```javascript
const tokenResponse = await axios.post(
  'https://cdpj.partners.bancointer.com.br/oauth/v2/token',
  {
    client_id: process.env.INTER_CLIENT_ID,
    client_secret: process.env.INTER_CLIENT_SECRET,
    grant_type: 'client_credentials',
    scope: 'boleto-cobranca.read boleto-cobranca.write webhook.write',
  },
  { httpsAgent }
);
```

### 3. Renovação Automática

- Token expira em 1 hora
- Implementar refresh automático 5 minutos antes da expiração
- Armazenar token em cache seguro

## 💰 Fluxo de Cobrança Completo

### 1. Após Assinatura ClickSign

```javascript
// Webhook ClickSign dispara
{
  "event": {
    "name": "document.signed",
    "data": { "document_key": "..." }
  }
}
```

### 2. Gerar Boleto Banco Inter

```javascript
const boleto = {
  seuNumero: `SIMPIX-${propostaId}`,
  valorNominal: valor,
  dataVencimento: calcularVencimento(),
  numDiasAgenda: 30,
  pagador: {
    cpfCnpj: formatarCPF(cliente.cpf),
    nome: cliente.nome,
    endereco: cliente.endereco,
    cidade: cliente.cidade,
    uf: cliente.uf,
    cep: formatarCEP(cliente.cep),
  },
  mensagem: {
    linha1: 'PARCELA EMPRÉSTIMO SIMPIX',
    linha2: `REF: PROPOSTA ${propostaId}`,
  },
  desconto: {
    tipo: 'PERCENTUAL',
    data: dataDesconto,
    valor: 0,
  },
  multa: {
    tipo: 'PERCENTUAL',
    data: dataMulta,
    valor: 2.0,
  },
  mora: {
    tipo: 'TAXAMENSAL',
    data: dataMora,
    valor: 1.0,
  },
};
```

### 3. Configurar Webhook

```javascript
const webhook = {
  url: 'https://api.simpix.com.br/webhooks/inter',
  tipoWebhook: 'COBRANCA',
};
```

## 🔄 Eventos de Webhook

### Tipos de Eventos

1. **COBRANCA_CRIADA** - Boleto criado com sucesso
2. **COBRANCA_PAGA** - Pagamento confirmado
3. **COBRANCA_CANCELADA** - Boleto cancelado
4. **COBRANCA_VENCIDA** - Boleto vencido

### Validação de Webhook

```javascript
// Validar assinatura HMAC
const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
hmac.update(JSON.stringify(body));
const signature = hmac.digest('hex');

if (signature !== headers['x-inter-signature']) {
  throw new Error('Invalid webhook signature');
}
```

## 🚨 Tratamento de Erros

### Códigos de Erro Comuns

- **401**: Token inválido ou expirado
- **403**: Sem permissão (verificar scopes)
- **422**: Dados inválidos (validar CPF, valores)
- **429**: Rate limit excedido
- **500**: Erro interno (implementar retry)

### Estratégia de Retry

```javascript
const axiosRetry = require('axios-retry');

axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return error.code === 'ECONNRESET' || error.response?.status >= 500;
  },
});
```

## 📊 Monitoramento e Logs

### Logs Essenciais

1. **Autenticação**: Token obtido, expiração, renovação
2. **Boletos**: Criação, código de barras, status
3. **Webhooks**: Eventos recebidos, validação, processamento
4. **Erros**: Tipo, contexto, ação tomada

### Métricas KPI

- Taxa de sucesso de geração de boletos
- Tempo médio de processamento
- Taxa de pagamento
- Latência de webhooks

## 🛡️ Segurança

### 1. Certificados

- Armazenar em local seguro
- Rotacionar anualmente
- Backup criptografado

### 2. Secrets

- Usar variáveis de ambiente
- Nunca commitar credenciais
- Rotacionar client_secret periodicamente

### 3. Validações

- Sempre validar CPF/CNPJ
- Verificar valores mínimos/máximos
- Sanitizar dados de entrada

## 🔧 Implementação no Simpix

### 1. Estrutura de Arquivos

```
server/
  services/
    interBankService.ts       # Serviço principal
    interAuthService.ts       # Gerenciamento de token
    interWebhookService.ts    # Processamento webhooks
  routes/
    inter.ts                  # Endpoints da API
  utils/
    interValidators.ts        # Validações específicas
```

### 2. Fluxo Integrado

1. **ClickSign assina** → Webhook recebido
2. **Gerar boleto** → API Banco Inter
3. **Enviar boleto** → Email/WhatsApp cliente
4. **Monitorar pagamento** → Webhook Inter
5. **Atualizar status** → Proposta paga

### 3. Configuração de Produção

```env
# Banco Inter Production
INTER_CLIENT_ID=seu_client_id
INTER_CLIENT_SECRET=seu_client_secret
INTER_CERT_PATH=/secure/certs/inter.pfx
INTER_CERT_PASSWORD=senha_certificado
INTER_WEBHOOK_URL=https://api.simpix.com.br/webhooks/inter
INTER_WEBHOOK_SECRET=secret_webhook
```

## 📱 Interface do Atendente

### Funcionalidades

1. **Visualizar Boletos**: Lista com status
2. **Reenviar Boleto**: WhatsApp/Email
3. **Cancelar Boleto**: Com motivo
4. **Consultar Pagamento**: Status em tempo real

## 🚀 Checklist de Implementação

- [ ] Configurar certificado mTLS
- [ ] Implementar autenticação OAuth
- [ ] Criar serviço de boletos
- [ ] Configurar webhooks
- [ ] Implementar validações
- [ ] Adicionar logs detalhados
- [ ] Testar em sandbox
- [ ] Validar em produção

## 📞 Suporte Banco Inter

- **Portal**: https://developers.inter.co
- **Email**: developers@bancointer.com.br
- **Horário**: Segunda a Sexta, 9h às 18h

## 🎯 Próximos Passos

1. **Fase 1**: Implementar autenticação e geração de boletos
2. **Fase 2**: Configurar webhooks e notificações
3. **Fase 3**: Adicionar PIX como opção de pagamento
4. **Fase 4**: Dashboard de métricas e relatórios

---

**Última atualização**: Janeiro 2025
**Versão**: 1.0
**Status**: Pronto para implementação
