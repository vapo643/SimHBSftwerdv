-- MISSÃO DE FUNDAÇÃO: Migração de Schema para T-01
-- Data: 2025-01-25
-- Descrição: Preparar as tabelas produtos e propostas para a nova arquitetura da tela de originação

-- =====================================================
-- 1. ADICIONAR CAMPOS DE TAC À TABELA PRODUTOS
-- =====================================================

-- Adicionar campo para valor da TAC
ALTER TABLE produtos 
ADD COLUMN tac_valor NUMERIC(10,2) DEFAULT 0;

-- Adicionar campo para tipo de TAC com restrição CHECK
ALTER TABLE produtos 
ADD COLUMN tac_tipo TEXT DEFAULT 'fixo' 
CHECK (tac_tipo IN ('fixo', 'percentual'));

-- Comentários para documentação
COMMENT ON COLUMN produtos.tac_valor IS 'Valor da Taxa de Abertura de Crédito (TAC) - pode ser valor fixo ou percentual';
COMMENT ON COLUMN produtos.tac_tipo IS 'Tipo de cobrança da TAC: fixo (valor em reais) ou percentual (sobre o valor do empréstimo)';

-- =====================================================
-- 2. NORMALIZAR A TABELA PROPOSTAS
-- =====================================================

-- Adicionar relacionamento com produto
ALTER TABLE propostas 
ADD COLUMN produto_id INTEGER REFERENCES produtos(id);

-- Adicionar relacionamento com tabela comercial
ALTER TABLE propostas 
ADD COLUMN tabela_comercial_id INTEGER REFERENCES tabelas_comerciais(id);

-- Adicionar campos de documentação do cliente
ALTER TABLE propostas 
ADD COLUMN cliente_rg TEXT,
ADD COLUMN cliente_orgao_emissor TEXT,
ADD COLUMN cliente_estado_civil TEXT,
ADD COLUMN cliente_nacionalidade TEXT;

-- Adicionar campos de endereço do cliente
ALTER TABLE propostas 
ADD COLUMN cliente_cep TEXT,
ADD COLUMN cliente_endereco TEXT,
ADD COLUMN cliente_ocupacao TEXT;

-- Adicionar campos financeiros calculados
ALTER TABLE propostas 
ADD COLUMN valor_tac NUMERIC(10,2),
ADD COLUMN valor_iof NUMERIC(10,2),
ADD COLUMN valor_total_financiado NUMERIC(15,2);

-- Criar índices para melhorar performance
CREATE INDEX idx_propostas_produto_id ON propostas(produto_id);
CREATE INDEX idx_propostas_tabela_comercial_id ON propostas(tabela_comercial_id);
CREATE INDEX idx_propostas_cliente_cpf ON propostas(cliente_cpf);

-- Comentários para documentação
COMMENT ON COLUMN propostas.produto_id IS 'Referência ao produto de crédito selecionado';
COMMENT ON COLUMN propostas.tabela_comercial_id IS 'Referência à tabela comercial aplicada';
COMMENT ON COLUMN propostas.cliente_rg IS 'Número do RG do cliente';
COMMENT ON COLUMN propostas.cliente_orgao_emissor IS 'Órgão emissor do RG';
COMMENT ON COLUMN propostas.cliente_estado_civil IS 'Estado civil do cliente';
COMMENT ON COLUMN propostas.cliente_nacionalidade IS 'Nacionalidade do cliente';
COMMENT ON COLUMN propostas.cliente_cep IS 'CEP do endereço do cliente';
COMMENT ON COLUMN propostas.cliente_endereco IS 'Endereço completo do cliente';
COMMENT ON COLUMN propostas.cliente_ocupacao IS 'Ocupação/profissão do cliente';
COMMENT ON COLUMN propostas.valor_tac IS 'Valor calculado da TAC para esta proposta';
COMMENT ON COLUMN propostas.valor_iof IS 'Valor calculado do IOF para esta proposta';
COMMENT ON COLUMN propostas.valor_total_financiado IS 'Valor total financiado incluindo taxas e impostos';

-- =====================================================
-- 3. VALIDAÇÃO E ROLLBACK (SE NECESSÁRIO)
-- =====================================================

-- Script de validação (executar após migração)
/*
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('produtos', 'propostas')
AND column_name IN (
    'tac_valor', 'tac_tipo', 'produto_id', 'tabela_comercial_id',
    'cliente_rg', 'cliente_orgao_emissor', 'cliente_estado_civil',
    'cliente_nacionalidade', 'cliente_cep', 'cliente_endereco',
    'cliente_ocupacao', 'valor_tac', 'valor_iof', 'valor_total_financiado'
)
ORDER BY table_name, ordinal_position;
*/

-- Script de rollback (em caso de erro)
/*
-- Rollback produtos
ALTER TABLE produtos DROP COLUMN IF EXISTS tac_valor;
ALTER TABLE produtos DROP COLUMN IF EXISTS tac_tipo;

-- Rollback propostas
ALTER TABLE propostas DROP COLUMN IF EXISTS produto_id;
ALTER TABLE propostas DROP COLUMN IF EXISTS tabela_comercial_id;
ALTER TABLE propostas DROP COLUMN IF EXISTS cliente_rg;
ALTER TABLE propostas DROP COLUMN IF EXISTS cliente_orgao_emissor;
ALTER TABLE propostas DROP COLUMN IF EXISTS cliente_estado_civil;
ALTER TABLE propostas DROP COLUMN IF EXISTS cliente_nacionalidade;
ALTER TABLE propostas DROP COLUMN IF EXISTS cliente_cep;
ALTER TABLE propostas DROP COLUMN IF EXISTS cliente_endereco;
ALTER TABLE propostas DROP COLUMN IF EXISTS cliente_ocupacao;
ALTER TABLE propostas DROP COLUMN IF EXISTS valor_tac;
ALTER TABLE propostas DROP COLUMN IF EXISTS valor_iof;
ALTER TABLE propostas DROP COLUMN IF EXISTS valor_total_financiado;

-- Drop índices
DROP INDEX IF EXISTS idx_propostas_produto_id;
DROP INDEX IF EXISTS idx_propostas_tabela_comercial_id;
DROP INDEX IF EXISTS idx_propostas_cliente_cpf;
*/