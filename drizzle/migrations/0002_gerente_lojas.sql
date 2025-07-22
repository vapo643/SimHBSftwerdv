-- =====================================================
-- MIGRAÇÃO: RELAÇÃO MUITOS-PARA-MUITOS GERENTES x LOJAS
-- =====================================================

-- 1. CRIAR TABELA DE JUNÇÃO
CREATE TABLE gerente_lojas (
  gerente_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  loja_id INTEGER NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (gerente_id, loja_id)
);

-- 2. CRIAR ÍNDICES PARA PERFORMANCE
CREATE INDEX idx_gerente_lojas_gerente_id ON gerente_lojas(gerente_id);
CREATE INDEX idx_gerente_lojas_loja_id ON gerente_lojas(loja_id);

-- 3. MIGRAR DADOS EXISTENTES (SE HOUVER)
INSERT INTO gerente_lojas (gerente_id, loja_id)
SELECT id, loja_id 
FROM users 
WHERE role = 'GERENTE' AND loja_id IS NOT NULL;

-- 4. REMOVER COLUNA ANTIGA
ALTER TABLE users DROP COLUMN loja_id;

-- 5. HABILITAR RLS NA NOVA TABELA
ALTER TABLE gerente_lojas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gerentes podem ver suas próprias associações de loja" ON gerente_lojas
  FOR SELECT USING (
    gerente_id = (
      SELECT id FROM users 
      WHERE email = (current_setting('app.current_user_email', true))
      LIMIT 1
    )
  );