import { pgTable, text, serial, integer, boolean, timestamp, decimal, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tabela de Parceiros (Instituições Financeiras)
export const parceiros = pgTable("parceiros", {
  id: serial("id").primaryKey(),
  razaoSocial: text("razao_social").notNull(),
  nomeFantasia: text("nome_fantasia").notNull(),
  cnpj: text("cnpj").notNull().unique(),
  email: text("email").notNull(),
  telefone: text("telefone").notNull(),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabela de Lojas (Pontos de Venda dos Parceiros)
export const lojas = pgTable("lojas", {
  id: serial("id").primaryKey(),
  parceiroId: integer("parceiro_id").notNull().references(() => parceiros.id),
  nome: text("nome").notNull(),
  endereco: text("endereco").notNull(),
  cidade: text("cidade").notNull(),
  uf: text("uf").notNull(),
  cep: text("cep").notNull(),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabela de Perfis (Relaciona usuários com lojas e define permissões)
export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  lojaId: integer("loja_id").notNull().references(() => lojas.id),
  role: text("role").notNull(), // ADMINISTRADOR, DIRETOR, GERENTE, ATENDENTE, ANALISTA, FINANCEIRO
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
  "cancelado"
]);

export const propostas = pgTable("propostas", {
  id: serial("id").primaryKey(),
  // CAMPO CRÍTICO PARA RLS - Isolamento por loja
  lojaId: integer("loja_id").notNull().references(() => lojas.id),
  
  // Cliente dados
  clienteNome: text("cliente_nome").notNull(),
  clienteCpf: text("cliente_cpf").notNull(),
  clienteEmail: text("cliente_email").notNull(),
  clienteTelefone: text("cliente_telefone").notNull(),
  clienteDataNascimento: text("cliente_data_nascimento").notNull(),
  clienteRenda: text("cliente_renda").notNull(),
  
  // Empréstimo dados
  valor: decimal("valor", { precision: 15, scale: 2 }).notNull(),
  prazo: integer("prazo").notNull(),
  finalidade: text("finalidade").notNull(),
  garantia: text("garantia").notNull(),
  
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
  
  // Campos do Capítulo 6 - CCB e Formalização
  ccb_documento_url: text("ccb_documento_url"),
  status_assinatura: text("status_assinatura").default("pendente"),
  status_biometria: text("status_biometria").default("pendente"),
  
  // Auditoria
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Produtos de Crédito
export const produtos = pgTable("produtos", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabelas Comerciais (Configurações de Taxa por Loja)
export const tabelasComerciais = pgTable("tabelas_comerciais", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").notNull().references(() => lojas.id),
  produtoId: integer("produto_id").notNull().references(() => produtos.id),
  nome: text("nome").notNull(),
  taxaJuros: decimal("taxa_juros", { precision: 5, scale: 2 }).notNull(),
  config: text("config"), // JSON com configurações específicas
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Schemas Zod
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  name: true,
  password: true,
});

export const insertParceiroSchema = createInsertSchema(parceiros).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLojaSchema = createInsertSchema(lojas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProfileSchema = createInsertSchema(profiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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

export const insertProdutoSchema = createInsertSchema(produtos).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTabelaComercialSchema = createInsertSchema(tabelasComerciais).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertParceiro = z.infer<typeof insertParceiroSchema>;
export type Parceiro = typeof parceiros.$inferSelect;
export type InsertLoja = z.infer<typeof insertLojaSchema>;
export type Loja = typeof lojas.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profiles.$inferSelect;
export type InsertProposta = z.infer<typeof insertPropostaSchema>;
export type UpdateProposta = z.infer<typeof updatePropostaSchema>;
export type Proposta = typeof propostas.$inferSelect;
export type InsertProduto = z.infer<typeof insertProdutoSchema>;
export type Produto = typeof produtos.$inferSelect;
export type InsertTabelaComercial = z.infer<typeof insertTabelaComercialSchema>;
export type TabelaComercial = typeof tabelasComerciais.$inferSelect;
