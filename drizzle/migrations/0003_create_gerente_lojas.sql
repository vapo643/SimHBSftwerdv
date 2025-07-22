
-- =====================================================
-- CREATE GERENTE_LOJAS JUNCTION TABLE
-- =====================================================
-- This table enables many-to-many relationship between users (gerentes) and lojas

CREATE TABLE IF NOT EXISTS gerente_lojas (
  gerente_id INTEGER NOT NULL,
  loja_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT pk_gerente_lojas PRIMARY KEY (gerente_id, loja_id),
  CONSTRAINT fk_gerente_lojas_gerente FOREIGN KEY (gerente_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_gerente_lojas_loja FOREIGN KEY (loja_id) REFERENCES lojas(id) ON DELETE CASCADE
);

-- =====================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for queries by gerente_id
CREATE INDEX IF NOT EXISTS idx_gerente_lojas_gerente_id ON gerente_lojas(gerente_id);

-- Index for queries by loja_id
CREATE INDEX IF NOT EXISTS idx_gerente_lojas_loja_id ON gerente_lojas(loja_id);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on the new table
ALTER TABLE gerente_lojas ENABLE ROW LEVEL SECURITY;

-- Users can only see associations for their own store
CREATE POLICY "Users can view gerente_lojas for their own store" ON gerente_lojas
  FOR SELECT USING (loja_id = get_current_user_loja_id());

-- Store admins can create gerente-loja associations for their store
CREATE POLICY "Store admins can create gerente_lojas for their store" ON gerente_lojas
  FOR INSERT WITH CHECK (loja_id = get_current_user_loja_id());

-- Store admins can update associations for their store
CREATE POLICY "Store admins can update gerente_lojas for their store" ON gerente_lojas
  FOR UPDATE USING (loja_id = get_current_user_loja_id());

-- Store admins can delete associations for their store
CREATE POLICY "Store admins can delete gerente_lojas for their store" ON gerente_lojas
  FOR DELETE USING (loja_id = get_current_user_loja_id());

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON gerente_lojas TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify table creation
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'gerente_lojas'
ORDER BY ordinal_position;

-- Verify constraints
SELECT 
  constraint_name,
  constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'gerente_lojas';

-- Verify RLS is enabled
SELECT 
  tablename,
  rowsecurity,
  (SELECT count(*) FROM pg_policy WHERE polrelid = c.oid) as policy_count
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE tablename = 'gerente_lojas';
