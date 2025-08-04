import { Router } from 'express';
import { getBrasiliaTimestamp } from '../../lib/timezone';

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

    // Processar diferentes tipos de eventos
    switch (evento) {
      case 'cobranca-paga':
        console.log('[INTER WEBHOOK] 💰 Payment received');
        console.log(`[INTER WEBHOOK] Cobrança: ${cobranca.seuNumero}`);
        console.log(`[INTER WEBHOOK] Valor: R$ ${cobranca.valorRecebido}`);
        
        // Aqui você pode atualizar o status da proposta
        // await updateProposalPaymentStatus(cobranca.seuNumero, 'PAGO');
        break;

      case 'cobranca-vencida':
        console.log('[INTER WEBHOOK] ⏰ Cobrança vencida');
        // await updateProposalPaymentStatus(cobranca.seuNumero, 'VENCIDO');
        break;

      case 'cobranca-cancelada':
        console.log('[INTER WEBHOOK] ❌ Cobrança cancelada');
        // await updateProposalPaymentStatus(cobranca.seuNumero, 'CANCELADO');
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