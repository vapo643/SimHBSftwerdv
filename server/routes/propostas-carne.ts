import { Router } from 'express';
import { db } from '../lib/supabase.js';
import { propostas } from '@shared/schema.js';
import { jwtAuthMiddleware } from '../lib/jwt-auth-middleware.js';
import { desc, eq } from 'drizzle-orm';
import { lojas, parceiros, produtos } from '@shared/schema.js';

const router = Router();

// GET /api/propostas - Lista propostas com filtro opcional
router.get('/', jwtAuthMiddleware, async (req, res) => {
  try {
    // ✅ DB GUARD: Prevent runtime 500s if db not initialized
    if (!db) {
      return res.status(503).json({ 
        success: false, 
        error: 'Database unavailable',
        timestamp: new Date().toISOString(),
      });
    }

    const { queue } = req.query;
    
    console.log('[PROPOSTAS] Parâmetros recebidos:', { queue });
    
    // ✅ FIX: Base query with JOINs - no reassignment to avoid TypeScript errors
    const base = db
      .select({
        id: propostas.id,
        numeroProposta: propostas.numeroProposta,
        clienteNome: propostas.clienteNome,
        status: propostas.status,
        valor: propostas.valor,
        prazo: propostas.prazo,
        valorTac: propostas.valorTac,
        valorIof: propostas.valorIof,
        taxaJuros: propostas.taxaJuros,
        lojaId: propostas.lojaId,
        produtoId: propostas.produtoId,
        createdAt: propostas.createdAt,
        updatedAt: propostas.updatedAt,
        // Campos das tabelas relacionadas - CRÍTICOS para frontend
        lojaNome: lojas.nomeLoja,
        produtoNome: produtos.nomeProduto,
        parceiroNome: parceiros.razaoSocial,
      })
      .from(propostas)
      .leftJoin(lojas, eq(propostas.lojaId, lojas.id))
      .leftJoin(produtos, eq(propostas.produtoId, produtos.id))
      .leftJoin(parceiros, eq(lojas.parceiroId, parceiros.id));

    // ✅ FIX: Two explicit query paths to avoid type reassignment issues
    let propostasResult;

    // FILTRO CRÍTICO: Fila de Análise = apenas propostas "em_analise"
    if (queue === 'analysis') {
      console.log('[PROPOSTAS] Filtro FILA DE ANÁLISE ativo - apenas status "em_analise"');
      propostasResult = await base
        .where(eq(propostas.status, 'em_analise'))
        .orderBy(desc(propostas.createdAt))
        .limit(50);
    } else {
      console.log('[PROPOSTAS] Dashboard - todas as propostas');
      propostasResult = await base
        .orderBy(desc(propostas.createdAt))
        .limit(50);
    }

    console.log(`[PROPOSTAS] Encontradas ${propostasResult.length} propostas (queue=${queue})`);
    
    res.json({
      success: true,
      data: propostasResult,
      total: propostasResult.length,
      queue: queue || 'all',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[PROPOSTAS] Erro ao buscar propostas:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/propostas/:id - Busca proposta individual (detalhes)
router.get('/:id', jwtAuthMiddleware, async (req, res) => {
  try {
    // ✅ DB GUARD: Prevent runtime 500s if db not initialized
    if (!db) {
      return res.status(503).json({ 
        success: false, 
        error: 'Database unavailable',
        timestamp: new Date().toISOString(),
      });
    }

    const { id } = req.params;
    
    console.log('[PROPOSTA INDIVIDUAL] Buscando detalhes da proposta:', id);
    
    const propostaResult = await db
      .select({
        // Campos principais da proposta
        id: propostas.id,
        numeroProposta: propostas.numeroProposta,
        clienteNome: propostas.clienteNome,
        status: propostas.status,
        valor: propostas.valor,
        prazo: propostas.prazo,
        valorTac: propostas.valorTac,
        valorIof: propostas.valorIof,
        taxaJuros: propostas.taxaJuros,
        lojaId: propostas.lojaId,
        produtoId: propostas.produtoId,
        createdAt: propostas.createdAt,
        updatedAt: propostas.updatedAt,
        // Campos das tabelas relacionadas para exibir nomes
        lojaNome: lojas.nomeLoja,
        produtoNome: produtos.nomeProduto,
        parceiroNome: parceiros.razaoSocial,
        // Campos restantes da proposta
        clienteCpf: propostas.clienteCpf,
        clienteEmail: propostas.clienteEmail,
        clienteTelefone: propostas.clienteTelefone,
        clienteDataNascimento: propostas.clienteDataNascimento,
        clienteRenda: propostas.clienteRenda,
        clienteRg: propostas.clienteRg,
        clienteOrgaoEmissor: propostas.clienteOrgaoEmissor,
        clienteEstadoCivil: propostas.clienteEstadoCivil,
        clienteNacionalidade: propostas.clienteNacionalidade,
        clienteCep: propostas.clienteCep,
        clienteEndereco: propostas.clienteEndereco,
        clienteLogradouro: propostas.clienteLogradouro,
        clienteNumero: propostas.clienteNumero,
        clienteComplemento: propostas.clienteComplemento,
        clienteBairro: propostas.clienteBairro,
        clienteCidade: propostas.clienteCidade,
        clienteUf: propostas.clienteUf,
        clienteOcupacao: propostas.clienteOcupacao,
        finalidade: propostas.finalidade,
        garantia: propostas.garantia,
        valorTotalFinanciado: propostas.valorTotalFinanciado,
        valorLiquidoLiberado: propostas.valorLiquidoLiberado,
        jurosModalidade: propostas.jurosModalidade,
        periodicidadeCapitalizacao: propostas.periodicidadeCapitalizacao,
        taxaJurosAnual: propostas.taxaJurosAnual,
        pracaPagamento: propostas.pracaPagamento,
        formaPagamento: propostas.formaPagamento,
        analistaId: propostas.analistaId,
        dataAnalise: propostas.dataAnalise,
        motivoPendencia: propostas.motivoPendencia,
        valorAprovado: propostas.valorAprovado,
        observacoes: propostas.observacoes,
      })
      .from(propostas)
      .leftJoin(lojas, eq(propostas.lojaId, lojas.id))
      .leftJoin(produtos, eq(propostas.produtoId, produtos.id))
      .leftJoin(parceiros, eq(lojas.parceiroId, parceiros.id))
      .where(eq(propostas.id, id))
      .limit(1);

    if (propostaResult.length === 0) {
      console.log('[PROPOSTA INDIVIDUAL] Proposta não encontrada:', id);
      return res.status(404).json({
        success: false,
        error: 'Proposta não encontrada',
        timestamp: new Date().toISOString(),
      });
    }

    const proposta = propostaResult[0];
    console.log(`[PROPOSTA INDIVIDUAL] Proposta encontrada: ${proposta.clienteNome} - Status: ${proposta.status}`);
    console.log(`[PROPOSTA INDIVIDUAL] Dados relacionados: Loja="${proposta.lojaNome}", Produto="${proposta.produtoNome}", Parceiro="${proposta.parceiroNome}"`);
    
    res.json({
      success: true,
      data: proposta,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[PROPOSTA INDIVIDUAL] Erro ao buscar proposta:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
