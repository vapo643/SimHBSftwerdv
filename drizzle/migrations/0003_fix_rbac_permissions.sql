-- =====================================================
-- CORREÇÃO CRÍTICA DE SEGURANÇA - RBAC COMPLETO
-- =====================================================
-- Remove todas as políticas antigas que estão erradas
DROP POLICY IF EXISTS "Users can view proposals from their own store" ON propostas;
DROP POLICY IF EXISTS "Users can create proposals for their own store" ON propostas;
DROP POLICY IF EXISTS "Users can update proposals from their own store" ON propostas;

-- =====================================================
-- NOVAS POLÍTICAS DE PROPOSTAS COM RBAC COMPLETO
-- =====================================================

-- ATENDENTE: Vê apenas suas próprias propostas
CREATE POLICY "Atendente can view only own proposals" ON propostas
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'ATENDENTE' 
    AND user_id = auth.uid()
  );

-- ATENDENTE: Cria propostas apenas para si mesmo e sua loja
CREATE POLICY "Atendente can create proposals for their store" ON propostas
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'role' = 'ATENDENTE'
    AND user_id = auth.uid()
    AND loja_id = (SELECT loja_id FROM users WHERE id = auth.uid())
  );

-- ATENDENTE: Atualiza apenas suas próprias propostas pendentes
CREATE POLICY "Atendente can update own pending proposals" ON propostas
  FOR UPDATE USING (
    auth.jwt() ->> 'role' = 'ATENDENTE'
    AND user_id = auth.uid()
    AND status = 'pendenciado'
  );

-- ANALISTA: Vê todas propostas em análise de todas as lojas
CREATE POLICY "Analista can view all proposals in analysis" ON propostas
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'ANALISTA'
    AND status IN ('aguardando_analise', 'em_analise')
  );

-- ANALISTA: Atualiza propostas em análise
CREATE POLICY "Analista can update proposals in analysis" ON propostas
  FOR UPDATE USING (
    auth.jwt() ->> 'role' = 'ANALISTA'
    AND status IN ('aguardando_analise', 'em_analise')
  );

-- GERENTE: Vê todas propostas da sua loja
CREATE POLICY "Gerente can view all proposals from their stores" ON propostas
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'GERENTE'
    AND loja_id IN (
      SELECT unnest(loja_ids) FROM users WHERE id = auth.uid()
    )
  );

-- FINANCEIRO: Vê apenas propostas aprovadas para pagamento
CREATE POLICY "Financeiro can view approved proposals" ON propostas
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'FINANCEIRO'
    AND status IN ('aprovado', 'pronto_pagamento', 'pago')
  );

-- ADMINISTRADOR: Vê todas as propostas
CREATE POLICY "Admin can view all proposals" ON propostas
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'ADMINISTRADOR'
  );

-- ADMINISTRADOR: Atualiza qualquer proposta
CREATE POLICY "Admin can update any proposal" ON propostas
  FOR UPDATE USING (
    auth.jwt() ->> 'role' = 'ADMINISTRADOR'
  );

-- =====================================================
-- POLÍTICAS PARA COMUNICAÇÃO LOGS
-- =====================================================
DROP POLICY IF EXISTS "Users can view communication logs for proposals from their store" ON comunicacao_logs;
DROP POLICY IF EXISTS "Users can create communication logs for proposals from their store" ON comunicacao_logs;

-- ATENDENTE: Vê logs apenas das suas propostas
CREATE POLICY "Atendente can view logs of own proposals" ON comunicacao_logs
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'ATENDENTE'
    AND proposta_id IN (
      SELECT id FROM propostas WHERE user_id = auth.uid()
    )
  );

-- ATENDENTE: Cria logs apenas para suas propostas
CREATE POLICY "Atendente can create logs for own proposals" ON comunicacao_logs
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'role' = 'ATENDENTE'
    AND proposta_id IN (
      SELECT id FROM propostas WHERE user_id = auth.uid()
    )
  );

-- ANALISTA: Vê logs de propostas em análise
CREATE POLICY "Analista can view logs of proposals in analysis" ON comunicacao_logs
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'ANALISTA'
    AND proposta_id IN (
      SELECT id FROM propostas WHERE status IN ('aguardando_analise', 'em_analise')
    )
  );

-- ANALISTA: Cria logs para propostas em análise
CREATE POLICY "Analista can create logs for proposals in analysis" ON comunicacao_logs
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'role' = 'ANALISTA'
    AND proposta_id IN (
      SELECT id FROM propostas WHERE status IN ('aguardando_analise', 'em_analise')
    )
  );

-- GERENTE: Vê logs de todas propostas das suas lojas
CREATE POLICY "Gerente can view logs from their stores" ON comunicacao_logs
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'GERENTE'
    AND proposta_id IN (
      SELECT id FROM propostas WHERE loja_id IN (
        SELECT unnest(loja_ids) FROM users WHERE id = auth.uid()
      )
    )
  );

-- ADMINISTRADOR: Vê todos os logs
CREATE POLICY "Admin can view all logs" ON comunicacao_logs
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'ADMINISTRADOR'
  );

-- =====================================================
-- POLÍTICAS PARA PROPOSTA LOGS
-- =====================================================
DROP POLICY IF EXISTS "Users can view proposal logs from their store" ON proposta_logs;
DROP POLICY IF EXISTS "Users can create proposal logs" ON proposta_logs;

-- Mesmas regras de comunicacao_logs aplicam para proposta_logs
CREATE POLICY "Atendente can view logs of own proposals audit" ON proposta_logs
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'ATENDENTE'
    AND proposta_id IN (
      SELECT id FROM propostas WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Analista can view logs of proposals in analysis audit" ON proposta_logs
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'ANALISTA'
    AND proposta_id IN (
      SELECT id FROM propostas WHERE status IN ('aguardando_analise', 'em_analise')
    )
  );

CREATE POLICY "Gerente can view logs from their stores audit" ON proposta_logs
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'GERENTE'
    AND proposta_id IN (
      SELECT id FROM propostas WHERE loja_id IN (
        SELECT unnest(loja_ids) FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admin can view all audit logs" ON proposta_logs
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'ADMINISTRADOR'
  );

-- Criar logs é permitido para todos os usuários autenticados (auditoria)
CREATE POLICY "Any authenticated user can create audit logs" ON proposta_logs
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );