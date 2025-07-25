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
});

export const lojas = pgTable("lojas", {
  id: serial("id").primaryKey(),
  parceiroId: integer("parceiro_id").references(() => parceiros.id).notNull(),
  nomeLoja: text("nome_loja").notNull(),
  endereco: text("endereco").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Usuários e Perfis
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // admin, analyst, user
  createdAt: timestamp("created_at").defaultNow(),
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
  "aprovado",
  "rejeitado",
  "documentos_enviados",
  "contratos_preparados",
  "contratos_assinados",
  "pronto_pagamento",
  "pago",
  "cancelado",
]);

export const propostas = pgTable("propostas", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").references(() => lojas.id).notNull(), // Multi-tenant key
  
  // Cliente dados - Normalized fields
  clienteNome: text("cliente_nome").notNull(),
  clienteCpf: text("cliente_cpf").notNull(),
  clienteEmail: text("cliente_email").notNull(),
  clienteTelefone: text("cliente_telefone").notNull(),
  clienteDataNascimento: text("cliente_data_nascimento").notNull(),
  clienteRenda: text("cliente_renda").notNull(),
  clienteRg: text("cliente_rg"),
  clienteOrgaoEmissor: text("cliente_orgao_emissor"),
  clienteEstadoCivil: text("cliente_estado_civil"),
  clienteNacionalidade: text("cliente_nacionalidade").default("Brasileira"),
  clienteCep: text("cliente_cep"),
  clienteEndereco: text("cliente_endereco"),
  clienteOcupacao: text("cliente_ocupacao"),

  // Empréstimo dados - Enhanced
  produtoId: integer("produto_id").references(() => produtos.id),
  tabelaComercialId: integer("tabela_comercial_id").references(() => tabelasComerciais.id),
  valor: decimal("valor", { precision: 15, scale: 2 }).notNull(),
  prazo: integer("prazo").notNull(),
  finalidade: text("finalidade").notNull(),
  garantia: text("garantia").notNull(),
  valorTac: decimal("valor_tac", { precision: 10, scale: 2 }),
  valorIof: decimal("valor_iof", { precision: 10, scale: 2 }),
  valorTotalFinanciado: decimal("valor_total_financiado", { precision: 15, scale: 2 }),

  // Status e análise
  status: statusEnum("status").notNull().default("rascunho"),
  valorAprovado: decimal("valor_aprovado", { precision: 15, scale: 2 }),
  taxaJuros: decimal("taxa_juros", { precision: 5, scale: 2 }),
  observacoes: text("observacoes"),

  // Documentos
  documentos: text("documentos").array(),

  // Formalização
  dataAprovacao: timestamp("data_aprovacao"),
  documentosAdicionais: text("documentos_adicionais").array(),
  contratoGerado: boolean("contrato_gerado").default(false),
  contratoAssinado: boolean("contrato_assinado").default(false),
  dataAssinatura: timestamp("data_assinatura"),
  dataPagamento: timestamp("data_pagamento"),
  observacoesFormalização: text("observacoes_formalizacao"),

  // Auditoria
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabelas Comerciais
export const tabelasComerciais = pgTable("tabelas_comerciais", {
  id: serial("id").primaryKey(),
  nomeTabela: text("nome_tabela").notNull(),
  taxaJuros: decimal("taxa_juros", { precision: 5, scale: 2 }).notNull(),
  prazos: integer("prazos").array().notNull(),
  produtoId: integer("produto_id").notNull(),
  parceiroId: integer("parceiro_id").references(() => parceiros.id),
  comissao: decimal("comissao", { precision: 5, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Produtos de Crédito
export const produtos = pgTable("produtos", {
  id: serial("id").primaryKey(),
  nomeProduto: text("nome_produto").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  tacValor: decimal("tac_valor", { precision: 10, scale: 2 }).default("0"),
  tacTipo: text("tac_tipo").default("fixo"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Logs de Comunicação - Multi-tenant  
export const comunicacaoLogs = pgTable("comunicacao_logs", {
  id: serial("id").primaryKey(),
  propostaId: integer("proposta_id").references(() => propostas.id).notNull(),
  lojaId: integer("loja_id").references(() => lojas.id).notNull(), // Multi-tenant key
  tipo: text("tipo").notNull(), // email, telefone, whatsapp, sistema
  conteudo: text("conteudo").notNull(),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
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
  updatedAt: true,
  userId: true,
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

export const insertProdutoSchema = createInsertSchema(produtos).omit({
  id: true,
  createdAt: true,
});

export const insertComunicacaoLogSchema = createInsertSchema(comunicacaoLogs).omit({
  id: true,
  createdAt: true,
});

export const insertGerenteLojaSchema = createInsertSchema(gerenteLojas).omit({
  createdAt: true,
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
export type InsertProduto = z.infer<typeof insertProdutoSchema>;
export type Produto = typeof produtos.$inferSelect;
export type InsertComunicacaoLog = z.infer<typeof insertComunicacaoLogSchema>;
export type ComunicacaoLog = typeof comunicacaoLogs.$inferSelect;
export type InsertGerenteLojas = z.infer<typeof insertGerenteLojaSchema>;
export type GerenteLojas = typeof gerenteLojas.$inferSelect;
