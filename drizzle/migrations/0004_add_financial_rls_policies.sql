-- =====================================================
-- OPERAÇÃO GUARDIÃO - REMEDIAÇÃO CRÍTICA RBAC
-- RBAC-FIX-001: Implementar RLS para Roles Financeiras
-- =====================================================
-- Data: 2025-09-01
-- Missão: Fechar lacunas críticas de segurança antes do deploy

-- =====================================================
-- 1. POLÍTICAS PARA ROLE: FINANCEIRO
-- =====================================================
-- FINANCEIRO: Vê propostas com CCB assinada + boleto gerado para pagamento
CREATE POLICY "Financeiro can view proposals ready for payment" ON propostas
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'FINANCEIRO'
    AND status IN (
      'ASSINATURA_CONCLUIDA',    -- CCB totalmente assinado
      'BOLETOS_EMITIDOS',        -- Boletos gerados
      'PAGAMENTO_PENDENTE',      -- Aguardando primeiro pagamento  
      'PAGAMENTO_PARCIAL',       -- Pelo menos 1 parcela paga
      'QUITADO',                 -- Todas parcelas pagas
      'pronto_pagamento',        -- Status legado
      'pagamento_autorizado',    -- Confirmação de veracidade
      'pago'                     -- Status legado mantido
    )
  );

-- FINANCEIRO: Pode atualizar status de pagamento
CREATE POLICY "Financeiro can update payment status" ON propostas
  FOR UPDATE USING (
    auth.jwt() ->> 'role' = 'FINANCEIRO'
    AND status IN (
      'ASSINATURA_CONCLUIDA',
      'BOLETOS_EMITIDOS', 
      'PAGAMENTO_PENDENTE',
      'PAGAMENTO_PARCIAL',
      'pronto_pagamento',
      'pagamento_autorizado'
    )
  );

-- =====================================================
-- 2. POLÍTICAS PARA ROLE: COBRANCA  
-- =====================================================
-- COBRANÇA: Vê propostas inadimplentes ou com risco de inadimplência
CREATE POLICY "Cobranca can view overdue and at-risk proposals" ON propostas
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'COBRANCA'
    AND status IN (
      'INADIMPLENTE',           -- Atraso > 30 dias
      'PAGAMENTO_PENDENTE',     -- Aguardando primeiro pagamento
      'PAGAMENTO_PARCIAL',      -- Pagamento incompleto
      'BOLETOS_EMITIDOS'        -- Boletos ativos para cobrança
    )
  );

-- COBRANÇA: Pode atualizar dados relacionados à cobrança
CREATE POLICY "Cobranca can update collection data" ON propostas
  FOR UPDATE USING (
    auth.jwt() ->> 'role' = 'COBRANCA'
    AND status IN (
      'INADIMPLENTE',
      'PAGAMENTO_PENDENTE', 
      'PAGAMENTO_PARCIAL',
      'BOLETOS_EMITIDOS'
    )
  );

-- =====================================================
-- 3. POLÍTICAS PARA ROLE: SUPERVISOR_COBRANCA
-- =====================================================
-- SUPERVISOR_COBRANCA: Mesma visão de COBRANÇA + funções supervisão
CREATE POLICY "Supervisor cobranca can view collection proposals" ON propostas
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'SUPERVISOR_COBRANCA'
    AND status IN (
      'INADIMPLENTE',           -- Atraso > 30 dias
      'PAGAMENTO_PENDENTE',     -- Aguardando primeiro pagamento  
      'PAGAMENTO_PARCIAL',      -- Pagamento incompleto
      'BOLETOS_EMITIDOS'        -- Boletos ativos para cobrança
    )
  );

-- SUPERVISOR_COBRANCA: Pode aprovar prorrogações e descontos
CREATE POLICY "Supervisor cobranca can approve extensions and discounts" ON propostas
  FOR UPDATE USING (
    auth.jwt() ->> 'role' = 'SUPERVISOR_COBRANCA'
    AND status IN (
      'INADIMPLENTE',
      'PAGAMENTO_PENDENTE',
      'PAGAMENTO_PARCIAL', 
      'BOLETOS_EMITIDOS'
    )
  );

-- =====================================================
-- 4. POLÍTICAS PARA ROLE: DIRETOR
-- =====================================================
-- DIRETOR: Visão total de todos parceiros, lojas e métricas
CREATE POLICY "Diretor can view all proposals" ON propostas
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'DIRETOR'
  );

-- DIRETOR: Pode fazer alterações estratégicas  
CREATE POLICY "Diretor can update strategic data" ON propostas
  FOR UPDATE USING (
    auth.jwt() ->> 'role' = 'DIRETOR'
  );

-- =====================================================
-- 5. POLÍTICAS PARA OUTRAS TABELAS CRÍTICAS  
-- =====================================================

-- FINANCEIRO: Acesso aos logs de pagamento
CREATE POLICY "Financeiro can view payment logs" ON comunicacao_logs
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'FINANCEIRO'
    AND proposta_id IN (
      SELECT id FROM propostas WHERE status IN (
        'ASSINATURA_CONCLUIDA', 'BOLETOS_EMITIDOS', 'PAGAMENTO_PENDENTE',
        'PAGAMENTO_PARCIAL', 'QUITADO', 'pronto_pagamento', 'pagamento_autorizado', 'pago'
      )
    )
  );

-- COBRANÇA: Acesso aos logs de cobrança
CREATE POLICY "Cobranca can view collection logs" ON comunicacao_logs
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'COBRANCA'
    AND proposta_id IN (
      SELECT id FROM propostas WHERE status IN (
        'INADIMPLENTE', 'PAGAMENTO_PENDENTE', 'PAGAMENTO_PARCIAL', 'BOLETOS_EMITIDOS'
      )
    )
  );

-- SUPERVISOR_COBRANCA: Mesma visão de COBRANÇA nos logs
CREATE POLICY "Supervisor cobranca can view collection logs" ON comunicacao_logs  
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'SUPERVISOR_COBRANCA'
    AND proposta_id IN (
      SELECT id FROM propostas WHERE status IN (
        'INADIMPLENTE', 'PAGAMENTO_PENDENTE', 'PAGAMENTO_PARCIAL', 'BOLETOS_EMITIDOS'
      )
    )
  );

-- DIRETOR: Acesso total aos logs
CREATE POLICY "Diretor can view all communication logs" ON comunicacao_logs
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'DIRETOR'
  );

-- =====================================================
-- 6. AUDIT LOGS - PROPOSTA_LOGS
-- =====================================================

-- FINANCEIRO: Logs de auditoria financeira
CREATE POLICY "Financeiro can view financial audit logs" ON proposta_logs
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'FINANCEIRO'
    AND proposta_id IN (
      SELECT id FROM propostas WHERE status IN (
        'ASSINATURA_CONCLUIDA', 'BOLETOS_EMITIDOS', 'PAGAMENTO_PENDENTE',
        'PAGAMENTO_PARCIAL', 'QUITADO', 'pronto_pagamento', 'pagamento_autorizado', 'pago'
      )
    )
  );

-- COBRANÇA: Logs de auditoria de cobrança
CREATE POLICY "Cobranca can view collection audit logs" ON proposta_logs
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'COBRANCA'
    AND proposta_id IN (
      SELECT id FROM propostas WHERE status IN (
        'INADIMPLENTE', 'PAGAMENTO_PENDENTE', 'PAGAMENTO_PARCIAL', 'BOLETOS_EMITIDOS'
      )
    )
  );

-- SUPERVISOR_COBRANCA: Logs de auditoria de supervisão
CREATE POLICY "Supervisor cobranca can view supervision audit logs" ON proposta_logs
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'SUPERVISOR_COBRANCA'
    AND proposta_id IN (
      SELECT id FROM propostas WHERE status IN (
        'INADIMPLENTE', 'PAGAMENTO_PENDENTE', 'PAGAMENTO_PARCIAL', 'BOLETOS_EMITIDOS'
      )
    )
  );

-- DIRETOR: Acesso total aos logs de auditoria
CREATE POLICY "Diretor can view all audit logs" ON proposta_logs
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'DIRETOR'
  );

-- =====================================================
-- REMEDIAÇÃO CONCLUÍDA
-- =====================================================
-- Todas as roles críticas agora possuem políticas RLS
-- Sistema pronto para validação de conformidade