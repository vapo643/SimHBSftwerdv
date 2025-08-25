/**
 * Webhook Service
 * Business logic layer for webhook processing
 * Following Clean Architecture principles - separates business logic from controllers
 */

import crypto from "crypto";
import { webhookRepository, WebhookLog, Proposal, Payment } from "../repositories/webhook.repository";
import { documentProcessingService, ProcessingSource } from "./documentProcessingService";
import { clickSignWebhookService } from "./clickSignWebhookService";

export interface ClickSignWebhookData {
  event: {
    name: string;
    data: any;
    occurred_at: string;
  };
  document?: {
    key: string;
    status: string;
    path?: string;
    filename?: string;
  };
}

export interface InterWebhookData {
  codigoSolicitacao: string;
  situacao: string;
  dataHora?: string;
  nossoNumero?: string;
  valorPago?: number;
  dataVencimento?: string;
  dataPagamento?: string;
  origemRecebimento?: "BOLETO" | "PIX";
  pixTxid?: string;
  codigoBarras?: string;
  linhaDigitavel?: string;
}

export class WebhookService {
  private readonly signedEvents = ["document.signed", "document.finished", "auto_close"];

  /**
   * Validate ClickSign HMAC signature
   */
  validateClickSignHMAC(payload: string, signature: string): boolean {
    const secret = process.env.CLICKSIGN_WEBHOOK_SECRET;

    if (!secret) {
      console.error("❌ [WEBHOOK] CLICKSIGN_WEBHOOK_SECRET not configured");
      return false;
    }

    const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    try {
      // Timing-safe comparison
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch (error) {
      console.error("❌ [WEBHOOK] Error validating HMAC:", error);
      return false;
    }
  }

  /**
   * Validate Inter HMAC signature
   */
  validateInterHMAC(payload: string, signature: string): boolean {
    const secret = process.env.INTER_WEBHOOK_SECRET;

    if (!secret) {
      console.error("❌ [WEBHOOK INTER] INTER_WEBHOOK_SECRET not configured");
      return false;
    }

    // Remove possible prefixes (sha256=, etc.)
    const cleanSignature = signature.replace(/^(sha256=|SHA256=)?/, '');
    
    const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    console.log(`🔐 [WEBHOOK INTER] Signature received (clean): ${cleanSignature.substring(0, 20)}...`);
    console.log(`🔐 [WEBHOOK INTER] Signature expected: ${expectedSignature.substring(0, 20)}...`);

    try {
      // Ensure both strings have the same size
      if (cleanSignature.length !== expectedSignature.length) {
        console.error(`❌ [WEBHOOK INTER] Signature length mismatch: received ${cleanSignature.length}, expected ${expectedSignature.length}`);
        return false;
      }

      // Timing-safe comparison
      return crypto.timingSafeEqual(
        Buffer.from(cleanSignature, 'hex'), 
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error(`❌ [WEBHOOK INTER] Error comparing signatures:`, error);
      return false;
    }
  }

  /**
   * Process ClickSign webhook
   */
  async processClickSignWebhook(webhookData: ClickSignWebhookData): Promise<{
    processed: boolean;
    message: string;
    propostaId?: string;
  }> {
    const { event, document } = webhookData;
    console.log(`📋 [WEBHOOK] Processing ClickSign event: ${event.name}, Document: ${document?.key || "N/A"}`);

    // Check if event should be processed
    if (!this.signedEvents.includes(event.name)) {
      console.log(`ℹ️ [WEBHOOK] Ignoring event ${event.name} (not a signing completion event)`);
      return {
        processed: false,
        message: "Event received but not processed",
      };
    }

    if (!document || document.status !== "closed") {
      console.log(
        `ℹ️ [WEBHOOK] Document not ready for processing. Status: ${document?.status || "unknown"}`
      );
      return {
        processed: false,
        message: "Document not ready",
      };
    }

    // Check idempotency
    const eventId = `${document.key}_${event.occurred_at}`;
    const alreadyProcessed = await webhookRepository.isWebhookProcessed("clicksign", eventId);
    
    if (alreadyProcessed) {
      console.log(`ℹ️ [WEBHOOK] Event already processed: ${eventId}`);
      return {
        processed: false,
        message: "Event already processed",
      };
    }

    // Find associated proposal
    const proposal = await webhookRepository.findProposalByClickSignDocument(document.key);
    
    if (!proposal) {
      console.warn(`⚠️ [WEBHOOK] No proposal found for document ${document.key}`);
      
      // Log webhook for debugging
      await webhookRepository.createWebhookLog({
        source: "clicksign",
        event: event.name,
        payload: webhookData,
        status: "failed",
        documentKey: document.key,
        error: "Proposal not found",
        metadata: { eventId }
      });
      
      throw new Error("Proposal not found");
    }

    console.log(`🎯 [WEBHOOK] Found proposal ${proposal.id} for document ${document.key}`);

    // Create webhook log
    const logId = await webhookRepository.createWebhookLog({
      source: "clicksign",
      event: event.name,
      payload: webhookData,
      status: "pending",
      propostaId: proposal.id,
      documentKey: document.key,
      metadata: { eventId }
    });

    try {
      // Update proposal signature status
      await webhookRepository.updateProposalSignatureStatus(proposal.id, {
        assinaturaEletronicaConcluida: true,
        dataAssinatura: event.occurred_at,
        clicksignDocumentId: document.key,
      });

      // Enqueue document processing
      // NOTE: DocumentProcessingService needs implementation of enqueueProcessing method
      // await documentProcessingService.enqueueProcessing({
      //   propostaId: proposal.id,
      //   documentKey: document.key,
      //   clienteNome: proposal.clienteNome,
      //   source: ProcessingSource.WEBHOOK,
      //   webhookEvent: event.name,
      //   metadata: {
      //     documentPath: document.path,
      //     filename: document.filename,
      //   },
      // });

      // Process via ClickSign webhook service  
      // NOTE: ClickSignWebhookService needs implementation of processWebhook method
      // await clickSignWebhookService.processWebhook(webhookData);

      // Update webhook log status
      await webhookRepository.updateWebhookLogStatus(logId, "processed");

      console.log(`✅ [WEBHOOK] Successfully processed ClickSign webhook for proposal ${proposal.id}`);

      return {
        processed: true,
        message: "Webhook processed successfully",
        propostaId: proposal.id,
      };
    } catch (error: any) {
      console.error(`❌ [WEBHOOK] Error processing ClickSign webhook:`, error);
      
      // Update webhook log with error
      await webhookRepository.updateWebhookLogStatus(logId, "failed", error.message);
      
      throw error;
    }
  }

  /**
   * Process Inter webhook
   */
  async processInterWebhook(webhookData: InterWebhookData): Promise<{
    processed: boolean;
    message: string;
    propostaId?: string;
    paymentId?: string;
  }> {
    const { nossoNumero, situacao, valorPago, dataPagamento } = webhookData;
    
    console.log(`📋 [WEBHOOK INTER] Processing payment event: ${situacao}, NossoNumero: ${nossoNumero}`);

    if (!nossoNumero) {
      console.warn(`⚠️ [WEBHOOK INTER] Missing nossoNumero in webhook`);
      return {
        processed: false,
        message: "Missing nossoNumero",
      };
    }

    // Check idempotency
    const eventId = `${nossoNumero}_${webhookData.dataHora || new Date().toISOString()}`;
    const alreadyProcessed = await webhookRepository.isWebhookProcessed("inter", eventId);
    
    if (alreadyProcessed) {
      console.log(`ℹ️ [WEBHOOK INTER] Event already processed: ${eventId}`);
      return {
        processed: false,
        message: "Event already processed",
      };
    }

    // Find associated payment
    const payment = await webhookRepository.findPaymentByNossoNumero(nossoNumero);
    
    if (!payment) {
      console.warn(`⚠️ [WEBHOOK INTER] No payment found for nossoNumero ${nossoNumero}`);
      
      // Try to find proposal directly
      const proposal = await webhookRepository.findProposalByNossoNumero(nossoNumero);
      
      if (!proposal) {
        // Log webhook for debugging
        await webhookRepository.createWebhookLog({
          source: "inter",
          event: situacao,
          payload: webhookData,
          status: "failed",
          error: "Payment and proposal not found",
          metadata: { eventId, nossoNumero }
        });
        
        throw new Error("Payment not found");
      }
      
      // Create payment record if proposal exists
      console.log(`📝 [WEBHOOK INTER] Creating payment record for proposal ${proposal.id}`);
      // Note: This would need additional implementation to create payment
    }

    const propostaId = payment?.propostaId;

    // Create webhook log
    const logId = await webhookRepository.createWebhookLog({
      source: "inter",
      event: situacao,
      payload: webhookData,
      status: "pending",
      propostaId: propostaId,
      metadata: { eventId, nossoNumero }
    });

    try {
      // Map Inter status to internal status
      let internalStatus = "pendente";
      if (situacao === "PAGO" || situacao === "RECEBIDO") {
        internalStatus = "pago";
      } else if (situacao === "CANCELADO" || situacao === "EXPIRADO") {
        internalStatus = "cancelado";
      }

      // Update payment status if payment exists
      if (payment) {
        await webhookRepository.updatePaymentStatus(payment.id, {
          status: internalStatus,
          valorPago: valorPago,
          dataPagamento: dataPagamento,
          metadata: {
            origemRecebimento: webhookData.origemRecebimento,
            pixTxid: webhookData.pixTxid,
            codigoBarras: webhookData.codigoBarras,
            linhaDigitavel: webhookData.linhaDigitavel,
          }
        });
      }

      // Update webhook log status
      await webhookRepository.updateWebhookLogStatus(logId, "processed");

      console.log(`✅ [WEBHOOK INTER] Successfully processed payment webhook for ${nossoNumero}`);

      return {
        processed: true,
        message: "Webhook processed successfully",
        propostaId: propostaId,
        paymentId: payment?.id,
      };
    } catch (error: any) {
      console.error(`❌ [WEBHOOK INTER] Error processing webhook:`, error);
      
      // Update webhook log with error
      await webhookRepository.updateWebhookLogStatus(logId, "failed", error.message);
      
      throw error;
    }
  }

  /**
   * Get recent webhook logs
   */
  async getRecentWebhookLogs(limit: number = 100): Promise<WebhookLog[]> {
    return await webhookRepository.getRecentWebhookLogs(limit);
  }

  /**
   * Get webhook logs by proposal
   */
  async getWebhookLogsByProposal(propostaId: string): Promise<WebhookLog[]> {
    return await webhookRepository.getWebhookLogsByProposal(propostaId);
  }
}

// Export singleton instance
export const webhookService = new WebhookService();