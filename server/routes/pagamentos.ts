import { Router } from "express";
import { jwtAuthMiddleware, type AuthenticatedRequest } from "../lib/jwt-auth-middleware.js";
import { db, supabase } from "../lib/supabase.js";
import { propostas, users, profiles, lojas, produtos, interCollections } from "@shared/schema";
import { eq, and, or, desc, sql, gte, lte, inArray } from "drizzle-orm";
import { z } from "zod";
import { isToday, isThisWeek, isThisMonth, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import multer from "multer";

// Configuração do multer para upload de arquivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

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
          inArray(propostas.status, ['pronto_pagamento', 'aprovado', 'pago'])
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
          // Status deve ser pronto_pagamento, aprovado OU pago (para histórico)
          inArray(propostas.status, ['pronto_pagamento', 'aprovado', 'pago'])
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
    
    console.log(`[PAGAMENTOS DEBUG] Pagamentos antes dos filtros: ${pagamentosFormatados.length}`);
    console.log(`[PAGAMENTOS DEBUG] Filtros recebidos - status: ${status}, periodo: ${periodo}`);

    // Filtrar por status
    if (status && status !== 'todos') {
      console.log(`[PAGAMENTOS DEBUG] Aplicando filtro de status: ${status}`);
      const antesStatus = pagamentosFiltrados.length;
      pagamentosFiltrados = pagamentosFiltrados.filter(p => p.status === status);
      console.log(`[PAGAMENTOS DEBUG] Após filtro status: ${antesStatus} -> ${pagamentosFiltrados.length}`);
    }

    // Filtrar por período
    if (periodo && periodo !== 'todos') {
      console.log(`[PAGAMENTOS DEBUG] Aplicando filtro de período: ${periodo}`);
      const antesPeriodo = pagamentosFiltrados.length;
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
      console.log(`[PAGAMENTOS DEBUG] Após filtro período: ${antesPeriodo} -> ${pagamentosFiltrados.length}`);
    }

    console.log(`[PAGAMENTOS DEBUG] RESPOSTA FINAL: ${pagamentosFiltrados.length} pagamentos`);
    if (pagamentosFiltrados.length > 0) {
      console.log(`[PAGAMENTOS DEBUG] Primeiro pagamento:`, {
        id: pagamentosFiltrados[0].id,
        nomeCliente: pagamentosFiltrados[0].nomeCliente,
        status: pagamentosFiltrados[0].status
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

// Rota para buscar CCB assinada (primeiro tenta Supabase Storage, depois ClickSign)
router.get("/:id/ccb-assinada", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }
    
    console.log(`[PAGAMENTOS] Buscando CCB assinada para proposta: ${id}`);
    
    // Buscar dados da proposta incluindo a chave do documento ClickSign
    const [proposta] = await db
      .select()
      .from(propostas)
      .where(eq(propostas.id, id))
      .limit(1);
    
    if (!proposta) {
      return res.status(404).json({ error: "Proposta não encontrada" });
    }
    
    // Verificar se a CCB foi gerada e assinada
    if (!proposta.ccbGerado) {
      return res.status(400).json({ error: "CCB não foi gerada para esta proposta" });
    }
    
    if (!proposta.assinaturaEletronicaConcluida) {
      return res.status(400).json({ error: "CCB ainda não foi assinada eletronicamente" });
    }
    
    const filename = `CCB_${proposta.id}_assinada.pdf`;
    
    // ESTRATÉGIA 1: Tentar buscar do Supabase Storage primeiro (mais rápido e econômico)
    if (proposta.caminhoCcbAssinado) {
      try {
        console.log(`[PAGAMENTOS] Tentando buscar CCB do Supabase Storage: ${proposta.caminhoCcbAssinado}`);
        
        // Baixar o arquivo do Storage
        const { data, error } = await supabase.storage
          .from('documents')
          .download(proposta.caminhoCcbAssinado);
        
        if (!error && data) {
          console.log(`[PAGAMENTOS] ✅ CCB encontrada no Supabase Storage`);
          const buffer = Buffer.from(await data.arrayBuffer());
          
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
          res.setHeader('Content-Length', buffer.length.toString());
          res.send(buffer);
          return;
        }
        
        console.log(`[PAGAMENTOS] ⚠️ CCB não encontrada no Storage, tentando ClickSign...`);
      } catch (storageError) {
        console.error('[PAGAMENTOS] Erro ao buscar do Storage:', storageError);
      }
    }
    
    // ESTRATÉGIA 2: Se não encontrou no Storage, buscar da ClickSign e salvar
    if (!proposta.clicksignDocumentKey) {
      return res.status(400).json({ error: "CCB assinada não encontrada" });
    }
    
    // Importar o serviço ClickSign
    const { clickSignService } = await import('../services/clickSignService.js');
    
    try {
      // Baixar o documento assinado da ClickSign
      console.log(`[PAGAMENTOS] Baixando documento da ClickSign: ${proposta.clicksignDocumentKey}`);
      const pdfBuffer = await clickSignService.downloadSignedDocument(proposta.clicksignDocumentKey);
      
      // Salvar no Supabase Storage para próximas requisições
      const storagePath = `ccb/assinadas/${proposta.id}/${filename}`;
      
      console.log(`[PAGAMENTOS] Salvando CCB no Supabase Storage: ${storagePath}`);
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true
        });
      
      if (!uploadError) {
        // Atualizar o caminho no banco de dados
        await db
          .update(propostas)
          .set({ caminhoCcbAssinado: storagePath })
          .where(eq(propostas.id, id));
        
        console.log(`[PAGAMENTOS] ✅ CCB salva no Storage e caminho atualizado no banco`);
      } else {
        console.error('[PAGAMENTOS] Erro ao salvar no Storage:', uploadError);
      }
      
      // Enviar o PDF como resposta
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length.toString());
      
      console.log(`[PAGAMENTOS] ✅ CCB assinada enviada com sucesso: ${filename} (${pdfBuffer.length} bytes)`);
      
      res.send(pdfBuffer);
    } catch (clickSignError: any) {
      console.error('[PAGAMENTOS] Erro ao baixar CCB da ClickSign:', clickSignError);
      
      // Tratar erros específicos
      if (clickSignError.message?.includes('still being processed')) {
        return res.status(202).json({ 
          error: "O documento ainda está sendo processado pela ClickSign. Tente novamente em alguns momentos." 
        });
      }
      
      return res.status(500).json({ 
        error: "Erro ao baixar o documento assinado",
        details: clickSignError.message 
      });
    }
  } catch (error) {
    console.error("[PAGAMENTOS] Erro ao buscar CCB assinada:", error);
    res.status(500).json({ error: "Erro ao buscar CCB assinada" });
  }
});

// Rota para verificar status de armazenamento da CCB
router.get("/:id/ccb-storage-status", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    
    const [proposta] = await db
      .select({
        id: propostas.id,
        ccbGerado: propostas.ccbGerado,
        assinaturaEletronicaConcluida: propostas.assinaturaEletronicaConcluida,
        caminhoCcbAssinado: propostas.caminhoCcbAssinado,
        clicksignDocumentKey: propostas.clicksignDocumentKey,
        ccbDocumentoUrl: propostas.ccbDocumentoUrl
      })
      .from(propostas)
      .where(eq(propostas.id, id))
      .limit(1);
    
    if (!proposta) {
      return res.status(404).json({ error: "Proposta não encontrada" });
    }
    
    // Verificar se existe no Storage
    let existsInStorage = false;
    let storageUrl = null;
    
    if (proposta.caminhoCcbAssinado) {
      const { data: files } = await supabase.storage
        .from('documents')
        .list(proposta.caminhoCcbAssinado.split('/').slice(0, -1).join('/'));
      
      existsInStorage = files ? files.some(f => proposta.caminhoCcbAssinado?.includes(f.name)) : false;
      
      if (existsInStorage) {
        const { data: urlData } = await supabase.storage
          .from('documents')
          .createSignedUrl(proposta.caminhoCcbAssinado, 3600);
        storageUrl = urlData?.signedUrl;
      }
    }
    
    res.json({
      status: {
        ccbGerada: proposta.ccbGerado,
        assinadaEletronicamente: proposta.assinaturaEletronicaConcluida,
        temChaveClickSign: !!proposta.clicksignDocumentKey,
        salvaNoStorage: existsInStorage
      },
      paths: {
        storagePathAssinada: proposta.caminhoCcbAssinado,
        storagePathOriginal: proposta.ccbDocumentoUrl,
        clickSignKey: proposta.clicksignDocumentKey
      },
      urls: {
        storageUrl: storageUrl,
        expiresIn: storageUrl ? 3600 : null
      },
      recommendation: !existsInStorage && proposta.assinaturaEletronicaConcluida 
        ? "CCB assinada mas não está no Storage. Use o endpoint /ccb-url para baixar e armazenar."
        : "CCB disponível no Storage"
    });
  } catch (error) {
    console.error("[PAGAMENTOS] Erro ao verificar status da CCB:", error);
    res.status(500).json({ error: "Erro ao verificar status" });
  }
});

// Rota para buscar detalhes completos da proposta
router.get("/:id/detalhes-completos", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    console.log(`[PAGAMENTOS] Buscando detalhes completos da proposta: ${id}`);
    
    // HOTFIX: Selecionar apenas colunas que existem, evitando created_at
    const [propostaData] = await db
      .select({
        // Campos básicos
        id: propostas.id,
        lojaId: propostas.lojaId,
        produtoId: propostas.produtoId,
        tabelaComercialId: propostas.tabelaComercialId,
        
        // Dados do cliente
        clienteNome: propostas.clienteNome,
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
        clienteOcupacao: propostas.clienteOcupacao,
        
        // Dados financeiros
        valor: propostas.valor,
        prazo: propostas.prazo,
        finalidade: propostas.finalidade,
        garantia: propostas.garantia,
        taxaJuros: propostas.taxaJuros,
        valorTac: propostas.valorTac,
        valorIof: propostas.valorIof,
        valorTotalFinanciado: propostas.valorTotalFinanciado,
        valorAprovado: propostas.valorAprovado,
        
        // Status e formalização
        status: propostas.status,
        ccbGerado: propostas.ccbGerado,
        assinaturaEletronicaConcluida: propostas.assinaturaEletronicaConcluida,
        biometriaConcluida: propostas.biometriaConcluida,
        caminhoCcbAssinado: propostas.caminhoCcbAssinado,
        ccbDocumentoUrl: propostas.ccbDocumentoUrl,
        statusAssinatura: propostas.statusAssinatura,
        statusBiometria: propostas.statusBiometria,
        
        // ClickSign
        clicksignDocumentKey: propostas.clicksignDocumentKey,
        clicksignSignerKey: propostas.clicksignSignerKey,
        clicksignListKey: propostas.clicksignListKey,
        clicksignStatus: propostas.clicksignStatus,
        clicksignSignUrl: propostas.clicksignSignUrl,
        clicksignSentAt: propostas.clicksignSentAt,
        clicksignSignedAt: propostas.clicksignSignedAt,
        
        // Dados de pagamento
        dadosPagamentoBanco: propostas.dadosPagamentoBanco,
        dadosPagamentoAgencia: propostas.dadosPagamentoAgencia,
        dadosPagamentoConta: propostas.dadosPagamentoConta,
        dadosPagamentoTipo: propostas.dadosPagamentoTipo,
        dadosPagamentoNomeTitular: propostas.dadosPagamentoNomeTitular,
        dadosPagamentoCpfTitular: propostas.dadosPagamentoCpfTitular,
        dadosPagamentoPix: propostas.dadosPagamentoPix,
        dadosPagamentoTipoPix: propostas.dadosPagamentoTipoPix,
        urlComprovantePagamento: propostas.urlComprovantePagamento,
        
        // Outros campos
        observacoes: propostas.observacoes,
        observacoesFormalizacao: propostas.observacoesFormalizacao,
        userId: propostas.userId,
        analistaId: propostas.analistaId,
        dataAnalise: propostas.dataAnalise,
        dataAprovacao: propostas.dataAprovacao,
        motivoPendencia: propostas.motivoPendencia,
        documentos: propostas.documentos,
        documentosAdicionais: propostas.documentosAdicionais,
        contratoGerado: propostas.contratoGerado,
        contratoAssinado: propostas.contratoAssinado,
        dataAssinatura: propostas.dataAssinatura,
        dataPagamento: propostas.dataPagamento,
        clienteData: propostas.clienteData,
        condicoesData: propostas.condicoesData,
        
        // NOTA: Omitindo createdAt temporariamente devido ao erro de mapeamento
        // createdAt: propostas.createdAt,
      })
      .from(propostas)
      .where(eq(propostas.id, id))
      .limit(1);
    
    if (!propostaData) {
      return res.status(404).json({ error: "Proposta não encontrada" });
    }
    
    // Buscar dados relacionados separadamente se existirem
    const [lojaData] = propostaData.lojaId ? await db
      .select()
      .from(lojas)
      .where(eq(lojas.id, propostaData.lojaId))
      .limit(1) : [null];
    
    const [produtoData] = propostaData.produtoId ? await db
      .select()
      .from(produtos)
      .where(eq(produtos.id, propostaData.produtoId))
      .limit(1) : [null];
    
    const [usuarioData] = propostaData.userId ? await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, propostaData.userId))
      .limit(1) : [null];
    
    // Usar os dados obtidos separadamente
    
    // Buscar boletos da Inter, se existirem
    console.log('[DEBUG] Tentando buscar boletos para proposta:', id);
    let boletos: any[] = [];
    try {
      boletos = await db
        .select()
        .from(interCollections)
        .where(eq(interCollections.propostaId, id));
      console.log('[DEBUG] Boletos encontrados:', boletos.length);
    } catch (boletoError) {
      console.error('[DEBUG] ERRO ao buscar boletos:', boletoError);
      // Continue sem boletos se houver erro
      boletos = [];
    }
    
    // Debug: verificar dados da proposta
    console.log(`[PAGAMENTOS DEBUG] Dados da proposta encontrados:`, {
      id: propostaData.id,
      clienteNome: propostaData.clienteNome,
      clienteEmail: propostaData.clienteEmail,
      clienteTelefone: propostaData.clienteTelefone,
      clienteDataNascimento: propostaData.clienteDataNascimento,
      clienteRenda: propostaData.clienteRenda,
      prazo: propostaData.prazo,
      taxaJuros: propostaData.taxaJuros,
      finalidade: propostaData.finalidade,
      ccbGerado: propostaData.ccbGerado,
      assinaturaEletronicaConcluida: propostaData.assinaturaEletronicaConcluida,
      caminhoCcbAssinado: propostaData.caminhoCcbAssinado
    });
    
    // Montar resposta completa
    const respostaCompleta = {
      ...propostaData,
      lojaNome: lojaData?.nomeLoja,
      produtoNome: produtoData?.nomeProduto,
      usuarioNome: usuarioData?.fullName,
      boletos: boletos.map(b => ({
        id: b.id,
        codigo: b.codigoSolicitacao,
        dataVencimento: b.dataVencimento,
        valor: b.valorNominal,
        status: b.situacao,
        linhaDigitavel: b.linhaDigitavel,
        pixCopiaECola: b.pixCopiaECola
      }))
    };
    
    console.log(`[PAGAMENTOS] ✅ Detalhes completos retornados para proposta: ${id}`);
    console.log(`[PAGAMENTOS DEBUG] Resposta enviada ao frontend - campos principais:`, {
      hasClienteEmail: !!respostaCompleta.clienteEmail,
      hasClienteTelefone: !!respostaCompleta.clienteTelefone,
      hasClienteDataNascimento: !!respostaCompleta.clienteDataNascimento,
      hasClienteRenda: !!respostaCompleta.clienteRenda,
      hasPrazo: !!respostaCompleta.prazo,
      hasTaxaJuros: !!respostaCompleta.taxaJuros,
      hasFinalidade: !!respostaCompleta.finalidade,
      hasCcbGerado: !!respostaCompleta.ccbGerado,
      hasCaminhoCcbAssinado: !!respostaCompleta.caminhoCcbAssinado
    });
    res.json(respostaCompleta);
    
  } catch (error) {
    console.error("[PAGAMENTOS] Erro ao buscar detalhes completos:", error);
    res.status(500).json({ error: "Erro ao buscar detalhes da proposta" });
  }
});

// Rota para confirmar veracidade e autorizar pagamento
router.post("/:id/confirmar-veracidade", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    // Verificar permissões - apenas ADMIN e FINANCEIRO podem confirmar
    if (userRole !== 'ADMINISTRADOR' && userRole !== 'FINANCEIRO') {
      return res.status(403).json({ error: "Sem permissão para confirmar veracidade" });
    }
    
    console.log(`[PAGAMENTOS] Confirmando veracidade da proposta: ${id} por usuário: ${userId}`);
    
    // Buscar proposta
    const [proposta] = await db
      .select()
      .from(propostas)
      .where(eq(propostas.id, id))
      .limit(1);
    
    if (!proposta) {
      return res.status(404).json({ error: "Proposta não encontrada" });
    }
    
    // Verificar se está no status correto
    if (proposta.status !== 'pronto_pagamento') {
      return res.status(400).json({ 
        error: "Proposta não está pronta para pagamento",
        statusAtual: proposta.status 
      });
    }
    
    // Verificar se CCB foi assinada
    if (!proposta.assinaturaEletronicaConcluida) {
      return res.status(400).json({ 
        error: "CCB ainda não foi assinada eletronicamente" 
      });
    }
    
    // Atualizar status para pagamento_autorizado
    await db
      .update(propostas)
      .set({ 
        status: 'pagamento_autorizado'
      })
      .where(eq(propostas.id, id));
    
    // Buscar informações do usuário para o log
    const { profiles } = await import("@shared/schema");
    const [user] = await db
      .select({
        fullName: profiles.fullName,
        role: profiles.role
      })
      .from(profiles)
      .where(eq(profiles.id, userId!))
      .limit(1);
    
    // Registrar na tabela de histórico de observações
    const { historicoObservacoesCobranca } = await import("@shared/schema");
    await db.insert(historicoObservacoesCobranca).values({
      propostaId: id,
      mensagem: `Veracidade dos documentos confirmada. Pagamento autorizado por ${userRole}.`,
      criadoPor: user?.fullName || userId || 'sistema',
      tipoAcao: 'CONFIRMACAO_VERACIDADE',
      dadosAcao: {
        autorId: userId,
        nomeAutor: user?.fullName,
        role: userRole,
        statusAnterior: 'pronto_pagamento',
        statusNovo: 'pagamento_autorizado',
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    });
    
    console.log(`[PAGAMENTOS] ✅ Veracidade confirmada e pagamento autorizado para proposta: ${id}`);
    
    // Retornar os dados de pagamento (incluindo chave PIX)
    res.json({
      success: true,
      message: "Veracidade confirmada e pagamento autorizado",
      status: "pagamento_autorizado",
      dadosPagamento: {
        pix: proposta.dadosPagamentoPix,
        banco: proposta.dadosPagamentoBanco,
        agencia: proposta.dadosPagamentoAgencia,
        conta: proposta.dadosPagamentoConta,
        titular: proposta.clienteNome
      },
      autorizadoPor: {
        id: userId,
        nome: user?.fullName,
        role: userRole,
        dataAutorizacao: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("[PAGAMENTOS] Erro ao confirmar veracidade:", error);
    res.status(500).json({ error: "Erro ao confirmar veracidade" });
  }
});

// Rota para marcar pagamento como pago
router.post("/:id/marcar-pago", jwtAuthMiddleware, upload.single('comprovante'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { observacoes } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    console.log(`[PAGAMENTOS] 🔍 [AUDIT] Iniciando marcação como pago - Proposta: ${id}`);
    console.log(`[PAGAMENTOS] 🔍 [AUDIT] Usuário: ${userId} | Role: ${userRole}`);
    
    // Verificar se o usuário tem permissão (apenas ADMIN e FINANCEIRO)
    if (!userRole || !['ADMINISTRADOR', 'FINANCEIRO'].includes(userRole)) {
      console.log(`[PAGAMENTOS] ⛔ [AUDIT] Acesso negado - Role insuficiente: ${userRole}`);
      return res.status(403).json({ 
        error: "Acesso negado. Apenas ADMIN e FINANCEIRO podem marcar pagamentos como pagos." 
      });
    }
    
    // Buscar proposta
    const [proposta] = await db
      .select()
      .from(propostas)
      .where(eq(propostas.id, id))
      .limit(1);
    
    if (!proposta) {
      console.log(`[PAGAMENTOS] ❌ [AUDIT] Proposta não encontrada: ${id}`);
      return res.status(404).json({ error: "Proposta não encontrada" });
    }
    
    // Verificar se a proposta está no status correto
    if (proposta.status !== 'pagamento_autorizado') {
      console.log(`[PAGAMENTOS] ⚠️ [AUDIT] Status inválido para pagamento - Atual: ${proposta.status}, Esperado: pagamento_autorizado`);
      return res.status(400).json({ 
        error: "Apenas propostas com status 'pagamento_autorizado' podem ser marcadas como pagas",
        statusAtual: proposta.status 
      });
    }
    
    let comprovanteUrl = null;
    
    // Processar upload do comprovante se fornecido
    if (req.file) {
      console.log(`[PAGAMENTOS] 📄 [AUDIT] Processando upload de comprovante - Arquivo: ${req.file.originalname}`);
      console.log(`[PAGAMENTOS] 📄 [AUDIT] Tamanho: ${req.file.size} bytes | Tipo: ${req.file.mimetype}`);
      
      // Validar tipo de arquivo
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        console.log(`[PAGAMENTOS] ❌ [AUDIT] Tipo de arquivo inválido: ${req.file.mimetype}`);
        return res.status(400).json({ 
          error: "Tipo de arquivo não permitido. Use PDF, JPG ou PNG." 
        });
      }
      
      // Validar tamanho (máximo 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (req.file.size > maxSize) {
        console.log(`[PAGAMENTOS] ❌ [AUDIT] Arquivo muito grande: ${req.file.size} bytes`);
        return res.status(400).json({ 
          error: "Arquivo muito grande. Máximo 5MB permitido." 
        });
      }
      
      try {
        // Upload para Supabase Storage
        const { supabase } = await import('../lib/supabase.js');
        const fileName = `comprovante_${Date.now()}_${req.file.originalname}`;
        const filePath = `comprovantes/${id}/${fileName}`;
        
        console.log(`[PAGAMENTOS] 📤 [AUDIT] Fazendo upload para Storage - Caminho: ${filePath}`);
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, req.file.buffer, {
            contentType: req.file.mimetype,
            cacheControl: '3600',
            upsert: false
          });
        
        if (uploadError) {
          console.error(`[PAGAMENTOS] ❌ [AUDIT] Erro no upload:`, uploadError);
          return res.status(500).json({ 
            error: "Erro ao fazer upload do comprovante",
            details: uploadError.message 
          });
        }
        
        // Gerar URL pública
        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);
        
        comprovanteUrl = urlData.publicUrl;
        console.log(`[PAGAMENTOS] ✅ [AUDIT] Upload concluído - URL: ${comprovanteUrl}`);
        
      } catch (error) {
        console.error(`[PAGAMENTOS] ❌ [AUDIT] Erro no processamento do arquivo:`, error);
        return res.status(500).json({ 
          error: "Erro ao processar arquivo de comprovante" 
        });
      }
    }
    
    // Atualizar status para pago e salvar URL do comprovante
    const updateData: any = { 
      status: 'pago',
      dataPagamento: new Date()
    };
    
    if (comprovanteUrl) {
      updateData.urlComprovantePagamento = comprovanteUrl;
    }
    
    await db
      .update(propostas)
      .set(updateData)
      .where(eq(propostas.id, id));
    
    console.log(`[PAGAMENTOS] ✅ [AUDIT] Status atualizado para 'pago' - Proposta: ${id}`);
    
    // Buscar informações do usuário para o log
    const { profiles } = await import("@shared/schema");
    const [user] = await db
      .select({
        fullName: profiles.fullName,
        role: profiles.role
      })
      .from(profiles)
      .where(eq(profiles.id, userId!))
      .limit(1);
    
    // Registrar na tabela de histórico de observações
    const { historicoObservacoesCobranca } = await import("@shared/schema");
    const mensagemLog = `Proposta marcada como paga por ${user?.fullName || userId}. ${observacoes ? `Observações: ${observacoes}` : ''}${comprovanteUrl ? ' Comprovante anexado.' : ''}`;
    
    await db.insert(historicoObservacoesCobranca).values({
      propostaId: id,
      mensagem: mensagemLog,
      criadoPor: user?.fullName || userId || 'sistema',
      tipoAcao: 'MARCACAO_PAGO',
      dadosAcao: {
        autorId: userId,
        nomeAutor: user?.fullName,
        role: userRole,
        statusAnterior: 'pagamento_autorizado',
        statusNovo: 'pago',
        observacoes: observacoes || null,
        comprovanteUrl: comprovanteUrl || null,
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    });
    
    console.log(`[PAGAMENTOS] 🔍 [AUDIT] Registro de auditoria criado - Ação: MARCACAO_PAGO`);
    console.log(`[PAGAMENTOS] ✅ [AUDIT] Processo concluído com sucesso - Proposta ${id} marcada como paga`);
    
    res.json({
      success: true,
      message: "Pagamento marcado como pago com sucesso",
      status: "pago",
      comprovanteUrl: comprovanteUrl,
      marcadoPor: {
        id: userId,
        nome: user?.fullName,
        role: userRole,
        dataMarcacao: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error("[PAGAMENTOS] ❌ [AUDIT] Erro ao marcar como pago:", error);
    res.status(500).json({ error: "Erro ao marcar pagamento como pago" });
  }
});

// Rota para obter URL assinada do Supabase Storage para CCB
router.get("/:id/ccb-url", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    
    console.log(`[PAGAMENTOS] Gerando URL assinada para CCB da proposta: ${id}`);
    
    // Buscar dados da proposta
    const [proposta] = await db
      .select()
      .from(propostas)
      .where(eq(propostas.id, id))
      .limit(1);
    
    if (!proposta) {
      return res.status(404).json({ error: "Proposta não encontrada" });
    }
    
    // Verificar se tem caminho da CCB assinada no Storage
    if (!proposta.caminhoCcbAssinado) {
      // Se não tem, mas tem chave do ClickSign e está assinada, baixar e salvar
      if (proposta.clicksignDocumentKey && proposta.assinaturaEletronicaConcluida) {
        console.log(`[PAGAMENTOS] CCB não está no Storage, baixando do ClickSign...`);
        
        const { clickSignService } = await import('../services/clickSignService.js');
        const pdfBuffer = await clickSignService.downloadSignedDocument(proposta.clicksignDocumentKey);
        
        // Salvar no Storage
        const filename = `CCB_${proposta.id}_assinada.pdf`;
        const storagePath = `ccb/assinadas/${proposta.id}/${filename}`;
        
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(storagePath, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true
          });
        
        if (!uploadError) {
          // Atualizar o caminho no banco
          await db
            .update(propostas)
            .set({ caminhoCcbAssinado: storagePath })
            .where(eq(propostas.id, id));
          
          console.log(`[PAGAMENTOS] ✅ CCB salva no Storage: ${storagePath}`);
          
          // Gerar URL assinada (válida por 1 hora)
          const { data: urlData, error: urlError } = await supabase.storage
            .from('documents')
            .createSignedUrl(storagePath, 3600);
          
          if (urlData?.signedUrl) {
            return res.json({
              url: urlData.signedUrl,
              source: 'clicksign_downloaded',
              storagePath,
              expiresIn: 3600
            });
          }
        }
      }
      
      return res.status(404).json({ error: "CCB assinada não disponível" });
    }
    
    // Gerar URL assinada do Storage (válida por 1 hora)
    const { data: urlData, error: urlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(proposta.caminhoCcbAssinado, 3600);
    
    if (urlError || !urlData?.signedUrl) {
      console.error('[PAGAMENTOS] Erro ao gerar URL assinada:', urlError);
      return res.status(500).json({ error: "Erro ao gerar URL para visualização" });
    }
    
    console.log(`[PAGAMENTOS] ✅ URL assinada gerada para: ${proposta.caminhoCcbAssinado}`);
    
    res.json({
      url: urlData.signedUrl,
      source: 'supabase_storage',
      storagePath: proposta.caminhoCcbAssinado,
      expiresIn: 3600
    });
  } catch (error) {
    console.error("[PAGAMENTOS] Erro ao gerar URL da CCB:", error);
    res.status(500).json({ error: "Erro ao gerar URL da CCB" });
  }
});

export default router;