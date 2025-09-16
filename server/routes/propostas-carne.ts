import { Router } from 'express';
import { db } from '../lib/supabase.js';
import { propostas, propostaLogs, profiles } from '@shared/schema.js';
import { jwtAuthMiddleware } from '../lib/jwt-auth-middleware.js';
import { desc, eq, asc } from 'drizzle-orm';
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
    
    // ✅ CORREÇÃO: Transformar dados para formato esperado pelo frontend
    const transformedData = propostasResult.map(row => ({
      id: row.id,
      numeroProposta: row.numeroProposta,
      nomeCliente: row.clienteNome, // Frontend espera nomeCliente
      status: row.status,
      valorSolicitado: row.valor, // Frontend espera valorSolicitado 
      prazo: row.prazo,
      valorTac: row.valorTac,
      valorIof: row.valorIof,
      taxaJuros: row.taxaJuros,
      lojaId: row.lojaId,
      produtoId: row.produtoId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      // Frontend espera objetos aninhados
      parceiro: row.parceiroNome ? {
        razaoSocial: row.parceiroNome
      } : null,
      loja: row.lojaNome ? {
        nomeLoja: row.lojaNome  
      } : null,
      // Campos extras para compatibilidade
      produtoNome: row.produtoNome
    }));
    
    console.log(`[PROPOSTAS] Dados transformados - primeiro item:`, transformedData[0]);
    
    res.json({
      success: true,
      data: transformedData,
      total: transformedData.length,
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
    
    // ✅ CORREÇÃO: Transformar dados da proposta individual para formato esperado pelo frontend
    const transformedProposta = {
      id: proposta.id,
      numeroProposta: proposta.numeroProposta,
      nomeCliente: proposta.clienteNome, // Frontend espera nomeCliente
      status: proposta.status,
      valorSolicitado: proposta.valor, // Frontend espera valorSolicitado
      prazo: proposta.prazo,
      valorTac: proposta.valorTac,
      valorIof: proposta.valorIof,
      taxaJuros: proposta.taxaJuros,
      valorTotalFinanciado: proposta.valorTotalFinanciado,
      valorLiquidoLiberado: proposta.valorLiquidoLiberado,
      lojaId: proposta.lojaId,
      produtoId: proposta.produtoId,
      createdAt: proposta.createdAt,
      updatedAt: proposta.updatedAt,
      
      // Frontend espera objetos aninhados
      parceiro: proposta.parceiroNome ? {
        razaoSocial: proposta.parceiroNome
      } : null,
      loja: proposta.lojaNome ? {
        nomeLoja: proposta.lojaNome
      } : null,
      
      // Campos do cliente
      cpfCliente: proposta.clienteCpf,
      emailCliente: proposta.clienteEmail,
      telefoneCliente: proposta.clienteTelefone,
      clienteDataNascimento: proposta.clienteDataNascimento,
      clienteRenda: proposta.clienteRenda,
      clienteRg: proposta.clienteRg,
      clienteOrgaoEmissor: proposta.clienteOrgaoEmissor,
      clienteEstadoCivil: proposta.clienteEstadoCivil,
      clienteNacionalidade: proposta.clienteNacionalidade,
      clienteCep: proposta.clienteCep,
      clienteEndereco: proposta.clienteEndereco,
      clienteLogradouro: proposta.clienteLogradouro,
      clienteNumero: proposta.clienteNumero,
      clienteComplemento: proposta.clienteComplemento,
      clienteBairro: proposta.clienteBairro,
      clienteCidade: proposta.clienteCidade,
      clienteUf: proposta.clienteUf,
      clienteOcupacao: proposta.clienteOcupacao,
      
      // Campos adicionais
      finalidade: proposta.finalidade,
      garantia: proposta.garantia,
      jurosModalidade: proposta.jurosModalidade,
      periodicidadeCapitalizacao: proposta.periodicidadeCapitalizacao,
      taxaJurosAnual: proposta.taxaJurosAnual,
      pracaPagamento: proposta.pracaPagamento,
      formaPagamento: proposta.formaPagamento,
      analistaId: proposta.analistaId,
      dataAnalise: proposta.dataAnalise,
      motivoPendencia: proposta.motivoPendencia,
      valorAprovado: proposta.valorAprovado,
      observacoes: proposta.observacoes,
      
      // Campos extras para compatibilidade
      produtoNome: proposta.produtoNome
    };
    
    res.json({
      success: true,
      data: transformedProposta,
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

// GET /api/propostas/:id/historico - Busca histórico de auditoria da proposta
router.get('/:id/historico', jwtAuthMiddleware, async (req, res) => {
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
    
    console.log('[PROPOSTA HISTÓRICO] Buscando histórico da proposta:', id);
    
    // 1. Buscar dados de criação da proposta
    const propostaResult = await db
      .select({
        id: propostas.id,
        clienteNome: propostas.clienteNome,
        createdAt: propostas.createdAt,
      })
      .from(propostas)
      .where(eq(propostas.id, id))
      .limit(1);

    if (propostaResult.length === 0) {
      console.log('[PROPOSTA HISTÓRICO] Proposta não encontrada:', id);
      return res.status(404).json({
        success: false,
        error: 'Proposta não encontrada',
        timestamp: new Date().toISOString(),
      });
    }

    const proposta = propostaResult[0];
    console.log(`[PROPOSTA HISTÓRICO] Proposta encontrada: ${proposta.clienteNome}`);
    
    // 2. Buscar logs de auditoria com dados dos usuários (mais recentes primeiro)
    const logsResult = await db
      .select({
        id: propostaLogs.id,
        statusAnterior: propostaLogs.statusAnterior,
        statusNovo: propostaLogs.statusNovo,
        observacao: propostaLogs.observacao,
        createdAt: propostaLogs.createdAt,
        autorId: propostaLogs.autorId,
        // Dados do usuário (profiles)
        usuarioNome: profiles.fullName,
        usuarioRole: profiles.role,
      })
      .from(propostaLogs)
      .leftJoin(profiles, eq(propostaLogs.autorId, profiles.id))
      .where(eq(propostaLogs.propostaId, id))
      .orderBy(desc(propostaLogs.createdAt))
      .limit(200);

    console.log(`[PROPOSTA HISTÓRICO] Encontrados ${logsResult.length} logs de auditoria`);
    
    // 3. Determinar o primeiro autor (criador da proposta) - buscar o mais ANTIGO log
    let primeiroAutor = null;
    if (logsResult.length > 0) {
      // Buscar o primeiro log (mais antigo) para identificar o criador real
      const primeiroLogResult = await db
        .select({
          usuarioNome: profiles.fullName,
        })
        .from(propostaLogs)
        .leftJoin(profiles, eq(propostaLogs.autorId, profiles.id))
        .where(eq(propostaLogs.propostaId, id))
        .orderBy(asc(propostaLogs.createdAt)) // ASC para pegar o mais antigo (criador)
        .limit(1);
        
      primeiroAutor = primeiroLogResult.length > 0 ? primeiroLogResult[0].usuarioNome : null;
    }
    
    // 4. Transformar logs para formato esperado pelo frontend
    const transformedLogs = logsResult.map(log => ({
      id: log.id,
      // ✅ CORREÇÃO: Garantir ambos os formatos para máxima compatibilidade
      created_at: log.createdAt?.toISOString() || new Date().toISOString(),
      createdAt: log.createdAt?.toISOString() || new Date().toISOString(), // Frontend espera camelCase
      status_novo: log.statusNovo,
      status_anterior: log.statusAnterior || null,
      statusNovo: log.statusNovo, // camelCase também
      statusAnterior: log.statusAnterior || null, // camelCase também
      observacao: log.observacao || null,
      detalhes: log.observacao || null, // Alias para detalhes
      usuario_nome: log.usuarioNome || 'Usuário não identificado', // snake_case
      usuarioNome: log.usuarioNome || 'Usuário não identificado', // camelCase para frontend
      descricao: `Status alterado de ${log.statusAnterior || 'inicial'} para ${log.statusNovo}`, // Campo esperado pelo frontend
      profiles: {
        role: log.usuarioRole || 'user'
      }
    }));
    
    // 5. Estruturar resposta final
    const historicoData = {
      propostaCriada: {
        data: proposta.createdAt?.toISOString() || new Date().toISOString(),
        por: primeiroAutor
      },
      logs: transformedLogs,
      total: transformedLogs.length
    };
    
    console.log(`[PROPOSTA HISTÓRICO] Histórico compilado - Criada em: ${historicoData.propostaCriada.data}, Total logs: ${historicoData.total}`);
    
    res.json({
      success: true,
      data: historicoData,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[PROPOSTA HISTÓRICO] Erro ao buscar histórico:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
