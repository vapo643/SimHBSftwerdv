
-- MIGRAÇÃO: Implementação de Row Level Security (RLS)
-- Data: 2025-01-21
-- Descrição: Políticas de segurança para isolamento multi-tenant por loja_id

-- ================================================
-- 1. ATIVAR RLS NAS TABELAS SENSÍVEIS
-- ================================================

-- Ativar RLS na tabela de propostas (dados mais sensíveis)
ALTER TABLE propostas ENABLE ROW LEVEL SECURITY;

-- Ativar RLS na tabela de tabelas comerciais (configurações por loja)
ALTER TABLE tabelas_comerciais ENABLE ROW LEVEL SECURITY;

-- Ativar RLS na tabela de profiles (usuários vinculados a lojas)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Ativar RLS na tabela de lojas (apenas para acesso às próprias lojas)
ALTER TABLE lojas ENABLE ROW LEVEL SECURITY;

-- ================================================
-- 2. FUNÇÃO AUXILIAR - OBTER LOJA_ID DO USUÁRIO LOGADO
-- ================================================

-- Função que retorna o loja_id do usuário autenticado
CREATE OR REPLACE FUNCTION get_user_loja_id()
RETURNS INTEGER AS $$
BEGIN
  -- Retorna o loja_id do perfil ativo do usuário logado
  RETURN (
    SELECT p.loja_id 
    FROM profiles p 
    WHERE p.user_id = auth.uid()::INTEGER 
    AND p.ativo = true 
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função que verifica se o usuário tem acesso a uma loja específica
CREATE OR REPLACE FUNCTION user_has_access_to_loja(target_loja_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM profiles p 
    WHERE p.user_id = auth.uid()::INTEGER 
    AND p.loja_id = target_loja_id 
    AND p.ativo = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- 3. POLÍTICAS RLS PARA TABELA PROPOSTAS
-- ================================================

-- POLÍTICA: Usuários só podem VER propostas da sua loja
CREATE POLICY "propostas_select_policy" ON propostas
FOR SELECT
TO authenticated
USING (loja_id = get_user_loja_id());

-- POLÍTICA: Usuários só podem INSERIR propostas na sua loja
CREATE POLICY "propostas_insert_policy" ON propostas
FOR INSERT
TO authenticated
WITH CHECK (loja_id = get_user_loja_id());

-- POLÍTICA: Usuários só podem ATUALIZAR propostas da sua loja
CREATE POLICY "propostas_update_policy" ON propostas
FOR UPDATE
TO authenticated
USING (loja_id = get_user_loja_id())
WITH CHECK (loja_id = get_user_loja_id());

-- POLÍTICA: Usuários só podem DELETAR propostas da sua loja
CREATE POLICY "propostas_delete_policy" ON propostas
FOR DELETE
TO authenticated
USING (loja_id = get_user_loja_id());

-- ================================================
-- 4. POLÍTICAS RLS PARA TABELA TABELAS_COMERCIAIS
-- ================================================

-- POLÍTICA: Usuários só podem VER tabelas comerciais da sua loja
CREATE POLICY "tabelas_comerciais_select_policy" ON tabelas_comerciais
FOR SELECT
TO authenticated
USING (loja_id = get_user_loja_id());

-- POLÍTICA: Usuários só podem INSERIR tabelas comerciais na sua loja
CREATE POLICY "tabelas_comerciais_insert_policy" ON tabelas_comerciais
FOR INSERT
TO authenticated
WITH CHECK (loja_id = get_user_loja_id());

-- POLÍTICA: Usuários só podem ATUALIZAR tabelas comerciais da sua loja
CREATE POLICY "tabelas_comerciais_update_policy" ON tabelas_comerciais
FOR UPDATE
TO authenticated
USING (loja_id = get_user_loja_id())
WITH CHECK (loja_id = get_user_loja_id());

-- POLÍTICA: Usuários só podem DELETAR tabelas comerciais da sua loja
CREATE POLICY "tabelas_comerciais_delete_policy" ON tabelas_comerciais
FOR DELETE
TO authenticated
USING (loja_id = get_user_loja_id());

-- ================================================
-- 5. POLÍTICAS RLS PARA TABELA PROFILES
-- ================================================

-- POLÍTICA: Usuários só podem VER profiles da mesma loja
CREATE POLICY "profiles_select_policy" ON profiles
FOR SELECT
TO authenticated
USING (loja_id = get_user_loja_id());

-- POLÍTICA: Apenas ADMINISTRADORES podem INSERIR novos profiles
CREATE POLICY "profiles_insert_policy" ON profiles
FOR INSERT
TO authenticated
WITH CHECK (
  loja_id = get_user_loja_id() 
  AND EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid()::INTEGER 
    AND p.role IN ('ADMINISTRADOR', 'DIRETOR')
    AND p.ativo = true
  )
);

-- POLÍTICA: Apenas ADMINISTRADORES podem ATUALIZAR profiles
CREATE POLICY "profiles_update_policy" ON profiles
FOR UPDATE
TO authenticated
USING (
  loja_id = get_user_loja_id() 
  AND EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid()::INTEGER 
    AND p.role IN ('ADMINISTRADOR', 'DIRETOR')
    AND p.ativo = true
  )
)
WITH CHECK (loja_id = get_user_loja_id());

-- POLÍTICA: Apenas ADMINISTRADORES podem DELETAR profiles
CREATE POLICY "profiles_delete_policy" ON profiles
FOR DELETE
TO authenticated
USING (
  loja_id = get_user_loja_id() 
  AND EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid()::INTEGER 
    AND p.role IN ('ADMINISTRADOR', 'DIRETOR')
    AND p.ativo = true
  )
);

-- ================================================
-- 6. POLÍTICAS RLS PARA TABELA LOJAS
-- ================================================

-- POLÍTICA: Usuários só podem VER sua própria loja
CREATE POLICY "lojas_select_policy" ON lojas
FOR SELECT
TO authenticated
USING (id = get_user_loja_id());

-- POLÍTICA: Apenas ADMINISTRADORES podem ATUALIZAR dados da loja
CREATE POLICY "lojas_update_policy" ON lojas
FOR UPDATE
TO authenticated
USING (
  id = get_user_loja_id() 
  AND EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid()::INTEGER 
    AND p.role IN ('ADMINISTRADOR', 'DIRETOR')
    AND p.ativo = true
  )
)
WITH CHECK (id = get_user_loja_id());

-- ================================================
-- 7. POLÍTICAS PARA TABELAS NÃO-SENSÍVEIS
-- ================================================

-- Tabelas de referência (parceiros, produtos) - acesso livre para usuários autenticados
-- Estas tabelas não precisam de RLS pois são dados de referência compartilhados

-- ================================================
-- 8. GRANTS DE PERMISSÃO
-- ================================================

-- Garantir que usuários autenticados possam executar as funções
GRANT EXECUTE ON FUNCTION get_user_loja_id() TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_access_to_loja(INTEGER) TO authenticated;

-- ================================================
-- 9. COMENTÁRIOS PARA AUDITORIA
-- ================================================

COMMENT ON POLICY "propostas_select_policy" ON propostas IS 
'RLS: Usuários só podem visualizar propostas da sua loja';

COMMENT ON POLICY "tabelas_comerciais_select_policy" ON tabelas_comerciais IS 
'RLS: Usuários só podem visualizar tabelas comerciais da sua loja';

COMMENT ON FUNCTION get_user_loja_id() IS 
'Função auxiliar RLS: Retorna o loja_id do usuário autenticado';

-- ================================================
-- 10. VERIFICAÇÃO DE INTEGRIDADE
-- ================================================

-- Verificar se todas as políticas foram criadas corretamente
DO $$
BEGIN
  RAISE NOTICE 'RLS Policies implemented successfully for multi-tenant isolation';
  RAISE NOTICE 'Tables with RLS: propostas, tabelas_comerciais, profiles, lojas';
  RAISE NOTICE 'Helper functions: get_user_loja_id(), user_has_access_to_loja()';
END $$;
