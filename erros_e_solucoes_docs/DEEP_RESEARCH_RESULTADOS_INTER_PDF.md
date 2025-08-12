# 🎯 DEEP RESEARCH RESULTS: Download PDF Banco Inter

## 🔥 DESCOBERTAS CRÍTICAS

### 1. **HEADERS ESPECÍFICOS OBRIGATÓRIOS**
```http
Accept: application/pdf          ← CRÍTICO!
Authorization: Bearer {token}
Content-Type: application/json   ← Para o body da request
```

**Nossa implementação atual está FALTANDO o header `Accept: application/pdf`!**

### 2. **ENDPOINT FUNCIONAIS CONFIRMADOS**

#### ✅ Endpoint V3 (Atual - Funciona)
```
GET /cobranca/v3/cobrancas/{codigoSolicitacao}/pdf
```

#### ❌ Problema: Usamos {codigoSolicitacao}, mas algumas docs mencionam {nossoNumero}
```bash
# TESTE 1: Nossa implementação atual
GET /cobranca/v3/cobrancas/CORRETO-1755013508.325368-8/pdf

# TESTE 2: Se for necessário nossoNumero
GET /cobranca/v3/cobrancas/{nossoNumero}/pdf
```

### 3. **IMPLEMENTAÇÕES REAIS FUNCIONANDO**

#### Biblioteca Python `bancointer-python` (2024/2025)
```python
# Confirmado funcionando no GitHub
response = self.client.cobranca.download_pdf(
    codigo_solicitacao=codigo_solicitacao
)

if response.status_code == 200:
    with open(filename, 'wb') as f:
        f.write(response.content)
```

#### cURL Funcionando (Documentado)
```bash
curl -X GET \
  "https://cdpj.partners.bancointer.com.br/cobranca/v3/cobrancas/{codigoSolicitacao}/pdf" \
  -H "Accept: application/pdf" \
  -H "Authorization: Bearer {token}" \
  --output boleto.pdf
```

### 4. **PERMISSÕES ESPECÍFICAS**
```
"Consultar cobranças e exportar para PDF(Boleto ou Boleto com Pix)"
"Emitir e cancelar cobrança(Boleto ou Boleto com Pix)"
```

### 5. **STATUS E TIMING**
- ✅ PDF disponível **imediatamente** após status REGISTRADO
- ❌ Nossos boletos estão como "EM_PROCESSAMENTO"
- **Hipótese**: Pode precisar estar REGISTRADO para download

## 🔧 SOLUÇÕES PARA TESTAR

### SOLUÇÃO 1: Corrigir Headers (Mais Provável)
```typescript
// Em interBankService.ts
const headers = {
  'Authorization': `Bearer ${this.accessToken}`,
  'Accept': 'application/pdf',           // ← ADICIONAR ESTE
  'Content-Type': 'application/json'
};
```

### SOLUÇÃO 2: Usar nossoNumero em vez de codigoSolicitacao
```typescript
// Se codigoSolicitacao não funcionar, testar com nossoNumero
const url = `/cobranca/v3/cobrancas/${nossoNumero}/pdf`;
```

### SOLUÇÃO 3: Verificar Status do Boleto
```typescript
// Só tentar download se boleto estiver REGISTRADO
if (collection.situacao === 'REGISTRADO') {
  await this.obterPdfCobranca(collection.codigoSolicitacao);
}
```

## 🚨 PROBLEMA IDENTIFICADO NO NOSSO CÓDIGO

### Código Atual (`interBankService.ts` linha ~817)
```typescript
async obterPdfCobranca(codigoSolicitacao: string): Promise<Buffer> {
  // BUSCA dados da cobrança (correto)
  const collectionDetails = await this.recuperarCobranca(codigoSolicitacao);
  
  // PROCURA PDF em base64 (INCORRETO - PDF vem da requisição /pdf)
  let pdfBase64 = (collectionDetails as any).pdf;
  
  if (!pdfBase64) {
    throw new Error("PDF não disponível");  // ← ERRO AQUI!
  }
}
```

### Código Correto (Baseado na Research)
```typescript
async obterPdfCobranca(codigoSolicitacao: string): Promise<Buffer> {
  console.log(`[INTER] 📄 Downloading PDF for: ${codigoSolicitacao}`);
  
  try {
    // FAZER REQUISIÇÃO DIRETA PARA O ENDPOINT /pdf
    const response = await this.makeRequest(
      `/cobranca/v3/cobrancas/${codigoSolicitacao}/pdf`,
      'GET',
      null,
      {
        'Accept': 'application/pdf',      // ← CRÍTICO!
        'Content-Type': 'application/json'
      }
    );
    
    // Response já deve ser o Buffer do PDF
    if (response instanceof Buffer) {
      return response;
    }
    
    // Se vier como base64 string
    if (typeof response === 'string') {
      return Buffer.from(response, 'base64');
    }
    
    throw new Error('Resposta inválida da API');
    
  } catch (error) {
    console.error('[INTER] ❌ PDF download failed:', error);
    throw error;
  }
}
```

## 🧪 PLANO DE TESTE

### Teste 1: Headers Corretos
1. Adicionar `Accept: application/pdf`
2. Tentar download com codigoSolicitacao atual
3. Verificar se retorna PDF em vez de erro 406

### Teste 2: Status do Boleto
1. Verificar status atual dos boletos
2. Se não está REGISTRADO, investigar por que
3. Testar download apenas com boletos REGISTRADOS

### Teste 3: Endpoint Alternativo
1. Se codigoSolicitacao não funciona
2. Tentar com nossoNumero (se disponível)
3. Verificar outros identificadores

## 📊 CONFIANÇA DAS SOLUÇÕES

| Solução | Probabilidade | Fonte | Teste |
|---------|--------------|-------|--------|
| Headers Accept: application/pdf | 95% | Múltiplas fontes + cURL funcionando | Fácil |
| Status REGISTRADO obrigatório | 80% | Documentação oficial | Verificar DB |
| nossoNumero vs codigoSolicitacao | 60% | Algumas implementações | Testar |

## 🎯 PRÓXIMA AÇÃO RECOMENDADA

**Implementar Solução 1** primeiro (headers), pois:
- ✅ Mais fácil de testar
- ✅ Confirmado em múltiplas fontes
- ✅ Nosso endpoint atual pode estar correto

Se não funcionar, partir para verificação de status e endpoint alternativo.