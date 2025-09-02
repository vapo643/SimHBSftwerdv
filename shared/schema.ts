import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  decimal,
  pgEnum,
  primaryKey,
  varchar,
  uuid,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Parceiros e Lojas
export const parceiros = pgTable('parceiros', {
  id: serial('id').primaryKey(),
  razaoSocial: text('razao_social').notNull(),
  cnpj: text('cnpj').notNull().unique(),
  comissaoPadrao: decimal('comissao_padrao'),
  tabelaComercialPadraoId: integer('tabela_comercial_padrao_id'),
  createdAt: timestamp('created_at').defaultNow(),
  deletedAt: timestamp('deleted_at'), // Soft delete column
});

export const lojas = pgTable('lojas', {
  id: serial('id').primaryKey(),
  parceiroId: integer('parceiro_id')
    .references(() => parceiros.id)
    .notNull(),
  nomeLoja: text('nome_loja').notNull(),
  endereco: text('endereco').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  deletedAt: timestamp('deleted_at'), // Soft delete column
});

// Profiles table (Supabase auth integration)
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  fullName: text('full_name'),
  role: text('role'),
  lojaId: integer('loja_id').references(() => lojas.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'), // Soft delete column
});

// Usuários e Perfis (legacy table)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  password: text('password').notNull(),
  role: text('role').notNull().default('user'), // admin, analyst, user
  createdAt: timestamp('created_at').defaultNow(),
});

// Tabela para rastrear sessões ativas dos usuários
export const userSessions = pgTable('user_sessions', {
  id: varchar('id', { length: 255 }).primaryKey(), // Session ID (token)
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 2048 }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  device: varchar('device', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
});

// Export types for userSessions
export type Session = typeof userSessions.$inferSelect;

// Tabela de junção para relacionamento muitos-para-muitos Gerentes x Lojas
// CORRIGIDO: Usar UUID para referenciar profiles.id conforme banco real (ADR-011)
export const gerenteLojas = pgTable(
  'gerente_lojas',
  {
    gerenteId: uuid('gerente_id')
      .references(() => profiles.id)
      .notNull(),
    lojaId: integer('loja_id')
      .references(() => lojas.id)
      .notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.gerenteId, table.lojaId] }),
  })
);

export const statusEnum = pgEnum('status', [
  // Status iniciais
  'rascunho',
  'aguardando_analise',
  'em_analise',
  'pendente',
  'pendenciado', // Status órfão formalizado - usado em dashboard e análise
  'aprovado',
  'rejeitado',

  // Status de aceite
  'aguardando_aceite_atendente', // Novo status após aprovação do analista
  'aceito_atendente', // Aceito pelo atendente, pronto para formalização

  // Status de formalização V2.0
  'CCB_GERADA', // Novo: CCB gerado com sucesso
  'AGUARDANDO_ASSINATURA', // Novo: Enviado para ClickSign
  'ASSINATURA_PENDENTE', // Novo: Cliente visualizou mas não assinou
  'ASSINATURA_CONCLUIDA', // Novo: CCB totalmente assinado

  // Status de documentos (legado)
  'documentos_enviados',
  'contratos_preparados',
  'em_formalizacao', // Status órfão formalizado - usado durante processo de formalização
  'contratos_assinados',
  'assinado', // Status órfão formalizado - usado em sync de documentos

  // Status de pagamento V2.0
  'BOLETOS_EMITIDOS', // Novo: Todos boletos gerados no Inter
  'PAGAMENTO_PENDENTE', // Novo: Aguardando primeiro pagamento
  'PAGAMENTO_PARCIAL', // Novo: Pelo menos 1 parcela paga
  'INADIMPLENTE', // Novo: Atraso > 30 dias
  'QUITADO', // Novo: Todas parcelas pagas (substitui "pago")

  // Status de pagamento (legado)
  'pronto_pagamento',
  'pagamento_autorizado', // Novo status após confirmação de veracidade
  'pago', // Legado: mantido para compatibilidade

  // Status administrativos
  'cancelado',
  'suspensa',
]);

export const propostas = pgTable('propostas', {
  id: text('id').primaryKey(), // UUID string format - used internally
  numeroProposta: integer('numero_proposta').notNull().unique(), // User-facing sequential number starting at 300001
  lojaId: integer('loja_id').notNull(), // Multi-tenant key

  // Relacionamentos de negócio
  produtoId: integer('produto_id').references(() => produtos.id).notNull(),
  tabelaComercialId: integer('tabela_comercial_id').references(() => tabelasComerciais.id).notNull(),

  // Cliente dados básicos (mantendo campos existentes para compatibilidade)
  clienteNome: text('cliente_nome').notNull(),
  clienteCpf: text('cliente_cpf').notNull(),
  clienteEmail: text('cliente_email'),
  clienteTelefone: text('cliente_telefone'),
  clienteDataNascimento: text('cliente_data_nascimento'),
  clienteRenda: text('cliente_renda'),

  // Cliente dados adicionais (novos campos normalizados)
  clienteRg: text('cliente_rg'),
  clienteOrgaoEmissor: text('cliente_orgao_emissor'),
  clienteRgUf: text('cliente_rg_uf'),
  clienteRgDataEmissao: text('cliente_rg_data_emissao'),
  clienteEstadoCivil: text('cliente_estado_civil'),
  clienteNacionalidade: text('cliente_nacionalidade').default('Brasileira'),
  clienteLocalNascimento: text('cliente_local_nascimento'),

  // Endereço detalhado
  clienteCep: text('cliente_cep'),
  clienteEndereco: text('cliente_endereco'), // Campo legado - mantido para compatibilidade
  clienteLogradouro: text('cliente_logradouro'),
  clienteNumero: text('cliente_numero'),
  clienteComplemento: text('cliente_complemento'),
  clienteBairro: text('cliente_bairro'),
  clienteCidade: text('cliente_cidade'),
  clienteUf: text('cliente_uf'),
  clienteOcupacao: text('cliente_ocupacao'),

  // Dados para Pessoa Jurídica
  tipoPessoa: text('tipo_pessoa').default('PF'), // PF ou PJ
  clienteRazaoSocial: text('cliente_razao_social'),
  clienteCnpj: text('cliente_cnpj'),

  // Empréstimo dados
  valor: decimal('valor', { precision: 15, scale: 2 }).notNull(),
  prazo: integer('prazo').notNull(),
  finalidade: text('finalidade'),
  garantia: text('garantia'),

  // Valores calculados
  valorTac: decimal('valor_tac', { precision: 10, scale: 2 }).notNull(),
  valorIof: decimal('valor_iof', { precision: 10, scale: 2 }).notNull(),
  valorTotalFinanciado: decimal('valor_total_financiado', { precision: 15, scale: 2 }).notNull(),
  valorLiquidoLiberado: decimal('valor_liquido_liberado', { precision: 15, scale: 2 }),

  // Dados financeiros detalhados
  jurosModalidade: text('juros_modalidade').default('pre_fixado'), // pre_fixado ou pos_fixado
  periodicidadeCapitalizacao: text('periodicidade_capitalizacao').default('mensal'),
  taxaJurosAnual: decimal('taxa_juros_anual', { precision: 5, scale: 2 }).notNull(),
  pracaPagamento: text('praca_pagamento').default('São Paulo'),
  formaPagamento: text('forma_pagamento').default('boleto'), // boleto, pix, debito
  anoBase: integer('ano_base').default(365),
  tarifaTed: decimal('tarifa_ted', { precision: 10, scale: 2 }).default('10.00'),
  taxaCredito: decimal('taxa_credito', { precision: 10, scale: 2 }),
  dataLiberacao: timestamp('data_liberacao'),
  formaLiberacao: text('forma_liberacao').default('deposito'), // deposito, ted, pix
  calculoEncargos: text('calculo_encargos'),

  // Status e análise
  status: text('status').notNull(),
  analistaId: text('analista_id').notNull(),
  dataAnalise: timestamp('data_analise'),
  motivoPendencia: text('motivo_pendencia'),
  valorAprovado: decimal('valor_aprovado', { precision: 15, scale: 2 }),
  taxaJuros: decimal('taxa_juros', { precision: 5, scale: 2 }).notNull(),
  observacoes: text('observacoes'),

  // Documentos (mantendo campos legados)
  documentos: text('documentos').array(),
  ccbDocumentoUrl: text('ccb_documento_url').notNull(),

  // Formalização - Enhanced fields
  dataAprovacao: timestamp('data_aprovacao'),
  documentosAdicionais: text('documentos_adicionais').array(),
  contratoGerado: boolean('contrato_gerado').default(false),
  contratoAssinado: boolean('contrato_assinado').default(false),
  dataAssinatura: timestamp('data_assinatura'),
  dataPagamento: timestamp('data_pagamento'),
  observacoesFormalização: text('observacoes_formalizacao'),

  // New formalization tracking fields (January 29, 2025)
  ccbGerado: boolean('ccb_gerado').notNull().default(false),
  caminhoCcb: text('caminho_ccb'), // Caminho do CCB gerado
  ccbGeradoEm: timestamp('ccb_gerado_em'), // Data de geração do CCB
  assinaturaEletronicaConcluida: boolean('assinatura_eletronica_concluida')
    .notNull()
    .default(false),
  biometriaConcluida: boolean('biometria_concluida').notNull().default(false),
  caminhoCcbAssinado: text('caminho_ccb_assinado'),

  // ClickSign Integration Fields (January 29, 2025)
  clicksignDocumentKey: text('clicksign_document_key'),
  clicksignSignerKey: text('clicksign_signer_key'),
  clicksignListKey: text('clicksign_list_key'),
  clicksignStatus: text('clicksign_status'), // 'pending', 'signed', 'cancelled', 'expired'
  clicksignSignUrl: text('clicksign_sign_url'),
  clicksignSentAt: timestamp('clicksign_sent_at'),
  clicksignSignedAt: timestamp('clicksign_signed_at'),

  // Dados de Pagamento (Destino do empréstimo) - Added August 5, 2025
  // Opção 1: Dados Bancários
  dadosPagamentoBanco: text('dados_pagamento_banco').notNull(),
  dadosPagamentoCodigoBanco: text('dados_pagamento_codigo_banco'), // Código do banco (001, 237, etc)
  dadosPagamentoAgencia: text('dados_pagamento_agencia'),
  dadosPagamentoConta: text('dados_pagamento_conta'),
  dadosPagamentoDigito: text('dados_pagamento_digito'), // Dígito da conta
  dadosPagamentoTipo: text('dados_pagamento_tipo'), // 'conta_corrente', 'conta_poupanca'
  dadosPagamentoNomeTitular: text('dados_pagamento_nome_titular'),
  dadosPagamentoCpfTitular: text('dados_pagamento_cpf_titular'),

  // Opção 2: PIX (relacionado à conta bancária)
  dadosPagamentoPix: text('dados_pagamento_pix'), // Chave PIX
  dadosPagamentoTipoPix: text('dados_pagamento_tipo_pix'), // CPF, CNPJ, Email, Telefone, Aleatória
  dadosPagamentoPixBanco: text('dados_pagamento_pix_banco'), // Banco do PIX
  dadosPagamentoPixNomeTitular: text('dados_pagamento_pix_nome_titular'), // Nome do titular do PIX
  dadosPagamentoPixCpfTitular: text('dados_pagamento_pix_cpf_titular'), // CPF do titular do PIX

  // Método escolhido
  metodoPagamento: text('metodo_pagamento').default('conta_bancaria'), // conta_bancaria ou pix

  // Comprovante de Pagamento - Added August 6, 2025
  urlComprovantePagamento: text('url_comprovante_pagamento'), // URL do comprovante no Supabase Storage

  // Tracking de boletos do Banco Inter - Added August 12, 2025
  interBoletoGerado: boolean('inter_boleto_gerado').default(false),
  interBoletoGeradoEm: timestamp('inter_boleto_gerado_em'),

  // Campos JSONB legados (mantidos para compatibilidade)
  clienteData: text('cliente_data'),
  condicoesData: text('condicoes_data'),

  // Novos campos de Empregador - Added August 20, 2025
  clienteEmpresaNome: text('cliente_empresa_nome'), // NULLABLE para retrocompatibilidade
  clienteEmpresaCnpj: text('cliente_empresa_cnpj'), // NULLABLE
  clienteCargoFuncao: text('cliente_cargo_funcao'), // NULLABLE
  clienteTempoEmprego: text('cliente_tempo_emprego'), // NULLABLE - Ex: "2 anos", "6 meses"
  clienteRendaComprovada: boolean('cliente_renda_comprovada').default(false), // NOT NULL com default

  // Novos campos Financeiros - Added August 20, 2025
  clienteDividasExistentes: decimal('cliente_dividas_existentes', { precision: 12, scale: 2 }), // NULLABLE
  clienteComprometimentoRenda: decimal('cliente_comprometimento_renda', { precision: 6, scale: 2 }).notNull(), // NOT NULL - Até 9999.99%
  clienteScoreSerasa: integer('cliente_score_serasa'), // NULLABLE - Score de crédito
  clienteRestricoesCpf: boolean('cliente_restricoes_cpf').default(false), // NOT NULL com default

  // Auditoria
  userId: text('user_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'), // Soft delete column
}, (table) => {
  return {
    // Índices de performance crítica para queries de listagem
    statusPerformanceIdx: index('idx_propostas_status_performance')
      .on(table.status, table.createdAt.desc(), table.deletedAt)
      .where(sql`deleted_at IS NULL`),
    cpfStatusIdx: index('idx_propostas_cpf_status')
      .on(table.clienteCpf, table.status)
      .where(sql`deleted_at IS NULL`),
  };
});

// Tabelas Comerciais (estrutura N:N)
export const tabelasComerciais = pgTable('tabelas_comerciais', {
  id: serial('id').primaryKey(),
  nomeTabela: text('nome_tabela').notNull(),
  taxaJuros: decimal('taxa_juros', { precision: 5, scale: 2 }).notNull(),
  taxaJurosAnual: decimal('taxa_juros_anual', { precision: 5, scale: 2 }), // Calculado da mensal
  prazos: integer('prazos').array().notNull(),
  parceiroId: integer('parceiro_id').references(() => parceiros.id),
  comissao: decimal('comissao', { precision: 5, scale: 2 }).notNull().default('0.00'),
  calculoEncargos: text('calculo_encargos'), // Fórmula de cálculo
  cetFormula: text('cet_formula'), // Como calcular CET
  createdAt: timestamp('created_at').defaultNow(),
  deletedAt: timestamp('deleted_at'), // Soft delete column
});

// Tabela de Junção N:N - Produtos <-> Tabelas Comerciais
export const produtoTabelaComercial = pgTable('produto_tabela_comercial', {
  id: serial('id').primaryKey(),
  produtoId: integer('produto_id')
    .references(() => produtos.id)
    .notNull(),
  tabelaComercialId: integer('tabela_comercial_id')
    .references(() => tabelasComerciais.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Produtos de Crédito
export const produtos = pgTable('produtos', {
  id: serial('id').primaryKey(),
  nomeProduto: text('nome_produto').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  tacValor: decimal('tac_valor', { precision: 10, scale: 2 }).default('0'),
  tacTipo: text('tac_tipo').notNull().default('fixo'),

  // Novos campos para CCB
  modalidadeJuros: text('modalidade_juros').default('pre_fixado'), // pre_fixado ou pos_fixado
  periodicidadeCapitalizacao: text('periodicidade_capitalizacao').default('mensal'),
  anoBase: integer('ano_base').default(365),
  tarifaTedPadrao: decimal('tarifa_ted_padrao', { precision: 10, scale: 2 }).default('10.00'),
  taxaCreditoPadrao: decimal('taxa_credito_padrao', { precision: 10, scale: 2 }).default('50.00'),

  createdAt: timestamp('created_at').defaultNow(),
  deletedAt: timestamp('deleted_at'), // Soft delete column
});

// Logs de Comunicação - Multi-tenant
export const comunicacaoLogs = pgTable('comunicacao_logs', {
  id: serial('id').primaryKey(),
  propostaId: text('proposta_id')
    .references(() => propostas.id)
    .notNull(), // Changed from integer to text to match propostas.id
  lojaId: integer('loja_id')
    .references(() => lojas.id)
    .notNull(), // Multi-tenant key
  tipo: text('tipo').notNull(), // email, telefone, whatsapp, sistema
  conteudo: text('conteudo').notNull(),
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

// Logs de Auditoria para Propostas
export const propostaLogs = pgTable('proposta_logs', {
  id: serial('id').primaryKey(),
  propostaId: text('proposta_id')
    .references(() => propostas.id)
    .notNull(),
  autorId: text('autor_id').notNull(), // UUID do usuário que fez a ação
  statusAnterior: text('status_anterior'),
  statusNovo: text('status_novo').notNull(),
  observacao: text('observacao'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Tabela de Junção - Propostas <-> Documentos
export const propostaDocumentos = pgTable('proposta_documentos', {
  id: serial('id').primaryKey(),
  propostaId: text('proposta_id')
    .references(() => propostas.id)
    .notNull(),
  nomeArquivo: text('nome_arquivo').notNull(),
  url: text('url').notNull(),
  tamanho: integer('tamanho'), // tamanho em bytes
  tipo: text('tipo'), // application/pdf, image/jpeg, etc
  createdAt: timestamp('created_at').defaultNow(),
});

// PAM V1.0 - Nova tabela de status contextuais (Fase 1: Fundação)
// Implementada em 19/08/2025 para resolver colisão de contextos
export const statusContextuais = pgTable('status_contextuais', {
  id: serial('id').primaryKey(),
  propostaId: text('proposta_id')
    .references(() => propostas.id, { onDelete: 'cascade' })
    .notNull(),
  contexto: text('contexto').notNull(), // 'pagamentos', 'cobrancas', 'formalizacao'
  status: text('status').notNull(),
  statusAnterior: text('status_anterior'), // Para auditoria
  atualizadoEm: timestamp('atualizado_em').defaultNow().notNull(),
  atualizadoPor: text('atualizado_por'), // UUID do usuário
  observacoes: text('observacoes'), // Notas sobre a mudança
  metadata: jsonb('metadata'), // Dados adicionais do contexto
});

// Audit Delete Log Table (Financial Compliance)
export const auditDeleteLog = pgTable('audit_delete_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tableName: text('table_name').notNull(),
  recordId: text('record_id').notNull(),
  deletedBy: uuid('deleted_by')
    .notNull()
    .references(() => profiles.id),
  deletedAt: timestamp('deleted_at').notNull().defaultNow(),
  deletionReason: text('deletion_reason'),
  recordData: text('record_data').notNull(), // JSONB stored as text
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  restoredAt: timestamp('restored_at'),
  restoredBy: uuid('restored_by').references(() => profiles.id),
});

// Referências Pessoais - Nova tabela para armazenar referências dos clientes
export const referenciaPessoal = pgTable('referencia_pessoal', {
  id: serial('id').primaryKey(),
  propostaId: text('proposta_id')
    .references(() => propostas.id, { onDelete: 'cascade' })
    .notNull(),
  nomeCompleto: text('nome_completo').notNull(),
  grauParentesco: text('grau_parentesco').notNull(), // Mãe, Pai, Irmão, Amigo, etc.
  telefone: text('telefone').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Referências Profissionais - Added August 20, 2025
export const referenciasProfissionais = pgTable('referencias_profissionais', {
  id: serial('id').primaryKey(),
  propostaId: text('proposta_id')
    .references(() => propostas.id, { onDelete: 'cascade' })
    .notNull()
    .unique(), // UNIQUE constraint - apenas uma referência profissional por proposta

  // Dados da Referência
  nomeCompleto: text('nome_completo').notNull(),
  cargoFuncao: text('cargo_funcao').notNull(),
  empresaNome: text('empresa_nome').notNull(),
  empresaTelefone: text('empresa_telefone').notNull(),
  tempoConhecimento: text('tempo_conhecimento').notNull(), // "2 anos", "5 meses"

  // Relacionamento
  tipoRelacionamento: text('tipo_relacionamento').notNull(), // "supervisor", "colega", "rh"

  // Auditoria
  createdAt: timestamp('created_at').defaultNow(),
});

// Configuração da Empresa (Credor)
export const configuracaoEmpresa = pgTable('configuracao_empresa', {
  id: serial('id').primaryKey(),

  // Dados da Simpix (Credor)
  razaoSocial: text('razao_social').notNull().default('SIMPIX LTDA'),
  cnpj: text('cnpj').notNull().default('00.000.000/0001-00'),
  endereco: text('endereco').notNull().default('Av. Paulista, 1000'),
  complemento: text('complemento').default('10º andar'),
  bairro: text('bairro').default('Bela Vista'),
  cep: text('cep').notNull().default('01310-100'),
  cidade: text('cidade').notNull().default('São Paulo'),
  uf: text('uf').notNull().default('SP'),
  telefone: text('telefone').default('(11) 3000-0000'),
  email: text('email').default('contato@simpix.com.br'),

  // Configurações de CCB
  pracaPagamentoPadrao: text('praca_pagamento_padrao').default('São Paulo'),
  anoBasePadrao: integer('ano_base_padrao').default(365),

  createdAt: timestamp('created_at').defaultNow(),
});

// Banco Inter Integration Tables
export const interCollections = pgTable('inter_collections', {
  id: serial('id').primaryKey(),
  propostaId: text('proposta_id')
    .references(() => propostas.id)
    .notNull(),
  codigoSolicitacao: text('codigo_solicitacao').notNull().unique(), // Inter's unique ID
  seuNumero: text('seu_numero').notNull(), // Our reference number
  valorNominal: decimal('valor_nominal', { precision: 12, scale: 2 }).notNull(),
  dataVencimento: text('data_vencimento').notNull(), // YYYY-MM-DD format
  situacao: text('situacao').notNull().default('EM_PROCESSAMENTO'), // Inter status
  dataSituacao: text('data_situacao'),
  nossoNumero: text('nosso_numero'), // Bank reference number
  codigoBarras: text('codigo_barras'), // Barcode for boleto
  linhaDigitavel: text('linha_digitavel'), // Digitizable line
  pixTxid: text('pix_txid'), // PIX transaction ID
  pixCopiaECola: text('pix_copia_e_cola'), // PIX copy-paste code
  valorTotalRecebido: decimal('valor_total_recebido', { precision: 12, scale: 2 }),
  origemRecebimento: text('origem_recebimento'), // BOLETO or PIX
  dataEmissao: text('data_emissao'),
  numeroParcela: integer('numero_parcela'), // Número da parcela (1, 2, 3...)
  totalParcelas: integer('total_parcelas'), // Total de parcelas

  // Novos campos para CCB
  vencimentoPrimeiraParcela: text('vencimento_primeira_parcela'),
  vencimentoUltimaParcela: text('vencimento_ultima_parcela'),
  formaPagamento: text('forma_pagamento'), // boleto, pix, debito

  isActive: boolean('is_active').default(true).notNull(),
  motivoCancelamento: text('motivo_cancelamento'), // Razão do cancelamento
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Tabela de histórico e observações de cobrança
export const historicoObservacoesCobranca = pgTable('historico_observacoes_cobranca', {
  id: uuid('id').defaultRandom().primaryKey(),
  propostaId: text('proposta_id')
    .references(() => propostas.id)
    .notNull(),
  mensagem: text('mensagem').notNull(),
  criadoPor: text('criado_por').notNull(), // Email do usuário
  tipoAcao: text('tipo_acao'), // DESCONTO_QUITACAO, PRORROGACAO, OBSERVACAO, etc
  dadosAcao: jsonb('dados_acao'), // JSON com detalhes da ação
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const interWebhooks = pgTable('inter_webhooks', {
  id: serial('id').primaryKey(),
  url: text('url').notNull(),
  eventos: text('eventos').array().notNull(), // Array of webhook events
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const interCallbacks = pgTable('inter_callbacks', {
  id: serial('id').primaryKey(),
  codigoSolicitacao: text('codigo_solicitacao').notNull(),
  evento: text('evento').notNull(), // Type of event received
  payload: text('payload').notNull(), // Full JSON payload
  processado: boolean('processado').default(false).notNull(),
  erro: text('erro'), // Error message if processing failed
  createdAt: timestamp('created_at').defaultNow(),
  processedAt: timestamp('processed_at'),
});

// Tabela de Parcelas - Controle de pagamentos parcelados
export const parcelas = pgTable('parcelas', {
  id: serial('id').primaryKey(),
  propostaId: text('proposta_id')
    .references(() => propostas.id, { onDelete: 'cascade' })
    .notNull(),
  numeroParcela: integer('numero_parcela').notNull(),
  valorParcela: decimal('valor_parcela', { precision: 12, scale: 2 }).notNull(),
  dataVencimento: text('data_vencimento').notNull(), // YYYY-MM-DD
  dataPagamento: text('data_pagamento'), // YYYY-MM-DD
  status: text('status').notNull().default('pendente'), // pendente, pago, vencido
  codigoBoleto: text('codigo_boleto'),
  linhaDigitavel: text('linha_digitavel'),
  codigoBarras: text('codigo_barras'),
  formaPagamento: text('forma_pagamento'), // boleto, pix, transferencia
  comprovantePagamento: text('comprovante_pagamento'), // URL do comprovante
  observacoes: text('observacoes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Observações de Cobrança - Sistema de histórico de contatos
export const observacoesCobranca = pgTable('observacoes_cobranca', {
  id: serial('id').primaryKey(),
  propostaId: text('proposta_id')
    .references(() => propostas.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => profiles.id)
    .notNull(),
  userName: text('user_name').notNull(), // Nome do usuário que fez a observação
  observacao: text('observacao').notNull(),
  tipoContato: text('tipo_contato'), // telefone, whatsapp, sms, email, presencial
  statusPromessa: text('status_promessa'), // promessa_pagamento, recusa, sem_contato, etc
  dataPromessaPagamento: timestamp('data_promessa_pagamento'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Zod Schemas para validação
export const insertParceiroSchema = createInsertSchema(parceiros).omit({
  id: true,
  createdAt: true,
});

export const updateParceiroSchema = createInsertSchema(parceiros).partial().omit({
  id: true,
  createdAt: true,
});

export const insertLojaSchema = createInsertSchema(lojas).omit({
  id: true,
  createdAt: true,
});

export const updateLojaSchema = createInsertSchema(lojas).partial().omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertPropostaSchema = createInsertSchema(propostas).omit({
  id: true,
  createdAt: true,
  userId: true,
});

// CORREÇÃO CRÍTICA: Schema específico para estrutura JSONB real
export const insertPropostaJsonbSchema = z.object({
  status: z.string().default('rascunho'),
  loja_id: z.number().int().positive(),
  produto_id: z.number().int().positive().optional(),
  tabela_comercial_id: z.number().int().positive().optional(),
  cliente_data: z.object({
    nome: z.string().min(1),
    cpf: z.string().min(11),
    email: z.string().email(),
    telefone: z.string().min(10),
    dataNascimento: z.string().optional(),
    renda: z.string().optional(),
    rg: z.string().optional(),
    orgaoEmissor: z.string().optional(),
    estadoCivil: z.string().optional(),
    nacionalidade: z.string().default('Brasileira'),
    cep: z.string().optional(),
    endereco: z.string().optional(),
    ocupacao: z.string().optional(),
  }),
  condicoes_data: z.object({
    valor: z.number().positive(),
    prazo: z.number().int().positive(),
    finalidade: z.string().optional(),
    garantia: z.string().optional(),
    valorTac: z.number().optional(),
    valorIof: z.number().optional(),
    valorTotalFinanciado: z.number().optional(),
  }),
});

export const updatePropostaSchema = createInsertSchema(propostas).partial().omit({
  id: true,
  createdAt: true,
  userId: true,
});

// 🔒 SCHEMA DE VALIDAÇÃO SIMPLIFICADA PARA CRIAÇÃO DE PROPOSTAS
// Schema permissivo - TODOS campos opcionais
export const createPropostaValidationSchema = z.object({
  // Todos os campos são opcionais e aceitam qualquer valor
  lojaId: z.any().optional(),
  clienteNome: z.any().optional(),
  clienteCpf: z.any().optional(),
  clienteEmail: z.any().optional(),
  clienteTelefone: z.any().optional(),
  valor: z.any().optional(),
  prazo: z.any().optional(),
  valorTotalFinanciado: z.any().optional(),
  valorTac: z.any().optional(),
  valorIof: z.any().optional(),

  // Todos os outros campos opcionais
  clienteDataNascimento: z.any().optional(),
  clienteRenda: z.any().optional(),
  clienteRg: z.any().optional(),
  clienteOrgaoEmissor: z.any().optional(),
  clienteRgUf: z.any().optional(),
  clienteRgDataEmissao: z.any().optional(),
  clienteEstadoCivil: z.any().optional(),
  clienteNacionalidade: z.any().optional(),
  clienteLocalNascimento: z.any().optional(),
  clienteEmpresaNome: z.any().optional(),
  clienteDataAdmissao: z.any().optional(),
  clienteDividasExistentes: z.any().optional(),
  clienteCep: z.any().optional(),
  clienteLogradouro: z.any().optional(),
  clienteNumero: z.any().optional(),
  clienteComplemento: z.any().optional(),
  clienteBairro: z.any().optional(),
  clienteCidade: z.any().optional(),
  clienteUf: z.any().optional(),
  clienteOcupacao: z.any().optional(),
  tipoPessoa: z.any().optional(),
  clienteRazaoSocial: z.any().optional(),
  clienteCnpj: z.any().optional(),
  finalidade: z.any().optional(),
  garantia: z.any().optional(),
  produtoId: z.any().optional(),
  tabelaComercialId: z.any().optional(),
  // Todos os outros campos opcionais
  status: z.any().optional(),
  metodoPagamento: z.any().optional(),
  dadosPagamentoBanco: z.any().optional(),
  dadosPagamentoAgencia: z.any().optional(),
  dadosPagamentoConta: z.any().optional(),
  dadosPagamentoDigito: z.any().optional(),
  dadosPagamentoPix: z.any().optional(),
  dadosPagamentoTipoPix: z.any().optional(),
  dadosPagamentoPixBanco: z.any().optional(),
  dadosPagamentoPixNomeTitular: z.any().optional(),
  dadosPagamentoPixCpfTitular: z.any().optional(),
  dadosPagamentoNomeTitular: z.any().optional(),
  dadosPagamentoCpfTitular: z.any().optional(),

  // Campos adicionais necessários para compatibilidade com o frontend
  clienteEndereco: z.string().optional(), // Campo legado
  clienteTelefoneEmpresa: z.string().optional(),
  referenciaPessoal: z.array(z.any()).optional(),
  dataCarencia: z.string().optional(),
  incluirTac: z.boolean().optional(),
  formaLiberacao: z.string().optional(),
  formaPagamento: z.string().optional(),
  pracaPagamento: z.string().optional(),
}); // REMOVIDO .strict() para permitir flexibilidade

export const insertTabelaComercialSchema = createInsertSchema(tabelasComerciais).omit({
  id: true,
  createdAt: true,
});

export const insertProdutoTabelaComercialSchema = createInsertSchema(produtoTabelaComercial).omit({
  id: true,
  createdAt: true,
});

export const insertProdutoSchema = createInsertSchema(produtos)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    tacValor: z.number().min(0).default(0),
    tacTipo: z.enum(['fixo', 'percentual']).default('fixo'),
  });

export const insertPropostaDocumentoSchema = createInsertSchema(propostaDocumentos).omit({
  id: true,
  createdAt: true,
});

export const insertComunicacaoLogSchema = createInsertSchema(comunicacaoLogs).omit({
  id: true,
  createdAt: true,
});

export const insertPropostaLogSchema = createInsertSchema(propostaLogs).omit({
  id: true,
  createdAt: true,
});

export const insertGerenteLojaSchema = createInsertSchema(gerenteLojas).omit({
  createdAt: true,
});

// Inter Bank schemas
export const insertInterCollectionSchema = createInsertSchema(interCollections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateInterCollectionSchema = createInsertSchema(interCollections).partial().omit({
  id: true,
  propostaId: true,
  createdAt: true,
});

export const insertInterWebhookSchema = createInsertSchema(interWebhooks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema para referências pessoais
export const insertReferenciaPessoalSchema = createInsertSchema(referenciaPessoal).omit({
  id: true,
  createdAt: true,
});

export const insertReferenciaPessoalBase = z.object({
  nomeCompleto: z.string().min(3, 'Nome completo é obrigatório'),
  grauParentesco: z.string().min(2, 'Grau de parentesco é obrigatório'),
  telefone: z.string().min(10, 'Telefone é obrigatório'),
  tipo_referencia: z.enum(['pessoal', 'profissional'], {
    errorMap: () => ({ message: "Tipo de referência deve ser 'pessoal' ou 'profissional'" }),
  }),
});

// Schema para validar array de exatamente 2 referências (PAM V1.1)
export const validateReferenciasCompletas = z
  .array(insertReferenciaPessoalBase)
  .length(2, 'São obrigatórias exatamente 2 referências')
  .refine(
    (refs) => {
      const tipos = refs.map((r) => r.tipo_referencia);
      // PAM V1.1: Primeira referência deve ser pessoal, segunda pode ser qualquer tipo
      return tipos.length === 2 && refs[0].tipo_referencia === 'pessoal';
    },
    {
      message: 'A primeira referência deve ser pessoal, a segunda pode ser pessoal ou profissional',
    }
  );

export const insertInterCallbackSchema = createInsertSchema(interCallbacks).omit({
  id: true,
  createdAt: true,
});

// Security logs table for autonomous monitoring
export const security_logs = pgTable('security_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventType: text('event_type').notNull(),
  severity: text('severity').notNull(), // LOW, MEDIUM, HIGH, CRITICAL
  ipAddress: text('ip_address'),
  userId: uuid('user_id'),
  userAgent: text('user_agent'),
  endpoint: text('endpoint'),
  statusCode: integer('status_code'),
  success: boolean('success').default(true),
  details: jsonb('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Status Transitions Audit Table - Sistema de Status V2.0
export const statusTransitions = pgTable('status_transitions', {
  id: serial('id').primaryKey(),
  propostaId: text('proposta_id')
    .notNull()
    .references(() => propostas.id, { onDelete: 'cascade' }),
  fromStatus: text('from_status'), // Pode ser null para criação inicial
  toStatus: text('to_status').notNull(),
  triggeredBy: text('triggered_by').notNull(), // 'api', 'webhook', 'manual', 'scheduler', 'system'
  metadata: jsonb('metadata'), // Dados adicionais sobre a transição
  userId: uuid('user_id'), // Usuário que realizou a ação (quando aplicável)
  webhookEventId: text('webhook_event_id'), // ID do evento de webhook (quando aplicável)
  errorMessage: text('error_message'), // Para transições que falharam
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// PAM V1.0 Blueprint V2.0 - Tabela de Solicitações de Modificação para Workflow de Aprovação
export const solicitacoesModificacao = pgTable('solicitacoes_modificacao', {
  id: serial('id').primaryKey(),
  propostaId: text('proposta_id')
    .notNull()
    .references(() => propostas.id, { onDelete: 'cascade' }),
  codigoSolicitacao: text('codigo_solicitacao'), // Código da solicitação no Banco Inter
  tipoSolicitacao: text('tipo_solicitacao').notNull(), // 'desconto' ou 'prorrogacao'
  dadosSolicitacao: jsonb('dados_solicitacao').notNull(), // JSON com dados específicos da solicitação
  status: text('status').notNull().default('pendente'), // 'pendente', 'aprovado', 'rejeitado', 'executado'
  solicitadoPorId: uuid('solicitado_por_id')
    .notNull()
    .references(() => profiles.id),
  solicitadoPorNome: text('solicitado_por_nome').notNull(),
  solicitadoPorRole: text('solicitado_por_role').notNull(),
  aprovadoPorId: uuid('aprovado_por_id').references(() => profiles.id),
  aprovadoPorNome: text('aprovado_por_nome'),
  observacaoSolicitante: text('observacao_solicitante'),
  observacaoAprovador: text('observacao_aprovador'),
  motivoRejeicao: text('motivo_rejeicao'),
  dataAprovacao: timestamp('data_aprovacao'),
  dataExecucao: timestamp('data_execucao'),
  erroExecucao: text('erro_execucao'), // Erro caso falhe ao executar no Inter
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// TypeScript Types
export type InsertParceiro = z.infer<typeof insertParceiroSchema>;
export type Parceiro = typeof parceiros.$inferSelect;
export type InsertLoja = z.infer<typeof insertLojaSchema>;
export type UpdateLoja = z.infer<typeof updateLojaSchema>;
export type Loja = typeof lojas.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertProposta = z.infer<typeof insertPropostaSchema>;
export type UpdateProposta = z.infer<typeof updatePropostaSchema>;
export type Proposta = typeof propostas.$inferSelect;
export type InsertTabelaComercial = z.infer<typeof insertTabelaComercialSchema>;
export type TabelaComercial = typeof tabelasComerciais.$inferSelect;
export type InsertProdutoTabelaComercial = z.infer<typeof insertProdutoTabelaComercialSchema>;
export type ProdutoTabelaComercial = typeof produtoTabelaComercial.$inferSelect;
export type InsertPropostaJsonb = z.infer<typeof insertPropostaJsonbSchema>;
export type InsertProduto = z.infer<typeof insertProdutoSchema>;
export type Produto = typeof produtos.$inferSelect;
export type InsertComunicacaoLog = z.infer<typeof insertComunicacaoLogSchema>;
export type ComunicacaoLog = typeof comunicacaoLogs.$inferSelect;
export type InsertPropostaLog = z.infer<typeof insertPropostaLogSchema>;
export type PropostaLog = typeof propostaLogs.$inferSelect;
export type InsertGerenteLojas = z.infer<typeof insertGerenteLojaSchema>;
export type GerenteLojas = typeof gerenteLojas.$inferSelect;
export type InsertPropostaDocumento = z.infer<typeof insertPropostaDocumentoSchema>;
export type PropostaDocumento = typeof propostaDocumentos.$inferSelect;

// Inter Bank types
export type InsertInterCollection = z.infer<typeof insertInterCollectionSchema>;
export type UpdateInterCollection = z.infer<typeof updateInterCollectionSchema>;
export type InterCollection = typeof interCollections.$inferSelect;
export type InsertInterWebhook = z.infer<typeof insertInterWebhookSchema>;
export type InterWebhook = typeof interWebhooks.$inferSelect;
export type InsertInterCallback = z.infer<typeof insertInterCallbackSchema>;
export type InterCallback = typeof interCallbacks.$inferSelect;

// Referência Pessoal types
export type InsertReferenciaPessoal = z.infer<typeof insertReferenciaPessoalSchema>;
export type ReferenciaPessoal = typeof referenciaPessoal.$inferSelect;

// Status Transitions types - Sistema de Status V2.0
export const insertStatusTransitionSchema = createInsertSchema(statusTransitions).omit({
  id: true,
  createdAt: true,
});

export type InsertStatusTransition = z.infer<typeof insertStatusTransitionSchema>;
export type StatusTransition = typeof statusTransitions.$inferSelect;

// Solicitações Modificação types - PAM V1.0 Blueprint V2.0
export const insertSolicitacaoModificacaoSchema = createInsertSchema(solicitacoesModificacao).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  aprovadoPorId: true,
  aprovadoPorNome: true,
  dataAprovacao: true,
  dataExecucao: true,
  erroExecucao: true,
});

export const updateSolicitacaoModificacaoSchema = createInsertSchema(solicitacoesModificacao)
  .partial()
  .omit({
    id: true,
    createdAt: true,
    solicitadoPorId: true,
    solicitadoPorNome: true,
    solicitadoPorRole: true,
  });

export type InsertSolicitacaoModificacao = z.infer<typeof insertSolicitacaoModificacaoSchema>;
export type UpdateSolicitacaoModificacao = z.infer<typeof updateSolicitacaoModificacaoSchema>;
export type SolicitacaoModificacao = typeof solicitacoesModificacao.$inferSelect;

// PAM V1.0 - Sistema de Alertas Proativos (15/08/2025)
// Tabela principal de notificações
export const notificacoes = pgTable('notificacoes', {
  id: serial('id').primaryKey(),

  // Identificação
  tipo: varchar('tipo', { length: 100 }).notNull(), // "alto_valor_vencimento_proximo"
  titulo: varchar('titulo', { length: 255 }).notNull(), // "Proposta de Alto Valor Vencendo"
  mensagem: text('mensagem').notNull(), // "Proposta #12345 de João Silva..."

  // Priorização
  prioridade: varchar('prioridade', { length: 20 }).notNull(), // "BAIXA", "MEDIA", "ALTA", "CRITICA"
  categoria: varchar('categoria', { length: 50 }).notNull(), // "vencimento", "atraso", "pagamento"

  // Relacionamento
  propostaId: varchar('proposta_id', { length: 36 }), // ID da proposta relacionada
  linkRelacionado: varchar('link_relacionado', { length: 500 }), // "/financeiro/cobrancas?id=..."

  // Destinatário
  userId: varchar('user_id', { length: 36 }).notNull(), // A quem é dirigida
  userRole: varchar('user_role', { length: 50 }), // Role para filtros

  // Status e Rastreamento
  status: varchar('status', { length: 20 }).notNull().default('nao_lida'), // "nao_lida", "lida", "arquivada"
  dataLeitura: timestamp('data_leitura'),
  dataArquivamento: timestamp('data_arquivamento'),

  // Metadados
  dadosAdicionais: jsonb('dados_adicionais'), // Dados específicos do alerta
  origem: varchar('origem', { length: 50 }).notNull().default('sistema'), // "sistema", "webhook", "manual"

  // Auditoria
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Tabela de configuração de regras de alertas
export const regrasAlertas = pgTable('regras_alertas', {
  id: serial('id').primaryKey(),
  nome: varchar('nome', { length: 100 }).notNull().unique(),
  descricao: text('descricao').notNull(),

  // Configuração
  ativa: boolean('ativa').notNull().default(true),
  trigger: varchar('trigger', { length: 20 }).notNull(), // "cron", "webhook"
  prioridade: varchar('prioridade', { length: 20 }).notNull(),

  // Query e Lógica
  querySQL: text('query_sql'),
  condicoes: jsonb('condicoes'), // Parâmetros configuráveis
  destinatarios: jsonb('destinatarios'), // Array de roles

  // Limitadores (evitar spam)
  limiteExecutacoesDia: integer('limite_execucoes_dia').default(1),
  intervaloMinimoMinutos: integer('intervalo_minimo_minutos').default(60),

  // Auditoria
  criadoPor: varchar('criado_por', { length: 36 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Tabela de histórico de execuções de alertas
export const historicoExecucoesAlertas = pgTable('historico_execucoes_alertas', {
  id: serial('id').primaryKey(),
  regraId: integer('regra_id')
    .notNull()
    .references(() => regrasAlertas.id),

  // Execução
  dataExecucao: timestamp('data_execucao').notNull().defaultNow(),
  duracao: integer('duracao'), // em milissegundos
  status: varchar('status', { length: 20 }).notNull(), // "sucesso", "erro", "sem_resultados"

  // Resultados
  registrosProcessados: integer('registros_processados').default(0),
  notificacoesCriadas: integer('notificacoes_criadas').default(0),
  erroDetalhes: text('erro_detalhes'),

  // Contexto
  triggerOrigem: varchar('trigger_origem', { length: 50 }), // "cron", "webhook_clicksign"
  dadosContexto: jsonb('dados_contexto'),
});

// ========================================================================
// SPRINT 2: DOMAIN ENTITIES - CCBs e Boletos (Banking-Grade Performance)
// ========================================================================

// Tabela de CCBs (Cédulas de Crédito Bancário) - Documentos formalizados
export const ccbs = pgTable('ccbs', {
  id: uuid('id').defaultRandom().primaryKey(),
  propostaId: text('proposta_id')
    .references(() => propostas.id, { onDelete: 'cascade' })
    .notNull(),
  
  // Identificação do documento
  numeroCCB: text('numero_ccb').notNull().unique(), // Número único da CCB
  valorCCB: decimal('valor_ccb', { precision: 15, scale: 2 }).notNull(),
  
  // Estados do ciclo de vida da CCB
  status: text('status').notNull().default('gerada'), // gerada, enviada_assinatura, assinada, cancelada
  
  // Dados do documento original
  caminhoDocumentoOriginal: text('caminho_documento_original'), // CCB gerada (PDF)
  urlDocumentoOriginal: text('url_documento_original'), // URL do storage
  
  // Dados do documento assinado
  caminhoDocumentoAssinado: text('caminho_documento_assinado'), // CCB assinada (PDF)
  urlDocumentoAssinado: text('url_documento_assinado'), // URL do storage
  
  // Integração ClickSign
  clicksignDocumentKey: text('clicksign_document_key'), // Chave do documento no ClickSign
  clicksignSignerKey: text('clicksign_signer_key'), // Chave do signatário
  clicksignListKey: text('clicksign_list_key'), // Chave da lista
  clicksignSignUrl: text('clicksign_sign_url'), // URL de assinatura
  clicksignStatus: text('clicksign_status'), // Status no ClickSign
  
  // Controle de tempo
  dataEnvioAssinatura: timestamp('data_envio_assinatura'),
  dataAssinaturaConcluida: timestamp('data_assinatura_concluida'),
  prazoAssinatura: timestamp('prazo_assinatura'), // Prazo limite para assinatura
  
  // Metadados
  tamanhoArquivo: integer('tamanho_arquivo'), // Tamanho em bytes
  hashDocumento: text('hash_documento'), // Hash SHA-256 para integridade
  versaoTemplate: text('versao_template').default('1.0'), // Controle de versão do template
  
  // Auditoria e soft delete
  criadoPor: uuid('criado_por').references(() => profiles.id),
  observacoes: text('observacoes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'), // Soft delete
});

// Tabela de Boletos - Documentos de cobrança independentes do Inter
export const boletos = pgTable('boletos', {
  id: uuid('id').defaultRandom().primaryKey(),
  propostaId: text('proposta_id')
    .references(() => propostas.id, { onDelete: 'cascade' })
    .notNull(),
  ccbId: uuid('ccb_id')
    .references(() => ccbs.id, { onDelete: 'cascade' }),
  
  // Identificação do boleto
  numeroBoleto: text('numero_boleto').notNull(), // Número sequencial único
  numeroParcela: integer('numero_parcela').notNull(), // 1, 2, 3...
  totalParcelas: integer('total_parcelas').notNull(),
  
  // Dados financeiros
  valorPrincipal: decimal('valor_principal', { precision: 12, scale: 2 }).notNull(),
  valorJuros: decimal('valor_juros', { precision: 10, scale: 2 }).default('0.00'),
  valorMulta: decimal('valor_multa', { precision: 10, scale: 2 }).default('0.00'),
  valorTotal: decimal('valor_total', { precision: 12, scale: 2 }).notNull(),
  
  // Datas importantes
  dataVencimento: text('data_vencimento').notNull(), // YYYY-MM-DD
  dataEmissao: text('data_emissao').notNull(), // YYYY-MM-DD
  dataPagamento: text('data_pagamento'), // YYYY-MM-DD quando pago
  
  // Status e controle
  status: text('status').notNull().default('emitido'), // emitido, vencido, pago, cancelado
  formaPagamento: text('forma_pagamento'), // boleto, pix, transferencia
  
  // Integração bancária (Inter ou outros)
  bancoOrigemId: text('banco_origem_id'), // Identificador no banco
  codigoBarras: text('codigo_barras'),
  linhaDigitavel: text('linha_digitavel'),
  nossoNumero: text('nosso_numero'), // Número de controle do banco
  
  // PIX (se disponível)
  pixTxid: text('pix_txid'),
  pixCopiaECola: text('pix_copia_e_cola'),
  qrCodePix: text('qr_code_pix'), // Base64 ou URL
  
  // Documentos e comprovantes
  urlBoleto: text('url_boleto'), // URL do boleto em PDF
  urlComprovantePagamento: text('url_comprovante_pagamento'),
  
  // Histórico de tentativas
  tentativasEnvio: integer('tentativas_envio').default(0),
  ultimoEnvio: timestamp('ultimo_envio'),
  motivoCancelamento: text('motivo_cancelamento'),
  
  // Auditoria e soft delete
  geradoPor: uuid('gerado_por').references(() => profiles.id),
  observacoes: text('observacoes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'), // Soft delete
});


// ========================================================================
// SCHEMAS ZOD PARA VALIDAÇÃO DAS NOVAS ENTIDADES
// ========================================================================

// CCBs - Schemas de validação
export const insertCcbSchema = createInsertSchema(ccbs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const updateCcbSchema = createInsertSchema(ccbs).partial().omit({
  id: true,
  propostaId: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

// Boletos - Schemas de validação
export const insertBoletoSchema = createInsertSchema(boletos).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const updateBoletoSchema = createInsertSchema(boletos).partial().omit({
  id: true,
  propostaId: true,
  ccbId: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

// Schemas de inserção existentes
export const insertNotificacaoSchema = createInsertSchema(notificacoes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  dataLeitura: true,
  dataArquivamento: true,
});

export const insertRegraAlertaSchema = createInsertSchema(regrasAlertas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHistoricoExecucaoAlertaSchema = createInsertSchema(
  historicoExecucoesAlertas
).omit({
  id: true,
  dataExecucao: true,
});

// ========================================================================
// TYPES PARA NOVAS ENTIDADES (SPRINT 2)
// ========================================================================

// CCBs Types
export type InsertCcb = z.infer<typeof insertCcbSchema>;
export type UpdateCcb = z.infer<typeof updateCcbSchema>;
export type Ccb = typeof ccbs.$inferSelect;

// Boletos Types
export type InsertBoleto = z.infer<typeof insertBoletoSchema>;
export type UpdateBoleto = z.infer<typeof updateBoletoSchema>;
export type Boleto = typeof boletos.$inferSelect;

// Types para Alertas Proativos
export type InsertNotificacao = z.infer<typeof insertNotificacaoSchema>;
export type Notificacao = typeof notificacoes.$inferSelect;
export type InsertRegraAlerta = z.infer<typeof insertRegraAlertaSchema>;
export type RegraAlerta = typeof regrasAlertas.$inferSelect;
export type InsertHistoricoExecucaoAlerta = z.infer<typeof insertHistoricoExecucaoAlertaSchema>;
export type HistoricoExecucaoAlerta = typeof historicoExecucoesAlertas.$inferSelect;

