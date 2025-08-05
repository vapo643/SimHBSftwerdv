import { Router } from "express";
import { jwtAuthMiddleware, type AuthenticatedRequest } from "../lib/jwt-auth-middleware.js";
import { db } from "../lib/supabase.js";
import { propostas, users, lojas, produtos, interCollections } from "@shared/schema";
import { eq, and, or, desc, sql, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { isToday, isThisWeek, isThisMonth, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

const router = Router();

// Schema de validação para pagamento
const pagamentoSchema = z.object({
  propostaId: z.string().uuid(),
  numeroContrato: z.string(),
  nomeCliente: z.string(),
  cpfCliente: z.string(),
  valorFinanciado: z.number(),
  valorLiquido: z.number(),
  valorIOF: z.number(),
  valorTAC: z.number(),
  contaBancaria: z.object({
    banco: z.string(),
    agencia: z.string(),
    conta: z.string(),
    tipoConta: z.string(),
    titular: z.string(),
  }),
  formaPagamento: z.enum(['ted', 'pix', 'doc']),
  loja: z.string(),
  produto: z.string(),
  observacoes: z.string().optional(),
});

// Buscar pagamentos
router.get("/", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, periodo } = req.query;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    // Primeiro, vamos debugar para ver quantas propostas existem com cada condição
    const totalPropostas = await db
      .select({ count: sql<number>`count(*)` })
      .from(propostas)
      .where(sql`${propostas.deletedAt} IS NULL`);
    
    const propostasAprovadas = await db
      .select({ count: sql<number>`count(*)` })
      .from(propostas)
      .where(
        and(
          eq(propostas.status, 'aprovado'),
          sql`${propostas.deletedAt} IS NULL`
        )
      );
    
    const propostasComCCB = await db
      .select({ count: sql<number>`count(*)` })
      .from(propostas)
      .where(
        and(
          eq(propostas.ccbGerado, true),
          eq(propostas.assinaturaEletronicaConcluida, true),
          sql`${propostas.deletedAt} IS NULL`
        )
      );

    // Verificar também boletos gerados via Inter Bank
    const propostasComBoletos = await db
      .select({ 
        count: sql<number>`count(DISTINCT ${interCollections.propostaId})` 
      })
      .from(interCollections)
      .where(sql`${interCollections.propostaId} IS NOT NULL`);

    console.log(`[PAGAMENTOS DEBUG] Total propostas: ${totalPropostas[0]?.count || 0}`);
    console.log(`[PAGAMENTOS DEBUG] Propostas aprovadas: ${propostasAprovadas[0]?.count || 0}`);
    console.log(`[PAGAMENTOS DEBUG] Propostas com CCB assinada: ${propostasComCCB[0]?.count || 0}`);
    console.log(`[PAGAMENTOS DEBUG] Propostas com boletos Inter: ${propostasComBoletos[0]?.count || 0}`);

    // Buscar propostas que estão prontas para pagamento ou já foram pagas
    const result = await db
      .select({
        id: propostas.id,
        clienteNome: propostas.clienteNome,
        clienteCpf: propostas.clienteCpf,
        valorTotalFinanciado: propostas.valorTotalFinanciado,
        valorTac: propostas.valorTac,
        valorIof: propostas.valorIof,
        status: propostas.status,
        dataAprovacao: propostas.dataAprovacao,
        dataPagamento: propostas.dataPagamento,
        lojaId: propostas.lojaId,
        produtoId: propostas.produtoId,
        userId: propostas.userId,
        observacoes: propostas.observacoes,
        lojaNome: lojas.nomeLoja,
        produtoNome: produtos.nomeProduto,
        analistaId: propostas.analistaId,
        ccbGerado: propostas.ccbGerado,
        assinaturaEletronicaConcluida: propostas.assinaturaEletronicaConcluida,
        hasInterCollection: sql<boolean>`EXISTS (SELECT 1 FROM inter_collections WHERE inter_collections.proposta_id = ${propostas.id})`,
      })
      .from(propostas)
      .leftJoin(lojas, eq(propostas.lojaId, lojas.id))
      .leftJoin(produtos, eq(propostas.produtoId, produtos.id))
      .where(
        and(
          or(
            eq(propostas.status, 'pronto_pagamento'),
            eq(propostas.status, 'pago'),
            // Incluir propostas aprovadas com CCB assinada e assinatura eletrônica concluída
            and(
              eq(propostas.status, 'aprovado'),
              eq(propostas.ccbGerado, true),
              eq(propostas.assinaturaEletronicaConcluida, true)
            ),
            // Incluir propostas que tenham boletos gerados no Inter Bank
            sql`EXISTS (SELECT 1 FROM inter_collections WHERE inter_collections.proposta_id = ${propostas.id})`
          ),
          sql`${propostas.deletedAt} IS NULL`
        )
      )
      .orderBy(desc(propostas.dataAprovacao));

    console.log(`[PAGAMENTOS DEBUG] Propostas encontradas: ${result.length}`);
    if (result.length > 0) {
      console.log(`[PAGAMENTOS DEBUG] Primeira proposta:`, {
        id: result[0].id,
        status: result[0].status,
        ccbGerado: result[0].ccbGerado,
        assinaturaEletronicaConcluida: result[0].assinaturaEletronicaConcluida,
        hasInterCollection: result[0].hasInterCollection,
      });
    }

    // Processar os resultados para o formato esperado pelo frontend
    const pagamentosFormatados = result.map((proposta: any) => {
      // Calcular valor líquido
      const valorFinanciado = Number(proposta.valorTotalFinanciado || 0);
      const valorIof = Number(proposta.valorIof || 0);
      const valorTac = Number(proposta.valorTac || 0);
      const valorLiquido = valorFinanciado - valorIof - valorTac;

      // Mapear status para o formato esperado pelo frontend
      let statusFrontend = 'aguardando_aprovacao';
      if (proposta.status === 'pago') {
        statusFrontend = 'pago';
      } else if (proposta.status === 'aprovado') {
        statusFrontend = 'aprovado';
      } else if (proposta.status === 'pronto_pagamento') {
        statusFrontend = 'em_processamento';
      } else if (proposta.status === 'rejeitado') {
        statusFrontend = 'rejeitado';
      } else if (proposta.status === 'cancelado') {
        statusFrontend = 'cancelado';
      }

      // Dados bancários mock (em produção, isso viria de outro lugar ou seria informado pelo usuário)
      const contaBancaria = {
        banco: 'Banco do Brasil',
        agencia: '0001',
        conta: '12345-6',
        tipoConta: 'Corrente',
        titular: proposta.clienteNome || 'Não informado'
      };

      return {
        id: proposta.id,
        propostaId: proposta.id,
        numeroContrato: `CONT-${proposta.id.slice(0, 8).toUpperCase()}`,
        nomeCliente: proposta.clienteNome || 'Não informado',
        cpfCliente: proposta.clienteCpf || 'Não informado',
        valorFinanciado: valorFinanciado,
        valorLiquido: valorLiquido,
        valorIOF: valorIof,
        valorTAC: valorTac,
        contaBancaria: contaBancaria,
        status: statusFrontend,
        dataRequisicao: proposta.dataAprovacao || new Date().toISOString(),
        dataAprovacao: proposta.dataAprovacao,
        dataPagamento: proposta.dataPagamento,
        requisitadoPor: {
          id: proposta.userId || '',
          nome: 'Sistema',
          papel: 'SISTEMA'
        },
        aprovadoPor: proposta.analistaId ? {
          id: proposta.analistaId,
          nome: 'Analista',
          papel: 'ANALISTA'
        } : undefined,
        motivoRejeicao: '',
        observacoes: proposta.observacoes,
        comprovante: '',
        formaPagamento: 'ted' as const,
        loja: proposta.lojaNome || 'Não informado',
        produto: proposta.produtoNome || 'Não informado'
      };
    });

    // Aplicar filtros
    let pagamentosFiltrados = pagamentosFormatados;

    // Filtrar por status
    if (status && status !== 'todos') {
      pagamentosFiltrados = pagamentosFiltrados.filter(p => p.status === status);
    }

    // Filtrar por período
    if (periodo && periodo !== 'todos') {
      const now = new Date();
      pagamentosFiltrados = pagamentosFiltrados.filter(p => {
        const dataReq = new Date(p.dataRequisicao);
        switch (periodo) {
          case 'hoje':
            return isToday(dataReq);
          case 'semana':
            return isThisWeek(dataReq);
          case 'mes':
            return isThisMonth(dataReq);
          default:
            return true;
        }
      });
    }

    res.json(pagamentosFiltrados);
  } catch (error) {
    console.error("Erro ao buscar pagamentos:", error);
    res.status(500).json({ error: "Erro ao buscar pagamentos" });
  }
});

// Aprovar pagamento
router.post("/:id/aprovar", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { observacao } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    // Verificar se o usuário tem permissão para aprovar
    if (!['ADMINISTRADOR', 'DIRETOR', 'FINANCEIRO', 'GERENTE'].includes(userRole || '')) {
      return res.status(403).json({ error: "Sem permissão para aprovar pagamentos" });
    }

    // Buscar a proposta
    const proposta = await db
      .select()
      .from(propostas)
      .where(eq(propostas.id, id))
      .limit(1);

    if (!proposta.length) {
      return res.status(404).json({ error: "Proposta não encontrada" });
    }

    // Atualizar status para pago
    await db
      .update(propostas)
      .set({
        status: 'pago',
        analistaId: userId,
        dataPagamento: new Date(),
        observacoes: observacao || proposta[0].observacoes
      })
      .where(eq(propostas.id, id));

    res.json({ message: "Pagamento aprovado com sucesso" });
  } catch (error) {
    console.error("Erro ao aprovar pagamento:", error);
    res.status(500).json({ error: "Erro ao aprovar pagamento" });
  }
});

// Rejeitar pagamento
router.post("/:id/rejeitar", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    // Verificar se o usuário tem permissão para rejeitar
    if (!['ADMINISTRADOR', 'DIRETOR', 'FINANCEIRO', 'GERENTE'].includes(userRole || '')) {
      return res.status(403).json({ error: "Sem permissão para rejeitar pagamentos" });
    }

    if (!motivo) {
      return res.status(400).json({ error: "Motivo da rejeição é obrigatório" });
    }

    // Atualizar status para rejeitado
    await db
      .update(propostas)
      .set({
        status: 'rejeitado',
        analistaId: userId
      })
      .where(eq(propostas.id, id));

    res.json({ message: "Pagamento rejeitado com sucesso" });
  } catch (error) {
    console.error("Erro ao rejeitar pagamento:", error);
    res.status(500).json({ error: "Erro ao rejeitar pagamento" });
  }
});

export default router;