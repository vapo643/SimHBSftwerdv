-- Script de teste para validar a funcionalidade Realtime na Tela de Cobranças
-- PAM V1.0 - TESTE FUNCIONAL

-- 1. Primeiro, vamos verificar se temos propostas na tabela
SELECT COUNT(*) as total_propostas FROM propostas;
SELECT COUNT(*) as total_collections FROM inter_collections;

-- 2. Simular uma atualização de status em uma proposta existente
-- Isso deve acionar o Realtime e atualizar a tela automaticamente
UPDATE propostas 
SET 
  status = 'pago',
  updated_at = NOW()
WHERE id = (SELECT id FROM propostas WHERE status != 'pago' LIMIT 1)
RETURNING id, status, nome_cliente;

-- 3. Simular atualização em inter_collections (boleto pago)
UPDATE inter_collections
SET 
  situacao = 'RECEBIDO',
  data_situacao = NOW()::text,
  valor_pago = valor_nominal,
  updated_at = NOW()
WHERE codigo_solicitacao = (
  SELECT codigo_solicitacao 
  FROM inter_collections 
  WHERE situacao != 'RECEBIDO' 
  LIMIT 1
)
RETURNING codigo_solicitacao, situacao, seu_numero;

-- 4. Verificar os resultados
SELECT 
  'propostas_pagas' as tipo,
  COUNT(*) as quantidade
FROM propostas 
WHERE status = 'pago'
UNION ALL
SELECT 
  'boletos_recebidos' as tipo,
  COUNT(*) as quantidade
FROM inter_collections 
WHERE situacao = 'RECEBIDO';