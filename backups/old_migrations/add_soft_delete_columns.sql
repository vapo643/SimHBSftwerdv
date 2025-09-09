-- SOFT DELETE IMPLEMENTATION - CRITICAL COMPLIANCE REQUIREMENT
-- Date: 2025-01-31
-- Purpose: Add soft delete columns to all tables for financial compliance

-- 1. Add deleted_at columns to all tables that don't have them
ALTER TABLE parceiros ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE tabelas_comerciais ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE produto_tabela_comercial ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE comunicacao_logs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE proposta_logs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE proposta_documentos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;

-- 2. Create audit log table for tracking all delete operations
CREATE TABLE IF NOT EXISTS audit_delete_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  deleted_by UUID NOT NULL REFERENCES profiles(id),
  deleted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deletion_reason TEXT,
  record_data JSONB NOT NULL, -- Store complete record before deletion
  ip_address INET,
  user_agent TEXT,
  restored_at TIMESTAMP,
  restored_by UUID REFERENCES profiles(id)
);

-- 3. Create indexes for performance
CREATE INDEX idx_parceiros_deleted_at ON parceiros(deleted_at);
CREATE INDEX idx_produtos_deleted_at ON produtos(deleted_at);
CREATE INDEX idx_tabelas_comerciais_deleted_at ON tabelas_comerciais(deleted_at);
CREATE INDEX idx_propostas_deleted_at ON propostas(deleted_at);
CREATE INDEX idx_profiles_deleted_at ON profiles(deleted_at);
CREATE INDEX idx_audit_delete_log_table_record ON audit_delete_log(table_name, record_id);
CREATE INDEX idx_audit_delete_log_deleted_at ON audit_delete_log(deleted_at);

-- 4. Create views for active records (excluding soft-deleted)
CREATE OR REPLACE VIEW active_parceiros AS
  SELECT * FROM parceiros WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW active_produtos AS
  SELECT * FROM produtos WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW active_tabelas_comerciais AS
  SELECT * FROM tabelas_comerciais WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW active_propostas AS
  SELECT * FROM propostas WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW active_profiles AS
  SELECT * FROM profiles WHERE deleted_at IS NULL;

-- 5. Create function to audit soft deletes
CREATE OR REPLACE FUNCTION audit_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if this is actually a soft delete (deleted_at changed from NULL to a value)
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    INSERT INTO audit_delete_log (
      table_name,
      record_id,
      deleted_by,
      deleted_at,
      record_data
    ) VALUES (
      TG_TABLE_NAME,
      OLD.id::TEXT,
      current_setting('app.current_user_id')::UUID,
      NEW.deleted_at,
      to_jsonb(OLD)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create triggers for audit logging
CREATE TRIGGER audit_parceiros_soft_delete
  AFTER UPDATE OF deleted_at ON parceiros
  FOR EACH ROW EXECUTE FUNCTION audit_soft_delete();

CREATE TRIGGER audit_produtos_soft_delete
  AFTER UPDATE OF deleted_at ON produtos
  FOR EACH ROW EXECUTE FUNCTION audit_soft_delete();

CREATE TRIGGER audit_tabelas_comerciais_soft_delete
  AFTER UPDATE OF deleted_at ON tabelas_comerciais
  FOR EACH ROW EXECUTE FUNCTION audit_soft_delete();

CREATE TRIGGER audit_propostas_soft_delete
  AFTER UPDATE OF deleted_at ON propostas
  FOR EACH ROW EXECUTE FUNCTION audit_soft_delete();

CREATE TRIGGER audit_profiles_soft_delete
  AFTER UPDATE OF deleted_at ON profiles
  FOR EACH ROW EXECUTE FUNCTION audit_soft_delete();

-- 7. Update RLS policies to exclude soft-deleted records
-- Parceiros
DROP POLICY IF EXISTS "parceiros_select_policy" ON parceiros;
CREATE POLICY "parceiros_select_policy" ON parceiros
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL AND (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'ADMINISTRADOR'
    )
  ));

-- Produtos
DROP POLICY IF EXISTS "produtos_select_policy" ON produtos;
CREATE POLICY "produtos_select_policy" ON produtos
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Tabelas Comerciais
DROP POLICY IF EXISTS "tabelas_comerciais_select_policy" ON tabelas_comerciais;
CREATE POLICY "tabelas_comerciais_select_policy" ON tabelas_comerciais
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Propostas
DROP POLICY IF EXISTS "propostas_select_by_store" ON propostas;
CREATE POLICY "propostas_select_by_store" ON propostas
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL AND loja_id IN (
    SELECT COALESCE(
      CASE 
        WHEN p.role = 'ADMINISTRADOR' THEN l.id
        WHEN p.role = 'GERENTE' THEN gl.loja_id
        WHEN p.role IN ('ATENDENTE', 'ANALISTA', 'FINANCEIRO') THEN l.id
        ELSE NULL
      END
    )
    FROM profiles p
    LEFT JOIN lojas l ON p.loja_id = l.id
    LEFT JOIN gerente_lojas gl ON p.id::integer = gl.gerente_id
    WHERE p.id = auth.uid()
  ));

-- Comentário sobre conformidade
COMMENT ON TABLE audit_delete_log IS 'Audit trail for soft deletes - Financial compliance requirement per OWASP and banking regulations';