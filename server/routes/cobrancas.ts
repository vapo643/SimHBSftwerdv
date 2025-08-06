import { Router } from "express";
import { db } from "../lib/supabase";
import { propostas, parcelas, observacoesCobranca, referenciaPessoal, interCollections, profiles } from "@shared/schema";
import { eq, and, sql, desc, gte, lte, inArray, or } from "drizzle-orm";
import { format, parseISO, differenceInDays, isAfter } from "date-fns";

const router = Router();

// GET /api/cobrancas - Lista todas as propostas com informações de cobrança
router.get("/", async (req: any, res) => {
  try {
    const { status, atraso } = req.query;
    const userRole = req.user?.role || '';
    
    // Buscar todas as propostas com parcelas (não apenas inadimplentes)
    const propostasData = await db
      .select()
      .from(propostas)
      .where(
        and(
          sql`${propostas.deletedAt} IS NULL`,
          inArray(propostas.status, ['aprovado', 'pronto_pagamento', 'pago'])
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

        // Determinar status geral
        let statusCobranca = 'em_dia';
        if (parcelasVencidas > 0) {
          statusCobranca = 'inadimplente';
        } else if (parcelasPagas === parcelasData.length) {
          statusCobranca = 'quitado';
        }

        return {
          id: proposta.id,
          numeroContrato: proposta.id.slice(0, 8).toUpperCase(),
          nomeCliente: proposta.clienteNome || 'Sem nome',
          cpfCliente: proposta.clienteCpf || '',
          telefoneCliente: proposta.clienteTelefone || '',
          emailCliente: proposta.clienteEmail || '',
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

    // Aplicar filtros
    let propostasFiltradas = propostasComCobranca;
    
    // FILTRO AUTOMÁTICO PARA USUÁRIOS DE COBRANÇA
    // Usuários com role "COBRANÇA" veem apenas: inadimplentes, em atraso ou que vencem em 3 dias
    if (userRole === 'COBRANÇA') {
      const hoje = new Date();
      const em3Dias = new Date();
      em3Dias.setDate(hoje.getDate() + 3);
      
      propostasFiltradas = propostasComCobranca.filter(p => {
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

    // Buscar referências pessoais
    const referencias = await db
      .select()
      .from(referenciaPessoal)
      .where(eq(referenciaPessoal.propostaId, propostaId));

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