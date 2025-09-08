# PROMPT PARA GEMINI DEEP THINK - RESOLVER PROBLEMA DE VÍRUS NO DOWNLOAD DE PDF

## CONTEXTO CRÍTICO

Estamos enfrentando um problema onde o antivírus do Windows detecta vírus ao tentar baixar PDFs de boletos do banco Inter. O problema persiste mesmo após várias tentativas de correção.

## DIAGNÓSTICO ATUAL

### 1. Fluxo do Download

```
Frontend (React) → Backend (Express) → API Banco Inter → PDF Download
```

### 2. Logs de Erro Observados

```
[INTER] 📊 STATUS: 406 Not Acceptable
[INTER] 📋 Error as JSON: {
  "title": "Falha durante a execução da request.",
  "violacoes": [{
    "razao": "Specified Accept Types [application/pdf] not supported. Supported types: [application/problem+json, application/json]"
  }]
}
```

### 3. Comportamento Atual

- Quando o Inter retorna erro 406, um arquivo corrompido é baixado
- O antivírus detecta esse arquivo como vírus
- O usuário vê mensagem de "Vírus detectado"

## CÓDIGO ATUAL

### Backend - server/services/interBankService.ts

```typescript
async obterPdfCobranca(codigoSolicitacao: string): Promise<Buffer> {
  const response = await this.makeRequest(`/cobranca/v3/cobrancas/${codigoSolicitacao}/pdf`, 'GET');
  // Tenta converter para Buffer...
}
```

### Backend - server/routes/inter-collections.ts

```typescript
router.get('/:propostaId/:codigoSolicitacao/pdf', async (req, res) => {
  const pdfBuffer = await interService.obterPdfCobranca(codigoSolicitacao);
  res.setHeader('Content-Type', 'application/pdf');
  res.send(pdfBuffer);
});
```

### Frontend - client/src/lib/pdfDownloader.ts

```typescript
const response = await fetch(url, {
  headers: { Accept: 'application/pdf, */*' },
});
const blob = await response.blob();
// Cria link de download...
```

## ANÁLISE PROFUNDA NECESSÁRIA

### 1. Por que o antivírus detecta vírus?

- O arquivo baixado está corrompido/vazio?
- O tipo MIME está incorreto?
- Há algum problema com os headers HTTP?
- O blob está sendo criado incorretamente?

### 2. API do Banco Inter

- O endpoint `/pdf` realmente existe?
- Existe alternativa para obter o PDF?
- O PDF vem em base64 dentro do JSON da cobrança?
- Há documentação sobre download de PDF?

### 3. Soluções Possíveis

- Gerar PDF localmente com os dados do boleto?
- Usar biblioteca como jsPDF ou pdfkit?
- Buscar o PDF em outro campo da resposta?
- Implementar validação de conteúdo antes do download?

## REQUISITOS DA SOLUÇÃO

### DEVE:

1. Eliminar completamente a detecção de vírus
2. Permitir download seguro do boleto
3. Funcionar com a API atual do banco Inter
4. Manter a segurança do sistema

### NÃO DEVE:

1. Baixar arquivos corrompidos
2. Criar vulnerabilidades de segurança
3. Expor dados sensíveis
4. Quebrar funcionalidades existentes

## PERGUNTAS PARA ANÁLISE

1. **Arquitetura**: Deveríamos gerar o PDF localmente ao invés de baixar do banco?
2. **API**: Existe documentação oficial do Inter sobre download de PDF?
3. **Segurança**: Como validar que o conteúdo é realmente um PDF válido?
4. **Headers**: Quais headers HTTP são essenciais para download seguro?
5. **Alternativas**: Podemos mostrar o boleto em tela e oferecer print/screenshot?

## SOLUÇÃO ESPERADA

Preciso de uma solução que:

1. **Identifique** a causa raiz do problema do vírus
2. **Implemente** correções no código existente
3. **Valide** que o PDF é seguro antes do download
4. **Ofereça** alternativas caso o PDF não esteja disponível
5. **Garanta** que o antivírus não detecte mais vírus

## INFORMAÇÕES ADICIONAIS

- Sistema: Windows 10/11
- Antivírus: Windows Defender (padrão)
- Navegador: Chrome/Edge
- Framework: React + Express + TypeScript
- Banco Inter API: v3 de cobrança

Por favor, analise profundamente este problema e forneça uma solução completa e definitiva que elimine a detecção de vírus e permita o download seguro dos boletos.
