import { Router } from "express";
import { getBrasiliaTimestamp } from "../../lib/timezone";
import { db } from "../../lib/supabase";
import { interWebhooks } from "@shared/schema";
import { boletoStatusService } from "../../services/boletoStatusService";

const router = Router();

/**
 * Webhook do Banco Inter para notificações de pagamento
 * POST /webhooks/inter
 * 
 * @realismo-cetico: VULNERABILIDADE CRÍTICA - Sem validação HMAC
 * TODO: Implementar validação de assinatura do webhook para segurança
 */
router.post("/", async (req, res) => {
  try {
    console.log("[INTER WEBHOOK] 📨 Received notification");
    console.log("[INTER WEBHOOK] Headers:", req.headers);
    console.log("[INTER WEBHOOK] Body:", JSON.stringify(req.body, null, 2));

    const { evento, cobranca } = req.body;

    // Validar estrutura do webhook
    if (!evento || !cobranca) {
      console.log("[INTER WEBHOOK] ❌ Invalid webhook structure");
      return res.status(400).json({ error: "Invalid webhook structure" });
    }

    // Salvar webhook no banco para auditoria
    await db.insert(interWebhooks).values({
      eventos: [evento],
      url: req.url,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Usar serviço centralizado para processar webhook
    const result = await boletoStatusService.processarWebhook(req.body);
    
    if (!result.success) {
      console.log(`[INTER WEBHOOK] ⚠️ Processamento parcial: ${result.message}`);
      if (result.errors) {
        console.error("[INTER WEBHOOK] Erros:", result.errors);
      }
    }

    // Sempre responder com 200 para confirmar recebimento
    res.status(200).json({
      message: "Webhook received successfully",
      processed: result.success,
      details: result.message,
      timestamp: getBrasiliaTimestamp(),
    });
  } catch (error) {
    console.error("[INTER WEBHOOK] ❌ Error processing webhook:", error);
    // Mesmo em erro, retornar 200 para evitar retry do Inter
    res.status(200).json({ 
      error: "Internal processing error",
      timestamp: getBrasiliaTimestamp() 
    });
  }
});

export default router;