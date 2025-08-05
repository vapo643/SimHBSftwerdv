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

    // Buscar propostas aprovadas ou pagas com cobranças
    const propostasComCobrancas = await db
      .select({
        proposta: propostas,
        cobrancas: sql<any>`
          COALESCE(
            json_agg(
              json_build_object(
                'id', ${inter_collections.id},
                'codigoSolicitacao', ${inter_collections.codigoSolicitacao},
                'nossoNumero', ${inter_collections.nossoNumero},
                'seuNumero', ${inter_collections.seuNumero},
                'valorNominal', ${inter_collections.valorNominal},
                'dataVencimento', ${inter_collections.dataVencimento},
                'situacao', ${inter_collections.situacao},
                'dataSituacao', ${inter_collections.dataSituacao},
                'linhaDigitavel', ${inter_collections.linhaDigitavel},
                'codigoBarras', ${inter_collections.codigoBarras},
                'pixQrCode', ${inter_collections.pixQrCode},
                'pixCopiaECola', ${inter_collections.pixCopiaECola}
              ) ORDER BY ${inter_collections.dataVencimento}
            ) FILTER (WHERE ${inter_collections.id} IS NOT NULL),
            '[]'::json
          )
        `.as('cobrancas')
      })
      .from(propostas)
      .leftJoin(
        inter_collections,
        eq(propostas.id, inter_collections.propostaId)
      )
      .where(
        and(
          or(
            eq(propostas.status, 'pronto_pagamento'),
            eq(propostas.status, 'pago'),
            eq(propostas.status, 'aprovado')
          ),
          isNotNull(propostas.ccb_gerado),
          isNotNull(propostas.assinatura_eletronica_concluida)
        )
      )
      .groupBy(propostas.id);

    // Formatar dados para o frontend
    const cobrancasFormatadas = propostasComCobrancas.map(item => {
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
      const valorTotal = proposta.condicoes_data?.valorTotalFinanciado || 0;
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
        nomeCliente: proposta.cliente_data?.nome || 'Sem nome',
        cpfCliente: proposta.cliente_data?.cpf || 'Sem CPF',
        telefoneCliente: proposta.cliente_data?.telefone || 'Sem telefone',
        emailCliente: proposta.cliente_data?.email || 'Sem email',
        valorTotal,
        valorFinanciado: proposta.condicoes_data?.valor || 0,
        quantidadeParcelas: proposta.condicoes_data?.prazo || totalParcelas,
        parcelasPagas,
        parcelasPendentes,
        parcelasVencidas,
        valorTotalPago,
        valorTotalPendente,
        diasAtraso,
        status,
        dataContrato: proposta.createdAt,
        ccbAssinada: !!proposta.assinatura_eletronica_concluida,
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
          ccb: proposta.ccb_path
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
      acao: 'status_cobrancas_atualizado',
      descricao: 'Status das cobranças atualizado via dashboard',
      dadosAnteriores: {},
      dadosNovos: { totalCobrancas: cobrancas.length },
      usuarioId: req.user!.id,
      usuarioNome: req.user!.nome || 'Sistema',
      ip: req.ip || 'unknown'
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
      acao: 'cobranca_enviada',
      descricao: `Cobrança enviada via ${validatedData.tipo}`,
      dadosAnteriores: {},
      dadosNovos: {
        tipo: validatedData.tipo,
        destinatario: validatedData.destinatario,
        mensagem: validatedData.mensagem
      },
      usuarioId: req.user!.id,
      usuarioNome: req.user!.nome || 'Sistema',
      ip: req.ip || 'unknown'
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