import { Router } from "express";
import * as crypto from "crypto";
import { getBrasiliaTimestamp } from "../../lib/timezone";
import { db } from "../../lib/supabase";
import { interWebhooks } from "@shared/schema";
import { boletoStatusService } from "../../services/boletoStatusService";

const router = Router();

/**
 * Valida assinatura HMAC do Banco Inter
 * @realismo-cetico: Usando timing-safe comparison para evitar timing attacks
 */
function validateInterWebhookHMAC(payload: string, signature: string): boolean {
  const secret = process.env.INTER_WEBHOOK_SECRET;

  if (!secret) {
    console.error("❌ [INTER WEBHOOK SECURITY] INTER_WEBHOOK_SECRET not configured");
    return false;
  }

  // Remover prefixos possíveis (sha256=, SHA256=, etc.)
  const cleanSignature = signature.replace(/^(sha256=|SHA256=)?/, '');
  
  // Gerar assinatura esperada
  const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  console.log(`🔐 [INTER WEBHOOK SECURITY] Signature received (clean): ${cleanSignature.substring(0, 20)}...`);
  console.log(`🔐 [INTER WEBHOOK SECURITY] Signature expected: ${expectedSignature.substring(0, 20)}...`);

  try {
    // Garantir que ambas as strings tenham o mesmo tamanho
    if (cleanSignature.length !== expectedSignature.length) {
      console.error(`❌ [INTER WEBHOOK SECURITY] Signature length mismatch: received ${cleanSignature.length}, expected ${expectedSignature.length}`);
      return false;
    }

    // Timing-safe comparison para prevenir timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(cleanSignature, 'hex'), 
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error(`❌ [INTER WEBHOOK SECURITY] Error comparing signatures:`, error);
    return false;
  }
}

/**
 * Webhook do Banco Inter para notificações de pagamento
 * POST /webhooks/inter
 * 
 * @realismo-cetico: SEGURANÇA IMPLEMENTADA - Validação HMAC ativa
 * Requer assinatura válida no header para processar requisições
 */
router.post("/", async (req, res) => {
  try {
    console.log("[INTER WEBHOOK] 📨 Received notification");
    console.log("[INTER WEBHOOK] Headers:", Object.keys(req.headers));
    
    // 1. VALIDAÇÃO DE SEGURANÇA HMAC (Primeira etapa mandatória)
    const signature = (req.headers["x-signature"] || 
                      req.headers["x-inter-signature"] || 
                      req.headers["signature"] ||
                      req.headers["x-hub-signature-256"]) as string;
    
    const payload = JSON.stringify(req.body);
    
    console.log(`🔐 [INTER WEBHOOK SECURITY] Headers com 'sig':`, Object.keys(req.headers).filter(h => h.includes('sig')));
    console.log(`🔐 [INTER WEBHOOK SECURITY] Signature header: ${signature ? 'presente' : 'AUSENTE'}`);
    
    // Em desenvolvimento, permitir webhooks sem assinatura para testes
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (signature) {
      if (!validateInterWebhookHMAC(payload, signature)) {
        console.error("❌ [INTER WEBHOOK SECURITY] HMAC signature validation FAILED");
        console.error("❌ [INTER WEBHOOK SECURITY] Rejecting unauthorized request");
        
        // Registrar tentativa falha para auditoria de segurança
        await db.insert(interWebhooks).values({
          eventos: ["SECURITY_VALIDATION_FAILED"],
          url: req.url,
          isActive: false,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        return res.status(401).json({ error: "Unauthorized: Invalid signature" });
      }
      console.log("✅ [INTER WEBHOOK SECURITY] HMAC signature validated successfully");
    } else if (!isDevelopment) {
      console.error("❌ [INTER WEBHOOK SECURITY] Missing signature in PRODUCTION");
      return res.status(401).json({ error: "Unauthorized: Missing signature" });
    } else {
      console.warn("⚠️ [INTER WEBHOOK SECURITY] Development mode - signature not required");
    }
    
    // Continuar com processamento apenas após validação bem-sucedida
    console.log("[INTER WEBHOOK] Payload validated:", JSON.stringify(req.body, null, 2));
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