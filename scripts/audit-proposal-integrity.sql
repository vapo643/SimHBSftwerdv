-- ========================================================================
-- PAM V8.1 TEST-002 - AUDITORIA DE INTEGRIDADE DE DADOS - PROPOSTA COMPLETA
-- ========================================================================
-- 
-- Script SQL para auditoria end-to-end de integridade de dados
-- Verifica se TODOS os dados inseridos via UI foram persistidos corretamente
-- 
-- USO: Substitua {PROPOSTA_ID} pelo ID real da proposta criada no teste
-- 
-- AUTOR: Replit Agent PAM V8.1
-- DATA: 2025-08-30
-- ========================================================================

\echo '========================================================================='
\echo 'PAM V8.1 TEST-002: AUDITORIA DE INTEGRIDADE DE DADOS - INÍCIO'
\echo '========================================================================='

-- ============================================================================
-- 1. TABELA PRINCIPAL: PROPOSTAS
-- ============================================================================

\echo ''
\echo '🔍 [1/8] AUDITANDO TABELA PRINCIPAL: propostas'
\echo '============================================================================'

-- 1.1 Dados Básicos da Proposta
SELECT 
  id,
  numero_proposta,
  loja_id,
  produto_id,
  tabela_comercial_id,
  status,
  created_at,
  updated_at
FROM propostas 
WHERE id = '{PROPOSTA_ID}';

-- 1.2 Dados Completos do Cliente (Pessoa Física)
\echo ''
\echo '📋 [1.2] DADOS DO CLIENTE - PESSOA FÍSICA'
SELECT 
  cliente_nome,
  cliente_cpf,
  cliente_email,
  cliente_telefone,
  cliente_data_nascimento,
  cliente_renda,
  cliente_rg,
  cliente_orgao_emissor,
  cliente_rg_uf,
  cliente_rg_data_emissao,
  cliente_estado_civil,
  cliente_nacionalidade,
  cliente_local_nascimento,
  cliente_ocupacao
FROM propostas 
WHERE id = '{PROPOSTA_ID}';

-- 1.3 Endereço Completo do Cliente
\echo ''
\echo '🏠 [1.3] ENDEREÇO DO CLIENTE'
SELECT 
  cliente_cep,
  cliente_logradouro,
  cliente_numero,
  cliente_complemento,
  cliente_bairro,
  cliente_cidade,
  cliente_uf
FROM propostas 
WHERE id = '{PROPOSTA_ID}';

-- 1.4 Dados do Empregador
\echo ''
\echo '🏢 [1.4] DADOS DO EMPREGADOR'
SELECT 
  cliente_empresa_nome,
  cliente_empresa_cnpj,
  cliente_cargo_funcao,
  cliente_tempo_emprego,
  cliente_renda_comprovada
FROM propostas 
WHERE id = '{PROPOSTA_ID}';

-- 1.5 Dados Financeiros do Cliente
\echo ''
\echo '💰 [1.5] DADOS FINANCEIROS DO CLIENTE'
SELECT 
  cliente_dividas_existentes,
  cliente_comprometimento_renda,
  cliente_score_serasa,
  cliente_restricoes_cpf
FROM propostas 
WHERE id = '{PROPOSTA_ID}';

-- 1.6 Dados do Empréstimo
\echo ''
\echo '💳 [1.6] DADOS DO EMPRÉSTIMO'
SELECT 
  valor,
  prazo,
  finalidade,
  garantia,
  valor_tac,
  valor_iof,
  valor_total_financiado,
  valor_liquido_liberado
FROM propostas 
WHERE id = '{PROPOSTA_ID}';

-- 1.7 Configurações Financeiras Detalhadas
\echo ''
\echo '⚙️ [1.7] CONFIGURAÇÕES FINANCEIRAS'
SELECT 
  juros_modalidade,
  periodicidade_capitalizacao,
  taxa_juros_anual,
  praca_pagamento,
  forma_pagamento,
  ano_base,
  tarifa_ted,
  taxa_credito,
  data_liberacao,
  forma_liberacao,
  calculo_encargos
FROM propostas 
WHERE id = '{PROPOSTA_ID}';

-- 1.8 Dados de Pagamento (Destino do Empréstimo)
\echo ''
\echo '🏦 [1.8] DADOS DE PAGAMENTO/DESTINO'
SELECT 
  metodo_pagamento,
  dados_pagamento_banco,
  dados_pagamento_codigo_banco,
  dados_pagamento_agencia,
  dados_pagamento_conta,
  dados_pagamento_digito,
  dados_pagamento_tipo,
  dados_pagamento_nome_titular,
  dados_pagamento_cpf_titular,
  dados_pagamento_pix,
  dados_pagamento_tipo_pix,
  dados_pagamento_pix_banco
FROM propostas 
WHERE id = '{PROPOSTA_ID}';

-- ============================================================================
-- 2. TABELAS RELACIONADAS: REFERÊNCIAS PESSOAIS
-- ============================================================================

\echo ''
\echo '🔍 [2/8] AUDITANDO REFERÊNCIAS PESSOAIS'
\echo '============================================================================'

SELECT 
  id,
  proposta_id,
  nome_completo,
  grau_parentesco,
  telefone,
  created_at
FROM referencia_pessoal 
WHERE proposta_id = '{PROPOSTA_ID}'
ORDER BY id;

-- Contagem de referências pessoais
\echo ''
\echo '📊 [2.1] CONTAGEM DE REFERÊNCIAS PESSOAIS'
SELECT COUNT(*) as total_referencias_pessoais
FROM referencia_pessoal 
WHERE proposta_id = '{PROPOSTA_ID}';

-- ============================================================================
-- 3. TABELAS RELACIONADAS: REFERÊNCIAS PROFISSIONAIS
-- ============================================================================

\echo ''
\echo '🔍 [3/8] AUDITANDO REFERÊNCIAS PROFISSIONAIS'
\echo '============================================================================'

SELECT 
  id,
  proposta_id,
  nome_completo,
  cargo_funcao,
  empresa_nome,
  empresa_telefone,
  tempo_conhecimento,
  tipo_relacionamento,
  created_at
FROM referencias_profissionais 
WHERE proposta_id = '{PROPOSTA_ID}';

-- Contagem de referências profissionais (deve ser 0 ou 1)
\echo ''
\echo '📊 [3.1] CONTAGEM DE REFERÊNCIAS PROFISSIONAIS'
SELECT COUNT(*) as total_referencias_profissionais
FROM referencias_profissionais 
WHERE proposta_id = '{PROPOSTA_ID}';

-- ============================================================================
-- 4. TABELAS RELACIONADAS: DOCUMENTOS
-- ============================================================================

\echo ''
\echo '🔍 [4/8] AUDITANDO DOCUMENTOS DA PROPOSTA'
\echo '============================================================================'

SELECT 
  id,
  proposta_id,
  nome_arquivo,
  url,
  tamanho,
  tipo,
  created_at
FROM proposta_documentos 
WHERE proposta_id = '{PROPOSTA_ID}'
ORDER BY created_at;

-- Contagem de documentos anexados
\echo ''
\echo '📊 [4.1] CONTAGEM DE DOCUMENTOS'
SELECT COUNT(*) as total_documentos
FROM proposta_documentos 
WHERE proposta_id = '{PROPOSTA_ID}';

-- ============================================================================
-- 5. AUDITORIA: LOGS DE MUDANÇAS DE STATUS
-- ============================================================================

\echo ''
\echo '🔍 [5/8] AUDITANDO LOGS DE AUDITORIA (proposta_logs)'
\echo '============================================================================'

SELECT 
  id,
  proposta_id,
  autor_id,
  status_anterior,
  status_novo,
  observacao,
  created_at
FROM proposta_logs 
WHERE proposta_id = '{PROPOSTA_ID}'
ORDER BY created_at;

-- Verificar se existe log de criação (status_anterior = NULL, status_novo = 'rascunho')
\echo ''
\echo '📊 [5.1] VERIFICAÇÃO DO LOG DE CRIAÇÃO'
SELECT 
  COUNT(*) as logs_criacao_encontrados,
  MIN(created_at) as primeira_transicao
FROM proposta_logs 
WHERE proposta_id = '{PROPOSTA_ID}' 
  AND status_anterior IS NULL 
  AND status_novo = 'rascunho';

-- ============================================================================
-- 6. STATUS CONTEXTUAIS (PAM V1.0)
-- ============================================================================

\echo ''
\echo '🔍 [6/8] AUDITANDO STATUS CONTEXTUAIS'
\echo '============================================================================'

SELECT 
  id,
  proposta_id,
  contexto,
  status,
  status_anterior,
  atualizado_em,
  atualizado_por,
  observacoes
FROM status_contextuais 
WHERE proposta_id = '{PROPOSTA_ID}'
ORDER BY contexto, atualizado_em;

-- Contagem por contexto
\echo ''
\echo '📊 [6.1] STATUS POR CONTEXTO'
SELECT 
  contexto,
  COUNT(*) as total_status_changes
FROM status_contextuais 
WHERE proposta_id = '{PROPOSTA_ID}'
GROUP BY contexto
ORDER BY contexto;

-- ============================================================================
-- 7. COMUNICAÇÕES E LOGS
-- ============================================================================

\echo ''
\echo '🔍 [7/8] AUDITANDO LOGS DE COMUNICAÇÃO'
\echo '============================================================================'

SELECT 
  id,
  proposta_id,
  loja_id,
  tipo,
  conteudo,
  user_id,
  created_at
FROM comunicacao_logs 
WHERE proposta_id = '{PROPOSTA_ID}'
ORDER BY created_at;

-- Contagem por tipo de comunicação
\echo ''
\echo '📊 [7.1] COMUNICAÇÕES POR TIPO'
SELECT 
  tipo,
  COUNT(*) as total_comunicacoes
FROM comunicacao_logs 
WHERE proposta_id = '{PROPOSTA_ID}'
GROUP BY tipo
ORDER BY tipo;

-- ============================================================================
-- 8. DOCUMENTOS FORMALIZADOS (CCB E BOLETOS - SPRINT 2)
-- ============================================================================

\echo ''
\echo '🔍 [8/8] AUDITANDO DOCUMENTOS FORMALIZADOS (CCB & BOLETOS)'
\echo '============================================================================'

-- 8.1 CCBs Geradas
\echo ''
\echo '📋 [8.1] CCBs GERADAS'
SELECT 
  id,
  proposta_id,
  numero_ccb,
  valor_ccb,
  status,
  caminho_documento_original,
  url_documento_original,
  clicksign_document_key,
  clicksign_status,
  data_envio_assinatura,
  data_assinatura_concluida,
  created_at
FROM ccbs 
WHERE proposta_id = '{PROPOSTA_ID}' 
  AND deleted_at IS NULL;

-- 8.2 Boletos Emitidos
\echo ''
\echo '📋 [8.2] BOLETOS EMITIDOS'
SELECT 
  id,
  proposta_id,
  ccb_id,
  numero_boleto,
  numero_parcela,
  total_parcelas,
  valor_principal,
  valor_total,
  data_vencimento,
  data_emissao,
  status,
  forma_pagamento,
  codigo_barras,
  linha_digitavel,
  pix_copia_e_cola,
  created_at
FROM boletos 
WHERE proposta_id = '{PROPOSTA_ID}' 
  AND deleted_at IS NULL
ORDER BY numero_parcela;

-- ============================================================================
-- 9. RESUMO FINAL DE INTEGRIDADE
-- ============================================================================

\echo ''
\echo '========================================================================='
\echo '📊 RESUMO FINAL DE INTEGRIDADE - CONTAGENS GERAIS'
\echo '========================================================================='

SELECT 
  'propostas' as tabela,
  COUNT(*) as registros_encontrados
FROM propostas 
WHERE id = '{PROPOSTA_ID}' AND deleted_at IS NULL

UNION ALL

SELECT 
  'referencia_pessoal' as tabela,
  COUNT(*) as registros_encontrados
FROM referencia_pessoal 
WHERE proposta_id = '{PROPOSTA_ID}'

UNION ALL

SELECT 
  'referencias_profissionais' as tabela,
  COUNT(*) as registros_encontrados
FROM referencias_profissionais 
WHERE proposta_id = '{PROPOSTA_ID}'

UNION ALL

SELECT 
  'proposta_documentos' as tabela,
  COUNT(*) as registros_encontrados
FROM proposta_documentos 
WHERE proposta_id = '{PROPOSTA_ID}'

UNION ALL

SELECT 
  'proposta_logs' as tabela,
  COUNT(*) as registros_encontrados
FROM proposta_logs 
WHERE proposta_id = '{PROPOSTA_ID}'

UNION ALL

SELECT 
  'status_contextuais' as tabela,
  COUNT(*) as registros_encontrados
FROM status_contextuais 
WHERE proposta_id = '{PROPOSTA_ID}'

UNION ALL

SELECT 
  'comunicacao_logs' as tabela,
  COUNT(*) as registros_encontrados
FROM comunicacao_logs 
WHERE proposta_id = '{PROPOSTA_ID}'

UNION ALL

SELECT 
  'ccbs' as tabela,
  COUNT(*) as registros_encontrados
FROM ccbs 
WHERE proposta_id = '{PROPOSTA_ID}' AND deleted_at IS NULL

UNION ALL

SELECT 
  'boletos' as tabela,
  COUNT(*) as registros_encontrados
FROM boletos 
WHERE proposta_id = '{PROPOSTA_ID}' AND deleted_at IS NULL

ORDER BY tabela;

\echo ''
\echo '========================================================================='
\echo 'PAM V8.1 TEST-002: AUDITORIA DE INTEGRIDADE DE DADOS - CONCLUÍDA'
\echo '========================================================================='