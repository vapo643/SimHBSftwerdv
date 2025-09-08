# 🔍 PROMPT DE DEEP RESEARCH: Download de PDF Boletos Banco Inter

## CONTEXTO CRÍTICO

Estou desenvolvendo integração com API do Banco Inter v3 para download de PDFs de boletos. A documentação oficial menciona o endpoint mas retorna erro 406. O cliente confirma que **a API está liberada para download de PDFs na conta dele**.

## PROBLEMA ESPECÍFICO

```
Endpoint atual: GET /cobranca/v3/cobrancas/{codigoSolicitacao}/pdf
Resultado: HTTP 406 "Not Acceptable"
Erro do banco: "pdf costumization, arquivo não esta disponivel no SITE"
```

## DEEP RESEARCH REQUEST

Por favor, pesquise EXAUSTIVAMENTE as seguintes possibilidades:

### 1. **HEADERS ESPECÍFICOS NECESSÁRIOS**

- Quais headers HTTP são obrigatórios para download de PDF?
- `Accept: application/pdf` vs `Accept: */*`
- Headers customizados do Inter (`x-inter-*`)
- Content-Type esperado na requisição

### 2. **ENDPOINT CORRETO E VARIAÇÕES**

- Existe diferença entre `/pdf` vs `/arquivo` vs `/documento`?
- API v2 vs v3: qual versão realmente suporta PDF?
- URLs completas funcionais documentadas em fóruns/GitHub

### 3. **PERMISSÕES E ESCOPO OAUTH**

- Escopos OAuth além de `boleto-cobranca.read`
- Permissões específicas para download de arquivos
- Configuração necessária no Internet Banking Inter

### 4. **STATUS DO BOLETO OBRIGATÓRIO**

- Boleto precisa estar em status específico? (REGISTRADO, ATIVO, etc.)
- Tempo mínimo após geração para PDF estar disponível
- Workflow correto: gerar → aguardar → baixar

### 5. **IMPLEMENTAÇÕES REAIS FUNCIONANDO**

- Repositórios GitHub com download funcionando
- Bibliotecas (PHP, Python, Node.js) que fazem download
- Casos de sucesso documentados em fóruns

### 6. **PARÂMETROS ADICIONAIS**

- Query parameters obrigatórios (`?formato=pdf`, `?versao=`, etc.)
- Path parameters além do codigoSolicitacao
- Configurações de conta necessárias

### 7. **TROUBLESHOOTING AVANÇADO**

- Como resolver erro 406 especificamente
- Rate limiting específico para downloads
- Logs detalhados de chamadas que funcionam

### 8. **ALTERNATIVAS DOCUMENTADAS**

- Webhook que entrega PDF automaticamente
- Endpoint de listagem que inclui PDF em base64
- API Banking (não cobrança) que tenha PDFs

## FORMATO DE RESPOSTA ESPERADO

Para cada descoberta, forneça:

```
SOLUÇÃO: [Título da solução]
MÉTODO: [GET/POST com headers exatos]
URL: [URL completa]
HEADERS: [Headers obrigatórios]
EXEMPLO: [Código funcional ou curl]
FONTE: [Link da documentação/fórum]
STATUS: [Testado/Não testado/Confirmado funcionando]
```

## PRIORIDADE MÁXIMA

1. **Headers específicos** que fazem diferença
2. **Implementações reais funcionando** (GitHub, fóruns)
3. **Diferenças entre API v2/v3** para PDF
4. **Configurações de conta** necessárias

## INFORMAÇÕES ADICIONAIS

- Ambiente: Produção (não sandbox)
- Conta PJ Inter ativa com API habilitada
- Certificados e credenciais funcionando (outros endpoints OK)
- Boletos sendo gerados com sucesso

**OBJETIVO**: Encontrar a combinação exata de endpoint + headers + parâmetros que permite download real do PDF oficial do Banco Inter.
