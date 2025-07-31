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
  jsonb
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Parceiros e Lojas
export const parceiros = pgTable("parceiros", {
  id: serial("id").primaryKey(),
  razaoSocial: text("razao_social").notNull(),
  cnpj: text("cnpj").notNull().unique(),
  comissaoPadrao: decimal("comissao_padrao"),
  tabelaComercialPadraoId: integer("tabela_comercial_padrao_id"),
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at"), // Soft delete column
});

export const lojas = pgTable("lojas", {
  id: serial("id").primaryKey(),
  parceiroId: integer("parceiro_id").references(() => parceiros.id).notNull(),
  nomeLoja: text("nome_loja").notNull(),
  endereco: text("endereco").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at"), // Soft delete column
});

// Profiles table (Supabase auth integration)
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name"),
  role: text("role"),
  lojaId: integer("loja_id").references(() => lojas.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"), // Soft delete column
});

// Usuários e Perfis (legacy table)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // admin, analyst, user
  createdAt: timestamp("created_at").defaultNow(),
});

// Tabela para rastrear sessões ativas dos usuários
export const userSessions = pgTable("user_sessions", {
  id: varchar("id", { length: 255 }).primaryKey(), // Session ID (token)
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  token: varchar("token", { length: 2048 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  device: varchar("device", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

// Tabela de junção para relacionamento muitos-para-muitos Gerentes x Lojas
export const gerenteLojas = pgTable("gerente_lojas", {
  gerenteId: integer("gerente_id").references(() => users.id).notNull(),
  lojaId: integer("loja_id").references(() => lojas.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.gerenteId, table.lojaId] }),
}));

export const statusEnum = pgEnum("status", [
  "rascunho",
  "aguardando_analise",
  "em_analise",
  "pendente",
  "aprovado",
  "rejeitado",
  "documentos_enviados",
  "contratos_preparados",
  "contratos_assinados",
  "pronto_pagamento",
  "pago",
  "cancelado",
  "suspensa",
]);

export const propostas = pgTable("propostas", {
  id: text("id").primaryKey(),
  lojaId: integer("loja_id").notNull(), // Multi-tenant key
  
  // Relacionamentos de negócio
  produtoId: integer("produto_id").references(() => produtos.id),
  tabelaComercialId: integer("tabela_comercial_id").references(() => tabelasComerciais.id),
  
  // Cliente dados básicos (mantendo campos existentes para compatibilidade)
  clienteNome: text("cliente_nome"),
  clienteCpf: text("cliente_cpf"),
  clienteEmail: text("cliente_email"),
  clienteTelefone: text("cliente_telefone"),
  clienteDataNascimento: text("cliente_data_nascimento"),
  clienteRenda: text("cliente_renda"),
  
  // Cliente dados adicionais (novos campos normalizados)
  clienteRg: text("cliente_rg"),
  clienteOrgaoEmissor: text("cliente_orgao_emissor"),
  clienteEstadoCivil: text("cliente_estado_civil"),
  clienteNacionalidade: text("cliente_nacionalidade").default("Brasileira"),
  clienteCep: text("cliente_cep"),
  clienteEndereco: text("cliente_endereco"),
  clienteOcupacao: text("cliente_ocupacao"),

  // Empréstimo dados
  valor: decimal("valor", { precision: 15, scale: 2 }),
  prazo: integer("prazo"),
  finalidade: text("finalidade"),
  garantia: text("garantia"),

  // Valores calculados
  valorTac: decimal("valor_tac", { precision: 10, scale: 2 }),
  valorIof: decimal("valor_iof", { precision: 10, scale: 2 }),
  valorTotalFinanciado: decimal("valor_total_financiado", { precision: 15, scale: 2 }),

  // Status e análise
  status: text("status").notNull(),
  analistaId: text("analista_id"),
  dataAnalise: timestamp("data_analise"),
  motivoPendencia: text("motivo_pendencia"),
  valorAprovado: decimal("valor_aprovado", { precision: 15, scale: 2 }),
  taxaJuros: decimal("taxa_juros", { precision: 5, scale: 2 }),
  observacoes: text("observacoes"),

  // Documentos (mantendo campos legados)
  documentos: text("documentos").array(),
  ccbDocumentoUrl: text("ccb_documento_url"),
  
  // Formalização - Enhanced fields
  dataAprovacao: timestamp("data_aprovacao"),
  documentosAdicionais: text("documentos_adicionais").array(),
  contratoGerado: boolean("contrato_gerado").default(false),
  contratoAssinado: boolean("contrato_assinado").default(false),
  dataAssinatura: timestamp("data_assinatura"),
  dataPagamento: timestamp("data_pagamento"),
  observacoesFormalização: text("observacoes_formalizacao"),
  
  // New formalization tracking fields (January 29, 2025)
  ccbGerado: boolean("ccb_gerado").notNull().default(false),
  assinaturaEletronicaConcluida: boolean("assinatura_eletronica_concluida").notNull().default(false),
  biometriaConcluida: boolean("biometria_concluida").notNull().default(false),
  caminhoCcbAssinado: text("caminho_ccb_assinado"),

  // ClickSign Integration Fields (January 29, 2025)
  clicksignDocumentKey: text("clicksign_document_key"),
  clicksignSignerKey: text("clicksign_signer_key"),
  clicksignListKey: text("clicksign_list_key"),
  clicksignStatus: text("clicksign_status"), // 'pending', 'signed', 'cancelled', 'expired'
  clicksignSignUrl: text("clicksign_sign_url"),
  clicksignSentAt: timestamp("clicksign_sent_at"),
  clicksignSignedAt: timestamp("clicksign_signed_at"),

  // Campos JSONB legados (mantidos para compatibilidade)
  clienteData: text("cliente_data"),
  condicoesData: text("condicoes_data"),

  // Auditoria
  userId: text("user_id"),
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at"), // Soft delete column
});

// Tabelas Comerciais (estrutura N:N)
export const tabelasComerciais = pgTable("tabelas_comerciais", {
  id: serial("id").primaryKey(),
  nomeTabela: text("nome_tabela").notNull(),
  taxaJuros: decimal("taxa_juros", { precision: 5, scale: 2 }).notNull(),
  prazos: integer("prazos").array().notNull(),
  parceiroId: integer("parceiro_id").references(() => parceiros.id),
  comissao: decimal("comissao", { precision: 5, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at"), // Soft delete column
});

// Tabela de Junção N:N - Produtos <-> Tabelas Comerciais
export const produtoTabelaComercial = pgTable("produto_tabela_comercial", {
  id: serial("id").primaryKey(),
  produtoId: integer("produto_id").references(() => produtos.id).notNull(),
  tabelaComercialId: integer("tabela_comercial_id").references(() => tabelasComerciais.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Produtos de Crédito
export const produtos = pgTable("produtos", {
  id: serial("id").primaryKey(),
  nomeProduto: text("nome_produto").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  tacValor: decimal("tac_valor", { precision: 10, scale: 2 }).default("0"),
  tacTipo: text("tac_tipo").notNull().default("fixo"),
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at"), // Soft delete column
});

// Logs de Comunicação - Multi-tenant  
export const comunicacaoLogs = pgTable("comunicacao_logs", {
  id: serial("id").primaryKey(),
  propostaId: text("proposta_id").references(() => propostas.id).notNull(), // Changed from integer to text to match propostas.id
  lojaId: integer("loja_id").references(() => lojas.id).notNull(), // Multi-tenant key
  tipo: text("tipo").notNull(), // email, telefone, whatsapp, sistema
  conteudo: text("conteudo").notNull(),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Logs de Auditoria para Propostas  
export const propostaLogs = pgTable("proposta_logs", {
  id: serial("id").primaryKey(),
  propostaId: text("proposta_id").references(() => propostas.id).notNull(),
  autorId: text("autor_id").notNull(), // UUID do usuário que fez a ação
  statusAnterior: text("status_anterior"),
  statusNovo: text("status_novo").notNull(),
  observacao: text("observacao"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tabela de Junção - Propostas <-> Documentos
export const propostaDocumentos = pgTable("proposta_documentos", {
  id: serial("id").primaryKey(),
  propostaId: text("proposta_id").references(() => propostas.id).notNull(),
  nomeArquivo: text("nome_arquivo").notNull(),
  url: text("url").notNull(),
  tamanho: integer("tamanho"), // tamanho em bytes
  tipo: text("tipo"), // application/pdf, image/jpeg, etc
  createdAt: timestamp("created_at").defaultNow(),
});

// Audit Delete Log Table (Financial Compliance)
export const auditDeleteLog = pgTable("audit_delete_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  tableName: text("table_name").notNull(),
  recordId: text("record_id").notNull(),
  deletedBy: uuid("deleted_by").notNull().references(() => profiles.id),
  deletedAt: timestamp("deleted_at").notNull().defaultNow(),
  deletionReason: text("deletion_reason"),
  recordData: text("record_data").notNull(), // JSONB stored as text
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  restoredAt: timestamp("restored_at"),
  restoredBy: uuid("restored_by").references(() => profiles.id),
});

// Banco Inter Integration Tables
export const interCollections = pgTable("inter_collections", {
  id: serial("id").primaryKey(),
  propostaId: text("proposta_id").references(() => propostas.id).notNull(),
  codigoSolicitacao: text("codigo_solicitacao").notNull().unique(), // Inter's unique ID
  seuNumero: text("seu_numero").notNull(), // Our reference number
  valorNominal: decimal("valor_nominal", { precision: 12, scale: 2 }).notNull(),
  dataVencimento: text("data_vencimento").notNull(), // YYYY-MM-DD format
  situacao: text("situacao").notNull().default("EM_PROCESSAMENTO"), // Inter status
  dataSituacao: text("data_situacao"),
  nossoNumero: text("nosso_numero"), // Bank reference number
  codigoBarras: text("codigo_barras"), // Barcode for boleto
  linhaDigitavel: text("linha_digitavel"), // Digitizable line
  pixTxid: text("pix_txid"), // PIX transaction ID
  pixCopiaECola: text("pix_copia_e_cola"), // PIX copy-paste code
  valorTotalRecebido: decimal("valor_total_recebido", { precision: 12, scale: 2 }),
  origemRecebimento: text("origem_recebimento"), // BOLETO or PIX
  dataEmissao: text("data_emissao"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const interWebhooks = pgTable("inter_webhooks", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  eventos: text("eventos").array().notNull(), // Array of webhook events
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const interCallbacks = pgTable("inter_callbacks", {
  id: serial("id").primaryKey(),
  codigoSolicitacao: text("codigo_solicitacao").notNull(),
  evento: text("evento").notNull(), // Type of event received
  payload: text("payload").notNull(), // Full JSON payload
  processado: boolean("processado").default(false).notNull(),
  erro: text("erro"), // Error message if processing failed
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at"),
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
  status: z.string().default("rascunho"),
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
    nacionalidade: z.string().default("Brasileira"),
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

export const insertTabelaComercialSchema = createInsertSchema(tabelasComerciais).omit({
  id: true,
  createdAt: true,
});

export const insertProdutoTabelaComercialSchema = createInsertSchema(produtoTabelaComercial).omit({
  id: true,
  createdAt: true,
});

export const insertProdutoSchema = createInsertSchema(produtos).omit({
  id: true,
  createdAt: true,
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

export const insertInterCallbackSchema = createInsertSchema(interCallbacks).omit({
  id: true,
  createdAt: true,
});

// Security logs table for autonomous monitoring
export const security_logs = pgTable("security_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventType: text("event_type").notNull(),
  severity: text("severity").notNull(), // LOW, MEDIUM, HIGH, CRITICAL
  ipAddress: text("ip_address"),
  userId: uuid("user_id"),
  userAgent: text("user_agent"),
  endpoint: text("endpoint"),
  statusCode: integer("status_code"),
  success: boolean("success").default(true),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
