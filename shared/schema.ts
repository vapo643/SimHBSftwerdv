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

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  name: true,
  password: true,
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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertProposta = z.infer<typeof insertPropostaSchema>;
export type UpdateProposta = z.infer<typeof updatePropostaSchema>;
export type Proposta = typeof propostas.$inferSelect;
