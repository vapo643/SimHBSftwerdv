import { Router } from 'express';
import { db } from '../lib/supabase';
import {
  propostas,
  parcelas,
  observacoesCobranca,
  historicoObservacoesCobranca,
  interCollections,
  profiles,
  solicitacoesModificacao,
  propostaLogs,
  statusContextuais, // PAM V1.0 - Importar tabela de status contextuais
} from '@shared/schema';
import { eq, and, sql, desc, gte, lte, inArray, or, not } from 'drizzle-orm';
import { format, parseISO, differenceInDays, isAfter } from 'date-fns';
import { jwtAuthMiddleware } from '../lib/jwt-auth-middleware';
import { maskCPF, maskEmail, maskRG, maskTelefone } from '../utils/masking';

const router = Router();

// GET /api/cobrancas - Lista todas as propostas com informações de cobrança
router.get('/', async (req: any, res) => {
  try {
    const { status, atraso } = req.query;
    const userRole = req.user?.role || '';

    console.log('🔍 [COBRANÇAS] ====== INÍCIO DA BUSCA DE PROPOSTAS ======');
    console.log('🔍 [COBRANÇAS] Filtros aplicados:', { status, atraso });

    // PAM V1.0 REFATORADO: Usar STATUS como fonte da verdade (Blueprint de Negócio V1.0)
    console.log('🔍 [COBRANÇAS] PAM V1.0 - Filtrando propostas por STATUS conforme Blueprint...');

    // REGRA CORRIGIDA: Filtrar por STATUS da proposta, não por EXISTS em inter_collections
    // Status elegíveis para cobrança (após boletos emitidos)
    const statusElegiveis = [
      'BOLETOS_EMITIDOS', // Principal status para cobranças
      'PAGAMENTO_PENDENTE', // Aguardando pagamento
      'PAGAMENTO_PARCIAL', // Pagamento parcial recebido
      'PAGAMENTO_CONFIRMADO', // Pagamento total confirmado
      // Status legados para compatibilidade
      'pronto_pagamento', // Antigo BOLETOS_EMITIDOS
    ];

    let whereConditions = and(
      sql`${propostas.deletedAt} IS NULL`,
      inArray(propostas.status, statusElegiveis)
    );

    // 🔧 PAM V1.0 - INSTRUMENTAÇÃO BACKEND PONTO 1
    console.log('[DEBUG-BACKEND-1] Iniciando query de cobranças com os seguintes filtros:', {
      statusElegiveis,
      whereConditions: whereConditions?.toString(),
      userRole,
      queryParams: { status, atraso },
    });

    // 🔧 PAM V1.0 - REFATORAÇÃO: Query com JOIN para status contextuais
    const propostasData = await db
      .select({
        // Campos essenciais da proposta
        id: propostas.id,
        numeroProposta: propostas.numeroProposta,
        lojaId: propostas.lojaId,
        status: propostas.status, // Status legado mantido para fallback
        // PAM V1.0 - Campo de status contextual da nova tabela
        statusContextual: statusContextuais.status,

        // 🎯 DADOS DO CLIENTE - SELEÇÃO EXPLÍCITA OBRIGATÓRIA
        clienteNome: propostas.clienteNome,
        clienteCpf: propostas.clienteCpf,
        clienteEmail: propostas.clienteEmail,
        clienteTelefone: propostas.clienteTelefone,
        clienteDataNascimento: propostas.clienteDataNascimento,
        clienteRenda: propostas.clienteRenda,
        clienteRg: propostas.clienteRg,
        clienteOrgaoEmissor: propostas.clienteOrgaoEmissor,
        clienteRgUf: propostas.clienteRgUf,
        clienteRgDataEmissao: propostas.clienteRgDataEmissao,
        clienteEstadoCivil: propostas.clienteEstadoCivil,
        clienteNacionalidade: propostas.clienteNacionalidade,
        clienteLocalNascimento: propostas.clienteLocalNascimento,

        // Endereço completo
        clienteCep: propostas.clienteCep,
        clienteEndereco: propostas.clienteEndereco,
        clienteLogradouro: propostas.clienteLogradouro,
        clienteNumero: propostas.clienteNumero,
        clienteComplemento: propostas.clienteComplemento,
        clienteBairro: propostas.clienteBairro,
        clienteCidade: propostas.clienteCidade,
        clienteUf: propostas.clienteUf,
        clienteOcupacao: propostas.clienteOcupacao,

        // Dados PJ
        tipoPessoa: propostas.tipoPessoa,
        clienteRazaoSocial: propostas.clienteRazaoSocial,
        clienteCnpj: propostas.clienteCnpj,

        // Dados financeiros necessários para cálculos
        valor: propostas.valor,
        prazo: propostas.prazo,
        valorTac: propostas.valorTac,
        valorIof: propostas.valorIof,
        valorTotalFinanciado: propostas.valorTotalFinanciado,
        valorLiquidoLiberado: propostas.valorLiquidoLiberado,
        taxaJuros: propostas.taxaJuros,

        // Dados de aprovação
        dataAprovacao: propostas.dataAprovacao,
        ccbGerado: propostas.ccbGerado,
        assinaturaEletronicaConcluida: propostas.assinaturaEletronicaConcluida,

        // Dados de pagamento para modal
        dadosPagamentoBanco: propostas.dadosPagamentoBanco,
        dadosPagamentoAgencia: propostas.dadosPagamentoAgencia,
        dadosPagamentoConta: propostas.dadosPagamentoConta,
        dadosPagamentoTipo: propostas.dadosPagamentoTipo,
        dadosPagamentoPix: propostas.dadosPagamentoPix,
        dadosPagamentoTipoPix: propostas.dadosPagamentoTipoPix,

        // Timestamps
        createdAt: propostas.createdAt,
        deletedAt: propostas.deletedAt,
      })
      .from(propostas)
      // PAM V1.0 - LEFT JOIN com status_contextuais para contexto de cobranças
      .leftJoin(
        statusContextuais,
        and(
          eq(propostas.id, statusContextuais.propostaId),
          eq(statusContextuais.contexto, 'cobrancas')
        )
      )
      .where(whereConditions)
      // PAM V1.0 Blueprint V2.0 - Ordenação Inteligente Multinível
      // Priorização: 1. Inadimplentes > 2. Próximos a Vencer > 3. Outros
      // Sub-ordenação: Por valor descendente dentro de cada categoria
      .orderBy(
        sql`
          CASE 
            -- Prioridade 1: Inadimplentes (qualquer parcela vencida)
            WHEN EXISTS (
              SELECT 1 FROM parcelas p 
              WHERE p.proposta_id = ${propostas.id} 
              AND p.data_vencimento < CURRENT_DATE 
              AND p.status != 'pago'
            ) THEN 1
            
            -- Prioridade 2: Próximos a Vencer (vence nos próximos 7 dias)
            WHEN EXISTS (
              SELECT 1 FROM parcelas p 
              WHERE p.proposta_id = ${propostas.id} 
              AND p.data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
              AND p.status != 'pago'
            ) THEN 2
            
            -- Prioridade 3: Outros (em dia, vencimento distante)
            ELSE 3
          END ASC,
          
          -- Sub-ordenação por valor total financiado (maior primeiro)
          ${propostas.valorTotalFinanciado} DESC NULLS LAST,
          
          -- Desempate final por data de criação
          ${propostas.createdAt} DESC
        `
      );

    // 🔧 PAM V1.0 - INSTRUMENTAÇÃO BACKEND PONTO 2
    console.log('[DEBUG-BACKEND-2] Resultado BRUTO do DB:', {
      totalPropostas: propostasData.length,
      primeiraProposta: propostasData[0] || null,
      idsEncontrados: propostasData.map((p) => p.id),
      statusEncontrados: propostasData.map((p) => ({
        id: p.id,
        statusLegado: p.status,
        statusContextual: p.statusContextual || 'sem_status_contextual',
      })),
    });

    console.log(
      `🔍 [COBRANÇAS] PAM V1.0 - Encontradas ${propostasData.length} propostas com status elegível`
    );

    // Para cada proposta, buscar suas parcelas e calcular status de cobrança
    const propostasComCobranca = await Promise.all(
      propostasData.map(async (proposta) => {
        // Buscar parcelas da proposta
        const parcelasData = await db
          .select()
          .from(parcelas)
          .where(eq(parcelas.propostaId, proposta.id))
          .orderBy(parcelas.numeroParcela);

        // Buscar TODOS os boletos do Inter Bank para análise (incluindo cancelados)
        const todosBoletosInter = await db
          .select()
          .from(interCollections)
          .where(eq(interCollections.propostaId, proposta.id));

        // Calcular estatísticas
        const hoje = new Date();
        let parcelasVencidas = 0;
        let parcelasPagas = 0;
        let parcelasPendentes = 0;
        let valorTotalPago = 0;
        let valorTotalPendente = 0;
        let valorTotalVencido = 0;
        let diasAtrasoMaximo = 0;

        const parcelasCompletas = parcelasData.map((parcela) => {
          const dataVencimento = parseISO(parcela.dataVencimento);
          const vencida = isAfter(hoje, dataVencimento) && parcela.status !== 'pago';
          const diasAtraso = vencida ? differenceInDays(hoje, dataVencimento) : 0;

          if (diasAtraso > diasAtrasoMaximo) {
            diasAtrasoMaximo = diasAtraso;
          }

          if (parcela.status === 'pago') {
            parcelasPagas++;
            valorTotalPago += Number(parcela.valorParcela);
          } else if (vencida) {
            parcelasVencidas++;
            valorTotalVencido += Number(parcela.valorParcela);
          } else {
            parcelasPendentes++;
            valorTotalPendente += Number(parcela.valorParcela);
          }

          // Adicionar dados do boleto Inter se existir
          const boletoInter = todosBoletosInter.find(
            (b) => b.numeroParcela === parcela.numeroParcela
          );

          return {
            ...parcela,
            diasAtraso,
            vencida,
            // Dados do Inter Bank
            interPixCopiaECola: boletoInter?.pixCopiaECola,
            interLinhaDigitavel: boletoInter?.linhaDigitavel,
            interCodigoBarras: boletoInter?.codigoBarras,
            interSituacao: boletoInter?.situacao,
          };
        });

        // Determinar status geral - só marcar como quitado se todas as parcelas foram pagas
        let statusCobranca = 'em_dia';
        if (parcelasPagas === parcelasData.length && parcelasData.length > 0) {
          statusCobranca = 'quitado';
        } else if (parcelasVencidas > 0) {
          statusCobranca = 'inadimplente';
        }

        // Pegar o primeiro boleto Inter ATIVO para mostrar na tabela principal
        const boletosAtivos = todosBoletosInter.filter(
          (b) => b.situacao !== 'CANCELADO' && b.situacao !== 'EXPIRADO' && b.isActive
        );
        const primeiroBoletoPendente =
          boletosAtivos.find((b) =>
            ['A_RECEBER', 'ATRASADO', 'EM_PROCESSAMENTO'].includes(b.situacao || '')
          ) || boletosAtivos[0];

        return {
          id: proposta.id,
          numeroContrato: proposta.id.slice(0, 8).toUpperCase(),
          nomeCliente: proposta.clienteNome || 'Sem nome',
          cpfCliente: proposta.clienteCpf ? maskCPF(proposta.clienteCpf) : '',
          telefoneCliente: proposta.clienteTelefone ? maskTelefone(proposta.clienteTelefone) : '',
          emailCliente: proposta.clienteEmail ? maskEmail(proposta.clienteEmail) : '',
          enderecoCliente: proposta.clienteEndereco || '',
          cepCliente: proposta.clienteCep || '',
          valorTotal: Number(proposta.valorTotalFinanciado) || 0,
          valorFinanciado: Number(proposta.valor) || 0,
          quantidadeParcelas: parcelasData.length,
          parcelasPagas,
          parcelasPendentes,
          parcelasVencidas,
          valorTotalPago,
          valorTotalPendente,
          valorTotalVencido,
          diasAtraso: diasAtrasoMaximo,
          status: statusCobranca,
          dataContrato: proposta.dataAprovacao || proposta.createdAt,
          ccbAssinada: proposta.ccbGerado && proposta.assinaturaEletronicaConcluida,
          parcelas: parcelasCompletas,
          // Dados do Inter Bank para ações
          interCodigoSolicitacao: primeiroBoletoPendente?.codigoSolicitacao,
          interSituacao: primeiroBoletoPendente?.situacao,
          interDataVencimento: primeiroBoletoPendente?.dataVencimento,
          // Dados bancários do cliente
          dadosBancarios: {
            banco: proposta.dadosPagamentoBanco,
            agencia: proposta.dadosPagamentoAgencia,
            conta: proposta.dadosPagamentoConta,
            tipoConta: proposta.dadosPagamentoTipo,
            pix: proposta.dadosPagamentoPix,
            tipoPix: proposta.dadosPagamentoTipoPix,
          },
        };
      })
    );

    // PAM V1.0 REFATORADO: Todas as propostas já foram filtradas por STATUS na query principal
    // Não precisamos mais da lógica de elegibilidade baseada em EXISTS
    let propostasFiltradas = propostasComCobranca;

    // FILTRO AUTOMÁTICO PARA USUÁRIOS DE COBRANÇA
    // Usuários com role "COBRANÇA" veem apenas: inadimplentes, em atraso ou que vencem em 3 dias
    if (userRole === 'COBRANÇA') {
      const hoje = new Date();
      const em3Dias = new Date();
      em3Dias.setDate(hoje.getDate() + 3);

      propostasFiltradas = propostasFiltradas.filter((p: any) => {
        // Inadimplentes ou em atraso
        if (p.status === 'inadimplente' || p.diasAtraso > 0) {
          return true;
        }

        // Parcelas que vencem nos próximos 3 dias
        const temParcelaVencendoEm3Dias = p.parcelas.some((parcela: any) => {
          if (parcela.status === 'pago') return false;
          const dataVencimento = parseISO(parcela.dataVencimento);
          return dataVencimento <= em3Dias && dataVencimento >= hoje;
        });

        return temParcelaVencendoEm3Dias;
      });
    }

    // Aplicar filtros manuais da interface (se não for usuário de cobrança ou se for filtro adicional)
    if (status === 'inadimplente') {
      propostasFiltradas = propostasFiltradas.filter((p) => p.status === 'inadimplente');
    } else if (status === 'em_dia') {
      propostasFiltradas = propostasFiltradas.filter((p) => p.status === 'em_dia');
    } else if (status === 'quitado') {
      propostasFiltradas = propostasFiltradas.filter((p) => p.status === 'quitado');
    }

    if (atraso === '1-15') {
      propostasFiltradas = propostasFiltradas.filter(
        (p) => p.diasAtraso >= 1 && p.diasAtraso <= 15
      );
    } else if (atraso === '30+') {
      propostasFiltradas = propostasFiltradas.filter((p) => p.diasAtraso > 30);
    }

    console.log(`🔍 [COBRANÇAS] Total de propostas após filtros: ${propostasFiltradas.length}`);
    console.log('🔍 [COBRANÇAS] ====== FIM DA BUSCA DE PROPOSTAS ======');

    // 🔧 PAM V1.0 - INSTRUMENTAÇÃO BACKEND PONTO 3
    console.log('[DEBUG-BACKEND-3] Payload FINAL enviado para o Frontend:', {
      totalPropostas: propostasFiltradas.length,
      primeiraPropostaCompleta: propostasFiltradas[0] || null,
      resumoDados: propostasFiltradas.map((p) => ({
        id: p.id,
        nomeCliente: p.nomeCliente,
        cpfCliente: p.cpfCliente,
        status: p.status,
        valorTotal: p.valorTotal,
      })),
    });

    res.json(propostasFiltradas);
  } catch (error) {
    console.error('Erro ao buscar propostas de cobrança:', error);
    res.status(500).json({ message: 'Erro ao buscar propostas de cobrança' });
  }
});

// GET /api/cobrancas/kpis - Retorna KPIs de inadimplência
router.get('/kpis', async (req, res) => {
  try {
    // PAM V1.0 REFATORADO: Usar STATUS para KPIs também
    const statusElegiveis = [
      'BOLETOS_EMITIDOS',
      'PAGAMENTO_PENDENTE',
      'PAGAMENTO_PARCIAL',
      'PAGAMENTO_CONFIRMADO',
      'pronto_pagamento',
    ];

    const propostasData = await db
      .select()
      .from(propostas)
      .where(and(sql`${propostas.deletedAt} IS NULL`, inArray(propostas.status, statusElegiveis)));

    let valorTotalEmAtraso = 0;
    let quantidadeContratosEmAtraso = 0;
    let valorTotalCarteira = 0;
    let quantidadeTotalContratos = propostasData.length;

    const hoje = new Date();

    // Calcular valores em atraso
    for (const proposta of propostasData) {
      valorTotalCarteira += Number(proposta.valorTotalFinanciado) || 0;

      const parcelasData = await db
        .select()
        .from(parcelas)
        .where(eq(parcelas.propostaId, proposta.id));

      let temParcelaVencida = false;

      for (const parcela of parcelasData) {
        const dataVencimento = parseISO(parcela.dataVencimento);
        const vencida = isAfter(hoje, dataVencimento) && parcela.status !== 'pago';

        if (vencida) {
          valorTotalEmAtraso += Number(parcela.valorParcela);
          temParcelaVencida = true;
        }
      }

      if (temParcelaVencida) {
        quantidadeContratosEmAtraso++;
      }
    }

    const taxaInadimplencia =
      quantidadeTotalContratos > 0
        ? (quantidadeContratosEmAtraso / quantidadeTotalContratos) * 100
        : 0;

    res.json({
      valorTotalEmAtraso,
      quantidadeContratosEmAtraso,
      valorTotalCarteira,
      quantidadeTotalContratos,
      taxaInadimplencia: taxaInadimplencia.toFixed(2),
    });
  } catch (error) {
    console.error('Erro ao calcular KPIs:', error);
    res.status(500).json({ message: 'Erro ao calcular KPIs' });
  }
});

// GET /api/cobrancas/:propostaId/ficha - Ficha completa do cliente
router.get('/:propostaId/ficha', async (req, res) => {
  try {
    const { propostaId } = req.params;

    // Buscar dados da proposta com status contextual
    const result = await db
      .select({
        // Todos os campos da proposta
        ...propostas,
        // PAM V1.0 - Campo de status contextual
        statusContextual: statusContextuais.status,
      })
      .from(propostas)
      // PAM V1.0 - LEFT JOIN com status_contextuais para contexto de cobranças
      .leftJoin(
        statusContextuais,
        and(
          eq(propostas.id, statusContextuais.propostaId),
          eq(statusContextuais.contexto, 'cobrancas')
        )
      )
      .where(eq(propostas.id, propostaId))
      .limit(1);

    const [proposta] = result;

    if (!proposta) {
      return res.status(404).json({ message: 'Proposta não encontrada' });
    }

    // Referências pessoais
    const referencias: any[] = [];

    // Buscar observações/histórico
    const observacoesRaw = await db
      .select()
      .from(historicoObservacoesCobranca)
      .where(eq(historicoObservacoesCobranca.propostaId, propostaId))
      .orderBy(desc(historicoObservacoesCobranca.createdAt));

    // Mapear observações para o formato esperado pelo frontend
    const observacoes = observacoesRaw.map((obs) => ({
      id: obs.id,
      observacao: obs.mensagem,
      userName: obs.criadoPor,
      tipoContato: obs.tipoAcao,
      statusPromessa: obs.tipoAcao,
      createdAt: obs.createdAt,
      dadosAcao: obs.dadosAcao,
    }));

    // Buscar parcelas e boletos
    const parcelasData = await db
      .select()
      .from(parcelas)
      .where(eq(parcelas.propostaId, propostaId))
      .orderBy(parcelas.numeroParcela);

    const boletosInter = await db
      .select()
      .from(interCollections)
      .where(eq(interCollections.propostaId, propostaId));

    // **PAM V1.0 - FASE 3 REFATORADO:** Removida sincronização em tempo real - usar dados do banco

    // Calcular estatísticas
    const hoje = new Date();
    const parcelasDetalhadas = parcelasData.map((parcela) => {
      const dataVencimento = parseISO(parcela.dataVencimento);
      const vencida = isAfter(hoje, dataVencimento) && parcela.status !== 'pago';
      const diasAtraso = vencida ? differenceInDays(hoje, dataVencimento) : 0;

      const boletoInter = boletosInter.find((b) => b.numeroParcela === parcela.numeroParcela);

      // **PAM V1.0 - FASE 4 CORRIGIDO:** Usar parcela.status como fonte da verdade primária
      // BUG CORRIGIDO: Priorizar status da tabela parcelas sobre inter_collections
      const statusParcela = parcela.status; // Fonte da verdade primária
      const situacaoInter = boletoInter?.situacao || 'EM_PROCESSAMENTO';

      // Mapear status da parcela para exibição consistente
      const statusExibicao = statusParcela === 'pago' ? 'PAGO' : situacaoInter;

      // PAM V1.0 - FASE 1: Correção do mapeamento de campos
      return {
        ...parcela,
        diasAtraso,
        vencida,
        // Campos corrigidos para match com frontend
        pixCopiaECola: boletoInter?.pixCopiaECola,
        linhaDigitavel: boletoInter?.linhaDigitavel,
        codigoBarras: boletoInter?.codigoBarras,
        codigoSolicitacao: boletoInter?.codigoSolicitacao, // NOVO CAMPO
        // Status corrigido: usar parcela.status como fonte da verdade
        interSituacao: statusExibicao,
      };
    });

    const ficha = {
      // Dados do cliente - COM MASCARAMENTO PII
      cliente: {
        nome: proposta.clienteNome,
        cpf: proposta.clienteCpf ? maskCPF(proposta.clienteCpf) : '',
        email: proposta.clienteEmail ? maskEmail(proposta.clienteEmail) : '',
        telefone: proposta.clienteTelefone ? maskTelefone(proposta.clienteTelefone) : '',
        dataNascimento: proposta.clienteDataNascimento,
        endereco: proposta.clienteEndereco,
        cep: proposta.clienteCep,
        ocupacao: proposta.clienteOcupacao,
      },
      // Dados bancários
      dadosBancarios: {
        banco: proposta.dadosPagamentoBanco,
        agencia: proposta.dadosPagamentoAgencia,
        conta: proposta.dadosPagamentoConta,
        tipoConta: proposta.dadosPagamentoTipo,
        pix: proposta.dadosPagamentoPix,
        tipoPix: proposta.dadosPagamentoTipoPix,
        titular: proposta.dadosPagamentoNomeTitular,
      },
      // Referências
      referencias,
      // Dados do contrato
      contrato: {
        numeroContrato: propostaId.slice(0, 8).toUpperCase(),
        dataContrato: proposta.dataAprovacao || proposta.createdAt,
        valorTotal: Number(proposta.valorTotalFinanciado),
        valorFinanciado: Number(proposta.valor),
        prazo: proposta.prazo,
        taxaJuros: Number(proposta.taxaJuros),
        ccbAssinada: proposta.ccbGerado && proposta.assinaturaEletronicaConcluida,
        status: proposta.statusContextual || proposta.status, // PAM V1.0 - Usar status contextual com fallback
      },
      // Parcelas
      parcelas: parcelasDetalhadas,
      // Observações/Histórico
      observacoes,
      // Resumo financeiro
      resumoFinanceiro: {
        totalParcelas: parcelasData.length,
        parcelasPagas: parcelasData.filter((p) => p.status === 'pago').length,
        parcelasVencidas: parcelasDetalhadas.filter((p) => p.vencida).length,
        parcelasPendentes: parcelasData.filter((p) => p.status === 'pendente').length,
        valorTotalPago: parcelasData
          .filter((p) => p.status === 'pago')
          .reduce((acc, p) => acc + Number(p.valorParcela), 0),
        valorTotalVencido: parcelasDetalhadas
          .filter((p) => p.vencida)
          .reduce((acc, p) => acc + Number(p.valorParcela), 0),
        valorTotalPendente: parcelasData
          .filter((p) => p.status !== 'pago')
          .reduce((acc, p) => acc + Number(p.valorParcela), 0),
      },
    };

    res.json(ficha);
  } catch (error) {
    console.error('Erro ao buscar ficha do cliente:', error);
    res.status(500).json({ message: 'Erro ao buscar ficha do cliente' });
  }
});

// PAM V1.0 - FASE 3: Endpoint para marcar parcela como paga manualmente
router.patch(
  '/parcelas/:codigoSolicitacao/marcar-pago',
  jwtAuthMiddleware,
  async (req: any, res) => {
    try {
      const { codigoSolicitacao } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const userName = req.user?.name || 'Sistema';

      // Verificar permissões - apenas ADMINISTRADOR, FINANCEIRO ou COBRADOR
      if (!['ADMINISTRADOR', 'FINANCEIRO', 'COBRADOR'].includes(userRole || '')) {
        return res.status(403).json({
          error: 'Sem permissão para marcar parcelas como pagas',
        });
      }

      // Buscar a parcela
      const [boletoInter] = await db
        .select()
        .from(interCollections)
        .where(eq(interCollections.codigoSolicitacao, codigoSolicitacao))
        .limit(1);

      if (!boletoInter) {
        return res.status(404).json({ error: 'Parcela não encontrada' });
      }

      // Atualizar status para PAGO
      await db
        .update(interCollections)
        .set({
          situacao: 'PAGO',
          updatedAt: new Date(),
        })
        .where(eq(interCollections.codigoSolicitacao, codigoSolicitacao));

      // Atualizar status da parcela na tabela parcelas
      await db
        .update(parcelas)
        .set({
          status: 'pago',
          dataPagamento: new Date().toISOString(),
        })
        .where(
          and(
            eq(parcelas.propostaId, boletoInter.propostaId),
            eq(parcelas.numeroParcela, Number(boletoInter.numeroParcela))
          )
        );

      // Registrar log de auditoria
      await db.insert(propostaLogs).values({
        propostaId: boletoInter.propostaId,
        autorId: userId || '00000000-0000-0000-0000-000000000000',
        statusAnterior: boletoInter.situacao,
        statusNovo: 'PAGO',
        observacao: `Parcela ${boletoInter.numeroParcela} marcada como paga manualmente por ${userName}`,
      });

      console.log(`[COBRANCAS] Parcela ${codigoSolicitacao} marcada como paga por ${userName}`);

      res.json({
        success: true,
        message: 'Parcela marcada como paga com sucesso',
        codigoSolicitacao,
        numeroParcela: boletoInter.numeroParcela,
      });
    } catch (error) {
      console.error('[COBRANCAS] Erro ao marcar parcela como paga:', error);
      res.status(500).json({ error: 'Erro ao processar solicitação' });
    }
  }
);

// POST /api/cobrancas/:propostaId/observacao - Adicionar observação
router.post('/:propostaId/observacao', async (req: any, res) => {
  try {
    const { propostaId } = req.params;
    const { observacao, tipoContato, statusPromessa, dataPromessaPagamento } = req.body;
    const userId = req.user?.id;
    const userName = req.user?.name || 'Sistema';

    if (!observacao) {
      return res.status(400).json({ message: 'Observação é obrigatória' });
    }

    const novaObservacao = await db
      .insert(observacoesCobranca)
      .values({
        propostaId,
        userId: userId || '00000000-0000-0000-0000-000000000000',
        userName,
        observacao,
        tipoContato,
        statusPromessa,
        dataPromessaPagamento: dataPromessaPagamento ? new Date(dataPromessaPagamento) : null,
      })
      .returning();

    res.json(novaObservacao[0]);
  } catch (error) {
    console.error('Erro ao adicionar observação:', error);
    res.status(500).json({ message: 'Erro ao adicionar observação' });
  }
});

// GET /api/cobrancas/inter-sumario - Obter sumário financeiro do Banco Inter
router.get('/inter-sumario', async (req: any, res) => {
  try {
    const userRole = req.user?.role;

    // Verificar se usuário tem permissão - aceitar tanto ADMINISTRADOR quanto COBRANÇA
    if (!userRole || !['ADMINISTRADOR', 'COBRANCA'].includes(userRole)) {
      console.log('[INTER-SUMARIO] Acesso negado - Role:', userRole);
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const { interBankService } = await import('../services/interBankService');

    // Calcular período de 30 dias
    const dataFinal = new Date();
    const dataInicial = new Date();
    dataInicial.setDate(dataInicial.getDate() - 30);

    const sumario = await interBankService.obterSumarioCobrancas({
      dataInicial: dataInicial.toISOString().split('T')[0],
      dataFinal: dataFinal.toISOString().split('T')[0],
      filtrarDataPor: 'VENCIMENTO',
    });

    res.json(sumario);
  } catch (error) {
    console.error('Erro ao obter sumário do Inter:', error);
    res.status(500).json({ message: 'Erro ao obter sumário financeiro' });
  }
});

// POST /api/cobrancas/inter-sync-all - Sincronizar todos os boletos de uma proposta com Banco Inter
router.post('/inter-sync-all', jwtAuthMiddleware, async (req: any, res) => {
  try {
    const { propostaId } = req.body;
    const userRole = req.user?.role;

    console.log(`[INTER-SYNC-ALL] Usuario: ${req.user?.id}, Role: ${userRole}`);

    // Verificar se usuário tem permissão
    if (!userRole || !['ADMINISTRADOR', 'COBRANCA'].includes(userRole)) {
      console.log('[INTER-SYNC-ALL] Acesso negado - Role:', userRole);
      return res.status(403).json({ message: 'Acesso negado' });
    }

    if (!propostaId) {
      return res.status(400).json({ message: 'ID da proposta é obrigatório' });
    }

    console.log(`[INTER-SYNC-ALL] Iniciando sincronização para proposta: ${propostaId}`);

    // Buscar todos os boletos da proposta
    const boletos = await db
      .select()
      .from(interCollections)
      .where(eq(interCollections.propostaId, propostaId));

    console.log(`[INTER-SYNC-ALL] Encontrados ${boletos.length} boletos para sincronizar`);

    const { interBankService } = await import('../services/interBankService');
    let atualizados = 0;
    let erros = 0;

    // Atualizar cada boleto
    for (const boleto of boletos) {
      if (!boleto.codigoSolicitacao) continue;

      try {
        console.log(`[INTER-SYNC-ALL] Sincronizando boleto: ${boleto.codigoSolicitacao}`);

        // Buscar status atualizado no Inter
        const cobranca = await interBankService.recuperarCobranca(boleto.codigoSolicitacao);

        if (cobranca && cobranca.cobranca) {
          const novoStatus = cobranca.cobranca.situacao;

          console.log(
            `[INTER-SYNC-ALL] Boleto ${boleto.codigoSolicitacao}: ${boleto.situacao} → ${novoStatus}`
          );

          // Atualizar inter_collections
          await db
            .update(interCollections)
            .set({
              situacao: novoStatus,
              valorTotalRecebido: cobranca.cobranca.valorTotalRecebido,
              updatedAt: new Date(),
            })
            .where(eq(interCollections.id, boleto.id));

          // Atualizar parcela correspondente se houver
          if (boleto.numeroParcela) {
            let novoStatusParcela: string;

            switch (novoStatus) {
              case 'RECEBIDO': // Pagamento confirmado
              case 'MARCADO_RECEBIDO': // Marcado como recebido manualmente
                novoStatusParcela = 'pago';
                break;
              case 'CANCELADO': // Boleto cancelado
              case 'EXPIRADO': // Boleto expirado
              case 'FALHA_EMISSAO': // Falha na emissão
                novoStatusParcela = 'cancelado';
                break;
              case 'ATRASADO': // Vencido e em atraso
              case 'PROTESTO': // Em protesto
                novoStatusParcela = 'vencido';
                break;
              case 'A_RECEBER': // Aguardando pagamento
              case 'EM_PROCESSAMENTO': // Processando
              default:
                novoStatusParcela = 'pendente';
                break;
            }

            const updateData: any = {
              status: novoStatusParcela,
              updatedAt: new Date(),
            };

            if (novoStatusParcela === 'pago' && cobranca.cobranca.dataSituacao) {
              updateData.dataPagamento = cobranca.cobranca.dataSituacao;
            }

            await db
              .update(parcelas)
              .set(updateData)
              .where(
                and(
                  eq(parcelas.propostaId, boleto.propostaId),
                  eq(parcelas.numeroParcela, boleto.numeroParcela)
                )
              );
          }

          atualizados++;
        }
      } catch (error) {
        console.error(
          `[INTER-SYNC-ALL] Erro ao sincronizar boleto ${boleto.codigoSolicitacao}:`,
          error
        );
        erros++;
      }
    }

    console.log(
      `[INTER-SYNC-ALL] Sincronização concluída: ${atualizados} atualizados, ${erros} erros`
    );

    res.json({
      success: true,
      message: `Sincronização concluída: ${atualizados} boletos atualizados`,
      totalBoletos: boletos.length,
      atualizados,
      erros,
    });
  } catch (error) {
    console.error('[INTER-SYNC-ALL] Erro:', error);
    res.status(500).json({ message: 'Erro ao sincronizar boletos' });
  }
});

// GET /api/cobrancas/inter-status/:codigoSolicitacao - Obter status individual do boleto no Banco Inter
router.get('/inter-status/:codigoSolicitacao', async (req: any, res) => {
  try {
    const { codigoSolicitacao } = req.params;
    const userRole = req.user?.role;

    // Verificar se usuário tem permissão - aceitar tanto ADMINISTRADOR quanto COBRANÇA
    if (!userRole || !['ADMINISTRADOR', 'COBRANCA'].includes(userRole)) {
      console.log('[INTER-STATUS] Acesso negado - Role:', userRole);
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const { interBankService } = await import('../services/interBankService');

    console.log(`[INTER-STATUS] Buscando status para boleto: ${codigoSolicitacao}`);

    // Buscar dados atualizados da cobrança no Inter
    const cobranca = await interBankService.recuperarCobranca(codigoSolicitacao);

    console.log(`[INTER-STATUS] Status recebido do Inter: ${cobranca?.cobranca?.situacao}`);

    // Atualizar status no banco local
    if (cobranca && cobranca.cobranca) {
      const novoStatus = cobranca.cobranca.situacao;

      // Atualizar inter_collections
      await db
        .update(interCollections)
        .set({
          situacao: novoStatus,
          valorTotalRecebido: cobranca.cobranca.valorTotalRecebido,
          updatedAt: new Date(),
        })
        .where(eq(interCollections.codigoSolicitacao, codigoSolicitacao));

      console.log(`[INTER-STATUS] Status atualizado no banco: ${novoStatus}`);

      // Atualizar status da parcela baseado no status do Inter
      const [interBoleto] = await db
        .select()
        .from(interCollections)
        .where(eq(interCollections.codigoSolicitacao, codigoSolicitacao))
        .limit(1);

      if (interBoleto && interBoleto.numeroParcela) {
        let novoStatusParcela: string;

        // Mapear status do Inter para status da parcela
        switch (novoStatus) {
          case 'RECEBIDO':
          case 'MARCADO_RECEBIDO':
            novoStatusParcela = 'pago';
            break;
          case 'CANCELADO':
          case 'EXPIRADO':
          case 'FALHA_EMISSAO':
            novoStatusParcela = 'cancelado';
            break;
          case 'VENCIDO':
          case 'ATRASADO':
          case 'PROTESTO':
            novoStatusParcela = 'vencido';
            break;
          case 'A_RECEBER':
          case 'EM_PROCESSAMENTO':
          default:
            novoStatusParcela = 'pendente';
            break;
        }

        console.log(
          `[INTER-STATUS] Atualizando parcela ${interBoleto.numeroParcela} para status: ${novoStatusParcela}`
        );

        const updateData: any = {
          status: novoStatusParcela,
          updatedAt: new Date(),
        };

        // Se foi pago, adicionar data de pagamento
        if (novoStatusParcela === 'pago' && cobranca.cobranca.dataSituacao) {
          updateData.dataPagamento = cobranca.cobranca.dataSituacao;
        }

        await db
          .update(parcelas)
          .set(updateData)
          .where(
            and(
              eq(parcelas.propostaId, interBoleto.propostaId),
              eq(parcelas.numeroParcela, interBoleto.numeroParcela)
            )
          );
      }
    }

    res.json({
      codigoSolicitacao,
      situacao: cobranca?.cobranca?.situacao || 'DESCONHECIDO',
      valorNominal: cobranca?.cobranca?.valorNominal,
      valorTotalRecebido: cobranca?.cobranca?.valorTotalRecebido,
      dataSituacao: cobranca?.cobranca?.dataSituacao,
      pixCopiaECola: cobranca?.pix?.pixCopiaECola,
      linhaDigitavel: cobranca?.boleto?.linhaDigitavel,
      codigoBarras: cobranca?.boleto?.codigoBarras,
    });
  } catch (error) {
    console.error('Erro ao obter status do boleto:', error);
    res.status(500).json({ message: 'Erro ao obter status do boleto' });
  }
});

// POST /api/cobrancas/sincronizar/:propostaId - Sincronizar status de todos os boletos de uma proposta
router.post('/sincronizar/:propostaId', jwtAuthMiddleware, async (req: any, res) => {
  try {
    const { propostaId } = req.params;
    const userRole = req.user?.role;

    // Verificar permissão
    if (!userRole || !['ADMINISTRADOR', 'COBRANCA'].includes(userRole)) {
      console.log('[SYNC] Acesso negado - Role:', userRole);
      return res.status(403).json({ message: 'Acesso negado' });
    }

    console.log(`[SYNC] Iniciando sincronização para proposta ${propostaId}`);

    // Importar serviço de sincronização
    const { boletoStatusService } = await import('../services/boletoStatusService');

    // Executar sincronização
    const result = await boletoStatusService.sincronizarStatusParcelas(propostaId);

    console.log(`[SYNC] Resultado:`, result);

    res.json({
      success: result.success,
      message: result.message,
      atualizacoes: result.updatedCount,
      erros: result.errors,
    });
  } catch (error) {
    console.error('[SYNC] Erro ao sincronizar:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao sincronizar status dos boletos',
    });
  }
});

// GET /api/cobrancas/exportar/inadimplentes - Exportar lista de inadimplentes para Excel
router.get('/exportar/inadimplentes', async (req, res) => {
  try {
    // PAM V1.0: Buscar apenas propostas inadimplentes com boletos (regra consistente)
    const propostasData = await db
      .select()
      .from(propostas)
      .where(
        and(
          sql`${propostas.deletedAt} IS NULL`,
          // EXISTS: apenas propostas que têm boletos na inter_collections
          sql`EXISTS (
            SELECT 1 
            FROM ${interCollections} 
            WHERE ${interCollections.propostaId} = ${propostas.id}
          )`
        )
      );

    const inadimplentes = [];
    const hoje = new Date();

    for (const proposta of propostasData) {
      const parcelasData = await db
        .select()
        .from(parcelas)
        .where(eq(parcelas.propostaId, proposta.id))
        .orderBy(parcelas.numeroParcela);

      // Encontrar parcelas vencidas
      const parcelasVencidas = parcelasData.filter((parcela) => {
        const dataVencimento = parseISO(parcela.dataVencimento);
        return isAfter(hoje, dataVencimento) && parcela.status !== 'pago';
      });

      if (parcelasVencidas.length > 0) {
        // Pegar a parcela mais antiga vencida
        const parcelaMaisAntiga = parcelasVencidas[0];
        const dataVencimento = parseISO(parcelaMaisAntiga.dataVencimento);
        const diasAtraso = differenceInDays(hoje, dataVencimento);

        inadimplentes.push({
          Nome: proposta.clienteNome || '',
          CPF: proposta.clienteCpf || '',
          Telefone: proposta.clienteTelefone || '',
          Email: proposta.clienteEmail || '',
          'Data Vencimento': format(dataVencimento, 'dd/MM/yyyy'),
          'Dias em Atraso': diasAtraso,
          'Valor Atualizado': new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }).format(Number(parcelaMaisAntiga.valorParcela)),
          'Número Parcela': `${parcelaMaisAntiga.numeroParcela}/${parcelasData.length}`,
          Contrato: proposta.id.slice(0, 8).toUpperCase(),
          'Valor Total Contrato': new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }).format(Number(proposta.valorTotalFinanciado)),
        });
      }
    }

    // Retornar dados em JSON para o frontend processar
    res.json({
      inadimplentes,
      total: inadimplentes.length,
      dataExportacao: format(new Date(), 'dd/MM/yyyy HH:mm'),
    });
  } catch (error) {
    console.error('Erro ao exportar inadimplentes:', error);
    res.status(500).json({ message: 'Erro ao exportar inadimplentes' });
  }
});

// PAM V1.0 Blueprint V2.0 - ENDPOINTS COM WORKFLOW DE APROVAÇÃO

/**
 * POST /api/cobrancas/boletos/:codigoSolicitacao/solicitar-prorrogacao
 * Cria uma solicitação de prorrogação que precisa ser aprovada pelo supervisor
 */
router.post(
  '/boletos/:codigoSolicitacao/solicitar-prorrogacao',
  jwtAuthMiddleware,
  async (req: any, res) => {
    try {
      const { codigoSolicitacao } = req.params;
      const { novaDataVencimento, observacao } = req.body;
      const userRole = req.user?.role;
      const userId = req.user?.id;
      const userName = req.user?.fullName || req.user?.email;

      // Blueprint V2.0: Apenas COBRANCA e ADMINISTRADOR podem solicitar
      if (!userRole || !['ADMINISTRADOR', 'COBRANCA', 'SUPERVISOR_COBRANCA'].includes(userRole)) {
        console.log(`[PRORROGAR] Acesso negado - User: ${userId}, Role: ${userRole}`);
        return res.status(403).json({
          error: 'Acesso negado',
          message: 'Você não tem permissão para solicitar prorrogações',
        });
      }

      // Validação de dados
      if (!codigoSolicitacao || !novaDataVencimento) {
        return res.status(400).json({
          error: 'Dados inválidos',
          message: 'Código da solicitação e nova data de vencimento são obrigatórios',
        });
      }

      // Validar formato da data
      const dataVencimento = new Date(novaDataVencimento);
      if (isNaN(dataVencimento.getTime())) {
        return res.status(400).json({
          error: 'Data inválida',
          message: 'Formato de data inválido',
        });
      }

      // Data não pode ser no passado
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      if (dataVencimento < hoje) {
        return res.status(400).json({
          error: 'Data inválida',
          message: 'A nova data de vencimento não pode ser no passado',
        });
      }

      console.log(
        `[PRORROGAR] Criando solicitação - Código: ${codigoSolicitacao}, Nova data: ${novaDataVencimento}`
      );

      // Buscar boleto no banco local
      const [boletoLocal] = await db
        .select()
        .from(interCollections)
        .where(eq(interCollections.codigoSolicitacao, codigoSolicitacao))
        .limit(1);

      if (!boletoLocal) {
        return res.status(404).json({
          error: 'Boleto não encontrado',
          message: 'Boleto não encontrado no sistema',
        });
      }

      // Verificar se o boleto pode ser prorrogado
      if (['RECEBIDO', 'CANCELADO', 'EXPIRADO'].includes(boletoLocal.situacao || '')) {
        return res.status(400).json({
          error: 'Operação inválida',
          message: `Boleto não pode ser prorrogado. Status atual: ${boletoLocal.situacao}`,
        });
      }

      // Blueprint V2.0: Se for ADMINISTRADOR ou SUPERVISOR_COBRANCA, aprova automaticamente
      const isAutoApproved = ['ADMINISTRADOR', 'SUPERVISOR_COBRANCA'].includes(userRole);

      // Criar solicitação de modificação
      const [novaSolicitacao] = await db
        .insert(solicitacoesModificacao)
        .values({
          propostaId: boletoLocal.propostaId,
          codigoSolicitacao: codigoSolicitacao,
          tipoSolicitacao: 'prorrogacao',
          dadosSolicitacao: {
            novaDataVencimento: novaDataVencimento,
            dataVencimentoOriginal: boletoLocal.dataVencimento,
            valorBoleto: boletoLocal.valorNominal,
            numeroParcela: boletoLocal.numeroParcela,
          },
          status: isAutoApproved ? 'aprovado' : 'pendente',
          solicitadoPorId: userId,
          solicitadoPorNome: userName,
          solicitadoPorRole: userRole,
          observacaoSolicitante: observacao,
          ...(isAutoApproved && {
            aprovadoPorId: userId,
            aprovadoPorNome: userName,
            dataAprovacao: new Date(),
            observacaoAprovador: 'Auto-aprovado por permissão elevada',
          }),
        })
        .returning();

      // Se foi auto-aprovado, executar imediatamente
      if (isAutoApproved) {
        try {
          const { interBankService } = await import('../services/interBankService');

          // Executar no Banco Inter
          await interBankService.editarCobranca(codigoSolicitacao, {
            dataVencimento: novaDataVencimento,
          });

          // Atualizar status para executado
          await db
            .update(solicitacoesModificacao)
            .set({
              status: 'executado',
              dataExecucao: new Date(),
            })
            .where(eq(solicitacoesModificacao.id, novaSolicitacao.id));

          // Atualizar banco local
          await db
            .update(interCollections)
            .set({
              dataVencimento: novaDataVencimento,
              updatedAt: new Date(),
            })
            .where(eq(interCollections.codigoSolicitacao, codigoSolicitacao));

          console.log(`[PRORROGAR] Solicitação auto-aprovada e executada com sucesso`);

          return res.json({
            success: true,
            message: 'Prorrogação executada com sucesso',
            solicitacaoId: novaSolicitacao.id,
            autoApproved: true,
            codigoSolicitacao,
            novaDataVencimento,
          });
        } catch (error: any) {
          // Se falhar, atualizar com erro
          await db
            .update(solicitacoesModificacao)
            .set({
              status: 'aprovado',
              erroExecucao: error.message || 'Erro ao executar no Banco Inter',
            })
            .where(eq(solicitacoesModificacao.id, novaSolicitacao.id));

          console.error(`[PRORROGAR] Erro na execução automática:`, error);
          return res.status(500).json({
            error: 'Erro na execução',
            message: 'Solicitação aprovada mas houve erro ao executar no Banco Inter',
            solicitacaoId: novaSolicitacao.id,
          });
        }
      }

      console.log(`[PRORROGAR] Solicitação criada e aguardando aprovação`);

      res.json({
        success: true,
        message: 'Solicitação de prorrogação criada e aguardando aprovação do supervisor',
        solicitacaoId: novaSolicitacao.id,
        status: 'pendente',
        codigoSolicitacao,
        novaDataVencimento,
      });
    } catch (error) {
      console.error('[PRORROGAR] Erro geral:', error);
      res.status(500).json({
        error: 'Erro interno',
        message: 'Erro ao criar solicitação de prorrogação',
      });
    }
  }
);

/**
 * POST /api/cobrancas/boletos/:codigoSolicitacao/solicitar-desconto
 * Cria uma solicitação de desconto que precisa ser aprovada pelo supervisor
 */
router.post(
  '/boletos/:codigoSolicitacao/solicitar-desconto',
  jwtAuthMiddleware,
  async (req: any, res) => {
    try {
      const { codigoSolicitacao } = req.params;
      const { tipoDesconto, valorDesconto, dataLimiteDesconto, observacao } = req.body;
      const userRole = req.user?.role;
      const userId = req.user?.id;
      const userName = req.user?.fullName || req.user?.email;

      // Blueprint V2.0: Apenas COBRANCA e ADMINISTRADOR podem solicitar
      if (!userRole || !['ADMINISTRADOR', 'COBRANCA', 'SUPERVISOR_COBRANCA'].includes(userRole)) {
        console.log(`[DESCONTO] Acesso negado - User: ${userId}, Role: ${userRole}`);
        return res.status(403).json({
          error: 'Acesso negado',
          message: 'Você não tem permissão para solicitar descontos',
        });
      }

      // Validação de dados
      if (!codigoSolicitacao || !tipoDesconto || !valorDesconto) {
        return res.status(400).json({
          error: 'Dados inválidos',
          message: 'Código da solicitação, tipo e valor do desconto são obrigatórios',
        });
      }

      // Validar tipo de desconto
      if (!['PERCENTUAL', 'FIXO'].includes(tipoDesconto)) {
        return res.status(400).json({
          error: 'Tipo inválido',
          message: 'Tipo de desconto deve ser PERCENTUAL ou FIXO',
        });
      }

      // Validar valor do desconto
      const valorDescontoNum = Number(valorDesconto);
      if (isNaN(valorDescontoNum) || valorDescontoNum <= 0) {
        return res.status(400).json({
          error: 'Valor inválido',
          message: 'Valor do desconto deve ser um número positivo',
        });
      }

      // Se percentual, não pode ser maior que 100%
      if (tipoDesconto === 'PERCENTUAL' && valorDescontoNum > 100) {
        return res.status(400).json({
          error: 'Valor inválido',
          message: 'Desconto percentual não pode ser maior que 100%',
        });
      }

      console.log(
        `[DESCONTO] Criando solicitação - Código: ${codigoSolicitacao}, Tipo: ${tipoDesconto}, Valor: ${valorDesconto}`
      );

      // Buscar boleto no banco local
      const [boletoLocal] = await db
        .select()
        .from(interCollections)
        .where(eq(interCollections.codigoSolicitacao, codigoSolicitacao))
        .limit(1);

      if (!boletoLocal) {
        return res.status(404).json({
          error: 'Boleto não encontrado',
          message: 'Boleto não encontrado no sistema',
        });
      }

      // Verificar se o boleto pode receber desconto
      if (['RECEBIDO', 'CANCELADO', 'EXPIRADO'].includes(boletoLocal.situacao || '')) {
        return res.status(400).json({
          error: 'Operação inválida',
          message: `Boleto não pode receber desconto. Status atual: ${boletoLocal.situacao}`,
        });
      }

      // Blueprint V2.0: Se for ADMINISTRADOR ou SUPERVISOR_COBRANCA, aprova automaticamente
      const isAutoApproved = ['ADMINISTRADOR', 'SUPERVISOR_COBRANCA'].includes(userRole);

      // Criar solicitação de modificação
      const [novaSolicitacao] = await db
        .insert(solicitacoesModificacao)
        .values({
          propostaId: boletoLocal.propostaId,
          codigoSolicitacao: codigoSolicitacao,
          tipoSolicitacao: 'desconto',
          dadosSolicitacao: {
            tipoDesconto: tipoDesconto,
            valorDesconto: valorDesconto,
            dataLimiteDesconto: dataLimiteDesconto,
            valorBoletoOriginal: boletoLocal.valorNominal,
            numeroParcela: boletoLocal.numeroParcela,
          },
          status: isAutoApproved ? 'aprovado' : 'pendente',
          solicitadoPorId: userId,
          solicitadoPorNome: userName,
          solicitadoPorRole: userRole,
          observacaoSolicitante: observacao,
          ...(isAutoApproved && {
            aprovadoPorId: userId,
            aprovadoPorNome: userName,
            dataAprovacao: new Date(),
            observacaoAprovador: 'Auto-aprovado por permissão elevada',
          }),
        })
        .returning();

      // Se foi auto-aprovado, executar imediatamente
      if (isAutoApproved) {
        try {
          const { interBankService } = await import('../services/interBankService');

          // Preparar payload para o Inter
          const descontoPayload: any = {
            codigoDesconto: 'DESCONTO1',
            taxa: tipoDesconto === 'PERCENTUAL' ? valorDescontoNum : 0,
            valor: tipoDesconto === 'FIXO' ? valorDescontoNum : 0,
          };

          if (dataLimiteDesconto) {
            descontoPayload.dataDesconto = dataLimiteDesconto;
          }

          // Executar no Banco Inter
          await interBankService.editarCobranca(codigoSolicitacao, {
            desconto: descontoPayload,
          });

          // Atualizar status para executado
          await db
            .update(solicitacoesModificacao)
            .set({
              status: 'executado',
              dataExecucao: new Date(),
            })
            .where(eq(solicitacoesModificacao.id, novaSolicitacao.id));

          console.log(`[DESCONTO] Solicitação auto-aprovada e executada com sucesso`);

          return res.json({
            success: true,
            message: 'Desconto aplicado com sucesso',
            solicitacaoId: novaSolicitacao.id,
            autoApproved: true,
            codigoSolicitacao,
            tipoDesconto,
            valorDesconto,
          });
        } catch (error: any) {
          // Se falhar, atualizar com erro
          await db
            .update(solicitacoesModificacao)
            .set({
              status: 'aprovado',
              erroExecucao: error.message || 'Erro ao executar no Banco Inter',
            })
            .where(eq(solicitacoesModificacao.id, novaSolicitacao.id));

          console.error(`[DESCONTO] Erro na execução automática:`, error);
          return res.status(500).json({
            error: 'Erro na execução',
            message: 'Solicitação aprovada mas houve erro ao executar no Banco Inter',
            solicitacaoId: novaSolicitacao.id,
          });
        }
      }

      console.log(`[DESCONTO] Solicitação criada e aguardando aprovação`);

      res.json({
        success: true,
        message: 'Solicitação de desconto criada e aguardando aprovação do supervisor',
        solicitacaoId: novaSolicitacao.id,
        status: 'pendente',
        codigoSolicitacao,
        tipoDesconto,
        valorDesconto,
      });
    } catch (error) {
      console.error('[DESCONTO] Erro geral:', error);
      res.status(500).json({
        error: 'Erro interno',
        message: 'Erro ao criar solicitação de desconto',
      });
    }
  }
);

// PAM V1.0 Blueprint V2.0 - ENDPOINTS PARA SUPERVISOR

/**
 * GET /api/cobrancas/solicitacoes
 * Lista todas as solicitações pendentes de aprovação (apenas SUPERVISOR_COBRANCA e ADMINISTRADOR)
 */
router.get('/solicitacoes', jwtAuthMiddleware, async (req: any, res) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const { status = 'pendente' } = req.query;

    // Apenas SUPERVISOR_COBRANCA e ADMINISTRADOR podem ver solicitações
    if (!userRole || !['ADMINISTRADOR', 'SUPERVISOR_COBRANCA'].includes(userRole)) {
      console.log(`[SOLICITAÇÕES] Acesso negado - User: ${userId}, Role: ${userRole}`);
      return res.status(403).json({
        error: 'Acesso negado',
        message: 'Apenas supervisores podem visualizar solicitações',
      });
    }

    const solicitacoes = await db
      .select({
        id: solicitacoesModificacao.id,
        propostaId: solicitacoesModificacao.propostaId,
        codigoSolicitacao: solicitacoesModificacao.codigoSolicitacao,
        tipoSolicitacao: solicitacoesModificacao.tipoSolicitacao,
        dadosSolicitacao: solicitacoesModificacao.dadosSolicitacao,
        status: solicitacoesModificacao.status,
        solicitadoPorNome: solicitacoesModificacao.solicitadoPorNome,
        solicitadoPorRole: solicitacoesModificacao.solicitadoPorRole,
        observacaoSolicitante: solicitacoesModificacao.observacaoSolicitante,
        createdAt: solicitacoesModificacao.createdAt,
      })
      .from(solicitacoesModificacao)
      .where(eq(solicitacoesModificacao.status, status))
      .orderBy(desc(solicitacoesModificacao.createdAt));

    res.json(solicitacoes);
  } catch (error) {
    console.error('[SOLICITAÇÕES] Erro ao buscar:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao buscar solicitações',
    });
  }
});

/**
 * POST /api/cobrancas/solicitacoes/:id/aprovar
 * Aprova uma solicitação e executa a ação no Banco Inter
 */
router.post('/solicitacoes/:id/aprovar', jwtAuthMiddleware, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { observacao } = req.body;
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const userName = req.user?.fullName || req.user?.email;

    // Apenas SUPERVISOR_COBRANCA e ADMINISTRADOR podem aprovar
    if (!userRole || !['ADMINISTRADOR', 'SUPERVISOR_COBRANCA'].includes(userRole)) {
      console.log(`[APROVAR] Acesso negado - User: ${userId}, Role: ${userRole}`);
      return res.status(403).json({
        error: 'Acesso negado',
        message: 'Apenas supervisores podem aprovar solicitações',
      });
    }

    // Buscar solicitação
    const [solicitacao] = await db
      .select()
      .from(solicitacoesModificacao)
      .where(eq(solicitacoesModificacao.id, parseInt(id)))
      .limit(1);

    if (!solicitacao) {
      return res.status(404).json({
        error: 'Não encontrado',
        message: 'Solicitação não encontrada',
      });
    }

    if (solicitacao.status !== 'pendente') {
      return res.status(400).json({
        error: 'Status inválido',
        message: `Solicitação já foi ${solicitacao.status}`,
      });
    }

    // Atualizar para aprovado
    await db
      .update(solicitacoesModificacao)
      .set({
        status: 'aprovado',
        aprovadoPorId: userId,
        aprovadoPorNome: userName,
        observacaoAprovador: observacao,
        dataAprovacao: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(solicitacoesModificacao.id, parseInt(id)));

    // Executar ação no Banco Inter
    try {
      const { interBankService } = await import('../services/interBankService');
      const dados = solicitacao.dadosSolicitacao as any;

      if (solicitacao.tipoSolicitacao === 'prorrogacao') {
        await interBankService.editarCobranca(solicitacao.codigoSolicitacao!, {
          dataVencimento: dados.novaDataVencimento,
        });
      } else if (solicitacao.tipoSolicitacao === 'desconto') {
        const descontoPayload: any = {
          codigoDesconto: 'DESCONTO1',
          taxa: dados.tipoDesconto === 'PERCENTUAL' ? Number(dados.valorDesconto) : 0,
          valor: dados.tipoDesconto === 'FIXO' ? Number(dados.valorDesconto) : 0,
        };
        if (dados.dataLimiteDesconto) {
          descontoPayload.dataDesconto = dados.dataLimiteDesconto;
        }
        await interBankService.editarCobranca(solicitacao.codigoSolicitacao!, {
          desconto: descontoPayload,
        });
      }

      // Marcar como executado
      await db
        .update(solicitacoesModificacao)
        .set({
          status: 'executado',
          dataExecucao: new Date(),
        })
        .where(eq(solicitacoesModificacao.id, parseInt(id)));

      res.json({
        success: true,
        message: `Solicitação aprovada e ${solicitacao.tipoSolicitacao} executada com sucesso`,
        solicitacaoId: id,
      });
    } catch (error: any) {
      // Se falhar ao executar, manter como aprovado mas com erro
      await db
        .update(solicitacoesModificacao)
        .set({
          erroExecucao: error.message || 'Erro ao executar no Banco Inter',
        })
        .where(eq(solicitacoesModificacao.id, parseInt(id)));

      console.error(`[APROVAR] Erro ao executar:`, error);
      res.status(500).json({
        error: 'Erro na execução',
        message: 'Solicitação aprovada mas houve erro ao executar no Banco Inter',
        detalhes: error.message,
      });
    }
  } catch (error) {
    console.error('[APROVAR] Erro geral:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao aprovar solicitação',
    });
  }
});

/**
 * POST /api/cobrancas/solicitacoes/:id/rejeitar
 * Rejeita uma solicitação
 */
router.post('/solicitacoes/:id/rejeitar', jwtAuthMiddleware, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { motivo, observacao } = req.body;
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const userName = req.user?.fullName || req.user?.email;

    // Apenas SUPERVISOR_COBRANCA e ADMINISTRADOR podem rejeitar
    if (!userRole || !['ADMINISTRADOR', 'SUPERVISOR_COBRANCA'].includes(userRole)) {
      console.log(`[REJEITAR] Acesso negado - User: ${userId}, Role: ${userRole}`);
      return res.status(403).json({
        error: 'Acesso negado',
        message: 'Apenas supervisores podem rejeitar solicitações',
      });
    }

    if (!motivo) {
      return res.status(400).json({
        error: 'Dados inválidos',
        message: 'Motivo da rejeição é obrigatório',
      });
    }

    // Buscar solicitação
    const [solicitacao] = await db
      .select()
      .from(solicitacoesModificacao)
      .where(eq(solicitacoesModificacao.id, parseInt(id)))
      .limit(1);

    if (!solicitacao) {
      return res.status(404).json({
        error: 'Não encontrado',
        message: 'Solicitação não encontrada',
      });
    }

    if (solicitacao.status !== 'pendente') {
      return res.status(400).json({
        error: 'Status inválido',
        message: `Solicitação já foi ${solicitacao.status}`,
      });
    }

    // Atualizar para rejeitado
    await db
      .update(solicitacoesModificacao)
      .set({
        status: 'rejeitado',
        aprovadoPorId: userId,
        aprovadoPorNome: userName,
        motivoRejeicao: motivo,
        observacaoAprovador: observacao,
        dataAprovacao: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(solicitacoesModificacao.id, parseInt(id)));

    res.json({
      success: true,
      message: 'Solicitação rejeitada',
      solicitacaoId: id,
      motivo,
    });
  } catch (error) {
    console.error('[REJEITAR] Erro:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao rejeitar solicitação',
    });
  }
});

export default router;
