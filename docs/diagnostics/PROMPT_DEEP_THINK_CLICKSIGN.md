# PROMPT PARA GEM DEEP THINK - CLICKSIGN API V3 INTEGRATION

## Contexto Técnico Completo

### Problema Principal

Integração da API v3 do ClickSign para upload de documentos PDF em envelopes está falhando com mensagens de erro inconsistentes sobre campos obrigatórios.

### Stack Tecnológico

- Node.js + TypeScript
- Express.js backend
- Supabase para storage de PDFs
- ClickSign API v3 (produção)

### Erros Observados

1. **Erro 1**: `content_base64 deve ser informado(a)` (quando uso campo `content`)
2. **Erro 2**: `content - não pode ficar em branco` (quando uso campo `content_base64`)
3. **Erro 3**: `MimeType não informado no campo content_base64` (em tentativas anteriores)

### Código Atual

```typescript
// Interface
interface DocumentData {
  content?: string;
  filename?: string;
  content_type?: string;
  template_id?: string;
}

// Request Body
const requestBody = {
  data: {
    type: 'documents',
    attributes: {
      content: base64Content,
      filename: `ccb_proposta_${proposalId}.pdf`,
      content_type: 'application/pdf'
    }
  }
};

// Headers
{
  'Content-Type': 'application/vnd.api+json',
  'Accept': 'application/vnd.api+json',
  'Authorization': 'Bearer token...'
}
```

### Fluxo de Processo

1. Criar envelope (✅ FUNCIONANDO)
2. Adicionar documento ao envelope (❌ FALHANDO)
3. Adicionar signatário (não testado ainda)
4. Enviar para assinatura (não testado ainda)

### Tentativas Realizadas

- [x] content_base64 + filename
- [x] content + filename
- [x] content + filename + content_type
- [x] Remoção do campo type
- [x] Base64 com prefixo data:application/pdf;base64,
- [x] Base64 puro (sem prefixo)

### Documentos de Referência Disponíveis

- Endpoints da API v3 fornecidos pelo usuário
- Logs detalhados de requests/responses
- Código de exemplo de tentativas anteriores

### Pergunta para Deep Analysis

**Como resolver definitivamente a integração do ClickSign API v3 para upload de documentos, considerando:**

1. **Análise dos erros**: Por que a API retorna mensagens contraditórias sobre campos obrigatórios?

2. **Estrutura correta do payload**: Qual deve ser exatamente a estrutura JSON para adicionar documentos?

3. **Campos obrigatórios vs opcionais**: Quais campos são realmente necessários vs documentação incompleta?

4. **Versionamento da API**: Existe diferença entre a documentação online e a implementação real da v3?

5. **Debugging estratégico**: Qual sequência de testes deveria realizar para identificar o formato correto?

6. **Alternativas de implementação**: Existem outras abordagens para esta integração que poderiam funcionar melhor?

**Meta-pergunta**: Como abordar sistematicamente problemas de integração de API quando a documentação oficial parece inconsistente com o comportamento real da API?

### Resultado Esperado

Estratégia clara e testável para resolver a integração, baseada em análise lógica dos padrões de erro e melhores práticas de debugging de APIs.
