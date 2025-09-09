-- Migration: Remove 19 legacy status values from propostas.status enum
-- Generated: 19/08/2025
-- ATENÇÃO: Esta operação é IRREVERSÍVEL no PostgreSQL
-- Execute apenas após validação completa e backup do banco de dados

-- NOTA IMPORTANTE: PostgreSQL NÃO suporta DROP VALUE em enums de forma nativa.
-- A única forma segura de remover valores de um enum é:
-- 1. Criar um novo tipo enum sem os valores legados
-- 2. Migrar todas as colunas para o novo tipo
-- 3. Dropar o tipo antigo
-- 4. Renomear o novo tipo para o nome original

-- Passo 1: Criar novo tipo enum com apenas os status ativos (9 valores confirmados)
CREATE TYPE "status_v2" AS ENUM(
  'rascunho',
  'aprovado', 
  'rejeitado',
  'CCB_GERADA',
  'AGUARDANDO_ASSINATURA',
  'ASSINATURA_CONCLUIDA',
  'BOLETOS_EMITIDOS',
  'pagamento_autorizado',
  'suspensa'
);

-- Passo 2: Migrar todas as colunas que usam o tipo status
-- Tabela: propostas
ALTER TABLE propostas 
  ALTER COLUMN status TYPE status_v2 
  USING status::text::status_v2;

-- Tabela: proposta_logs (status_anterior e status_novo)
ALTER TABLE proposta_logs 
  ALTER COLUMN status_anterior TYPE status_v2 
  USING status_anterior::text::status_v2;

ALTER TABLE proposta_logs 
  ALTER COLUMN status_novo TYPE status_v2 
  USING status_novo::text::status_v2;

-- Tabela: status_contextuais
ALTER TABLE status_contextuais 
  ALTER COLUMN status TYPE status_v2 
  USING status::text::status_v2;

ALTER TABLE status_contextuais 
  ALTER COLUMN status_anterior TYPE status_v2 
  USING status_anterior::text::status_v2;

-- Tabela: status_transitions
ALTER TABLE status_transitions 
  ALTER COLUMN from_status TYPE status_v2 
  USING from_status::text::status_v2;

ALTER TABLE status_transitions 
  ALTER COLUMN to_status TYPE status_v2 
  USING to_status::text::status_v2;

-- Passo 3: Dropar o tipo antigo
DROP TYPE status;

-- Passo 4: Renomear o novo tipo para o nome original
ALTER TYPE status_v2 RENAME TO status;

-- VALIDAÇÃO: Confirmar que apenas 9 valores permanecem no enum
-- Execute após a migração: SELECT unnest(enum_range(NULL::status));

-- Status removidos (19 total):
-- 1. aguardando_analise
-- 2. em_analise
-- 3. pendente
-- 4. pendenciado
-- 5. aguardando_aceite_atendente
-- 6. aceito_atendente
-- 7. ASSINATURA_PENDENTE
-- 8. documentos_enviados
-- 9. contratos_preparados
-- 10. em_formalizacao
-- 11. contratos_assinados
-- 12. assinado
-- 13. PAGAMENTO_PENDENTE
-- 14. PAGAMENTO_PARCIAL
-- 15. INADIMPLENTE
-- 16. QUITADO
-- 17. pronto_pagamento
-- 18. pago
-- 19. cancelado

-- FIM DA MIGRAÇÃO