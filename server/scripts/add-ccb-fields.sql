-- =====================================================
-- Script para adicionar TODOS os campos faltantes do CCB
-- Data: 07/08/2025
-- =====================================================

-- =====================================================
-- PARTE 1: ADICIONAR CAMPOS NA TABELA PROPOSTAS
-- =====================================================

-- Campos do RG completos
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS cliente_rg_uf TEXT;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS cliente_rg_data_emissao TEXT;

-- Campos de endereço detalhado
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS cliente_logradouro TEXT;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS cliente_numero TEXT;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS cliente_complemento TEXT;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS cliente_bairro TEXT;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS cliente_cidade TEXT;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS cliente_uf TEXT;

-- Campos pessoais adicionais
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS cliente_local_nascimento TEXT;

-- Campos para PJ
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS tipo_pessoa TEXT DEFAULT 'PF';
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS cliente_razao_social TEXT;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS cliente_cnpj TEXT;

-- Valores calculados adicionais
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS valor_liquido_liberado DECIMAL(15,2);

-- Dados financeiros detalhados
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS juros_modalidade TEXT DEFAULT 'pre_fixado';
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS periodicidade_capitalizacao TEXT DEFAULT 'mensal';
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS taxa_juros_anual DECIMAL(5,2);
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS praca_pagamento TEXT DEFAULT 'São Paulo';
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS forma_pagamento TEXT DEFAULT 'boleto';
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS ano_base INTEGER DEFAULT 365;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS tarifa_ted DECIMAL(10,2) DEFAULT 10.00;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS taxa_credito DECIMAL(10,2);
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS data_liberacao TIMESTAMP;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS forma_liberacao TEXT DEFAULT 'deposito';
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS calculo_encargos TEXT;

-- Dados de pagamento PIX
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS dados_pagamento_codigo_banco TEXT;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS dados_pagamento_digito TEXT;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS dados_pagamento_pix_banco TEXT;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS dados_pagamento_pix_nome_titular TEXT;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS dados_pagamento_pix_cpf_titular TEXT;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS metodo_pagamento TEXT DEFAULT 'conta_bancaria';

-- =====================================================
-- PARTE 2: ADICIONAR CAMPOS NA TABELA PRODUTOS
-- =====================================================

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS modalidade_juros TEXT DEFAULT 'pre_fixado';
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS periodicidade_capitalizacao TEXT DEFAULT 'mensal';
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS ano_base INTEGER DEFAULT 365;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS tarifa_ted_padrao DECIMAL(10,2) DEFAULT 10.00;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS taxa_credito_padrao DECIMAL(10,2) DEFAULT 50.00;

-- =====================================================
-- PARTE 3: ADICIONAR CAMPOS NA TABELA TABELAS_COMERCIAIS
-- =====================================================

ALTER TABLE tabelas_comerciais ADD COLUMN IF NOT EXISTS taxa_juros_anual DECIMAL(5,2);
ALTER TABLE tabelas_comerciais ADD COLUMN IF NOT EXISTS calculo_encargos TEXT;
ALTER TABLE tabelas_comerciais ADD COLUMN IF NOT EXISTS cet_formula TEXT;

-- =====================================================
-- PARTE 4: CRIAR TABELA DE CONFIGURAÇÃO DA EMPRESA
-- =====================================================

CREATE TABLE IF NOT EXISTS configuracao_empresa (
  id SERIAL PRIMARY KEY,
  razao_social TEXT NOT NULL DEFAULT 'SIMPIX LTDA',
  cnpj TEXT NOT NULL DEFAULT '00.000.000/0001-00',
  endereco TEXT NOT NULL DEFAULT 'Av. Paulista, 1000',
  complemento TEXT DEFAULT '10º andar',
  bairro TEXT DEFAULT 'Bela Vista',
  cep TEXT NOT NULL DEFAULT '01310-100',
  cidade TEXT NOT NULL DEFAULT 'São Paulo',
  uf TEXT NOT NULL DEFAULT 'SP',
  telefone TEXT DEFAULT '(11) 3000-0000',
  email TEXT DEFAULT 'contato@simpix.com.br',
  praca_pagamento_padrao TEXT DEFAULT 'São Paulo',
  ano_base_padrao INTEGER DEFAULT 365,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Inserir dados padrão da empresa
INSERT INTO configuracao_empresa (id, razao_social, cnpj, endereco, complemento, bairro, cep, cidade, uf, telefone, email)
VALUES (1, 'SIMPIX LTDA', '00.000.000/0001-00', 'Av. Paulista, 1000', '10º andar', 'Bela Vista', '01310-100', 'São Paulo', 'SP', '(11) 3000-0000', 'contato@simpix.com.br')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- PARTE 5: ADICIONAR CAMPOS NA TABELA INTER_COLLECTIONS
-- =====================================================

ALTER TABLE inter_collections ADD COLUMN IF NOT EXISTS vencimento_primeira_parcela TEXT;
ALTER TABLE inter_collections ADD COLUMN IF NOT EXISTS vencimento_ultima_parcela TEXT;
ALTER TABLE inter_collections ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;

-- =====================================================
-- PARTE 6: CRIAR ÍNDICES PARA MELHOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_propostas_tipo_pessoa ON propostas(tipo_pessoa) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_propostas_metodo_pagamento ON propostas(metodo_pagamento) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_produtos_modalidade_juros ON produtos(modalidade_juros) WHERE deleted_at IS NULL;

-- =====================================================
-- PARTE 7: COMENTÁRIOS EXPLICATIVOS
-- =====================================================

COMMENT ON COLUMN propostas.tipo_pessoa IS 'Tipo de pessoa: PF (Pessoa Física) ou PJ (Pessoa Jurídica)';
COMMENT ON COLUMN propostas.cliente_razao_social IS 'Razão social quando for PJ';
COMMENT ON COLUMN propostas.cliente_cnpj IS 'CNPJ quando for PJ';
COMMENT ON COLUMN propostas.metodo_pagamento IS 'Método de pagamento escolhido: conta_bancaria ou pix';
COMMENT ON COLUMN propostas.juros_modalidade IS 'Modalidade de juros: pre_fixado ou pos_fixado';
COMMENT ON COLUMN propostas.periodicidade_capitalizacao IS 'Periodicidade de capitalização: mensal ou diaria';
COMMENT ON COLUMN propostas.forma_pagamento IS 'Como o cliente pagará: boleto, pix ou debito';
COMMENT ON COLUMN propostas.forma_liberacao IS 'Como o recurso será liberado: deposito, ted ou pix';

-- =====================================================
-- PARTE 8: VALIDAÇÃO
-- =====================================================

-- Verificar campos adicionados na tabela propostas
SELECT 
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'propostas'
    AND column_name IN (
        'cliente_rg_uf',
        'cliente_rg_data_emissao',
        'cliente_logradouro',
        'cliente_numero',
        'cliente_complemento',
        'cliente_bairro',
        'cliente_cidade',
        'cliente_uf',
        'cliente_local_nascimento',
        'tipo_pessoa',
        'cliente_razao_social',
        'cliente_cnpj',
        'valor_liquido_liberado',
        'juros_modalidade',
        'periodicidade_capitalizacao',
        'taxa_juros_anual',
        'praca_pagamento',
        'forma_pagamento',
        'metodo_pagamento'
    )
ORDER BY column_name;

-- Verificar se a tabela configuracao_empresa foi criada
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'configuracao_empresa'
) AS tabela_criada;

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================

-- Resultado esperado:
-- ✅ 30+ campos adicionados na tabela propostas
-- ✅ 5 campos adicionados na tabela produtos
-- ✅ 3 campos adicionados na tabela tabelas_comerciais
-- ✅ 1 nova tabela configuracao_empresa criada
-- ✅ 3 campos adicionados na tabela inter_collections
-- ✅ 3 índices criados para performance
-- ✅ Todos os campos do CCB agora mapeados no sistema