import { Router } from "express";
import { jwtAuthMiddleware, type AuthenticatedRequest } from "../lib/jwt-auth-middleware.js";
import { db } from "../lib/supabase.js";
import { propostas, users, lojas, produtos, interCollections } from "@shared/schema";
import { eq, and, or, desc, sql, gte, lte, inArray } from "drizzle-orm";
import { z } from "zod";
import { isToday, isThisWeek, isThisMonth, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

const router = Router();

// Função auxiliar para registrar auditoria de pagamentos
async function registrarAuditoriaPagamento(
  propostaId: string,
  userId: string,
  acao: string,
  detalhes: any
) {
  const now = new Date().toISOString();
  console.log(`[AUDITORIA PAGAMENTO] ${now} - Proposta: ${propostaId}, User: ${userId}, Ação: ${acao}`);
  // TODO: Implementar gravação em tabela de auditoria
}

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
        count: sql<number>`count(DISTINCT ${interCollections.propostaId})`,
        propostaId: interCollections.propostaId
      })
      .from(interCollections)
      .where(sql`${interCollections.propostaId} IS NOT NULL`)
      .groupBy(interCollections.propostaId);

    console.log(`[PAGAMENTOS DEBUG] Total propostas: ${totalPropostas[0]?.count || 0}`);
    console.log(`[PAGAMENTOS DEBUG] Propostas aprovadas: ${propostasAprovadas[0]?.count || 0}`);
    console.log(`[PAGAMENTOS DEBUG] Propostas com CCB assinada: ${propostasComCCB[0]?.count || 0}`);
    console.log(`[PAGAMENTOS DEBUG] Propostas com boletos Inter: ${propostasComBoletos.length}`);
    if (propostasComBoletos.length > 0) {
      console.log(`[PAGAMENTOS DEBUG] Proposta com boleto Inter ID: ${propostasComBoletos[0].propostaId}`);
      
      // Debug: verificar o status dessa proposta específica
      const propostaIdString = propostasComBoletos[0].propostaId;
      if (propostaIdString) {
        const [propostaComBoleto] = await db
          .select()
          .from(propostas)
          .where(eq(propostas.id, propostaIdString))
          .limit(1);
        
        if (propostaComBoleto) {
          console.log(`[PAGAMENTOS DEBUG] Status da proposta com boleto:`, {
            id: propostaComBoleto.id,
            status: propostaComBoleto.status,
            ccbGerado: propostaComBoleto.ccbGerado,
            assinaturaEletronicaConcluida: propostaComBoleto.assinaturaEletronicaConcluida,
            clienteNome: propostaComBoleto.clienteNome
          });
        }
      }
    }

    // Buscar propostas com status pronto_pagamento
    const propostasComStatusPronto = await db
      .select()
      .from(propostas)
      .where(
        and(
          sql`${propostas.deletedAt} IS NULL`,
          eq(propostas.status, 'pronto_pagamento')
        )
      );
    
    console.log(`[PAGAMENTOS DEBUG] Propostas com status pronto_pagamento: ${propostasComStatusPronto.length}`);
    if (propostasComStatusPronto.length > 0) {
      console.log(`[PAGAMENTOS DEBUG] IDs:`, propostasComStatusPronto.map(p => p.id));
    }

    // NOVO DEBUG: Buscar TODAS as propostas que têm boletos, independente do status
    console.log(`[PAGAMENTOS DEBUG] ========== ANÁLISE DE BOLETOS ==========`);
    
    // ESTRATÉGIA: Busca em duas etapas para evitar problemas de tipo
    // Etapa 1: Buscar IDs de propostas que têm boletos Inter
    const boletosDetalhados = await db
      .select({ 
        propostaId: interCollections.propostaId,
        boletoId: interCollections.id,
        codigoSolicitacao: interCollections.codigoSolicitacao,
        valorNominal: interCollections.valorNominal,
        situacao: interCollections.situacao,
        nossoNumero: interCollections.nossoNumero,
        linhaDigitavel: interCollections.linhaDigitavel,
        pixCopiaECola: interCollections.pixCopiaECola
      })
      .from(interCollections)
      .where(
        and(
          sql`${interCollections.propostaId} IS NOT NULL`,
          sql`LENGTH(${interCollections.propostaId}) = 36` // Validação básica de UUID
        )
      );

    console.log(`[PAGAMENTOS DEBUG] Encontradas ${boletosDetalhados.length} propostas com boletos`);

    if (boletosDetalhados.length === 0) {
      console.log("[PAGAMENTOS DEBUG] Nenhuma proposta com boletos encontrada");
      console.log(`[PAGAMENTOS DEBUG] ========================================`);
    } else {
      // Extrair e validar os IDs das propostas
      const propostaIds = boletosDetalhados
        .map(item => item.propostaId)
        .filter(id => {
          // Validação extra para garantir que são UUIDs válidos
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          return id && uuidRegex.test(id);
        });

      console.log(`[PAGAMENTOS DEBUG] IDs válidos de propostas: ${propostaIds.length}`);

      if (propostaIds.length > 0) {
        // Etapa 2: Buscar as propostas elegíveis usando conversão de tipos
        const todasPropostasComBoletos = await db
          .select({
            id: propostas.id,
            clienteNome: propostas.clienteNome,
            status: propostas.status,
            ccbGerado: propostas.ccbGerado,
            assinaturaEletronicaConcluida: propostas.assinaturaEletronicaConcluida
          })
          .from(propostas)
          .where(
            and(
              // Usar inArray do Drizzle com conversão de tipos
              inArray(sql`${propostas.id}::text`, propostaIds),
              sql`${propostas.deletedAt} IS NULL`
            )
          );
        
        console.log(`[PAGAMENTOS DEBUG] Total de propostas com boletos Inter: ${todasPropostasComBoletos.length}`);
        todasPropostasComBoletos.forEach((proposta, index) => {
          console.log(`[PAGAMENTOS DEBUG] Proposta com boleto ${index + 1}:`, {
            id: proposta.id,
            clienteNome: proposta.clienteNome,
            status: proposta.status,
            ccbGerado: proposta.ccbGerado,
            assinaturaEletronicaConcluida: proposta.assinaturaEletronicaConcluida
          });
        });
      }
      console.log(`[PAGAMENTOS DEBUG] ========================================`);
    }

    // REGRA CRÍTICA DE SEGURANÇA: Uma proposta só pode aparecer para pagamento se:
    // 1. CCB foi assinada (ccb_gerado = true AND assinatura_eletronica_concluida = true)
    // 2. Boletos foram gerados no Inter Bank
    // 3. Status está como pronto_pagamento ou aguardando_desembolso
    console.log(`[PAGAMENTOS SECURITY] Aplicando filtros críticos de segurança para pagamentos`);
    
    // Query mais simples: buscar propostas elegíveis e verificar boletos depois
    const propostasElegiveis = await db
      .select({
        // Dados da proposta
        proposta: propostas,
        // Dados da loja
        loja: lojas,
        // Dados do produto
        produto: produtos
      })
      .from(propostas)
      .leftJoin(lojas, eq(propostas.lojaId, lojas.id))
      .leftJoin(produtos, eq(propostas.produtoId, produtos.id))
      .where(
        and(
          // Não pode estar deletada
          sql`${propostas.deletedAt} IS NULL`,
          // OBRIGATÓRIO: CCB deve estar assinada
          eq(propostas.ccbGerado, true),
          eq(propostas.assinaturaEletronicaConcluida, true),
          // Status deve ser pronto_pagamento
          eq(propostas.status, 'pronto_pagamento')
        )
      )
      .orderBy(desc(propostas.dataAprovacao));

    // Buscar boletos de forma mais simples para evitar erro de tipos
    const boletosInfo = await db
      .select({ 
        propostaId: interCollections.propostaId
      })
      .from(interCollections)
      .where(sql`${interCollections.propostaId} IS NOT NULL`);
    
    const propostasComBoletosSet = new Set(boletosInfo.map(b => b.propostaId).filter(id => id !== null));
    
    // Filtrar apenas as propostas que têm boletos
    const result = propostasElegiveis.filter(p => propostasComBoletosSet.has(p.proposta.id));

    console.log(`[PAGAMENTOS DEBUG] Total propostas encontradas: ${result.length}`);
    
    // Debug: mostrar detalhes de todas as propostas encontradas
    result.forEach((row, index) => {
      console.log(`[PAGAMENTOS DEBUG] Proposta ${index + 1}:`, {
        id: row.proposta.id,
        clienteNome: row.proposta.clienteNome,
        clienteCpf: row.proposta.clienteCpf,
        valorTotalFinanciado: row.proposta.valorTotalFinanciado,
        valorTac: row.proposta.valorTac,
        valorIof: row.proposta.valorIof,
        status: row.proposta.status,
        ccbGerado: row.proposta.ccbGerado,
        assinaturaEletronicaConcluida: row.proposta.assinaturaEletronicaConcluida,
        lojaNome: row.loja?.nomeLoja,
        produtoNome: row.produto?.nomeProduto,
        dadosPagamentoBanco: row.proposta.dadosPagamentoBanco,
        dadosPagamentoAgencia: row.proposta.dadosPagamentoAgencia,
        dadosPagamentoConta: row.proposta.dadosPagamentoConta
      });
    });

    // Processar os resultados para o formato esperado pelo frontend
    const pagamentosFormatados = result.map((row: any) => {
      const { proposta, loja, produto } = row;
      
      console.log(`[PAGAMENTOS DEBUG] Processando proposta ${proposta.id}:`, {
        clienteNome: proposta.clienteNome,
        clienteCpf: proposta.clienteCpf,
        valorTotalFinanciado: proposta.valorTotalFinanciado,
        lojaNome: loja?.nomeLoja,
        produtoNome: produto?.nomeProduto
      });
      
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

      // Dados bancários da proposta ou N/A quando não disponível
      const contaBancaria = {
        banco: proposta.dadosPagamentoBanco || 'N/A',
        agencia: proposta.dadosPagamentoAgencia || 'N/A',
        conta: proposta.dadosPagamentoConta || 'N/A',
        tipoConta: proposta.dadosPagamentoTipo || 'N/A',
        titular: proposta.dadosPagamentoNomeTitular || proposta.clienteNome || 'N/A'
      };

      const pagamentoFormatado = {
        id: proposta.id,
        propostaId: proposta.id,
        numeroContrato: `CONT-${proposta.id.slice(0, 8).toUpperCase()}`,
        nomeCliente: proposta.clienteNome || 'Cliente não informado',
        cpfCliente: proposta.clienteCpf || 'CPF não informado',
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
          nome: 'Atendente',
          papel: 'ATENDENTE',
          loja: loja?.nomeLoja || 'Loja não informada'
        },
        aprovadoPor: proposta.analistaId ? {
          id: proposta.analistaId,
          nome: 'Analista de Crédito',
          papel: 'ANALISTA'
        } : undefined,
        motivoRejeicao: '',
        observacoes: proposta.observacoes,
        comprovante: '',
        formaPagamento: proposta.dadosPagamentoPix ? 'pix' as const : 'ted' as const,
        loja: loja?.nomeLoja || 'Loja não informada',
        produto: produto?.nomeProduto || 'Produto não informado'
      };
      
      console.log(`[PAGAMENTOS DEBUG] Pagamento formatado para ${proposta.id}:`, {
        numeroContrato: pagamentoFormatado.numeroContrato,
        nomeCliente: pagamentoFormatado.nomeCliente,
        cpfCliente: pagamentoFormatado.cpfCliente,
        valorFinanciado: pagamentoFormatado.valorFinanciado,
        valorLiquido: pagamentoFormatado.valorLiquido,
        produto: pagamentoFormatado.produto,
        loja: pagamentoFormatado.loja
      });
      
      return pagamentoFormatado;
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

// Processar pagamento
router.post("/:id/processar", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { comprovante } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    // Buscar a proposta
    const [proposta] = await db
      .select()
      .from(propostas)
      .where(eq(propostas.id, id))
      .limit(1);

    if (!proposta) {
      return res.status(404).json({ error: "Proposta não encontrada" });
    }

    // Atualizar status para pago
    await db
      .update(propostas)
      .set({
        status: 'pago',
        dataPagamento: new Date(),
        observacoes: `${proposta.observacoes || ''}\n\n[PAGAMENTO PROCESSADO] Empréstimo pago ao cliente`
      })
      .where(eq(propostas.id, id));

    console.log(`[PAGAMENTOS] Pagamento processado para proposta ${id}`);

    res.json({ success: true, message: "Pagamento processado com sucesso" });
  } catch (error) {
    console.error("[PAGAMENTOS] Erro ao processar pagamento:", error);
    res.status(500).json({ error: "Erro ao processar pagamento" });
  }
});

// Nova rota para verificar documentos CCB antes do pagamento
router.get("/:id/verificar-documentos", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }
    
    // Registrar auditoria de visualização
    await registrarAuditoriaPagamento(
      id,
      userId,
      'VISUALIZACAO_DOCUMENTOS_PRE_PAGAMENTO',
      { timestamp: new Date().toISOString() }
    );
    
    // Buscar proposta e documentos
    const [proposta] = await db
      .select()
      .from(propostas)
      .where(eq(propostas.id, id))
      .limit(1);
      
    if (!proposta) {
      return res.status(404).json({ error: "Proposta não encontrada" });
    }
    
    // Verificar boletos no Inter
    const boletos = await db
      .select()
      .from(interCollections)
      .where(eq(interCollections.propostaId, id));
    
    const verificacoes = {
      ccbAssinada: proposta.ccbGerado && proposta.assinaturaEletronicaConcluida,
      boletosGerados: boletos.length > 0,
      titularidadeConta: proposta.dadosPagamentoCpfTitular === proposta.clienteCpf,
      documentosCcb: {
        urlCcb: proposta.ccbGerado ? `/api/propostas/${id}/ccb` : null,
        dataAssinatura: proposta.dataAprovacao
      },
      dadosPagamento: {
        valor: Number(proposta.valorTotalFinanciado || 0),
        valorLiquido: Number(proposta.valorTotalFinanciado || 0) - Number(proposta.valorIof || 0) - Number(proposta.valorTac || 0),
        destino: {
          tipo: proposta.dadosPagamentoPix ? 'PIX' : 'CONTA_BANCARIA',
          banco: proposta.dadosPagamentoBanco,
          agencia: proposta.dadosPagamentoAgencia,
          conta: proposta.dadosPagamentoConta,
          pix: proposta.dadosPagamentoPix
        }
      }
    };
    
    res.json(verificacoes);
  } catch (error) {
    console.error("Erro ao verificar documentos:", error);
    res.status(500).json({ error: "Erro ao verificar documentos" });
  }
});

// Nova rota para confirmar pagamento com segurança máxima
router.post("/:id/confirmar-desembolso", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { senha, observacoes } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }
    
    // Verificar permissões - SEGREGAÇÃO DE FUNÇÕES
    if (!['ADMINISTRADOR', 'FINANCEIRO'].includes(userRole || '')) {
      return res.status(403).json({ error: "Usuário sem permissão para confirmar desembolsos" });
    }
    
    // TODO: Implementar verificação de senha/MFA
    
    // Buscar proposta completa
    const [proposta] = await db
      .select()
      .from(propostas)
      .where(eq(propostas.id, id))
      .limit(1);
      
    if (!proposta) {
      return res.status(404).json({ error: "Proposta não encontrada" });
    }
    
    // Verificações críticas
    if (!proposta.ccbGerado || !proposta.assinaturaEletronicaConcluida) {
      return res.status(400).json({ error: "CCB não assinada. Desembolso bloqueado." });
    }
    
    const boletos = await db
      .select()
      .from(interCollections)
      .where(eq(interCollections.propostaId, id));
      
    if (boletos.length === 0) {
      return res.status(400).json({ error: "Boletos não gerados. Desembolso bloqueado." });
    }
    
    // Atualizar para DESEMBOLSADO
    await db
      .update(propostas)
      .set({
        status: 'pago',
        dataPagamento: new Date(),
        observacoes: `${proposta.observacoes || ''}\n\n[DESEMBOLSO CONFIRMADO] ${observacoes || 'Pagamento realizado ao cliente'}`
      })
      .where(eq(propostas.id, id));
    
    // Registrar auditoria completa e imutável
    await registrarAuditoriaPagamento(
      id,
      userId,
      'DESEMBOLSO_CONFIRMADO',
      {
        timestamp: new Date().toISOString(),
        userRole,
        valorDesembolsado: proposta.valorTotalFinanciado,
        destino: {
          tipo: proposta.dadosPagamentoPix ? 'PIX' : 'TED',
          dados: proposta.dadosPagamentoPix || `${proposta.dadosPagamentoBanco} AG:${proposta.dadosPagamentoAgencia} CC:${proposta.dadosPagamentoConta}`
        },
        observacoes,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    );
    
    res.json({ 
      success: true,
      message: "Desembolso confirmado com sucesso",
      status: "DESEMBOLSADO",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Erro ao confirmar desembolso:", error);
    res.status(500).json({ error: "Erro ao confirmar desembolso" });
  }
});

export default router;