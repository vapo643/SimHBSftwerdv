
-- =====================================================
-- MIGRAÇÃO: RELAÇÃO MUITOS-PARA-MUITOS GERENTES x LOJAS
-- =====================================================
-- Esta migração implementa a nova relação onde um gerente
-- pode estar associado a múltiplas lojas de múltiplos parceiros

-- ====================================
-- 1. CRIAR TABELA DE JUNÇÃO
-- ====================================

CREATE TABLE gerente_lojas (
  gerente_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  loja_id INTEGER NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (gerente_id, loja_id)
);

-- ====================================
-- 2. CRIAR ÍNDICES PARA PERFORMANCE
-- ====================================

CREATE INDEX idx_gerente_lojas_gerente_id ON gerente_lojas(gerente_id);
CREATE INDEX idx_gerente_lojas_loja_id ON gerente_lojas(loja_id);

-- ====================================
-- 3. MIGRAR DADOS EXISTENTES (SE HOUVER)
-- ====================================
-- Migrar dados de usuários com role GERENTE que já tenham loja_id definido

INSERT INTO gerente_lojas (gerente_id, loja_id)
SELECT id, loja_id 
FROM users 
WHERE role = 'GERENTE' AND loja_id IS NOT NULL;

-- ====================================
-- 4. REMOVER COLUNA ANTIGA
-- ====================================

ALTER TABLE users DROP COLUMN IF EXISTS loja_id;

-- ====================================
-- 5. HABILITAR RLS NA NOVA TABELA
-- ====================================

ALTER TABLE gerente_lojas ENABLE ROW LEVEL SECURITY;

-- Política para gerentes visualizarem suas próprias associações
CREATE POLICY "Gerentes can view their own store associations" ON gerente_lojas
  FOR SELECT USING (
    gerente_id = (
      SELECT id FROM users 
      WHERE email = (current_setting('app.current_user_email', true))
      LIMIT 1
    )
  );

-- Política para operações do sistema
CREATE POLICY "System can manage gerente_lojas associations" ON gerente_lojas
  FOR ALL USING (
    (current_setting('app.current_user_email', true)) = 'system@simpix.com'
    OR 
    EXISTS (
      SELECT 1 FROM users 
      WHERE email = (current_setting('app.current_user_email', true))
      AND role = 'admin'
    )
  );

-- ====================================
-- 6. COMENTÁRIOS E DOCUMENTAÇÃO
-- ====================================

COMMENT ON TABLE gerente_lojas IS 'Tabela de junção para relacionamento muitos-para-muitos entre gerentes e lojas';
COMMENT ON COLUMN gerente_lojas.gerente_id IS 'Referência para o usuário com perfil GERENTE';
COMMENT ON COLUMN gerente_lojas.loja_id IS 'Referência para a loja associada ao gerente';
