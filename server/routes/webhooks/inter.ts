import { Router } from 'express';
import { getBrasiliaTimestamp } from '../../lib/timezone';
import { storage } from '../../storage';
import { db } from '../../lib/supabase';
import { interWebhooks, interCollections } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * Webhook do Banco Inter para notificações de pagamento
 * POST /webhooks/inter
 */
router.post('/', async (req, res) => {
  try {
    console.log('[INTER WEBHOOK] 📨 Received notification');
    console.log('[INTER WEBHOOK] Headers:', req.headers);
    console.log('[INTER WEBHOOK] Body:', JSON.stringify(req.body, null, 2));

    const { evento, cobranca } = req.body;

    // Validar estrutura do webhook
    if (!evento || !cobranca) {
      console.log('[INTER WEBHOOK] ❌ Invalid webhook structure');
      return res.status(400).json({ error: 'Invalid webhook structure' });
    }

    // Salvar webhook no banco para auditoria
    await db.insert(interWebhooks).values({
      evento,
      payload: req.body,
      processedAt: new Date(),
      status: 'SUCCESS'
    });

    // Processar diferentes tipos de eventos
    switch (evento) {
      case 'cobranca-paga':
        console.log('[INTER WEBHOOK] 💰 Payment received');
        console.log(`[INTER WEBHOOK] Cobrança: ${cobranca.seuNumero}`);
        console.log(`[INTER WEBHOOK] Valor: R$ ${cobranca.valorRecebido}`);
        
        // Atualizar collection no banco
        if (cobranca.seuNumero) {
          try {
            // seuNumero é no formato "SIMPIX-{propostaId}-{numeroParcela}"
            const parts = cobranca.seuNumero.split('-');
            if (parts.length >= 2) {
              const propostaId = parts[1];
              
              // Atualizar collection como paga
              await db.update(interCollections)
                .set({ 
                  situacao: 'RECEBIDO',
                  dataSituacao: new Date().toISOString(),
                  valorPago: cobranca.valorRecebido?.toString(),
                  updatedAt: new Date()
                })
                .where(eq(interCollections.seuNumero, cobranca.seuNumero));
              
              console.log(`[INTER WEBHOOK] ✅ Cobrança ${cobranca.seuNumero} da proposta ${propostaId} marcada como paga`);
              
              // Verificar se todas as cobranças foram pagas
              const todasCobrancas = await db.select()
                .from(interCollections)
                .where(eq(interCollections.propostaId, propostaId));
              
              const todasPagas = todasCobrancas.every(c => c.situacao === 'RECEBIDO');
              
              if (todasPagas) {
                // Atualizar proposta como quitada
                await storage.updateProposta(propostaId, { status: 'pago' });
                console.log(`[INTER WEBHOOK] 🎉 Proposta ${propostaId} totalmente quitada`);
              }
            }
          } catch (error) {
            console.error('[INTER WEBHOOK] ❌ Erro ao atualizar cobrança:', error);
          }
        }
        break;

      case 'cobranca-vencida':
        console.log('[INTER WEBHOOK] ⏰ Cobrança vencida');
        
        // Atualizar status da parcela para vencido
        if (cobranca.seuNumero) {
          try {
            const parts = cobranca.seuNumero.split('-');
            if (parts.length >= 3) {
              const propostaId = parts[1];
              
              await db.update(interCollections)
                .set({ 
                  situacao: 'VENCIDO',
                  dataSituacao: new Date().toISOString(),
                  updatedAt: new Date()
                })
                .where(eq(interCollections.seuNumero, cobranca.seuNumero));
              
              console.log(`[INTER WEBHOOK] ⏰ Cobrança ${cobranca.seuNumero} da proposta ${propostaId} marcada como vencida`);
            }
          } catch (error) {
            console.error('[INTER WEBHOOK] ❌ Erro ao atualizar parcela vencida:', error);
          }
        }
        break;

      case 'cobranca-cancelada':
        console.log('[INTER WEBHOOK] ❌ Cobrança cancelada');
        break;

      default:
        console.log(`[INTER WEBHOOK] ℹ️ Unknown event: ${evento}`);
    }

    // Sempre responder com 200 para confirmar recebimento
    res.status(200).json({ 
      message: 'Webhook received successfully',
      timestamp: getBrasiliaTimestamp()
    });

  } catch (error) {
    console.error('[INTER WEBHOOK] ❌ Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;