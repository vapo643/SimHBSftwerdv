# 📋 API de Gestão de Contratos - Documentação Completa

## 🎯 Visão Geral

API RESTful para gerenciamento de contratos (CCBs assinados) com controle rigoroso de acesso baseado em roles. Desenvolvida especificamente para atender às necessidades de gestão administrativa e diretoria.

**Status:** ✅ IMPLEMENTADO E PRONTO PARA USO  
**Data de Implementação:** 08/08/2025  
**Acesso Restrito:** ADMINISTRADOR e DIRETOR apenas

---

## 🔐 Segurança e Controle de Acesso

### Roles Autorizados
- ✅ **ADMINISTRADOR** - Acesso completo a todos os contratos
- ✅ **DIRETOR** - Acesso completo a todos os contratos

### Roles Bloqueados (403 Forbidden)
- ❌ **GERENTE** - Sem acesso
- ❌ **ATENDENTE** - Sem acesso  
- ❌ **ANALISTA** - Sem acesso
- ❌ **FINANCEIRO** - Sem acesso

### Fluxo de Autenticação
1. Token JWT obrigatório no header `Authorization: Bearer {token}`
2. Validação do token via Supabase Auth
3. Verificação do role no banco de dados (profiles table)
4. Retorno 403 Forbidden se role não autorizado

---

## 📡 Endpoints Disponíveis

### 1. Listar Contratos
**GET** `/api/contratos`

Retorna lista de todos os contratos assinados com informações completas.

#### Query Parameters (opcionais):
```typescript
{
  status?: string;       // Filtrar por status específico
  lojaId?: string;      // Filtrar por loja
  dataInicio?: string;  // Data inicial (YYYY-MM-DD)
  dataFim?: string;     // Data final (YYYY-MM-DD)
  limite?: string;      // Número máximo de registros (padrão: 100)
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "contratos": [
    {
      "id": "6492cfeb-8b66-4fa7-beb6-c7998be61b78",
      "clienteNome": "João Silva Santos",
      "clienteCpf": "123.456.789-01",
      "tipoPessoa": "PF",
      "valor": "15000.00",
      "prazo": 12,
      "valorTotalFinanciado": "17050.00",
      "status": "contratos_assinados",
      "dataAssinatura": "2025-01-30T14:30:00Z",
      "ccbGerado": true,
      "assinaturaEletronicaConcluida": true,
      "urlCcbAssinado": "https://storage.url/ccb_assinado.pdf",
      "clicksignStatus": "signed",
      "lojaNome": "Loja Centro",
      "parceiroRazaoSocial": "Parceiro XYZ Ltda",
      "produtoNome": "Crédito Pessoal",
      "diasDesdeAssinatura": 8,
      "aguardandoPagamento": false,
      "statusFormalizacao": "CONCLUIDO"
    }
  ],
  "estatisticas": {
    "totalContratos": 45,
    "aguardandoPagamento": 5,
    "pagos": 40,
    "valorTotalContratado": 675000.00,
    "valorTotalLiberado": 600000.00
  },
  "filtrosAplicados": {
    "status": null,
    "lojaId": null,
    "dataInicio": null,
    "dataFim": null,
    "limite": 100
  }
}
```

#### Response (403 Forbidden - Role não autorizado):
```json
{
  "message": "Acesso negado. Permissões insuficientes.",
  "requiredRoles": ["ADMINISTRADOR", "DIRETOR"],
  "userRole": "GERENTE"
}
```

### 2. Buscar Contrato Específico
**GET** `/api/contratos/:id`

Retorna detalhes completos de um contrato específico incluindo histórico.

#### Response (200 OK):
```json
{
  "success": true,
  "contrato": {
    "propostas": {
      "id": "6492cfeb-8b66-4fa7-beb6-c7998be61b78",
      "clienteNome": "João Silva Santos",
      "...": "todos os campos da proposta"
    },
    "lojas": {
      "nomeLoja": "Loja Centro",
      "endereco": "Rua Principal, 123"
    },
    "parceiros": {
      "razaoSocial": "Parceiro XYZ Ltda",
      "cnpj": "12.345.678/0001-90"
    },
    "produtos": {
      "nomeProduto": "Crédito Pessoal"
    },
    "urlCcbAssinado": "https://storage.url/ccb_assinado.pdf",
    "urlCcbOriginal": "https://storage.url/ccb_original.pdf",
    "documentosAdicionais": [
      {
        "path": "docs/rg.pdf",
        "url": "https://storage.url/rg.pdf",
        "nome": "rg.pdf"
      }
    ],
    "historico": [
      {
        "id": 1,
        "acao": "CCB_GERADO",
        "descricao": "CCB gerado com sucesso",
        "createdAt": "2025-01-30T10:00:00Z"
      }
    ],
    "statusFormalizacao": "CONCLUIDO"
  }
}
```

---

## 🗄️ Estrutura de Dados

### Campos Principais Retornados

#### Dados do Cliente
- `clienteNome` - Nome completo
- `clienteCpf` - CPF formatado
- `clienteEmail` - Email
- `clienteTelefone` - Telefone
- `tipoPessoa` - PF ou PJ
- `clienteRazaoSocial` - Razão social (se PJ)
- `clienteCnpj` - CNPJ (se PJ)

#### Dados do Empréstimo
- `valor` - Valor principal
- `prazo` - Número de parcelas
- `valorTotalFinanciado` - Valor total com juros
- `valorLiquidoLiberado` - Valor líquido ao cliente
- `taxaJuros` - Taxa de juros mensal
- `valorTac` - Taxa de abertura
- `valorIof` - IOF

#### Status de Formalização
- `ccbGerado` - Se CCB foi gerado
- `ccbGeradoEm` - Data/hora de geração
- `assinaturaEletronicaConcluida` - Se foi assinado
- `dataAssinatura` - Data da assinatura
- `dataPagamento` - Data do pagamento

#### Integração ClickSign
- `clicksignDocumentKey` - Chave do documento
- `clicksignStatus` - Status (pending/signed/cancelled)
- `clicksignSignUrl` - URL para assinatura
- `clicksignSignedAt` - Data/hora da assinatura

#### URLs de Documentos
- `urlCcbAssinado` - URL do CCB assinado
- `urlComprovantePagamento` - URL do comprovante

#### Indicadores Calculados
- `diasDesdeAssinatura` - Dias desde a assinatura
- `aguardandoPagamento` - Boolean se aguarda pagamento
- `statusFormalizacao` - Status consolidado

### Status de Formalização Possíveis
- `PENDENTE_GERACAO` - CCB não gerado
- `AGUARDANDO_ASSINATURA` - CCB gerado mas não assinado
- `AGUARDANDO_PAGAMENTO` - Assinado mas não pago
- `CONCLUIDO` - Pago e concluído
- `EM_PROCESSAMENTO` - Estado intermediário

---

## 🧪 Testes

### Executar Testes Automatizados

```bash
# Instalar dependências (se necessário)
npm install axios

# Executar testes
npx tsx server/tests/test-gestao-contratos.ts
```

### Teste Manual via cURL

#### Teste 1: Acesso Autorizado (ADMIN)
```bash
curl -X GET "http://localhost:5000/api/contratos" \
  -H "Authorization: Bearer SEU_TOKEN_ADMIN" \
  -H "Content-Type: application/json"
```

#### Teste 2: Acesso Negado (GERENTE)
```bash
curl -X GET "http://localhost:5000/api/contratos" \
  -H "Authorization: Bearer SEU_TOKEN_GERENTE" \
  -H "Content-Type: application/json"
# Esperado: 403 Forbidden
```

#### Teste 3: Com Filtros
```bash
curl -X GET "http://localhost:5000/api/contratos?dataInicio=2025-01-01&dataFim=2025-01-31&limite=10" \
  -H "Authorization: Bearer SEU_TOKEN_DIRETOR" \
  -H "Content-Type: application/json"
```

---

## 🏗️ Arquitetura de Implementação

### Arquivos Criados
1. **`server/routes/gestao-contratos.ts`** - Implementação completa da API
2. **`server/tests/test-gestao-contratos.ts`** - Suite de testes automatizados
3. **`docs/GESTAO_CONTRATOS_API.md`** - Esta documentação

### Modificações em Arquivos Existentes
1. **`server/routes.ts`** - Adicionado import e registro da nova rota

### Tecnologias Utilizadas
- **Express.js** - Framework web
- **Drizzle ORM** - Acesso ao banco de dados
- **JWT** - Autenticação
- **Supabase** - Auth e Storage
- **TypeScript** - Type safety

### Segurança Implementada
- ✅ Autenticação JWT obrigatória
- ✅ Verificação de roles com guard específico
- ✅ Soft delete filtering
- ✅ Logs de auditoria para todos os acessos
- ✅ Tratamento de erros com diferentes níveis
- ✅ Validação de parâmetros de entrada

---

## 📊 Queries de Banco de Dados

### Query Principal (Simplificada)
```sql
SELECT 
  p.*,
  l.nome_loja,
  pa.razao_social,
  pr.nome_produto
FROM propostas p
LEFT JOIN lojas l ON p.loja_id = l.id
LEFT JOIN parceiros pa ON l.parceiro_id = pa.id
LEFT JOIN produtos pr ON p.produto_id = pr.id
WHERE 
  p.assinatura_eletronica_concluida = true
  AND p.caminho_ccb_assinado IS NOT NULL
  AND p.deleted_at IS NULL
ORDER BY p.data_assinatura DESC
LIMIT 100;
```

---

## 🚀 Próximos Passos

### Para Colocar em Produção

1. **Configurar Tokens JWT Reais**
   - Fazer login com usuários ADMIN e DIRETOR
   - Capturar tokens válidos
   - Usar nos testes

2. **Verificar Bucket Supabase**
   ```sql
   -- Verificar se bucket 'documents' existe
   SELECT * FROM storage.buckets WHERE id = 'documents';
   ```

3. **Criar Índices no Banco**
   ```sql
   -- Índices para performance
   CREATE INDEX idx_propostas_assinatura ON propostas(assinatura_eletronica_concluida);
   CREATE INDEX idx_propostas_data_assinatura ON propostas(data_assinatura);
   CREATE INDEX idx_propostas_deleted ON propostas(deleted_at);
   ```

4. **Configurar Logs de Auditoria**
   - Verificar tabela de logs de segurança
   - Configurar retenção de logs

5. **Monitoramento**
   - Adicionar métricas de uso
   - Alertas para acessos não autorizados
   - Dashboard de contratos

---

## 📝 Notas Importantes

1. **Performance**: Limite padrão de 100 registros para evitar sobrecarga
2. **Cache**: Considerar implementar cache Redis para queries frequentes
3. **Paginação**: Implementar paginação se volume de contratos crescer
4. **Backup**: URLs de documentos devem ter backup regular
5. **LGPD**: Dados sensíveis são retornados apenas para roles autorizados

---

## 🆘 Suporte

Para problemas ou dúvidas:
1. Verificar logs em `server/logs/security.log`
2. Testar com arquivo `test-gestao-contratos.ts`
3. Verificar roles no banco: `SELECT * FROM profiles WHERE role IN ('ADMINISTRADOR', 'DIRETOR');`

---

**Última Atualização:** 08/08/2025  
**Versão:** 1.0.0  
**Autor:** Sistema Simpix