import type { Express } from "express";
import { db } from "../lib/supabase.js";
import { produtos, tabelasComerciais, lojas, parceiros } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import { jwtAuthMiddleware } from "../lib/jwt-auth-middleware.js";
import type { AuthenticatedRequest } from "../lib/jwt-auth-middleware.js";

export function registerOriginationRoutes(app: Express) {
  // GET /api/origination/context - Orchestrator endpoint
  app.get("/api/origination/context", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      
      // 1. Get atendente details with loja and parceiro
      if (user.role !== 'ATENDENTE' && user.role !== 'GERENTE' && user.role !== 'ADMINISTRADOR') {
        return res.status(403).json({ 
          message: "Apenas atendentes, gerentes e administradores podem criar propostas" 
        });
      }

      // Get user's loja
      const userLoja = await db.select({
        id: lojas.id,
        nome: lojas.nomeLoja,
        parceiroId: lojas.parceiroId,
        parceiroNome: parceiros.razaoSocial,
      })
      .from(lojas)
      .innerJoin(parceiros, eq(lojas.parceiroId, parceiros.id))
      .where(eq(lojas.id, user.loja_id!))
      .limit(1);

      if (userLoja.length === 0) {
        return res.status(400).json({ message: "Usuário não está associado a uma loja" });
      }

      const loja = userLoja[0];

      // 2. Get all active products with their TAC configuration
      const allProdutos = await db.select()
        .from(produtos)
        .where(eq(produtos.isActive, true));

      // 3. For each product, get available commercial tables
      const produtosComTabelas = await Promise.all(
        allProdutos.map(async (produto) => {
          // First check for personalized tables for this partner
          const tabelasPersonalizadas = await db.select()
            .from(tabelasComerciais)
            .where(
              and(
                eq(tabelasComerciais.produtoId, produto.id),
                eq(tabelasComerciais.parceiroId, loja.parceiroId)
              )
            );

          // If no personalized tables, get general tables
          let tabelasDisponiveis = tabelasPersonalizadas;
          if (tabelasPersonalizadas.length === 0) {
            tabelasDisponiveis = await db.select()
              .from(tabelasComerciais)
              .where(
                and(
                  eq(tabelasComerciais.produtoId, produto.id),
                  isNull(tabelasComerciais.parceiroId)
                )
              );
          }

          return {
            id: produto.id,
            nome: produto.nomeProduto,
            tacValor: produto.tacValor ? parseFloat(produto.tacValor) : 0,
            tacTipo: produto.tacTipo || 'fixo',
            tabelasDisponiveis: tabelasDisponiveis.map(t => ({
              id: t.id,
              nome: t.nomeTabela,
              taxaJuros: parseFloat(t.taxaJuros),
              prazos: t.prazos,
              comissao: parseFloat(t.comissao || '0'),
            })),
          };
        })
      );

      // 4. Business rules and limits
      const limites = {
        valorMinimo: 1000,
        valorMaximo: 50000,
        prazoMaximo: 48,
      };

      // 5. Required documents configuration
      const documentosObrigatorios = [
        'RG ou CNH',
        'Comprovante de Residência',
        'Comprovante de Renda',
      ];

      // Build complete response
      const context = {
        atendente: {
          id: user.id,
          nome: user.full_name || user.email,
          loja: {
            id: loja.id,
            nome: loja.nome,
            parceiro: {
              id: loja.parceiroId,
              nome: loja.parceiroNome,
            },
          },
        },
        produtos: produtosComTabelas,
        documentosObrigatorios,
        limites,
      };

      res.json(context);
    } catch (error) {
      console.error('Erro ao buscar contexto de originação:', error);
      res.status(500).json({ message: "Erro ao carregar dados do formulário" });
    }
  });
}