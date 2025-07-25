# Migração T-01: Schema Foundation - COMPLETA ✓

## Data: 2025-01-25
## Status: Migração Já Aplicada

### 1. TABELA PRODUTOS - TAC Fields ✓

**Campos Adicionados:**
- `tac_valor` NUMERIC(10,2) DEFAULT 0 ✓
- `tac_tipo` TEXT DEFAULT 'fixo' CHECK IN ('fixo', 'percentual') ✓

### 2. TABELA PROPOSTAS - Normalização Completa ✓

**Relacionamentos de Negócio:**
- `produto_id` INTEGER FK → produtos(id) ✓
- `tabela_comercial_id` INTEGER FK → tabelas_comerciais(id) ✓

**Documentação do Cliente:**
- `cliente_rg` TEXT ✓
- `cliente_orgao_emissor` TEXT ✓
- `cliente_estado_civil` TEXT ✓
- `cliente_nacionalidade` TEXT DEFAULT 'Brasileira' ✓
- `cliente_cep` TEXT ✓
- `cliente_endereco` TEXT ✓
- `cliente_ocupacao` TEXT ✓

**Valores Financeiros Calculados:**
- `valor_tac` NUMERIC(10,2) ✓
- `valor_iof` NUMERIC(10,2) ✓
- `valor_total_financiado` NUMERIC(15,2) ✓

### 3. DRIZZLE SCHEMA ATUALIZADO ✓

O arquivo `shared/schema.ts` foi atualizado para refletir a estrutura atual do banco:
- Tabela `produtos` com campos TAC
- Tabela `propostas` com todos os campos normalizados
- Mantida compatibilidade com campos legados (cliente_data, condicoes_data)

### NOTA IMPORTANTE:
Esta migração já foi aplicada ao banco de dados. Este documento serve como registro histórico e documentação da arquitetura implementada para suportar a nova tela T-01 de originação de propostas.