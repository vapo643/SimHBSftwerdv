# PROMPT PARA PERPLEXITY - DOCUMENTAÇÃO CLICKSIGN API V3

## Contexto
Preciso integrar a API v3 do ClickSign para upload de documentos em envelopes, mas estou enfrentando inconsistências na documentação dos campos obrigatórios.

## Pergunta para Perplexity

"Preciso das URLs oficiais e atualizadas da documentação do ClickSign API v3 para:

1. **Documentação oficial da API v3**: URL completa da documentação técnica do ClickSign API v3
2. **Endpoint de adição de documentos**: Documentação específica para POST /api/v3/envelopes/{envelope_id}/documents
3. **Campos obrigatórios para upload**: Quais campos exatos são necessários no body da requisição para adicionar um documento PDF a um envelope
4. **Formato do content**: Se deve ser 'content', 'content_base64', ou outro campo para o conteúdo do documento
5. **Headers obrigatórios**: Content-Type e outros headers necessários

Contexto técnico:
- Estou usando Node.js/TypeScript
- Endpoint: https://app.clicksign.com/api/v3
- Tentei content_base64, content, com e sem content_type
- API sempre retorna erro sobre campos em branco ou não informados

Preciso das URLs oficiais da documentação, não exemplos genéricos."

## URLs que preciso encontrar:
- [ ] Documentação oficial ClickSign API v3
- [ ] Referência de endpoints de envelopes
- [ ] Guia de integração para upload de documentos
- [ ] Exemplos de código para Node.js/JavaScript
- [ ] Changelog da API v3 vs v2