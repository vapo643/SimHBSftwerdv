# DIAGNÓSTICO PROFUNDO: Erro Persistente 400 - API v3 Banco Inter Cobrança

## CONTEXTO CRÍTICO

Estamos enfrentando um erro 400 persistente na API v3 do Banco Inter ao tentar criar uma cobrança (boleto). O erro NÃO está relacionado à autenticação OAuth2 (que está funcionando perfeitamente), mas sim à validação dos dados da cobrança.

### STATUS ATUAL
- ✅ OAuth2 mTLS: Funcionando (token obtido com sucesso, expiração 3600s)
- ✅ Certificados: Configurados corretamente  
- ❌ Criação de Cobrança: Erro 400 sem corpo de resposta

## PAYLOAD ENVIADO (EXATO)

```json
{
  "seuNumero": "902183dd-b5d1-4",
  "valorNominal": 1000,
  "dataVencimento": "2025-08-09",
  "numDiasAgenda": 30,
  "pagador": {
    "cpfCnpj": "20528464760",
    "tipoPessoa": "FISICA",
    "nome": "Gabriel de Jesus Santana Serri",
    "endereco": "Rua miguel angelo",
    "numero": "100",
    "bairro": "Centro",
    "cidade": "Serra",
    "uf": "ES",
    "cep": "29165460",
    "email": "gabrieldjesus238@gmail.com",
    "ddd": "27",
    "telefone": "998538565"
  }
}
```

## TENTATIVAS JÁ REALIZADAS (TODAS FALHARAM)

1. **Formatação de telefone**: Separação DDD/número
2. **Correção cidade/estado**: CEP 29165460 = Serra/ES (não São Paulo/SP)
3. **Remoção de acentos**: Todos os campos texto sem caracteres especiais
4. **Campo formasRecebimento**: Tentado adicionar mas não aparece no payload final

## INFORMAÇÕES TÉCNICAS

- **Endpoint**: `POST https://cdpj.partners.bancointer.com.br/cobranca/v3/cobrancas`
- **Headers**: 
  - `Authorization: Bearer [token válido]`
  - `Content-Type: application/json`
- **Certificado mTLS**: Configurado via undici.Agent
- **Resposta**: Status 400, corpo vazio (sem mensagem de erro)

## PERGUNTAS ESPECÍFICAS PARA PESQUISA

1. **Campos obrigatórios faltantes**: Quais são TODOS os campos obrigatórios para API v3 de cobrança do Banco Inter que não estão no payload acima?

2. **Estrutura do campo formasRecebimento**: Por que este campo não aparece no payload final? Qual a estrutura correta?

3. **Validações específicas**: 
   - O campo "seuNumero" tem alguma validação além do limite de 15 caracteres?
   - O formato da data está correto (YYYY-MM-DD)?
   - Existe alguma validação de valor mínimo/máximo?

4. **Diferenças entre API v2 e v3**: Quais campos mudaram entre as versões?

5. **Conta corrente obrigatória**: É necessário informar dados da conta corrente do beneficiário?

6. **Campos de mensagem**: Os campos de mensagem são obrigatórios ou opcionais?

7. **Validação de CEP**: A API valida se o CEP corresponde à cidade/estado informados?

8. **Encoding/Charset**: Existe algum requisito específico de encoding para os dados?

## NECESSIDADES URGENTES

1. **Exemplo completo funcional**: Um payload JSON completo que funcione na API v3
2. **Lista de erros comuns**: Códigos de erro 400 específicos e suas causas
3. **Documentação oficial atualizada**: Link para a documentação mais recente da API v3
4. **Validações não documentadas**: Regras de negócio que causam 400 mas não estão na documentação

## CONTEXTO ADICIONAL

- Sistema em produção na próxima semana
- Integração crítica para o fluxo de negócio
- Ambiente de produção do Banco Inter
- Usando Node.js com TypeScript
- Biblioteca undici para requisições HTTP com mTLS

## BUSCA DIRECIONADA

Por favor, procure por:
- "Banco Inter API v3 cobrança erro 400 campos obrigatórios"
- "Inter API v3 boleto payload completo exemplo"
- "Banco Inter cobrança v3 formasRecebimento estrutura"
- "Inter API error 400 empty response body"
- Fóruns de desenvolvedores com soluções reais implementadas
- Documentação oficial mais recente (2024/2025)

## IMPORTANTE

NÃO precisamos de informações sobre:
- Configuração de OAuth2 (já funciona)
- Geração de certificados (já temos)
- Erros de autenticação (não é o problema)
- API v2 (estamos usando v3)

Precisamos especificamente da estrutura EXATA e COMPLETA do payload para criação de cobrança na API v3.