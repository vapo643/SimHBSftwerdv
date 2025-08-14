/**
 * ClickSign Integration Routes
 * Handles electronic signature workflow
 */

import express from "express";
import { clickSignService } from "../services/clickSignService.js";
import { clickSignWebhookService } from "../services/clickSignWebhookService.js";
import { clickSignSecurityService } from "../services/clickSignSecurityService.js";
import { interBankService } from "../services/interBankService.js";
import { storage } from "../storage.js";
import { jwtAuthMiddleware, type AuthenticatedRequest } from "../lib/jwt-auth-middleware.js";
import { getBrasiliaTimestamp } from "../lib/timezone.js";
// STATUS V2.0: Import do serviço de auditoria
import { logStatusTransition } from "../services/auditService.js";

const router = express.Router();

/**
 * Send CCB to ClickSign for electronic signature
 * POST /api/clicksign/send-ccb/:propostaId
 */
router.post("/send-ccb/:propostaId", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { propostaId } = req.params;

    console.log(`[CLICKSIGN] Initiating CCB signature for proposal: ${propostaId}`);

    // 1. Get proposal data
    const proposta = await storage.getPropostaById(propostaId);
    if (!proposta) {
      return res.status(404).json({ error: "Proposta não encontrada" });
    }

    // Validate proposal is approved and CCB is generated
    if (proposta.status !== "aprovado") {
      return res
        .status(400)
        .json({ error: "Proposta deve estar aprovada para envio ao ClickSign" });
    }

    if (!proposta.ccbGerado) {
      return res.status(400).json({ error: "CCB deve estar gerado antes do envio ao ClickSign" });
    }

    // Check if already sent to ClickSign
    if (proposta.clicksignDocumentKey) {
      return res.status(400).json({
        error: "CCB já foi enviado ao ClickSign",
        clicksignStatus: proposta.clicksignStatus,
        clicksignSignUrl: proposta.clicksignSignUrl,
      });
    }

    // 2. Get CCB file from Supabase Storage
    const ccbUrl = await storage.getCcbUrl(propostaId);
    if (!ccbUrl) {
      return res.status(404).json({ error: "CCB não encontrado no storage" });
    }

    // Download CCB as buffer
    const ccbResponse = await fetch(ccbUrl);
    if (!ccbResponse.ok) {
      throw new Error(`Failed to download CCB: ${ccbResponse.status}`);
    }
    const ccbBuffer = Buffer.from(await ccbResponse.arrayBuffer());

    // 3. Prepare and validate client data with security
    const clienteData = JSON.parse(proposta.clienteData || "{}");
    const rawClientData = {
      name: clienteData.nomeCompleto || proposta.clienteNome,
      email: clienteData.email || proposta.clienteEmail,
      cpf: clienteData.cpf || proposta.clienteCpf,
      phone: clienteData.telefone || proposta.clienteTelefone,
    };

    // Validate and sanitize client data
    let clientData;
    try {
      clientData = clickSignSecurityService.validateClientData(rawClientData);
    } catch (error) {
      console.error("[CLICKSIGN SECURITY] Client data validation failed:", error);
      return res.status(400).json({
        error: "Dados do cliente inválidos",
        details: (error as Error).message,
      });
    }

    // Generate filename for ClickSign
    const filename = `CCB-${propostaId}-${Date.now()}.pdf`;

    // Validate PDF security
    try {
      clickSignSecurityService.validatePDF(ccbBuffer, filename);
    } catch (error) {
      console.error("[CLICKSIGN SECURITY] PDF validation failed:", error);
      return res.status(400).json({
        error: "Arquivo PDF inválido",
        details: (error as Error).message,
      });
    }

    // Create audit log
    const auditLog = clickSignSecurityService.createAuditLog(
      "CLICKSIGN_SEND_CCB",
      { proposalId: propostaId, clientEmail: clientData.email },
      req.user?.id
    );
    console.log("[CLICKSIGN AUDIT]", auditLog);

    // 4. Send to ClickSign
    const clickSignResult = await clickSignService.sendCCBForSignature(
      ccbBuffer,
      filename,
      clientData
    );

    // 5. Update proposal with ClickSign data
    await storage.updateProposta(propostaId, {
      clicksignDocumentKey: clickSignResult.documentKey,
      clicksignSignerKey: clickSignResult.signerKey,
      clicksignListKey: clickSignResult.listKey,
      clicksignStatus: "pending",
      clicksignSignUrl: clickSignResult.signUrl,
      clicksignSentAt: new Date(getBrasiliaTimestamp()),
      status: "AGUARDANDO_ASSINATURA",
    });

    // STATUS V2.0: Registrar transição de status
    await logStatusTransition({
      propostaId: propostaId,
      fromStatus: proposta.status || "CCB_GERADA",
      toStatus: "AGUARDANDO_ASSINATURA",
      triggeredBy: "api",
      userId: req.user?.id,
      metadata: {
        service: "clickSignService",
        action: "sendCCBForSignature",
        documentKey: clickSignResult.documentKey,
        signUrl: clickSignResult.signUrl,
        timestamp: new Date().toISOString()
      }
    });

    console.log(`[CLICKSIGN] ✅ CCB sent successfully for proposal: ${propostaId}`);
    console.log(`[CLICKSIGN V2.0] Status atualizado para AGUARDANDO_ASSINATURA`);

    res.json({
      success: true,
      message: "CCB enviado ao ClickSign com sucesso",
      clickSignData: {
        documentKey: clickSignResult.documentKey,
        status: "pending",
        signUrl: clickSignResult.signUrl,
      },
    });
  } catch (error) {
    console.error(`[CLICKSIGN] ❌ Error sending CCB:`, error);
    res.status(500).json({
      error: "Erro ao enviar CCB para ClickSign",
      details: (error as Error).message,
    });
  }
});

/**
 * Get ClickSign status for a proposal
 * GET /api/clicksign/status/:propostaId
 */
router.get("/status/:propostaId", jwtAuthMiddleware, async (req, res) => {
  try {
    const { propostaId } = req.params;

    const proposta = await storage.getPropostaById(propostaId);
    if (!proposta) {
      return res.status(404).json({ error: "Proposta não encontrada" });
    }

    if (!proposta.clicksignDocumentKey) {
      return res.json({
        status: "not_sent",
        message: "CCB não foi enviado ao ClickSign ainda",
      });
    }

    // Get current status from ClickSign
    let clickSignStatus = null;
    try {
      clickSignStatus = await clickSignService.getDocumentStatus(proposta.clicksignDocumentKey);
    } catch (error) {
      console.error(`[CLICKSIGN] Error getting status:`, error);
    }

    res.json({
      propostaId,
      clickSignData: {
        documentKey: proposta.clicksignDocumentKey,
        signerKey: proposta.clicksignSignerKey,
        listKey: proposta.clicksignListKey,
        status: proposta.clicksignStatus,
        signUrl: proposta.clicksignSignUrl,
        sentAt: proposta.clicksignSentAt,
        signedAt: proposta.clicksignSignedAt,
      },
      externalStatus: clickSignStatus,
    });
  } catch (error) {
    console.error(`[CLICKSIGN] Error getting status:`, error);
    res.status(500).json({
      error: "Erro ao consultar status ClickSign",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Webhook endpoint for ClickSign notifications
 * POST /api/clicksign/webhook
 *
 * Security features:
 * - HMAC signature validation
 * - Timestamp validation
 * - Event deduplication
 */
router.post("/webhook", async (req, res) => {
  try {
    // Security: IP validation and rate limiting
    const clientIP = req.ip || req.connection.remoteAddress || "";

    if (!clickSignSecurityService.validateWebhookIP(clientIP)) {
      console.error("[CLICKSIGN WEBHOOK] Blocked request from unauthorized IP:", clientIP);
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!clickSignSecurityService.checkWebhookRateLimit(clientIP)) {
      console.error("[CLICKSIGN WEBHOOK] Rate limit exceeded for IP:", clientIP);
      return res.status(429).json({ error: "Too many requests" });
    }

    // Security: Validate event structure
    let validatedEvent;
    try {
      validatedEvent = clickSignSecurityService.validateWebhookEvent(req.body);
    } catch (error) {
      console.error("[CLICKSIGN WEBHOOK] Invalid event structure:", error);
      return res.status(400).json({ error: "Invalid webhook format" });
    }

    // Security: Log sanitized event
    const auditLog = clickSignSecurityService.createAuditLog(
      "CLICKSIGN_WEBHOOK_RECEIVED",
      validatedEvent,
      "webhook"
    );
    console.log("[CLICKSIGN WEBHOOK AUDIT]", auditLog);

    // Validate signature if secret is configured
    const signature = req.headers["x-clicksign-signature"] as string;
    const timestamp = req.headers["x-clicksign-timestamp"] as string;

    if (signature && timestamp) {
      const payload = JSON.stringify(req.body);
      const isValid = clickSignWebhookService.validateSignature(payload, signature, timestamp);

      if (!isValid) {
        console.error("[CLICKSIGN WEBHOOK] ❌ Invalid signature or expired timestamp");
        return res.status(401).json({ error: "Invalid webhook signature" });
      }
    }

    // Extract event data from v1/v2 structure
    const eventData = validatedEvent;

    if (!eventData.event || !eventData.data) {
      return res.status(400).json({ error: "Invalid webhook payload" });
    }

    // Check for duplicate events
    const eventId = `${eventData.event}_${eventData.data.document?.key || eventData.data.list?.key || ""}_${eventData.occurred_at || Date.now()}`;
    if (clickSignWebhookService.isDuplicateEvent(eventId)) {
      console.log("[CLICKSIGN WEBHOOK] Duplicate event detected, skipping");
      return res.json({ success: true, message: "Duplicate event skipped" });
    }

    // Process event using webhook service
    const result = await clickSignWebhookService.processEvent(eventData);

    if (!result.processed) {
      console.log(`[CLICKSIGN WEBHOOK] Event not processed: ${result.reason}`);
      return res.status(404).json({ error: result.reason });
    }

    console.log(`[CLICKSIGN WEBHOOK] ✅ Event ${eventData.event} processed successfully:`, result);
    res.json({ success: true, message: "Webhook processed successfully", result });
  } catch (error) {
    console.error(`[CLICKSIGN WEBHOOK] ❌ Error processing webhook:`, error);
    res.status(500).json({
      error: "Erro ao processar webhook ClickSign",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Test webhook endpoint (dev only)
 * POST /api/clicksign/webhook-test
 */
router.post("/webhook-test", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "Not found" });
  }

  try {
    console.log(`[CLICKSIGN WEBHOOK TEST] Received event:`, req.body);

    // Process event directly without validation
    const result = await clickSignWebhookService.processEvent(req.body);

    if (!result.processed) {
      console.log(`[CLICKSIGN WEBHOOK TEST] Event not processed: ${result.reason}`);
      return res.status(404).json({ error: result.reason });
    }

    console.log(`[CLICKSIGN WEBHOOK TEST] ✅ Event processed successfully:`, result);
    res.json({ success: true, message: "Webhook processed successfully", result });
  } catch (error) {
    console.error(`[CLICKSIGN WEBHOOK TEST] ❌ Error:`, error);
    res.status(500).json({
      error: "Erro ao processar webhook teste",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Test ClickSign connection
 * GET /api/clicksign/test
 */
router.get("/test", jwtAuthMiddleware, async (req, res) => {
  try {
    const isConnected = await clickSignService.testConnection();

    res.json({
      connected: isConnected,
      environment: process.env.NODE_ENV === "production" ? "production" : "sandbox",
      message: isConnected ? "ClickSign conectado com sucesso" : "Falha na conexão com ClickSign",
    });
  } catch (error) {
    console.error(`[CLICKSIGN] Connection test error:`, error);
    res.status(500).json({
      error: "Erro ao testar conexão ClickSign",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export { router as clickSignRouter };
