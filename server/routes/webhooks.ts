/**
 * Webhook endpoints para integrações externas
 * Implementa validação HMAC e processamento assíncrono
 */

import express from "express";
import crypto from "crypto";
import { db } from "../lib/supabase";
import { sql } from "drizzle-orm";
import { documentProcessingService, ProcessingSource } from "../services/documentProcessingService";
import { clickSignWebhookService } from "../services/clickSignWebhookService";
import { z } from "zod";

const router = express.Router();

// Schema de validação para webhook do ClickSign
const clickSignWebhookSchema = z.object({
  event: z.object({
    name: z.string(),
    data: z.any(),
    occurred_at: z.string(),
  }),
  document: z
    .object({
      key: z.string(),
      status: z.string(),
      path: z.string().optional(),
      filename: z.string().optional(),
    })
    .optional(),
});

/**
 * Valida assinatura HMAC do ClickSign
 */
function validateClickSignHMAC(payload: string, signature: string): boolean {
  const secret = process.env.CLICKSIGN_WEBHOOK_SECRET;

  if (!secret) {
    console.error("❌ [WEBHOOK] CLICKSIGN_WEBHOOK_SECRET not configured");
    return false;
  }

  const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  // Timing-safe comparison
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

/**
 * POST /api/webhooks/clicksign
 * Recebe eventos de assinatura do ClickSign
 */
router.post("/clicksign", express.raw({ type: "application/json" }), async (req, res) => {
  const startTime = Date.now();

  try {
    console.log("🔔 [WEBHOOK] ClickSign webhook received");

    // 1. Validar assinatura HMAC
    const signature = req.headers["content-hmac"] as string;
    const payload = req.body.toString();

    if (!signature) {
      console.warn("⚠️ [WEBHOOK] Missing HMAC signature");
      return res.status(401).json({ error: "Missing signature" });
    }

    if (!validateClickSignHMAC(payload, signature)) {
      console.error("❌ [WEBHOOK] Invalid HMAC signature");
      return res.status(401).json({ error: "Invalid signature" });
    }

    // 2. Parse e validar payload
    let webhookData;
    try {
      webhookData = JSON.parse(payload);
      clickSignWebhookSchema.parse(webhookData);
    } catch (parseError) {
      console.error("❌ [WEBHOOK] Invalid payload format:", parseError);
      return res.status(400).json({ error: "Invalid payload" });
    }

    const { event, document } = webhookData;
    console.log(`📋 [WEBHOOK] Event: ${event.name}, Document: ${document?.key || "N/A"}`);

    // 3. Processar apenas eventos de documento finalizado
    const signedEvents = ["document.signed", "document.finished", "auto_close"];

    if (!signedEvents.includes(event.name)) {
      console.log(`ℹ️ [WEBHOOK] Ignoring event ${event.name} (not a signing completion event)`);
      return res.status(200).json({
        message: "Event received but not processed",
        event: event.name,
      });
    }

    if (!document || document.status !== "closed") {
      console.log(
        `ℹ️ [WEBHOOK] Document not ready for processing. Status: ${document?.status || "unknown"}`
      );
      return res.status(200).json({
        message: "Document not ready",
        status: document?.status,
      });
    }

    // 4. Buscar proposta associada ao documento
    const proposalResult = await db.execute(sql`
      SELECT id, cliente_nome, status
      FROM propostas 
      WHERE clicksign_document_id = ${document.key}
         OR clicksign_envelope_id = ${document.key}
      LIMIT 1
    `);

    if (!proposalResult || proposalResult.length === 0) {
      console.warn(`⚠️ [WEBHOOK] No proposal found for document ${document.key}`);
      return res.status(404).json({ error: "Proposal not found" });
    }

    const proposal = proposalResult[0];
    console.log(`🎯 [WEBHOOK] Found proposal ${proposal.id} for document ${document.key}`);

    // 5. Processar documento de forma assíncrona
    // Responder rapidamente ao webhook
    res.status(200).json({
      message: "Webhook received and queued for processing",
      proposalId: proposal.id,
    });

    // Processar em background
    setImmediate(async () => {
      try {
        // CORREÇÃO CRÍTICA: Usar clickSignWebhookService para atualizar status corretamente
        const result = await clickSignWebhookService.processEvent({
          event: event.name,
          data: {
            document: document,
            signer: event.data?.signer,
            list: event.data?.list
          },
          occurred_at: event.occurred_at
        });

        if (result.processed) {
          console.log(
            `✅ [WEBHOOK] Successfully processed document for proposal ${result.proposalId || proposal.id} via WEBHOOK`
          );

          // Também processar o download do documento assinado
          if (document.status === "closed") {
            await documentProcessingService.processSignedDocument(
              proposal.id as string,
              ProcessingSource.WEBHOOK,
              document.key
            );
          }

          // Log webhook success
          await db.execute(sql`
            INSERT INTO webhook_logs (
              source,
              event_type,
              payload,
              processed,
              processing_time,
              created_at
            ) VALUES (
              ${"clicksign"},
              ${event.name},
              ${JSON.stringify(webhookData)},
              ${true},
              ${Date.now() - startTime},
              NOW()
            )
          `);
        } else {
          console.error(
            `❌ [WEBHOOK] Failed to process document for proposal ${proposal.id}: ${result.reason}`
          );
        }
      } catch (error) {
        console.error(`❌ [WEBHOOK] Background processing error:`, error);
      }
    });
  } catch (error) {
    console.error("❌ [WEBHOOK] Unexpected error:", error);

    // Log webhook error
    try {
      await db.execute(sql`
        INSERT INTO webhook_logs (
          source,
          event_type,
          payload,
          processed,
          error,
          created_at
        ) VALUES (
          ${"clicksign"},
          ${"error"},
          ${JSON.stringify({ headers: req.headers, body: req.body?.toString() || "" })},
          ${false},
          ${error instanceof Error ? error.message : "Unknown error"},
          NOW()
        )
      `);
    } catch (logError) {
      console.error("Failed to log webhook error:", logError);
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/webhooks/inter
 * Recebe notificações de pagamento do Banco Inter
 */
router.post("/inter", express.raw({ type: "application/json" }), async (req, res) => {
  const startTime = Date.now();

  try {
    console.log("🏦 [WEBHOOK] Inter webhook received");

    // 1. Validar assinatura (Inter usa header diferente)
    const signature = req.headers["x-inter-signature"] as string;
    const secret = process.env.INTER_WEBHOOK_SECRET;

    if (!secret) {
      console.error("❌ [WEBHOOK] INTER_WEBHOOK_SECRET not configured");
      return res.status(500).json({ error: "Webhook secret not configured" });
    }

    if (!signature) {
      console.warn("⚠️ [WEBHOOK] Missing Inter signature");
      return res.status(401).json({ error: "Missing signature" });
    }

    // Validar HMAC para Inter
    const payload = req.body.toString();
    const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("base64"); // Inter usa base64

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      console.error("❌ [WEBHOOK] Invalid Inter signature");
      return res.status(401).json({ error: "Invalid signature" });
    }

    // 2. Parse payload
    const webhookData = JSON.parse(payload);
    console.log(`🏦 [WEBHOOK] Inter event type: ${webhookData.tipoEvento}`);

    // 3. Processar diferentes tipos de eventos
    switch (webhookData.tipoEvento) {
      case "COBRANCA_RECEBIDA":
        console.log(`💰 [WEBHOOK] Payment received for collection ${webhookData.cobranca?.codigo}`);

        // Atualizar status da parcela
        await db.execute(sql`
          UPDATE parcelas 
          SET 
            status = 'pago',
            data_pagamento = NOW(),
            atualizado_em = NOW()
          WHERE codigo_boleto = ${webhookData.cobranca?.codigo}
        `);

        // Log do pagamento
        await db.execute(sql`
          INSERT INTO webhook_logs (
            source,
            event_type,
            payload,
            processed,
            processing_time,
            created_at
          ) VALUES (
            ${"inter"},
            ${webhookData.tipoEvento},
            ${JSON.stringify(webhookData)},
            ${true},
            ${Date.now() - startTime},
            NOW()
          )
        `);

        break;

      case "COBRANCA_VENCIDA":
        console.warn(`⚠️ [WEBHOOK] Collection expired: ${webhookData.cobranca?.codigo}`);

        // Atualizar status para vencido
        await db.execute(sql`
          UPDATE parcelas 
          SET 
            status = 'vencido',
            atualizado_em = NOW()
          WHERE codigo_boleto = ${webhookData.cobranca?.codigo}
        `);

        break;

      default:
        console.log(`ℹ️ [WEBHOOK] Unhandled Inter event type: ${webhookData.tipoEvento}`);
    }

    res.status(200).json({ message: "Webhook processed successfully" });
  } catch (error) {
    console.error("❌ [WEBHOOK] Inter webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/webhooks/health
 * Health check para verificar se o serviço de webhooks está ativo
 */
router.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "webhooks",
    timestamp: new Date().toISOString(),
  });
});

export default router;
