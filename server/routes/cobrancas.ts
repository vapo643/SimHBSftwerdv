import { Router } from 'express';
import { jwtAuthMiddleware, type AuthenticatedRequest } from '../lib/jwt-auth-middleware.js';
import { db } from '../lib/supabase.js';
import { propostas, interCollections, propostaLogs } from '@shared/schema';
import { eq, and, or, gte, isNotNull, sql } from 'drizzle-orm';
import { interBankService } from '../services/interBankService.js';
import { z } from 'zod';

const router = Router();

// Buscar todas as propostas com cobranças ativas
router.get('/', jwtAuthMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[COBRANÇAS DEBUG] ========== INÍCIO DA BUSCA ==========');
    
    // CRITICAL: APENAS propostas com boletos Inter devem aparecer
    // Propostas ainda em formalização NÃO devem aparecer aqui
    const propostasComCobrancas = await db
      .select({
        proposta: propostas,
        cobrancas: sql<any>`
          json_agg(
            json_build_object(
              'id', ${interCollections.id},
              'codigoSolicitacao', ${interCollections.codigoSolicitacao},
              'nossoNumero', ${interCollections.nossoNumero},
              'seuNumero', ${interCollections.seuNumero},
              'valorNominal', ${interCollections.valorNominal},
              'dataVencimento', ${interCollections.dataVencimento},
              'situacao', ${interCollections.situacao},
              'dataSituacao', ${interCollections.dataSituacao},
              'linhaDigitavel', ${interCollections.linhaDigitavel},
              'codigoBarras', ${interCollections.codigoBarras},
              'pixQrCode', ${interCollections.pixTxid},
              'pixCopiaECola', ${interCollections.pixCopiaECola}
            ) ORDER BY ${interCollections.dataVencimento}
          )
        `.as('cobrancas')
      })
      .from(propostas)
      .innerJoin(  // CRITICAL: INNER JOIN garante apenas propostas COM boletos
        interCollections,
        eq(propostas.id, interCollections.propostaId)
      )
      .where(
        and(
          or(
            eq(propostas.status, 'pronto_pagamento'),
            eq(propostas.status, 'pago'),
            eq(propostas.status, 'aprovado')
          ),
          isNotNull(propostas.ccbGerado),
          isNotNull(propostas.assinaturaEletronicaConcluida),
          isNotNull(interCollections.codigoSolicitacao)  // CRITICAL: Garantir que há boleto Inter
        )
      )
      .groupBy(propostas.id);

    console.log(`[COBRANÇAS DEBUG] Propostas encontradas com boletos Inter: ${propostasComCobrancas.length}`);
    
    // Filtrar ainda mais para garantir que há boletos válidos
    const propostasComBoletosValidos = propostasComCobrancas.filter(item => {
      const cobrancas = item.cobrancas || [];
      const temBoletosValidos = Array.isArray(cobrancas) && cobrancas.length > 0 && 
        cobrancas.some((c: any) => c.codigoSolicitacao && c.linhaDigitavel);
      
      console.log(`[COBRANÇAS DEBUG] Proposta ${item.proposta.id}: ${cobrancas.length} boletos, válidos: ${temBoletosValidos}`);
      
      return temBoletosValidos;
    });

    console.log(`[COBRANÇAS DEBUG] Propostas FINAIS após filtro de boletos válidos: ${propostasComBoletosValidos.length}`);
    console.log('[COBRANÇAS DEBUG] ========================================');

    // Formatar dados para o frontend
    const cobrancasFormatadas = propostasComBoletosValidos.map(item => {
      const proposta = item.proposta;
      const cobrancas = item.cobrancas || [];
      
      // Calcular estatísticas
      const totalParcelas = cobrancas.length;
      const parcelasPagas = cobrancas.filter((c: any) => 
        c.situacao === 'PAGO' || c.situacao === 'RECEBIDO'
      ).length;
      const parcelasPendentes = cobrancas.filter((c: any) => 
        c.situacao === 'A_VENCER' || c.situacao === 'PENDENTE_REGISTRO'
      ).length;
      const parcelasVencidas = cobrancas.filter((c: any) => 
        c.situacao === 'VENCIDO' || c.situacao === 'ATRASADO'
      ).length;

      // Calcular valores
      const valorTotal = proposta.condicoesData?.valorTotalFinanciado || 0;
      const valorParcela = totalParcelas > 0 ? valorTotal / totalParcelas : 0;
      const valorTotalPago = parcelasPagas * valorParcela;
      const valorTotalPendente = (parcelasPendentes + parcelasVencidas) * valorParcela;

      // Calcular dias de atraso
      let diasAtraso = 0;
      const parcelaVencidaMaisAntiga = cobrancas
        .filter((c: any) => c.situacao === 'VENCIDO' || c.situacao === 'ATRASADO')
        .sort((a: any, b: any) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime())[0];
      
      if (parcelaVencidaMaisAntiga) {
        const dataVencimento = new Date(parcelaVencidaMaisAntiga.dataVencimento);
        const hoje = new Date();
        diasAtraso = Math.floor((hoje.getTime() - dataVencimento.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Determinar status geral
      let status: 'em_dia' | 'inadimplente' | 'quitado' = 'em_dia';
      if (parcelasPagas === totalParcelas && totalParcelas > 0) {
        status = 'quitado';
      } else if (parcelasVencidas > 0) {
        status = 'inadimplente';
      }

      return {
        id: proposta.id,
        numeroContrato: proposta.id.slice(0, 8).toUpperCase(),
        nomeCliente: proposta.clienteData?.nome || 'Sem nome',
        cpfCliente: proposta.clienteData?.cpf || 'Sem CPF',
        telefoneCliente: proposta.clienteData?.telefone || 'Sem telefone',
        emailCliente: proposta.clienteData?.email || 'Sem email',
        valorTotal,
        valorFinanciado: proposta.condicoesData?.valor || 0,
        quantidadeParcelas: proposta.condicoesData?.prazo || totalParcelas,
        parcelasPagas,
        parcelasPendentes,
        parcelasVencidas,
        valorTotalPago,
        valorTotalPendente,
        diasAtraso,
        status,
        dataContrato: proposta.createdAt,
        ccbAssinada: !!proposta.assinaturaEletronicaConcluida,
        parcelas: cobrancas.map((cobranca: any, index: number) => ({
          id: cobranca.id,
          numero: index + 1,
          valorParcela,
          dataVencimento: cobranca.dataVencimento,
          dataPagamento: cobranca.dataSituacao,
          codigoBoleto: cobranca.codigoSolicitacao,
          linhaDigitavel: cobranca.linhaDigitavel,
          codigoBarras: cobranca.codigoBarras,
          status: mapearStatusCobranca(cobranca.situacao),
          diasAtraso: calcularDiasAtraso(cobranca.dataVencimento, cobranca.situacao),
          // Dados do Inter Bank
          interCodigoSolicitacao: cobranca.codigoSolicitacao,
          interQrCode: cobranca.pixQrCode,
          interPixCopiaECola: cobranca.pixCopiaECola,
          interSituacao: cobranca.situacao,
          interNossoNumero: cobranca.nossoNumero
        })),
        documentos: {
          ccb: proposta.ccbDocumentoUrl || proposta.caminhoCcbAssinado
        }
      };
    });

    res.json(cobrancasFormatadas);
  } catch (error) {
    console.error('[COBRANÇAS] Erro ao buscar cobranças:', error);
    res.status(500).json({ error: 'Erro ao buscar cobranças' });
  }
});

// Atualizar status de uma cobrança específica
router.post('/:propostaId/atualizar-status', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { propostaId } = req.params;
    
    // Buscar todas as cobranças da proposta
    const cobrancas = await db
      .select()
      .from(interCollections)
      .where(eq(interCollections.propostaId, propostaId));

    // Atualizar status de cada cobrança no Banco Inter
    for (const cobranca of cobrancas) {
      try {
        const detalhes = await interBankService.recuperarCobranca(cobranca.codigoSolicitacao);
        
        // Atualizar no banco de dados
        await db
          .update(interCollections)
          .set({
            situacao: detalhes.situacao,
            dataSituacao: detalhes.dataSituacao,
            nossoNumero: detalhes.nossoNumero,
            linhaDigitavel: detalhes.linhaDigitavel || detalhes.boleto?.linhaDigitavel,
            codigoBarras: detalhes.codigoBarras || detalhes.boleto?.codigoBarras,
            pixCopiaECola: detalhes.pixCopiaECola || detalhes.pix?.pixCopiaECola,
            updatedAt: new Date()
          })
          .where(eq(interCollections.id, cobranca.id));
          
      } catch (error) {
        console.error(`[COBRANÇAS] Erro ao atualizar cobrança ${cobranca.id}:`, error);
      }
    }

    // Registrar log
    await db.insert(propostaLogs).values({
      propostaId,
      autorId: req.user!.id,
      statusAnterior: null,
      statusNovo: 'status_cobrancas_atualizado',
      observacao: `Status das cobranças atualizado via dashboard - Total: ${cobrancas.length} cobranças`
    });

    res.json({ success: true, message: 'Status atualizado com sucesso' });
  } catch (error) {
    console.error('[COBRANÇAS] Erro ao atualizar status:', error);
    res.status(500).json({ error: 'Erro ao atualizar status' });
  }
});

// Enviar mensagem de cobrança
const contatoSchema = z.object({
  propostaId: z.string().uuid(),
  tipo: z.enum(['whatsapp', 'sms', 'email']),
  destinatario: z.string(),
  mensagem: z.string()
});

router.post('/contato', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = contatoSchema.parse(req.body);
    
    // Aqui você implementaria a integração com serviços de envio
    // Por enquanto, apenas registramos o log
    await db.insert(propostaLogs).values({
      propostaId: validatedData.propostaId,
      autorId: req.user!.id,
      statusAnterior: null,
      statusNovo: 'cobranca_enviada',
      observacao: `Cobrança enviada via ${validatedData.tipo} para ${validatedData.destinatario}`
    });

    res.json({ success: true, message: 'Mensagem enviada com sucesso' });
  } catch (error) {
    console.error('[COBRANÇAS] Erro ao enviar contato:', error);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
});

// Funções auxiliares
function mapearStatusCobranca(situacao: string): 'pago' | 'pendente' | 'vencido' {
  switch (situacao) {
    case 'PAGO':
    case 'RECEBIDO':
      return 'pago';
    case 'VENCIDO':
    case 'ATRASADO':
      return 'vencido';
    default:
      return 'pendente';
  }
}

function calcularDiasAtraso(dataVencimento: string, situacao: string): number {
  if (situacao !== 'VENCIDO' && situacao !== 'ATRASADO') {
    return 0;
  }
  
  const vencimento = new Date(dataVencimento);
  const hoje = new Date();
  const diferenca = hoje.getTime() - vencimento.getTime();
  return Math.max(0, Math.floor(diferenca / (1000 * 60 * 60 * 24)));
}

export default router;