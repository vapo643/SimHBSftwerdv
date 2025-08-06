import { Router } from "express";
import { db } from "../lib/supabase";
import { propostas, parcelas, observacoesCobranca, interCollections, profiles } from "@shared/schema";
import { eq, and, sql, desc, gte, lte, inArray, or } from "drizzle-orm";
import { format, parseISO, differenceInDays, isAfter } from "date-fns";
import { jwtAuthMiddleware } from "../lib/jwt-auth-middleware";

const router = Router();

// GET /api/cobrancas - Lista todas as propostas com informações de cobrança
router.get("/", async (req: any, res) => {
  try {
    const { status, atraso } = req.query;
    const userRole = req.user?.role || '';
    
    // Buscar apenas propostas com CCB assinado e assinatura eletrônica concluída
    const propostasData = await db
      .select()
      .from(propostas)
      .where(
        and(
          sql`${propostas.deletedAt} IS NULL`,
          inArray(propostas.status, ['aprovado', 'pronto_pagamento', 'pago']),
          eq(propostas.ccbGerado, true),
          eq(propostas.assinaturaEletronicaConcluida, true)
        )
      )
      .orderBy(desc(propostas.createdAt));

    // Para cada proposta, buscar suas parcelas e calcular status de cobrança
    const propostasComCobranca = await Promise.all(
      propostasData.map(async (proposta) => {
        // Buscar parcelas da proposta
        const parcelasData = await db
          .select()
          .from(parcelas)
          .where(eq(parcelas.propostaId, proposta.id))
          .orderBy(parcelas.numeroParcela);

        // Buscar boletos do Inter Bank
        const boletosInter = await db
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

        const parcelasCompletas = parcelasData.map(parcela => {
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
          const boletoInter = boletosInter.find(b => b.numeroParcela === parcela.numeroParcela);
          
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

        return {
          id: proposta.id,
          numeroContrato: proposta.id.slice(0, 8).toUpperCase(),
          nomeCliente: proposta.clienteNome || 'Sem nome',
          cpfCliente: proposta.clienteCpf || '',
          telefoneCliente: proposta.clienteTelefone || '',
          emailCliente: proposta.clienteEmail || '',
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
          // Dados bancários do cliente
          dadosBancarios: {
            banco: proposta.dadosPagamentoBanco,
            agencia: proposta.dadosPagamentoAgencia,
            conta: proposta.dadosPagamentoConta,
            tipoConta: proposta.dadosPagamentoTipo,
            pix: proposta.dadosPagamentoPix,
            tipoPix: proposta.dadosPagamentoTipoPix,
          }
        };
      })
    );

    // Filtrar apenas propostas que têm boletos gerados (no Inter ou nas parcelas)
    const propostasComBoletos = propostasComCobranca.filter(p => {
      // Verifica se tem parcelas com boletos OU se tem boletos no Inter
      return p.parcelas.length > 0 && (
        p.parcelas.some(parcela => 
          parcela.interPixCopiaECola || 
          parcela.interLinhaDigitavel || 
          parcela.interCodigoBarras ||
          parcela.codigoBoleto
        )
      );
    });

    // Aplicar filtros
    let propostasFiltradas = propostasComBoletos;
    
    // FILTRO AUTOMÁTICO PARA USUÁRIOS DE COBRANÇA
    // Usuários com role "COBRANÇA" veem apenas: inadimplentes, em atraso ou que vencem em 3 dias
    if (userRole === 'COBRANÇA') {
      const hoje = new Date();
      const em3Dias = new Date();
      em3Dias.setDate(hoje.getDate() + 3);
      
      propostasFiltradas = propostasComBoletos.filter(p => {
        // Inadimplentes ou em atraso
        if (p.status === 'inadimplente' || p.diasAtraso > 0) {
          return true;
        }
        
        // Parcelas que vencem nos próximos 3 dias
        const temParcelaVencendoEm3Dias = p.parcelas.some(parcela => {
          if (parcela.status === 'pago') return false;
          const dataVencimento = parseISO(parcela.dataVencimento);
          return dataVencimento <= em3Dias && dataVencimento >= hoje;
        });
        
        return temParcelaVencendoEm3Dias;
      });
    }
    
    // Aplicar filtros manuais da interface (se não for usuário de cobrança ou se for filtro adicional)
    if (status === 'inadimplente') {
      propostasFiltradas = propostasFiltradas.filter(p => p.status === 'inadimplente');
    } else if (status === 'em_dia') {
      propostasFiltradas = propostasFiltradas.filter(p => p.status === 'em_dia');
    } else if (status === 'quitado') {
      propostasFiltradas = propostasFiltradas.filter(p => p.status === 'quitado');
    }

    if (atraso === '1-15') {
      propostasFiltradas = propostasFiltradas.filter(p => p.diasAtraso >= 1 && p.diasAtraso <= 15);
    } else if (atraso === '30+') {
      propostasFiltradas = propostasFiltradas.filter(p => p.diasAtraso > 30);
    }

    res.json(propostasFiltradas);
  } catch (error) {
    console.error("Erro ao buscar propostas de cobrança:", error);
    res.status(500).json({ message: "Erro ao buscar propostas de cobrança" });
  }
});

// GET /api/cobrancas/kpis - Retorna KPIs de inadimplência
router.get("/kpis", async (req, res) => {
  try {
    // Buscar todas as propostas ativas
    const propostasData = await db
      .select()
      .from(propostas)
      .where(
        and(
          sql`${propostas.deletedAt} IS NULL`,
          inArray(propostas.status, ['aprovado', 'pronto_pagamento', 'pago'])
        )
      );

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

    const taxaInadimplencia = quantidadeTotalContratos > 0 
      ? (quantidadeContratosEmAtraso / quantidadeTotalContratos * 100)
      : 0;

    res.json({
      valorTotalEmAtraso,
      quantidadeContratosEmAtraso,
      valorTotalCarteira,
      quantidadeTotalContratos,
      taxaInadimplencia: taxaInadimplencia.toFixed(2)
    });
  } catch (error) {
    console.error("Erro ao calcular KPIs:", error);
    res.status(500).json({ message: "Erro ao calcular KPIs" });
  }
});

// GET /api/cobrancas/:propostaId/ficha - Ficha completa do cliente
router.get("/:propostaId/ficha", async (req, res) => {
  try {
    const { propostaId } = req.params;
    
    // Buscar dados da proposta
    const [proposta] = await db
      .select()
      .from(propostas)
      .where(eq(propostas.id, propostaId))
      .limit(1);

    if (!proposta) {
      return res.status(404).json({ message: "Proposta não encontrada" });
    }

    // Referências pessoais
    const referencias: any[] = [];

    // Buscar observações/histórico
    const observacoes = await db
      .select()
      .from(observacoesCobranca)
      .where(eq(observacoesCobranca.propostaId, propostaId))
      .orderBy(desc(observacoesCobranca.createdAt));

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

    // Calcular estatísticas
    const hoje = new Date();
    const parcelasDetalhadas = parcelasData.map(parcela => {
      const dataVencimento = parseISO(parcela.dataVencimento);
      const vencida = isAfter(hoje, dataVencimento) && parcela.status !== 'pago';
      const diasAtraso = vencida ? differenceInDays(hoje, dataVencimento) : 0;
      
      const boletoInter = boletosInter.find(b => b.numeroParcela === parcela.numeroParcela);
      
      return {
        ...parcela,
        diasAtraso,
        vencida,
        interPixCopiaECola: boletoInter?.pixCopiaECola,
        interLinhaDigitavel: boletoInter?.linhaDigitavel,
        interCodigoBarras: boletoInter?.codigoBarras,
        interSituacao: boletoInter?.situacao,
      };
    });

    const ficha = {
      // Dados do cliente
      cliente: {
        nome: proposta.clienteNome,
        cpf: proposta.clienteCpf,
        email: proposta.clienteEmail,
        telefone: proposta.clienteTelefone,
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
        status: proposta.status,
      },
      // Parcelas
      parcelas: parcelasDetalhadas,
      // Observações/Histórico
      observacoes,
      // Resumo financeiro
      resumoFinanceiro: {
        totalParcelas: parcelasData.length,
        parcelasPagas: parcelasData.filter(p => p.status === 'pago').length,
        parcelasVencidas: parcelasDetalhadas.filter(p => p.vencida).length,
        parcelasPendentes: parcelasData.filter(p => p.status === 'pendente').length,
        valorTotalPago: parcelasData
          .filter(p => p.status === 'pago')
          .reduce((acc, p) => acc + Number(p.valorParcela), 0),
        valorTotalVencido: parcelasDetalhadas
          .filter(p => p.vencida)
          .reduce((acc, p) => acc + Number(p.valorParcela), 0),
        valorTotalPendente: parcelasData
          .filter(p => p.status !== 'pago')
          .reduce((acc, p) => acc + Number(p.valorParcela), 0),
      }
    };

    res.json(ficha);
  } catch (error) {
    console.error("Erro ao buscar ficha do cliente:", error);
    res.status(500).json({ message: "Erro ao buscar ficha do cliente" });
  }
});

// POST /api/cobrancas/:propostaId/observacao - Adicionar observação
router.post("/:propostaId/observacao", async (req: any, res) => {
  try {
    const { propostaId } = req.params;
    const { observacao, tipoContato, statusPromessa, dataPromessaPagamento } = req.body;
    const userId = req.user?.id;
    const userName = req.user?.name || 'Sistema';

    if (!observacao) {
      return res.status(400).json({ message: "Observação é obrigatória" });
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
    console.error("Erro ao adicionar observação:", error);
    res.status(500).json({ message: "Erro ao adicionar observação" });
  }
});

// GET /api/cobrancas/inter-sumario - Obter sumário financeiro do Banco Inter
router.get("/inter-sumario", async (req: any, res) => {
  try {
    const userRole = req.user?.role;
    
    // Verificar se usuário tem permissão - aceitar tanto ADMINISTRADOR quanto COBRANÇA
    if (!userRole || !['ADMINISTRADOR', 'COBRANCA'].includes(userRole)) {
      console.log('[INTER-SUMARIO] Acesso negado - Role:', userRole);
      return res.status(403).json({ message: "Acesso negado" });
    }

    const { interBankService } = await import('../services/interBankService');
    
    // Calcular período de 30 dias
    const dataFinal = new Date();
    const dataInicial = new Date();
    dataInicial.setDate(dataInicial.getDate() - 30);
    
    const sumario = await interBankService.obterSumarioCobrancas({
      dataInicial: dataInicial.toISOString().split('T')[0],
      dataFinal: dataFinal.toISOString().split('T')[0],
      filtrarDataPor: 'VENCIMENTO'
    });

    res.json(sumario);
  } catch (error) {
    console.error("Erro ao obter sumário do Inter:", error);
    res.status(500).json({ message: "Erro ao obter sumário financeiro" });
  }
});

// POST /api/cobrancas/inter-sync-all - Sincronizar todos os boletos de uma proposta com Banco Inter
router.post("/inter-sync-all", jwtAuthMiddleware, async (req: any, res) => {
  try {
    const { propostaId } = req.body;
    const userRole = req.user?.role;
    
    console.log(`[INTER-SYNC-ALL] Usuario: ${req.user?.id}, Role: ${userRole}`);
    
    // Verificar se usuário tem permissão
    if (!userRole || !['ADMINISTRADOR', 'COBRANCA'].includes(userRole)) {
      console.log('[INTER-SYNC-ALL] Acesso negado - Role:', userRole);
      return res.status(403).json({ message: "Acesso negado" });
    }

    if (!propostaId) {
      return res.status(400).json({ message: "ID da proposta é obrigatório" });
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
          
          console.log(`[INTER-SYNC-ALL] Boleto ${boleto.codigoSolicitacao}: ${boleto.situacao} → ${novoStatus}`);
          
          // Atualizar inter_collections
          await db
            .update(interCollections)
            .set({
              situacao: novoStatus,
              valorTotalRecebido: cobranca.cobranca.valorTotalRecebido,
              updatedAt: new Date()
            })
            .where(eq(interCollections.id, boleto.id));
          
          // Atualizar parcela correspondente se houver
          if (boleto.numeroParcela) {
            let novoStatusParcela: string;
            
            switch (novoStatus) {
              case 'RECEBIDO':           // Pagamento confirmado
              case 'MARCADO_RECEBIDO':   // Marcado como recebido manualmente
                novoStatusParcela = 'pago';
                break;
              case 'CANCELADO':          // Boleto cancelado
              case 'EXPIRADO':           // Boleto expirado
              case 'FALHA_EMISSAO':      // Falha na emissão
                novoStatusParcela = 'cancelado';
                break;
              case 'ATRASADO':           // Vencido e em atraso
              case 'PROTESTO':           // Em protesto
                novoStatusParcela = 'vencido';
                break;
              case 'A_RECEBER':          // Aguardando pagamento
              case 'EM_PROCESSAMENTO':   // Processando
              default:
                novoStatusParcela = 'pendente';
                break;
            }
            
            const updateData: any = {
              status: novoStatusParcela,
              updatedAt: new Date()
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
        console.error(`[INTER-SYNC-ALL] Erro ao sincronizar boleto ${boleto.codigoSolicitacao}:`, error);
        erros++;
      }
    }

    console.log(`[INTER-SYNC-ALL] Sincronização concluída: ${atualizados} atualizados, ${erros} erros`);

    res.json({
      success: true,
      message: `Sincronização concluída: ${atualizados} boletos atualizados`,
      totalBoletos: boletos.length,
      atualizados,
      erros
    });
  } catch (error) {
    console.error('[INTER-SYNC-ALL] Erro:', error);
    res.status(500).json({ message: "Erro ao sincronizar boletos" });
  }
});

// GET /api/cobrancas/inter-status/:codigoSolicitacao - Obter status individual do boleto no Banco Inter
router.get("/inter-status/:codigoSolicitacao", async (req: any, res) => {
  try {
    const { codigoSolicitacao } = req.params;
    const userRole = req.user?.role;
    
    // Verificar se usuário tem permissão - aceitar tanto ADMINISTRADOR quanto COBRANÇA
    if (!userRole || !['ADMINISTRADOR', 'COBRANCA'].includes(userRole)) {
      console.log('[INTER-STATUS] Acesso negado - Role:', userRole);
      return res.status(403).json({ message: "Acesso negado" });
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
          updatedAt: new Date()
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
        
        console.log(`[INTER-STATUS] Atualizando parcela ${interBoleto.numeroParcela} para status: ${novoStatusParcela}`);
        
        const updateData: any = {
          status: novoStatusParcela,
          updatedAt: new Date()
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
      codigoBarras: cobranca?.boleto?.codigoBarras
    });
  } catch (error) {
    console.error("Erro ao obter status do boleto:", error);
    res.status(500).json({ message: "Erro ao obter status do boleto" });
  }
});

// GET /api/cobrancas/exportar/inadimplentes - Exportar lista de inadimplentes para Excel
router.get("/exportar/inadimplentes", async (req, res) => {
  try {
    // Buscar propostas inadimplentes
    const propostasData = await db
      .select()
      .from(propostas)
      .where(
        and(
          sql`${propostas.deletedAt} IS NULL`,
          inArray(propostas.status, ['aprovado', 'pronto_pagamento', 'pago'])
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
      const parcelasVencidas = parcelasData.filter(parcela => {
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
            currency: 'BRL' 
          }).format(Number(parcelaMaisAntiga.valorParcela)),
          'Número Parcela': `${parcelaMaisAntiga.numeroParcela}/${parcelasData.length}`,
          'Contrato': proposta.id.slice(0, 8).toUpperCase(),
          'Valor Total Contrato': new Intl.NumberFormat('pt-BR', { 
            style: 'currency', 
            currency: 'BRL' 
          }).format(Number(proposta.valorTotalFinanciado)),
        });
      }
    }

    // Retornar dados em JSON para o frontend processar
    res.json({
      inadimplentes,
      total: inadimplentes.length,
      dataExportacao: format(new Date(), 'dd/MM/yyyy HH:mm')
    });
  } catch (error) {
    console.error("Erro ao exportar inadimplentes:", error);
    res.status(500).json({ message: "Erro ao exportar inadimplentes" });
  }
});

export default router;