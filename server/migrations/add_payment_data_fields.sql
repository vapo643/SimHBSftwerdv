-- Add payment data fields to propostas table
-- Created: August 5, 2025

ALTER TABLE propostas 
ADD COLUMN IF NOT EXISTS dados_pagamento_banco TEXT,
ADD COLUMN IF NOT EXISTS dados_pagamento_agencia TEXT,
ADD COLUMN IF NOT EXISTS dados_pagamento_conta TEXT,
ADD COLUMN IF NOT EXISTS dados_pagamento_tipo TEXT,
ADD COLUMN IF NOT EXISTS dados_pagamento_nome_titular TEXT,
ADD COLUMN IF NOT EXISTS dados_pagamento_cpf_titular TEXT,
ADD COLUMN IF NOT EXISTS dados_pagamento_pix TEXT;

-- Add comments for documentation
COMMENT ON COLUMN propostas.dados_pagamento_banco IS 'Banco de destino do pagamento do empréstimo';
COMMENT ON COLUMN propostas.dados_pagamento_agencia IS 'Agência bancária de destino';
COMMENT ON COLUMN propostas.dados_pagamento_conta IS 'Número da conta de destino';
COMMENT ON COLUMN propostas.dados_pagamento_tipo IS 'Tipo de conta: conta_corrente ou conta_poupanca';
COMMENT ON COLUMN propostas.dados_pagamento_nome_titular IS 'Nome do titular da conta de destino';
COMMENT ON COLUMN propostas.dados_pagamento_cpf_titular IS 'CPF do titular da conta de destino';
COMMENT ON COLUMN propostas.dados_pagamento_pix IS 'Chave PIX para pagamento (opcional)';