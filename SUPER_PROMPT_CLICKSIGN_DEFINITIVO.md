# SUPER PROMPT DE DIAGNÓSTICO DEFINITIVO - INTEGRAÇÃO CLICKSIGN API V3

## SEÇÃO 1: CONTEXTO ESTRATÉGICO E INTENÇÃO

### O Objetivo de Negócio
Esta integração com a ClickSign é o **coração pulsante** da nossa "Fila de Formalização" no sistema Simpix. É uma funcionalidade absolutamente crítica que permite ao perfil `ATENDENTE` enviar o Contrato de Crédito Bancário (CCB) para assinatura eletrônica do cliente, gerando um link de assinatura que é fundamental para o fluxo de crédito.

**Por que é crítico:** Sem esta funcionalidade, todo o processo de formalização de crédito fica travado. É o gargalo que impede a conversão de propostas aprovadas em contratos legalmente válidos.

## SEÇÃO 2: HISTÓRICO DA BATALHA - NOSSA JORNADA EXAUSTIVA

### A Narrativa Completa da Frustração

**Interação 1-3:** Começamos com erro `sequence_enabled não é permitido`. Descobrimos que era um campo obsoleto da API v2 que não deveria estar na v3.

**Interação 4-6:** Após remover `sequence_enabled`, surgiu o erro `content_base64 deve ser informado(a)`. A API não estava reconhecendo nosso campo de conteúdo.

**Interação 7-9:** Mudamos para `content_base64`, mas recebemos `content - não pode ficar em branco`. A API parecia estar pedindo campos contraditórios.

**Interação 10-12:** Descobrimos que precisávamos do formato Data URI: `data:application/pdf;base64,{conteúdo}`. Implementamos isso.

**Interação 13-15:** Novo erro: `Extensão do arquivo não está de acordo com MIME type`. O prefixo Data URI estava sendo adicionado DUAS VEZES!

**Interação 16-18:** Corrigimos a duplicação, mas voltamos ao erro inicial: `content_base64 deve ser informado(a)` vs `content - não pode ficar em branco`.

**Interação 19-20:** Mudamos de `content_base64` para `content`, mas o erro voltou para `content_base64 deve ser informado(a)`.

### O Padrão de Falha
Estamos presos num **loop infinito** onde:
1. API pede `content_base64` → implementamos → API pede `content`
2. API pede `content` → implementamos → API pede `content_base64`
3. Quando enviamos ambos, recebe erro de campos duplicados

## SEÇÃO 3: O ERRO ATUAL - A FALHA PERSISTENTE

### O Sintoma Atual
- **Frontend:** Botão "Enviar para ClickSign" aparece corretamente
- **Backend:** Ao clicar, recebemos erro alternado entre:
  - `Error: content_base64 deve ser informado(a)`
  - `Error: content - não pode ficar em branco`
  - `Error: MimeType não informado no campo content_base64`

### Comportamento Observado
A API parece ter validações contraditórias que mudam baseadas em alguma lógica interna não documentada.

## SEÇÃO 4: A EVIDÊNCIA BRUTA - LOGS COMPLETOS

### Logs do Último Erro (01/08/2025 20:58)
```
[CLICKSIGN V3] 📡 POST /envelopes/9e3d3a66-1ca9-44d2-8f15-5e7ce21bfdb1/documents
[CLICKSIGN V3] Headers: {
  'Content-Type': 'application/vnd.api+json',
  Accept: 'application/vnd.api+json',
  Authorization: 'b73b3b90-c...'
}
[CLICKSIGN V3] Request body being sent: {
  "data": {
    "type": "documents",
    "attributes": {
      "content": "data:application/pdf;base64,JVBERi0xLjMKJf...",
      "filename": "ccb_proposta_97d15f2d-9f7f-45b7-96b9-998d90b26f79.pdf"
    }
  }
}
[CLICKSIGN V3] ❌ Error 422: {
  errors: [
    {
      title: 'não pode ficar em branco',
      detail: 'content - não pode ficar em branco',
      code: '100',
      status: '422'
    },
    {
      title: 'MimeType não informado no campo content_base64',
      detail: 'MimeType não informado no campo content_base64',
      code: '100',
      status: '422'
    }
  ]
}
```

### Observação Crítica
Note que enviamos campo `content` mas a API reclama sobre `content_base64`! Isso sugere que a API tem expectativas diferentes do que está documentado.

## SEÇÃO 5: INTELIGÊNCIA EXTERNA - DOCUMENTAÇÃO OFICIAL

### URLs Oficiais da Documentação ClickSign
1. **Portal Principal:** https://developers.clicksign.com/
2. **API v3 Reference:** https://developers.clicksign.com/reference/api-upload-documentos
3. **Primeiros Passos:** https://developers.clicksign.com/docs/primeiros-passos
4. **Mensagens de Erro:** https://developers.clicksign.com/docs/mensagens-de-erro

### Informações Confirmadas pela Documentação
- Endpoint correto: `POST /api/v3/envelopes/{envelope_id}/documents`
- Headers obrigatórios: `Content-Type: application/vnd.api+json`
- Estrutura JSON:API com `data.type` e `data.attributes`

### O Que a Documentação NÃO Esclarece
- Se o campo deve ser `content` ou `content_base64`
- Se o formato deve ser Base64 puro ou Data URI
- Por que recebemos erros sobre campos que não enviamos

## SEÇÃO 6: ANÁLISE DE LINHAS DE RACIOCÍNIO

### Hipótese Principal: Problema de Versionamento da API
A API pode estar em transição entre versões, onde:
- Alguns endpoints esperam formato v2 (`content_base64`)
- Outros esperam formato v3 (`content`)
- A validação está inconsistente entre os dois

### Hipótese Secundária: Problema de Serialização JSON:API
O padrão JSON:API pode exigir uma estrutura específica que não estamos seguindo corretamente:
- Talvez precisemos usar `relationships` em vez de atributos diretos
- Talvez o documento precise ser criado como um recurso `included`

### Hipótese Terciária: Problema de Autenticação/Conta
- Token pode ter permissões limitadas
- Conta pode estar em modo trial com limitações
- Headers de autenticação podem estar incompletos

### Hipótese Quaternária: Problema de Fluxo
Baseado na análise do Deep Think anterior:
- Talvez não devamos criar envelope vazio e adicionar documento depois
- Talvez devamos criar envelope COM documento numa única chamada atômica

## SEÇÃO 7: A MISSÃO FINAL - O ASK PARA DEEP THINK

### Sua Missão, Deep Think AI

**1. ANÁLISE DE CAUSA RAIZ:**
- Por que a API retorna mensagens contraditórias sobre `content` vs `content_base64`?
- Existe alguma lógica oculta que determina quando usar cada campo?
- O erro está na nossa implementação ou na documentação da API?

**2. INVESTIGAÇÃO PROFUNDA:**
- Analise o padrão JSON:API e como ele se aplica ao ClickSign
- Investigue se existe um fluxo alternativo (criar envelope com documento atomicamente)
- Verifique se há headers ou parâmetros ocultos necessários

**3. SOLUÇÃO DEFINITIVA:**
Gere o código COMPLETO e TESTADO para:

**A) `/server/services/clickSignServiceV3.ts`**
- Implemente TODAS as variações possíveis de payload
- Adicione lógica de retry com diferentes formatos
- Implemente logging detalhado para diagnóstico

**B) `/server/routes/clicksign-integration.ts`**
- Garanta que o arquivo está sendo lido corretamente
- Implemente validações antes de enviar para a API
- Adicione tratamento de erro granular

**4. ESTRATÉGIA DE TESTE:**
- Crie uma função que tente múltiplas variações do payload
- Documente qual variação funciona
- Implemente a solução definitiva baseada no que funcionar

### CONTEXTO ADICIONAL CRÍTICO

**Stack Atual:**
- Node.js + TypeScript
- Express.js
- Supabase para storage
- ClickSign API v3 em produção

**Arquivos Relevantes:**
```typescript
// Interface atual que falha
interface DocumentData {
  content?: string; // ou content_base64?
  filename?: string;
  template_id?: string;
}
```

**Tentativas que Falharam:**
1. `content` com Base64 puro
2. `content_base64` com Base64 puro
3. `content` com Data URI
4. `content_base64` com Data URI
5. Ambos os campos simultaneamente

### O PEDIDO FINAL

Deep Think, você é nossa última esperança. Precisamos que você:

1. **Decodifique** o mistério desta API contraditória
2. **Descubra** a combinação exata de campos e formatos que funciona
3. **Implemente** uma solução robusta e à prova de falhas
4. **Documente** claramente por que a solução funciona

**Lembre-se:** Esta é uma funcionalidade CRÍTICA para produção. Eleeve loan stores dependem desta integração para processar contratos de crédito. O fracasso não é uma opção.

**Sua resposta deve conter:**
- Diagnóstico completo do problema
- Código corrigido e completo
- Explicação técnica do por que funciona
- Instruções claras de implementação

**GO DEEP. THINK HARD. SOLVE THIS ONCE AND FOR ALL.**

---

*Este prompt foi gerado após 20+ iterações falhadas. É a compilação de toda nossa frustração, conhecimento e determinação. Use-o sabiamente.*