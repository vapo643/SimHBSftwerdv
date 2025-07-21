-- =====================================================
-- MULTI-TENANT ROW LEVEL SECURITY (RLS) IMPLEMENTATION
-- =====================================================
-- This migration implements comprehensive Row Level Security 
-- policies to ensure complete data isolation by loja_id

-- ====================================
-- 1. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ====================================

-- Enable RLS on core hierarchy tables
ALTER TABLE parceiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE lojas ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Enable RLS on business data tables
ALTER TABLE propostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tabelas_comerciais ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE comunicacao_logs ENABLE ROW LEVEL SECURITY;

-- ====================================
-- 2. USER CONTEXT FUNCTION
-- ====================================
-- Create function to get current user's loja_id from JWT token
CREATE OR REPLACE FUNCTION get_current_user_loja_id()
RETURNS INTEGER AS $$
BEGIN
  -- Extract loja_id from JWT token custom claims
  -- In Supabase, we'll store loja_id in user metadata
  RETURN COALESCE(
    (current_setting('request.jwt.claims', true)::json->>'loja_id')::integer,
    (current_setting('app.current_user_loja_id', true))::integer,
    -1  -- Return -1 if no loja_id found (will deny all access)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================
-- 3. PARCEIROS TABLE RLS POLICIES
-- ====================================

-- SELECT: Users can only see their own partner
CREATE POLICY "Users can view their own partner" ON parceiros
  FOR SELECT USING (
    id = (
      SELECT p.id 
      FROM lojas l 
      JOIN parceiros p ON l.parceiro_id = p.id 
      WHERE l.id = get_current_user_loja_id()
    )
  );

-- INSERT: Only system admins can create partners (handled at application level)
CREATE POLICY "System admins can create partners" ON parceiros
  FOR INSERT WITH CHECK (false); -- Disable direct inserts, use application layer

-- UPDATE: Users can update their own partner data
CREATE POLICY "Users can update their own partner" ON parceiros
  FOR UPDATE USING (
    id = (
      SELECT p.id 
      FROM lojas l 
      JOIN parceiros p ON l.parceiro_id = p.id 
      WHERE l.id = get_current_user_loja_id()
    )
  );

-- DELETE: Prevent direct deletions
CREATE POLICY "Prevent partner deletions" ON parceiros
  FOR DELETE USING (false);

-- ====================================
-- 4. LOJAS TABLE RLS POLICIES
-- ====================================

-- SELECT: Users can only see their own store
CREATE POLICY "Users can view their own store" ON lojas
  FOR SELECT USING (id = get_current_user_loja_id());

-- INSERT: Only partner admins can create stores (handled at application level)
CREATE POLICY "Partner admins can create stores" ON lojas
  FOR INSERT WITH CHECK (
    parceiro_id = (
      SELECT p.id 
      FROM lojas l 
      JOIN parceiros p ON l.parceiro_id = p.id 
      WHERE l.id = get_current_user_loja_id()
    )
  );

-- UPDATE: Users can update their own store
CREATE POLICY "Users can update their own store" ON lojas
  FOR UPDATE USING (id = get_current_user_loja_id());

-- DELETE: Prevent direct deletions
CREATE POLICY "Prevent store deletions" ON lojas
  FOR DELETE USING (false);

-- ====================================
-- 5. USERS TABLE RLS POLICIES
-- ====================================

-- SELECT: Users can only see users from their own store
CREATE POLICY "Users can view users from their own store" ON users
  FOR SELECT USING (loja_id = get_current_user_loja_id());

-- INSERT: Store admins can create users for their store
CREATE POLICY "Store admins can create users for their store" ON users
  FOR INSERT WITH CHECK (loja_id = get_current_user_loja_id());

-- UPDATE: Users can update users from their own store
CREATE POLICY "Users can update users from their own store" ON users
  FOR UPDATE USING (loja_id = get_current_user_loja_id());

-- DELETE: Prevent direct deletions (soft delete at application level)
CREATE POLICY "Prevent user deletions" ON users
  FOR DELETE USING (false);

-- ====================================
-- 6. PROPOSTAS TABLE RLS POLICIES
-- ====================================

-- SELECT: Users can only see proposals from their own store
CREATE POLICY "Users can view proposals from their own store" ON propostas
  FOR SELECT USING (loja_id = get_current_user_loja_id());

-- INSERT: Users can create proposals for their own store
CREATE POLICY "Users can create proposals for their own store" ON propostas
  FOR INSERT WITH CHECK (loja_id = get_current_user_loja_id());

-- UPDATE: Users can update proposals from their own store
CREATE POLICY "Users can update proposals from their own store" ON propostas
  FOR UPDATE USING (loja_id = get_current_user_loja_id());

-- DELETE: Prevent hard deletions (soft delete at application level)
CREATE POLICY "Prevent proposal deletions" ON propostas
  FOR DELETE USING (false);

-- ====================================
-- 7. TABELAS_COMERCIAIS TABLE RLS POLICIES
-- ====================================

-- SELECT: Users can only see commercial tables from their own store
CREATE POLICY "Users can view commercial tables from their own store" ON tabelas_comerciais
  FOR SELECT USING (loja_id = get_current_user_loja_id());

-- INSERT: Users can create commercial tables for their own store
CREATE POLICY "Users can create commercial tables for their own store" ON tabelas_comerciais
  FOR INSERT WITH CHECK (loja_id = get_current_user_loja_id());

-- UPDATE: Users can update commercial tables from their own store
CREATE POLICY "Users can update commercial tables from their own store" ON tabelas_comerciais
  FOR UPDATE USING (loja_id = get_current_user_loja_id());

-- DELETE: Users can delete commercial tables from their own store
CREATE POLICY "Users can delete commercial tables from their own store" ON tabelas_comerciais
  FOR DELETE USING (loja_id = get_current_user_loja_id());

-- ====================================
-- 8. PRODUTOS TABLE RLS POLICIES
-- ====================================

-- SELECT: Users can only see products from their own store
CREATE POLICY "Users can view products from their own store" ON produtos
  FOR SELECT USING (loja_id = get_current_user_loja_id());

-- INSERT: Users can create products for their own store
CREATE POLICY "Users can create products for their own store" ON produtos
  FOR INSERT WITH CHECK (loja_id = get_current_user_loja_id());

-- UPDATE: Users can update products from their own store
CREATE POLICY "Users can update products from their own store" ON produtos
  FOR UPDATE USING (loja_id = get_current_user_loja_id());

-- DELETE: Users can delete products from their own store
CREATE POLICY "Users can delete products from their own store" ON produtos
  FOR DELETE USING (loja_id = get_current_user_loja_id());

-- ====================================
-- 9. COMUNICACAO_LOGS TABLE RLS POLICIES
-- ====================================

-- SELECT: Users can only see communication logs from their own store
CREATE POLICY "Users can view communication logs from their own store" ON comunicacao_logs
  FOR SELECT USING (loja_id = get_current_user_loja_id());

-- INSERT: Users can create communication logs for their own store
CREATE POLICY "Users can create communication logs for their own store" ON comunicacao_logs
  FOR INSERT WITH CHECK (loja_id = get_current_user_loja_id());

-- UPDATE: Prevent updates to communication logs (immutable audit trail)
CREATE POLICY "Prevent communication log updates" ON comunicacao_logs
  FOR UPDATE USING (false);

-- DELETE: Prevent deletions of communication logs (permanent audit trail)
CREATE POLICY "Prevent communication log deletions" ON comunicacao_logs
  FOR DELETE USING (false);

-- ====================================
-- 10. SECURITY INDEXES FOR PERFORMANCE
-- ====================================

-- Create indexes on loja_id columns for optimal RLS performance
CREATE INDEX IF NOT EXISTS idx_users_loja_id ON users(loja_id);
CREATE INDEX IF NOT EXISTS idx_propostas_loja_id ON propostas(loja_id);
CREATE INDEX IF NOT EXISTS idx_tabelas_comerciais_loja_id ON tabelas_comerciais(loja_id);
CREATE INDEX IF NOT EXISTS idx_produtos_loja_id ON produtos(loja_id);
CREATE INDEX IF NOT EXISTS idx_comunicacao_logs_loja_id ON comunicacao_logs(loja_id);

-- ====================================
-- 11. BYPASS POLICIES FOR SYSTEM OPERATIONS
-- ====================================

-- Create a BYPASS role for system operations (migrations, backups, etc.)
-- This role can be used by trusted system processes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'simpix_system') THEN
    CREATE ROLE simpix_system;
  END IF;
END
$$;

-- Grant BYPASS privileges to the system role
ALTER ROLE simpix_system SET row_security = off;

-- ====================================
-- 12. VALIDATION TRIGGERS
-- ====================================

-- Trigger to ensure loja_id consistency in propostas
CREATE OR REPLACE FUNCTION validate_proposta_loja_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure user creating/updating proposal belongs to the same loja
  IF NEW.loja_id != get_current_user_loja_id() THEN
    RAISE EXCEPTION 'Cannot create/update proposal for different store. User loja_id: %, Proposal loja_id: %', 
      get_current_user_loja_id(), NEW.loja_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_proposta_loja_id
  BEFORE INSERT OR UPDATE ON propostas
  FOR EACH ROW
  EXECUTE FUNCTION validate_proposta_loja_id();

-- ====================================
-- 13. MONITORING AND AUDIT
-- ====================================

-- Create a view to monitor RLS policy effectiveness
CREATE OR REPLACE VIEW rls_security_audit AS
SELECT 
  schemaname,
  tablename,
  rowsecurity,
  (SELECT count(*) FROM pg_policy WHERE polrelid = c.oid) as policy_count
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
WHERE schemaname = 'public'
ORDER BY tablename;

-- ====================================
-- IMPLEMENTATION NOTES
-- ====================================

-- 1. JWT Integration: The get_current_user_loja_id() function expects 
--    the loja_id to be included in the JWT token's custom claims.
--    This must be set during user authentication.

-- 2. Application Layer: Some policies deliberately return false to force
--    operations through the application layer where additional business
--    logic can be applied.

-- 3. Performance: All loja_id columns are indexed for optimal RLS performance.

-- 4. Audit Trail: Communication logs are immutable to maintain audit integrity.

-- 5. Bypass Role: The simpix_system role allows system operations while
--    maintaining security for regular users.

-- 6. Validation: Triggers provide additional validation beyond RLS policies.