# 🔬 ANÁLISE TÉCNICA PROFUNDA - Problema PDF Banco Inter

## 📊 ANÁLISE DOS LOGS COMPLETOS (12/08/2025)

### PADRÃO IDENTIFICADO NAS REQUISIÇÕES

#### Requisição 1: Consulta do Boleto (FUNCIONA ✅)

```
URL: https://cdpj.partners.bancointer.com.br/cobranca/v3/cobrancas/73e76cfe-f8f8-4638-ac83-d8e809e06eef
Method: GET
Headers:
  - Authorization: Bearer e19584b6-8bf1-4077-b66d-a97e10e47627
  - Accept: application/json
  - User-Agent: SIMPIX-Inter-Integration/1.0
  - x-conta-corrente: 346470536

Response Status: 200 OK
Response Headers:
  - content-type: application/json ✅
  - content-length: 974 bytes
Response: JSON com dados completos do boleto
```

#### Requisição 2: Download do PDF (FALHA ❌)

```
URL: https://cdpj.partners.bancointer.com.br/cobranca/v3/cobrancas/73e76cfe-f8f8-4638-ac83-d8e809e06eef/pdf
Method: GET
Headers:
  - Authorization: Bearer e19584b6-8bf1-4077-b66d-a97e10e47627
  - Accept: application/json  // ⚠️ FORÇADO - com application/pdf retorna 406
  - User-Agent: SIMPIX-Inter-Integration/1.0
  - Content-Type: application/json
  - x-conta-corrente: 346470536

Response Status: 200 OK
Response Headers:
  - content-type: application/json ❌ ESPERADO: application/pdf
  - transfer-encoding: chunked
  - Response buffer size: 55182 bytes (55KB)
Response: JSON ao invés de PDF binário
```

## 🔍 DESCOBERTAS CRÍTICAS

### 1. TAMANHO SUSPEITO DA RESPOSTA

- **55KB** é muito grande para um JSON de erro
- **55KB** é muito pequeno para um PDF de boleto (normalmente 150-300KB)
- **Hipótese**: API está retornando PDF em base64 dentro de JSON?

### 2. DIFERENÇA DE HEADERS

- Requisição normal: `content-length: 974`
- Requisição PDF: `transfer-encoding: chunked` + 55KB
- **Indica**: Resposta grande demais para JSON normal

### 3. TEMPO DE RESPOSTA

- Consulta normal: `x-upstream-time: 87ms`
- Download PDF: `x-upstream-time: 109ms` a `1244ms`
- **Indica**: Processamento adicional no servidor

### 4. RATE LIMIT

- `x-rate-limit-remaining: 118`
- **Não é problema de rate limit**

## 🧪 TESTES NECESSÁRIOS URGENTES

### TESTE 1: Analisar o JSON de 55KB

```javascript
// URGENTE: Ver o que tem dentro desses 55KB
const response = await axios.get(pdfUrl, {
  headers: { Accept: 'application/json' },
  responseType: 'text', // Forçar texto para análise
});

console.log('CONTEÚDO COMPLETO:', response.data);
console.log('PRIMEIROS 1000 CHARS:', response.data.substring(0, 1000));

// Verificar se é base64
const isBase64 = /^[A-Za-z0-9+/]+=*$/.test(response.data);
console.log('É Base64?', isBase64);

// Se tiver campo 'pdf' ou 'documento'
if (typeof response.data === 'object') {
  console.log('CAMPOS DO JSON:', Object.keys(response.data));

  // Procurar por campos suspeitos
  ['pdf', 'documento', 'arquivo', 'base64', 'content', 'data'].forEach((field) => {
    if (response.data[field]) {
      console.log(`CAMPO ${field} ENCONTRADO:`, response.data[field].substring(0, 100));
    }
  });
}
```

### TESTE 2: Requisição com curl Completo

```bash
# Teste completo com todos os detalhes
curl -v -X GET \
  "https://cdpj.partners.bancointer.com.br/cobranca/v3/cobrancas/73e76cfe-f8f8-4638-ac83-d8e809e06eef/pdf" \
  -H "Authorization: Bearer TOKEN" \
  -H "Accept: */*" \
  -H "x-conta-corrente: 346470536" \
  --cert cert.pem \
  --key key.pem \
  -o response.txt \
  -w "\n\nHTTP Code: %{http_code}\nContent-Type: %{content_type}\nSize: %{size_download}\n"

# Analisar o arquivo
file response.txt
hexdump -C response.txt | head -20
```

### TESTE 3: Headers Alternativos

```javascript
// Teste com diferentes combinações
const tests = [
  { Accept: 'application/pdf, */*;q=0.8' },
  { Accept: 'application/octet-stream' },
  { Accept: 'application/pdf', 'Accept-Encoding': 'gzip, deflate' },
  { Accept: 'application/pdf', 'x-api-version': 'v3' },
  { Accept: 'application/pdf', 'x-format': 'pdf' },
];

for (const headers of tests) {
  try {
    const response = await axios.get(pdfUrl, { headers, responseType: 'arraybuffer' });
    console.log('SUCESSO com headers:', headers);
    console.log('Response type:', response.headers['content-type']);
    break;
  } catch (error) {
    console.log('Falha com:', headers, '- Erro:', error.response?.status);
  }
}
```

## 🎯 SOLUÇÃO ALTERNATIVA IMEDIATA

### OPÇÃO 1: Parser do JSON de 55KB

```javascript
async obterPdfCobranca(codigoSolicitacao: string): Promise<Buffer> {
  // ... código atual ...

  const response = await axios.get(url, {
    headers: { ...headers, Accept: 'application/json' },
    responseType: 'text'
  });

  // ANALISAR O RESPONSE DE 55KB
  try {
    const data = JSON.parse(response.data);

    // Procurar campo com PDF
    const pdfFields = ['pdf', 'arquivo', 'documento', 'base64', 'content'];
    for (const field of pdfFields) {
      if (data[field]) {
        console.log(`[INTER] ✅ PDF encontrado no campo '${field}'`);

        // Se for base64
        if (typeof data[field] === 'string' && data[field].length > 1000) {
          return Buffer.from(data[field], 'base64');
        }
      }
    }
  } catch (e) {
    // Talvez seja PDF direto disfarçado?
    if (response.data.startsWith('%PDF')) {
      console.log('[INTER] ✅ É um PDF disfarçado como JSON!');
      return Buffer.from(response.data);
    }
  }

  throw new Error('PDF não encontrado na resposta');
}
```

### OPÇÃO 2: Gerar PDF Localmente

```javascript
// Se API não fornecer, gerar com dados que temos
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

async gerarPdfLocal(dadosBoleto: any): Promise<Buffer> {
  const doc = new PDFDocument();
  const chunks: Buffer[] = [];

  doc.on('data', chunk => chunks.push(chunk));

  // Adicionar logo do Inter
  doc.image('inter-logo.png', 50, 50, { width: 100 });

  // Dados do boleto
  doc.fontSize(12)
     .text(`Nosso Número: ${dadosBoleto.nossoNumero}`)
     .text(`Vencimento: ${dadosBoleto.dataVencimento}`)
     .text(`Valor: R$ ${dadosBoleto.valorNominal}`);

  // Código de barras
  doc.text(dadosBoleto.linhaDigitavel);

  // QR Code PIX
  const qrImage = await QRCode.toBuffer(dadosBoleto.pixCopiaECola);
  doc.image(qrImage, 400, 200, { width: 100 });

  doc.end();

  return Buffer.concat(chunks);
}
```

## 📞 PERGUNTAS PARA SUPORTE INTER

1. **O endpoint `/cobranca/v3/cobrancas/{id}/pdf` está ativo em produção?**
2. **Existe alguma flag de conta para habilitar download de PDF?**
3. **O PDF é retornado em base64 dentro de um JSON?**
4. **Existe endpoint alternativo para download de PDF?**
5. **A conta precisa de permissão especial para PDFs?**

## 🚨 AÇÃO IMEDIATA NECESSÁRIA

1. **DEBUGAR OS 55KB**: Imprimir o conteúdo completo da resposta
2. **TESTAR COM POSTMAN**: Isolar o problema fora do código
3. **CONTATAR SUPORTE**: Com evidências específicas
4. **IMPLEMENTAR FALLBACK**: Gerar PDF localmente se necessário

## 💡 INSIGHTS FINAIS

O problema NÃO é:

- ❌ Autenticação (token válido)
- ❌ Certificados (mTLS funcionando)
- ❌ Rate limit (temos cota)
- ❌ Código do boleto (UUID válido)

O problema PODE SER:

- ⚠️ API retorna PDF em formato não documentado (base64 em JSON)
- ⚠️ Conta não tem permissão para PDFs
- ⚠️ Endpoint mudou mas ainda responde
- ⚠️ Header proprietário necessário

## 🎯 PRÓXIMOS PASSOS CRÍTICOS

1. **IMEDIATO**: Debug completo dos 55KB de resposta
2. **HOJE**: Teste isolado com Postman/curl
3. **AMANHÃ**: Contato com suporte técnico Inter
4. **FALLBACK**: Implementar geração local de PDF

---

**URGENTE**: Este documento deve ser usado junto com o SUPER_PROMPT_BANCO_INTER_PDF_COMPLETO.md para resolver o problema definitivamente.
