-- Create PostgreSQL function for setting user context for RLS
CREATE OR REPLACE FUNCTION set_user_context(
  p_user_id TEXT,
  p_role TEXT,
  p_loja_id TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  -- Set current user ID for RLS
  PERFORM set_config('app.current_user_id', p_user_id, true);
  
  -- Set current role for RLS
  PERFORM set_config('app.current_user_role', p_role, true);
  
  -- Set current loja_id for RLS (if applicable)
  IF p_loja_id IS NOT NULL THEN
    PERFORM set_config('app.current_loja_id', p_loja_id, true);
  ELSE
    PERFORM set_config('app.current_loja_id', '', true);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION set_user_context(TEXT, TEXT, TEXT) TO authenticated;

-- Create helper functions to get context values
CREATE OR REPLACE FUNCTION current_user_id() RETURNS TEXT AS $$
  SELECT current_setting('app.current_user_id', true)
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_user_role() RETURNS TEXT AS $$
  SELECT current_setting('app.current_user_role', true)
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_loja_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.current_loja_id', true), '')
$$ LANGUAGE sql STABLE;

-- Grant execute permission on helper functions
GRANT EXECUTE ON FUNCTION current_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION current_loja_id() TO authenticated;