-- =====================================================
-- SUPABASE INTEGRATION SETUP FOR MULTI-TENANT RLS
-- =====================================================
-- Execute this SQL in your Supabase SQL editor or PostgreSQL admin

-- ====================================
-- 1. CREATE CUSTOM FUNCTION FOR SUPABASE JWT
-- ====================================

-- Function to extract loja_id from Supabase JWT token
CREATE OR REPLACE FUNCTION get_current_user_loja_id()
RETURNS INTEGER AS $$
DECLARE
  user_email TEXT;
  user_loja_id INTEGER;
BEGIN
  -- Get email from Supabase JWT
  user_email := (auth.jwt() ->> 'email');
  
  -- If no email in JWT, try to get from session
  IF user_email IS NULL THEN
    user_email := (current_setting('app.current_user_email', true));
  END IF;
  
  -- If still no email, return -1 (no access)
  IF user_email IS NULL OR user_email = '' THEN
    RETURN -1;
  END IF;
  
  -- Get loja_id from users table
  SELECT loja_id INTO user_loja_id
  FROM users 
  WHERE email = user_email
  LIMIT 1;
  
  -- Return loja_id or -1 if not found
  RETURN COALESCE(user_loja_id, -1);
EXCEPTION
  WHEN OTHERS THEN
    -- Return -1 on any error (denies access)
    RETURN -1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================
-- 2. ALTERNATIVE FUNCTION FOR NON-SUPABASE DEPLOYMENTS  
-- ====================================

-- Alternative function that uses session variables
-- Use this if not deploying to Supabase
CREATE OR REPLACE FUNCTION get_current_user_loja_id_session()
RETURNS INTEGER AS $$
BEGIN
  -- Try to get from application-set session variable first
  RETURN COALESCE(
    (current_setting('app.current_user_loja_id', true))::integer,
    -1  -- Return -1 if no loja_id found (will deny all access)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================
-- 3. ENABLE SUPABASE AUTH INTEGRATION
-- ====================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA auth TO authenticated;

-- Allow authenticated users to read their own user data
GRANT SELECT ON users TO authenticated;
GRANT SELECT ON lojas TO authenticated;
GRANT SELECT ON parceiros TO authenticated;

-- Allow authenticated users to work with proposals
GRANT SELECT, INSERT, UPDATE ON propostas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tabelas_comerciais TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON produtos TO authenticated;
GRANT SELECT, INSERT ON comunicacao_logs TO authenticated;

-- Grant sequence usage for inserts
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ====================================
-- 4. SAMPLE DATA FOR TESTING
-- ====================================

-- Insert sample partner
INSERT INTO parceiros (nome, cnpj, email, telefone, endereco, status) 
VALUES (
  'Parceiro Teste',
  '12.345.678/0001-90',
  'parceiro@teste.com',
  '(11) 1234-5678',
  'Rua Teste, 123, São Paulo, SP',
  true
) ON CONFLICT (cnpj) DO NOTHING;

-- Insert sample store
INSERT INTO lojas (parceiro_id, nome, endereco, telefone, gerente, status)
VALUES (
  (SELECT id FROM parceiros WHERE cnpj = '12.345.678/0001-90'),
  'Loja Centro',
  'Av. Principal, 456, Centro, São Paulo, SP',
  '(11) 8765-4321',
  'João Silva',
  true
) ON CONFLICT DO NOTHING;

-- Insert sample user (you'll need to create this user in Supabase Auth first)
-- UPDATE: Replace 'user@teste.com' with the actual email from Supabase Auth
INSERT INTO users (email, name, password, loja_id, role)
VALUES (
  'user@teste.com',
  'Usuário Teste',
  'temp_password', -- This will be managed by Supabase Auth
  (SELECT id FROM lojas WHERE nome = 'Loja Centro'),
  'admin'
) ON CONFLICT (email) DO NOTHING;

-- ====================================
-- 5. VERIFICATION QUERIES
-- ====================================

-- Test RLS context function
SELECT get_current_user_loja_id() AS current_user_loja_id;

-- Check RLS status on all tables
SELECT 
  schemaname,
  tablename,
  rowsecurity,
  (SELECT count(*) FROM pg_policy WHERE polrelid = c.oid) as policy_count
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
WHERE schemaname = 'public'
  AND tablename IN ('users', 'propostas', 'tabelas_comerciais', 'produtos', 'comunicacao_logs', 'lojas', 'parceiros')
ORDER BY tablename;

-- Test data isolation (should return empty when RLS is active)
-- Run this as different users to verify isolation
SELECT count(*) as proposal_count FROM propostas;
SELECT count(*) as user_count FROM users;