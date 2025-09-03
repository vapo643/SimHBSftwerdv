# CONTRATO DE DADOS - VISÃO DO ANALISTA

**Versão:** 1.0  
**Data:** 2025-09-03  
**PAM V2.5 - OPERAÇÃO VISÃO CLARA - Missão P2**

## RESUMO EXECUTIVO

Este documento define o contrato de dados oficial para toda a interface do analista, garantindo consistência e prevenindo regressões. Todos os campos listados foram validados tecnicamente e devem estar sempre disponíveis.

---

## 🔍 FILA DE ANÁLISE `/api/propostas?queue=analysis`

### Campos Obrigatórios
| Campo Frontend | Campo Backend | Origem Tabela | Status | Observações |
|----------------|---------------|---------------|--------|-------------|
| `cliente.nome` | `cliente_nome` | propostas | ✅ | Sempre presente |
| `cliente.cpf` | `cliente_cpf` | propostas | ✅ | Formatado no frontend como XXX.XXX.XXX-XX |
| `loja.nome` | `nome_loja` | lojas (JOIN) | ✅ | Corrigido em V1.0 - Join funcional |
| `valor` | `valor` | propostas | ✅ | Formatado como currency (R$ X.XXX,XX) |
| `status` | `status` | propostas | ✅ | Enum validado pelo FSM |

### Query de Validação
```sql
-- Esta query DEVE sempre funcionar
SELECT 
  p.id,
  p.cliente_nome,
  p.valor,
  p.status,
  l.nome_loja
FROM propostas p
LEFT JOIN lojas l ON p.loja_id = l.id
WHERE p.status IN ('aguardando_analise', 'em_analise', 'pendente')
  AND p.deleted_at IS NULL;
```

---

## 📊 DETALHE DA PROPOSTA `/api/propostas/:id`

### Seção: Dados Financeiros
| Campo Frontend | Campo Backend | Origem Tabela | Status | Observações |
|----------------|---------------|---------------|--------|-------------|
| `financeiros.tac` | `valor_tac` | propostas | ✅ | Corrigido em V1.0 |
| `financeiros.iof` | `valor_iof` | propostas | ✅ | Corrigido em V1.0 |
| `financeiros.valorTotal` | `valor_total_financiado` | propostas | ✅ | Corrigido em V1.0 |
| `financeiros.valor` | `valor` | propostas | ✅ | Valor principal solicitado |
| `financeiros.taxaJuros` | `taxa_juros` | propostas | ✅ | Taxa mensal aplicada |

### Seção: Dados do Cliente
| Campo Frontend | Campo Backend | Origem Tabela | Status | Observações |
|----------------|---------------|---------------|--------|-------------|
| `cliente.nome` | `cliente_nome` | propostas | ✅ | Nome completo |
| `cliente.cpf` | `cliente_cpf` | propostas | ✅ | CPF formatado |
| `cliente.renda` | `cliente_renda` | propostas | ✅ | Corrigido em V1.0 |
| `cliente.email` | `cliente_email` | propostas | ✅ | Email de contato |
| `cliente.telefone` | `cliente_telefone` | propostas | ✅ | Telefone de contato |

### Seção: Condições do Empréstimo
| Campo Frontend | Campo Backend | Origem Tabela | Status | Observações |
|----------------|---------------|---------------|--------|-------------|
| `condicoes.finalidade` | `finalidade` | propostas | ✅ | Fallback: "Não informado" |
| `condicoes.garantia` | `garantia` | propostas | ✅ | Fallback: "Não informado" |
| `condicoes.prazo` | `prazo` | propostas | ✅ | Prazo em meses |

### Seção: Informações da Loja
| Campo Frontend | Campo Backend | Origem Tabela | Status | Observações |
|----------------|---------------|---------------|--------|-------------|
| `loja.nome` | `nome_loja` | lojas (JOIN) | ✅ | Via loja_id |
| `loja.id` | `id` | lojas (JOIN) | ✅ | ID da loja parceira |

---

## 🚨 CAMPOS CRÍTICOS PARA OPERAÇÃO PENDENCIAR

### PAM V2.5 - Novos Campos Implementados
| Campo Frontend | Campo Backend | Origem Tabela | Status | Observações |
|----------------|---------------|---------------|--------|-------------|
| `analise.motivoPendencia` | `motivo_pendencia` | propostas | ✅ | Implementado em P0 |
| `analise.analistaId` | `analista_id` | propostas | ✅ | UUID do analista |
| `analise.dataAnalise` | `data_analise` | propostas | ✅ | Timestamp da análise |

---

## 🛡️ VALIDAÇÃO DE INTEGRIDADE

### Teste Automatizado Requerido
```typescript
// Este teste DEVE sempre passar
describe('Analyst Data Contract', () => {
  it('should return all required fields for analyst queue', async () => {
    const proposal = await getProposalForAnalysis();
    
    // Campos obrigatórios da fila
    expect(proposal).toHaveProperty('cliente.nome');
    expect(proposal).toHaveProperty('cliente.cpf');
    expect(proposal).toHaveProperty('loja.nome');
    expect(proposal).toHaveProperty('valor');
    expect(proposal).toHaveProperty('status');
    
    // Campos financeiros detalhados
    expect(proposal).toHaveProperty('financeiros.tac');
    expect(proposal).toHaveProperty('financeiros.iof');
    expect(proposal).toHaveProperty('financeiros.valorTotal');
  });
});
```

### Queries de Validação Contínua
```sql
-- Verificar se todas as propostas em análise têm dados completos
SELECT COUNT(*) as propostas_com_dados_incompletos
FROM propostas p
LEFT JOIN lojas l ON p.loja_id = l.id
WHERE p.status IN ('aguardando_analise', 'em_analise', 'pendente')
  AND p.deleted_at IS NULL
  AND (
    p.cliente_nome IS NULL OR
    p.cliente_cpf IS NULL OR
    p.valor IS NULL OR
    l.nome_loja IS NULL
  );
-- Resultado esperado: 0
```

---

## 📈 MÉTRICAS DE QUALIDADE

- **Taxa de Campos Presentes:** 100% para campos obrigatórios
- **Performance Join:** < 100ms para consulta com JOIN loja
- **Consistência de Dados:** 0 registros com campos NULL críticos

---

## 🔄 CHANGELOG

**V1.0 (2025-09-03) - PAM V2.5:**
- ✅ Corrigidos campos financeiros: TAC, IOF, Valor Total
- ✅ Corrigido campo Renda Mensal
- ✅ Corrigido JOIN com tabela lojas
- ✅ Implementado fluxo "Pendenciar" com novos campos
- ✅ Validação técnica completa via SQL

---

## ⚡ PRÓXIMOS PASSOS

1. **Implementar testes automatizados** para este contrato
2. **Monitoramento contínuo** das queries de validação
3. **Alertas automáticos** para campos NULL críticos
4. **Dashboard de qualidade** dos dados do analista

---

**Responsável:** Replit Agent  
**Aprovação:** PAM V2.5 Protocol  
**Revisão:** Necessária a cada mudança de schema