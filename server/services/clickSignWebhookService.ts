/**
 * ClickSign Webhook Service
 * Handles webhook security validation and event processing
 *
 * Security features:
 * - HMAC signature validation
 * - Request timestamp validation
 * - Event deduplication
 * - Rate limiting protection
 */

import crypto from 'crypto';
import { storage } from '../storage.js';
import { interBankService } from './interBankService.js';
import { getBrasiliaTimestamp } from '../lib/timezone.js';
// STATUS V2.0: Import do serviço de auditoria
import { logStatusTransition } from './auditService.js';
// PAM V1.0: Import do serviço de processamento de documentos
import { documentProcessingService, ProcessingSource } from './documentProcessingService.js';
// PAM V1.0 - OPERAÇÃO PONTE AUTOMATIZADA: Import do UseCase
import { MarcarAssinaturaConcluidaUseCase } from '../modules/proposal/application/MarcarAssinaturaConcluidaUseCase.js';
import { DomainException } from '../modules/shared/domain/DomainException.js';
import { UnitOfWork } from '../lib/unit-of-work.js';
import { logInfo, logError } from '../lib/logger.js';
import { SecureLogger, sanitizeWebhookPayload } from '../modules/shared/infrastructure/SanitizedLogger';

interface WebhookEvent {
  event: string;
  data: {
    document?: {
      key: string;
      filename?: string;
      status?: string;
      created_at?: string;
      finished_at?: string;
    };
    signer?: {
      email: string;
      name?: string;
      sign_at?: string;
      viewed_at?: string;
    };
    list?: {
      key: string;
      status?: string;
    };
  };
  occurred_at?: string;
}

interface WebhookSecurityHeaders {
  'x-clicksign-signature'?: string;
  'x-clicksign-timestamp'?: string;
  'x-clicksign-event'?: string;
}

class ClickSignWebhookService {
  private readonly webhookSecret: string;
  private readonly maxTimestampAge: number = 300; // 5 minutes
  private processedEvents: Set<string> = new Set();
  private readonly marcarAssinaturaConcluidaUseCase: MarcarAssinaturaConcluidaUseCase;

  constructor(marcarAssinaturaConcluidaUseCase?: MarcarAssinaturaConcluidaUseCase) {
    this.webhookSecret = process.env.CLICKSIGN_WEBHOOK_SECRET || '';

    // PAM V1.0 - OPERAÇÃO PONTE AUTOMATIZADA: Injeção via construtor (DI correto)
    if (marcarAssinaturaConcluidaUseCase) {
      this.marcarAssinaturaConcluidaUseCase = marcarAssinaturaConcluidaUseCase;
    } else {
      // Fallback para compatibilidade - criar internamente se não injetado
      const unitOfWork = new UnitOfWork();
      this.marcarAssinaturaConcluidaUseCase = new MarcarAssinaturaConcluidaUseCase(unitOfWork);
    }

    if (!this.webhookSecret) {
      console.warn(
        '[CLICKSIGN WEBHOOK] ⚠️ Webhook secret not configured. Signature validation disabled.'
      );
    }

    logInfo('[CLICKSIGN WEBHOOK SERVICE] ✅ Inicializado com UseCase MarcarAssinaturaConcluidaUseCase', {
      webhookSecretConfigured: !!this.webhookSecret,
      useCaseInjected: !!this.marcarAssinaturaConcluidaUseCase,
      injectionMethod: marcarAssinaturaConcluidaUseCase ? 'constructor' : 'internal_fallback'
    });
  }

  /**
   * Validate webhook signature 
   * PAM V1.0 - OPERAÇÃO PONTE AUTOMATIZADA: Corrigido bug de segurança HMAC
   */
  validateSignature(payload: string, signature: string, timestamp: string): boolean {
    if (!this.webhookSecret) {
      console.warn('[CLICKSIGN WEBHOOK] Signature validation skipped - no secret configured');
      return true; // Skip validation if no secret
    }

    try {
      // Parse and validate timestamp
      const webhookTime = parseInt(timestamp, 10);
      if (isNaN(webhookTime)) {
        console.error('[CLICKSIGN WEBHOOK] Invalid timestamp format');
        return false;
      }

      // Check timestamp age
      const currentTime = Math.floor(Date.now() / 1000);
      if (currentTime - webhookTime > this.maxTimestampAge) {
        console.error('[CLICKSIGN WEBHOOK] Request timestamp too old');
        return false;
      }

      // Normalize signature (remove common prefixes)
      const cleanSignature = signature.replace(/^(sha256=|SHA256=)?/, '');

      // Generate expected signature
      const signedPayload = `${timestamp}.${payload}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(signedPayload)
        .digest('hex');

      // Validate hex format and length before comparison
      if (!/^[a-fA-F0-9]+$/.test(cleanSignature) || cleanSignature.length !== expectedSignature.length) {
        console.error('[CLICKSIGN WEBHOOK] Invalid signature format or length');
        return false;
      }

      // Safe timing comparison with properly formatted buffers
      const isValid = crypto.timingSafeEqual(
        Buffer.from(cleanSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );

      if (!isValid) {
        console.error('[CLICKSIGN WEBHOOK] Invalid signature');
      }

      return isValid;

    } catch (error) {
      console.error('[CLICKSIGN WEBHOOK] Signature validation error:', error);
      return false;
    }
  }

  /**
   * Check for duplicate events
   * PAM V1.0 - OPERAÇÃO PONTE AUTOMATIZADA: Corrigido método quebrado
   */
  isDuplicateEvent(eventId: string): boolean {
    if (!eventId) {
      return false; // No event ID, can't check for duplicates
    }

    // Use only the event ID, not timestamp (which was making every event unique)
    const key = eventId;

    if (this.processedEvents.has(key)) {
      logInfo('[CLICKSIGN WEBHOOK] ⚠️ Duplicate event detected', { eventId });
      return true;
    }

    this.processedEvents.add(key);

    // Clean old events (keep last 1000)
    if (this.processedEvents.size > 1000) {
      const entries = Array.from(this.processedEvents);
      this.processedEvents = new Set(entries.slice(-500));
      logInfo('[CLICKSIGN WEBHOOK] 🧹 Cleaned old duplicate event cache', { 
        removedEvents: this.processedEvents.size - 500,
        currentCacheSize: this.processedEvents.size 
      });
    }

    return false;
  }

  /**
   * Process webhook event (API v1/v2)
   */
  async processEvent(event: WebhookEvent): Promise<{
    processed: boolean;
    reason?: string;
    proposalId?: any;
    status?: string;
    documentKey?: string;
  }> {
    const eventType = event.event;
    const eventData = event.data;

    console.log(`[CLICKSIGN WEBHOOK] Processing event: ${eventType}`, {
      documentKey: eventData.document?.key,
      listKey: eventData.list?.key,
      signerEmail: eventData.signer?.email,
      occurredAt: event.occurred_at,
    });

    // Find related proposal
    const proposta = await this.findProposal(eventData);

    if (!proposta) {
      console.warn('[CLICKSIGN WEBHOOK] No proposal found for event');
      return { processed: false, reason: 'Proposal not found' };
    }

    // Process based on event type (API v1/v2)
    switch (eventType) {
      case 'auto_close':
        return await this.handleAutoClose(proposta, eventData);

      case 'document_closed':
        return await this.handleDocumentClosed(proposta, eventData);

      case 'cancel':
        return await this.handleCancel(proposta, eventData);

      case 'deadline':
        return await this.handleDeadline(proposta, eventData);

      case 'upload':
        return await this.handleUpload(proposta, eventData);

      case 'sign':
        return await this.handleSign(proposta, eventData);

      case 'refusal':
        return await this.handleRefusal(proposta, eventData);

      default:
        console.log(`[CLICKSIGN WEBHOOK] Unhandled event type: ${eventType}`);
        return { processed: true, reason: 'Event type not handled' };
    }
  }

  /**
   * Find proposal by ClickSign keys (API v1/v2)
   */
  private async findProposal(data: WebhookEvent['data']) {
    const documentKey = data.document?.key;
    const listKey = data.list?.key;

    if (documentKey) {
      return await storage.getPropostaByClickSignKey('document', documentKey);
    } else if (listKey) {
      return await storage.getPropostaByClickSignKey('list', listKey);
    }

    return null;
  }

  /**
   * Handle auto_close event - MOST IMPORTANT
   * PAM V1.0 - OPERAÇÃO PONTE AUTOMATIZADA: Refatorado para usar UseCase
   */
  private async handleAutoClose(proposta: any, data: WebhookEvent['data']) {
    logInfo('[CLICKSIGN WEBHOOK] 🎉 AUTO_CLOSE event received', {
      propostaId: proposta.id,
      documentKey: data.document?.key,
      service: 'clickSignWebhookService',
      method: 'handleAutoClose'
    });

    const now = getBrasiliaTimestamp();

    // PAM V1.0: Usar UseCase para transição de status ao invés de update direto
    try {
      await this.marcarAssinaturaConcluidaUseCase.execute({
        propostaId: proposta.id,
        userId: 'sistema' // Usuario sistema para ações automáticas de webhook
      });

      logInfo('[CLICKSIGN WEBHOOK] ✅ UseCase executado com sucesso - Status atualizado para ASSINATURA_CONCLUIDA', {
        propostaId: proposta.id,
        documentKey: data.document?.key,
        triggeredBy: 'webhook_auto_close'
      });

      // Manter compatibilidade: Update campos ClickSign específicos
      const clickSignUpdateData = {
        clicksignStatus: 'finished',
        clicksignSignedAt: new Date(now),
        assinaturaEletronicaConcluida: true,
        biometriaConcluida: true, // ClickSign biometria acontece no mesmo processo
        dataAssinatura: new Date(now),
      };

      await storage.updateProposta(proposta.id, clickSignUpdateData);

    } catch (error) {
      if (error instanceof DomainException) {
        // PAM V1.0: Tratamento idempotente - Se já processado, é sucesso para o webhook
        logInfo('[CLICKSIGN WEBHOOK] ℹ️ Webhook recebido para proposta que já foi processada - Nenhuma ação necessária', {
          propostaId: proposta.id,
          domainError: error.message,
          documentKey: data.document?.key,
          reason: 'webhook_idempotent'
        });

        // Ainda assim, sync campos ClickSign se necessário
        const clickSignUpdateData = {
          clicksignStatus: 'finished',
          clicksignSignedAt: new Date(now),
          assinaturaEletronicaConcluida: true,
          biometriaConcluida: true,
          dataAssinatura: new Date(now),
        };

        await storage.updateProposta(proposta.id, clickSignUpdateData);

      } else {
        // Erro crítico - falha real no sistema
        logError('[CLICKSIGN WEBHOOK] ❌ Erro crítico ao processar auto_close', error as Error, {
          propostaId: proposta.id,
          documentKey: data.document?.key,
          method: 'handleAutoClose'
        });

        // Log para auditoria
        await storage.createPropostaLog({
          propostaId: proposta.id,
          autorId: 'clicksign-webhook',
          statusAnterior: proposta.status,
          statusNovo: proposta.status,
          observacao: `❌ ERRO CRÍTICO: Falha ao processar webhook auto_close. Erro: ${(error as Error).message}`,
        });

        // Re-throw para indicar falha ao endpoint de webhook
        throw error;
      }
    }

    // Log de sucesso específico para webhook
    await storage.createPropostaLog({
      propostaId: proposta.id,
      autorId: 'clicksign-webhook',
      statusAnterior: proposta.status,
      statusNovo: 'ASSINATURA_CONCLUIDA',
      observacao: '✅ CCB assinado com sucesso + Biometria validada - Finalização automática via webhook AUTO_CLOSE',
    });

    // PAM V1.0: Processar documento assinado automaticamente
    try {
      console.log(
        `[CLICKSIGN → STORAGE] 📥 Iniciando processamento automático do documento assinado`
      );
      const processingResult = await documentProcessingService.processSignedDocument(
        proposta.id,
        ProcessingSource.WEBHOOK,
        data.document?.key || data.list?.key
      );

      if (processingResult.success) {
        console.log(
          `[CLICKSIGN → STORAGE] ✅ Documento processado e armazenado com sucesso para proposta ${proposta.id}`
        );
        await storage.createPropostaLog({
          propostaId: proposta.id,
          autorId: 'clicksign-webhook',
          statusAnterior: proposta.status,
          statusNovo: 'ASSINATURA_CONCLUIDA',
          observacao: `📄 CCB assinado baixado e armazenado no Storage: ${processingResult.details?.storagePath || 'caminho disponível'}`,
        });
      } else {
        console.error(
          `[WEBHOOK-ERROR] Falha ao processar documento assinado para proposta ${proposta.id}: ${processingResult.message}`
        );
      }
    } catch (error) {
      console.error(
        `[WEBHOOK-ERROR] Erro crítico ao processar documento assinado para proposta ${proposta.id}:`,
        error
      );
      // Não interrompe o fluxo principal - apenas registra o erro
      await storage.createPropostaLog({
        propostaId: proposta.id,
        autorId: 'clicksign-webhook',
        statusAnterior: proposta.status,
        statusNovo: 'ASSINATURA_CONCLUIDA',
        observacao: `⚠️ Erro ao baixar CCB assinado automaticamente. Necessário processamento manual. Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      });
    }

    // CRITICAL: Trigger automatic boleto generation
    console.log(`[CLICKSIGN → INTER] 🚀 Triggering automatic boleto generation`);
    await this.triggerBoletoGeneration(proposta);

    return {
      processed: true,
      proposalId: proposta.id,
      status: 'finished',
      documentKey: data.document?.key,
    };
  }

  /**
   * Handle document_closed event
   */
  private async handleDocumentClosed(proposta: any, data: WebhookEvent['data']) {
    console.log(`[CLICKSIGN WEBHOOK] Document closed for proposal: ${proposta.id}`);

    await storage.createPropostaLog({
      propostaId: proposta.id,
      autorId: 'clicksign-webhook',
      statusAnterior: proposta.status,
      statusNovo: proposta.status,
      observacao: '📄 Documento finalizado e pronto para download',
    });

    return { processed: true, proposalId: proposta.id, documentKey: data.document?.key };
  }

  /**
   * Handle cancel event
   */
  private async handleCancel(proposta: any, data: WebhookEvent['data']) {
    console.log(`[CLICKSIGN WEBHOOK] Document cancelled for proposal: ${proposta.id}`);

    await storage.updateProposta(proposta.id, {
      clicksignStatus: 'cancelled',
    });

    await storage.createPropostaLog({
      propostaId: proposta.id,
      autorId: 'clicksign-webhook',
      statusAnterior: proposta.status,
      statusNovo: proposta.status,
      observacao: '❌ Documento cancelado no ClickSign',
    });

    return { processed: true, proposalId: proposta.id, status: 'cancelled' };
  }

  /**
   * Handle deadline event
   */
  private async handleDeadline(proposta: any, data: WebhookEvent['data']) {
    console.log(`[CLICKSIGN WEBHOOK] ⏰ Deadline alert for proposal: ${proposta.id}`);

    await storage.createPropostaLog({
      propostaId: proposta.id,
      autorId: 'clicksign-webhook',
      statusAnterior: proposta.status,
      statusNovo: proposta.status,
      observacao: '⏰ Alerta de prazo - Documento próximo do vencimento',
    });

    return { processed: true, proposalId: proposta.id, documentKey: data.document?.key };
  }

  /**
   * Handle upload event
   */
  private async handleUpload(proposta: any, data: WebhookEvent['data']) {
    console.log(`[CLICKSIGN WEBHOOK] 📤 Document uploaded for proposal: ${proposta.id}`);

    await storage.createPropostaLog({
      propostaId: proposta.id,
      autorId: 'clicksign-webhook',
      statusAnterior: proposta.status,
      statusNovo: proposta.status,
      observacao: '📤 Documento carregado no ClickSign com sucesso',
    });

    return { processed: true, proposalId: proposta.id, documentKey: data.document?.key };
  }

  /**
   * Handle sign event
   * PAM V1.0 - OPERAÇÃO PONTE AUTOMATIZADA: Refatorado para usar UseCase
   */
  private async handleSign(proposta: any, data: WebhookEvent['data']) {
    const signerInfo = data.signer ? ` por ${data.signer.name || data.signer.email}` : '';
    
    logInfo('[CLICKSIGN WEBHOOK] ✍️ SIGN event received', {
      propostaId: proposta.id,
      documentKey: data.document?.key,
      signerEmail: data.signer?.email,
      service: 'clickSignWebhookService',
      method: 'handleSign'
    });

    // PAM V1.0: Usar UseCase para transição de status ao invés de update direto
    try {
      await this.marcarAssinaturaConcluidaUseCase.execute({
        propostaId: proposta.id,
        userId: 'sistema' // Usuario sistema para ações automáticas de webhook
      });

      logInfo('[CLICKSIGN WEBHOOK] ✅ UseCase executado com sucesso - Status atualizado via evento SIGN', {
        propostaId: proposta.id,
        documentKey: data.document?.key,
        signerEmail: data.signer?.email,
        triggeredBy: 'webhook_sign'
      });

      // Manter compatibilidade: Update campos ClickSign específicos
      await storage.updateProposta(proposta.id, {
        assinaturaEletronicaConcluida: true,
        clicksignStatus: 'signed',
        clicksignDocumentKey: data.document?.key || null,
      });

      await storage.createPropostaLog({
        propostaId: proposta.id,
        autorId: 'clicksign-webhook',
        statusAnterior: proposta.status,
        statusNovo: 'ASSINATURA_CONCLUIDA',
        observacao: `✍️ Documento assinado${signerInfo} - Status atualizado automaticamente para ASSINATURA_CONCLUIDA`,
      });

    } catch (error) {
      if (error instanceof DomainException) {
        // PAM V1.0: Tratamento idempotente - Se já processado, é sucesso para o webhook
        logInfo('[CLICKSIGN WEBHOOK] ℹ️ Webhook SIGN recebido para proposta que já foi processada - Nenhuma ação necessária', {
          propostaId: proposta.id,
          domainError: error.message,
          documentKey: data.document?.key,
          signerEmail: data.signer?.email,
          reason: 'webhook_idempotent_sign'
        });

        // Ainda assim, sync campos ClickSign se necessário
        await storage.updateProposta(proposta.id, {
          assinaturaEletronicaConcluida: true,
          clicksignStatus: 'signed',
          clicksignDocumentKey: data.document?.key || null,
        });

        await storage.createPropostaLog({
          propostaId: proposta.id,
          autorId: 'clicksign-webhook',
          statusAnterior: proposta.status,
          statusNovo: proposta.status,
          observacao: `✍️ Documento assinado${signerInfo} - Status já processado anteriormente`,
        });

      } else {
        // Erro crítico - falha real no sistema
        logError('[CLICKSIGN WEBHOOK] ❌ Erro crítico ao processar evento SIGN', error as Error, {
          propostaId: proposta.id,
          documentKey: data.document?.key,
          signerEmail: data.signer?.email,
          method: 'handleSign'
        });

        // Log para auditoria
        await storage.createPropostaLog({
          propostaId: proposta.id,
          autorId: 'clicksign-webhook',
          statusAnterior: proposta.status,
          statusNovo: proposta.status,
          observacao: `❌ ERRO CRÍTICO: Falha ao processar webhook SIGN${signerInfo}. Erro: ${(error as Error).message}`,
        });

        // Re-throw para indicar falha ao endpoint de webhook
        throw error;
      }
    }

    // PAM V1.0: Processar documento assinado automaticamente (evento de assinatura individual)
    try {
      console.log(`[CLICKSIGN → STORAGE] 📥 Processando documento após assinatura individual`);
      const processingResult = await documentProcessingService.processSignedDocument(
        proposta.id,
        ProcessingSource.WEBHOOK,
        data.document?.key
      );

      if (processingResult.success) {
        console.log(
          `[CLICKSIGN → STORAGE] ✅ Documento processado após assinatura para proposta ${proposta.id}`
        );
        await storage.createPropostaLog({
          propostaId: proposta.id,
          autorId: 'clicksign-webhook',
          statusAnterior: proposta.status,
          statusNovo: proposta.status,
          observacao: `📄 CCB processado e armazenado após assinatura${signerInfo}`,
        });
      }
    } catch (error) {
      console.error(
        `[WEBHOOK-ERROR] Erro ao processar documento após assinatura para proposta ${proposta.id}:`,
        error
      );
      // Erro não bloqueia o webhook - será processado posteriormente
    }

    return { processed: true, proposalId: proposta.id, documentKey: data.document?.key };
  }

  /**
   * Handle refusal event
   */
  private async handleRefusal(proposta: any, data: WebhookEvent['data']) {
    console.log(`[CLICKSIGN WEBHOOK] ❌ Document refused for proposal: ${proposta.id}`);

    const signerInfo = data.signer ? ` por ${data.signer.name || data.signer.email}` : '';

    await storage.updateProposta(proposta.id, {
      clicksignStatus: 'refused',
    });

    await storage.createPropostaLog({
      propostaId: proposta.id,
      autorId: 'clicksign-webhook',
      statusAnterior: proposta.status,
      statusNovo: proposta.status,
      observacao: `❌ Documento recusado${signerInfo}`,
    });

    return { processed: true, proposalId: proposta.id, status: 'refused' };
  }

  /**
   * Handle document created event
   */
  private async handleDocumentCreated(proposta: any, data: WebhookEvent['data']) {
    console.log(`[CLICKSIGN WEBHOOK] Document created for proposal: ${proposta.id}`);

    await storage.createPropostaLog({
      propostaId: proposta.id,
      autorId: 'clicksign-webhook',
      statusAnterior: proposta.status,
      statusNovo: proposta.status,
      observacao: 'Documento CCB criado no ClickSign',
    });

    return { processed: true, proposalId: proposta.id };
  }

  /**
   * Handle document signed event
   */
  private async handleDocumentSigned(proposta: any, data: WebhookEvent['data']) {
    console.log(`[CLICKSIGN WEBHOOK] Document signed for proposal: ${proposta.id}`);

    const updateData = {
      clicksignStatus: 'signed',
      clicksignSignedAt: new Date(),
      assinaturaEletronicaConcluida: true,
      dataAssinatura: new Date(),
      status: 'contratos_assinados',
    };

    await storage.updateProposta(proposta.id, updateData);

    await storage.createPropostaLog({
      propostaId: proposta.id,
      autorId: 'clicksign-webhook',
      statusAnterior: proposta.status,
      statusNovo: 'contratos_assinados',
      observacao: 'CCB assinado eletronicamente via ClickSign',
    });

    // Trigger boleto generation
    await this.triggerBoletoGeneration(proposta);

    return { processed: true, proposalId: proposta.id, status: 'signed' };
  }

  /**
   * Handle document finished event (all signers completed)
   */
  private async handleDocumentFinished(proposta: any, data: WebhookEvent['data']) {
    console.log(`[CLICKSIGN WEBHOOK] Document finished for proposal: ${proposta.id}`);

    const finishedAt = getBrasiliaTimestamp();

    const updateData = {
      clicksignStatus: 'finished',
      clicksignSignedAt: new Date(finishedAt),
    };

    await storage.updateProposta(proposta.id, updateData);

    await storage.createPropostaLog({
      propostaId: proposta.id,
      autorId: 'clicksign-webhook',
      statusAnterior: proposta.status,
      statusNovo: proposta.status,
      observacao: 'Processo de assinatura finalizado - todos os signatários assinaram',
    });

    return { processed: true, proposalId: proposta.id, status: 'finished' };
  }

  /**
   * Handle document cancelled event
   */
  private async handleDocumentCancelled(proposta: any, data: WebhookEvent['data']) {
    console.log(`[CLICKSIGN WEBHOOK] Document cancelled for proposal: ${proposta.id}`);

    const updateData = {
      clicksignStatus: 'cancelled',
    };

    await storage.updateProposta(proposta.id, updateData);

    await storage.createPropostaLog({
      propostaId: proposta.id,
      autorId: 'clicksign-webhook',
      statusAnterior: proposta.status,
      statusNovo: proposta.status,
      observacao: 'Assinatura do CCB cancelada no ClickSign',
    });

    return { processed: true, proposalId: proposta.id, status: 'cancelled' };
  }

  /**
   * Handle document refused event
   */
  private async handleDocumentRefused(proposta: any, data: WebhookEvent['data']) {
    console.log(`[CLICKSIGN WEBHOOK] Document refused for proposal: ${proposta.id}`);

    const updateData = {
      clicksignStatus: 'refused',
    };

    await storage.updateProposta(proposta.id, updateData);

    await storage.createPropostaLog({
      propostaId: proposta.id,
      autorId: 'clicksign-webhook',
      statusAnterior: proposta.status,
      statusNovo: proposta.status,
      observacao: `Assinatura recusada por: ${data.signer?.email || 'signatário'}`,
    });

    return { processed: true, proposalId: proposta.id, status: 'refused' };
  }

  /**
   * Trigger boleto generation after signature
   * 🎯 PAM V1.0: Exposed as public method for manual orchestration
   */
  public async triggerBoletoGeneration(proposta: any) {
    try {
      console.log(`[CLICKSIGN → INTER] Triggering boleto generation for proposal: ${proposta.id}`);

      // ===== PROTEÇÃO CONTRA CONDIÇÃO DE CORRIDA =====
      // Check if collection already exists (ENHANCED CHECK)
      const existingCollections = await storage.getInterCollectionsByProposalId(proposta.id);

      if (existingCollections && existingCollections.length > 0) {
        console.log(
          `[CLICKSIGN → INTER] 🚫 BLOQUEIO: ${existingCollections.length} boletos ativos já existem para proposta: ${proposta.id}`
        );
        console.log(
          `[CLICKSIGN → INTER] 🚫 Boletos existentes:`,
          existingCollections.map((col) => ({
            codigo: col.codigoSolicitacao,
            parcela: col.numeroParcela,
            valor: col.valorNominal,
            situacao: col.situacao,
            isActive: col.isActive,
          }))
        );

        await storage.createPropostaLog({
          propostaId: proposta.id,
          autorId: 'clicksign-webhook',
          statusAnterior: proposta.status,
          statusNovo: proposta.status,
          observacao: `🚫 WEBHOOK BLOQUEADO: ${existingCollections.length} boletos ativos já existem. Timestamp: ${new Date().toISOString()}`,
        });

        return;
      }

      // ===== DUPLA VERIFICAÇÃO ANTES DA CRIAÇÃO =====
      console.log(
        `[CLICKSIGN → INTER] ✅ Verificação inicial passou. Fazendo segunda verificação antes de criar boletos...`
      );

      // Wait 500ms and check again to prevent race conditions
      await new Promise((resolve) => setTimeout(resolve, 500));
      const secondCheck = await storage.getInterCollectionsByProposalId(proposta.id);

      if (secondCheck && secondCheck.length > 0) {
        console.log(
          `[CLICKSIGN → INTER] 🚫 BLOQUEIO NA SEGUNDA VERIFICAÇÃO: ${secondCheck.length} boletos criados por outro processo`
        );
        await storage.createPropostaLog({
          propostaId: proposta.id,
          autorId: 'clicksign-webhook',
          statusAnterior: proposta.status,
          statusNovo: proposta.status,
          observacao: `🚫 CORRIDA DETECTADA: Boletos criados por outro processo durante os 500ms de espera`,
        });
        return;
      }

      // Parse proposal data
      const clienteData =
        typeof proposta.clienteData === 'string'
          ? JSON.parse(proposta.clienteData)
          : proposta.clienteData || {};

      const condicoesData =
        typeof proposta.condicoesData === 'string'
          ? JSON.parse(proposta.condicoesData)
          : proposta.condicoesData || {};

      // Get number of installments and value per installment
      const numeroParcelas = parseInt(condicoesData.prazoMeses || '1');
      const valorParcela = parseFloat(String(condicoesData.valorParcela || 0));

      console.log(
        `[CLICKSIGN → INTER] ✅ AUTORIZADO: Criando ${numeroParcelas} boletos de R$ ${valorParcela} cada para proposta ${proposta.id}`
      );
      console.log(
        `[CLICKSIGN → INTER] 📊 Detalhes: numeroParcelas=${numeroParcelas}, valorParcela=${valorParcela}`
      );

      const successfulBoletos = [];
      const failedBoletos = [];

      // Create one boleto for each installment
      for (let i = 0; i < numeroParcelas; i++) {
        try {
          const parcelaNumero = i + 1;

          // Generate boleto according to Inter Bank API requirements
          const boletoData = {
            seuNumero: `${proposta.id.slice(0, 12)}-${parcelaNumero}`, // Max 15 chars with installment number
            valorNominal: valorParcela, // Use installment value, not total
            dataVencimento: this.calculateDueDateByMonth(i + 1), // First installment in 30 days, then monthly
            numDiasAgenda: 60, // Auto-cancel after 60 days
            pagador: {
              cpfCnpj: clienteData.cpf?.replace(/\D/g, '') || '',
              tipoPessoa: 'FISICA' as const,
              nome: clienteData.nome || '',
              email: clienteData.email || '',
              ddd: clienteData.telefone ? clienteData.telefone.replace(/\D/g, '').slice(0, 2) : '',
              telefone: clienteData.telefone
                ? clienteData.telefone.replace(/\D/g, '').slice(2)
                : '',
              endereco: clienteData.logradouro || clienteData.endereco || '',
              numero: clienteData.numero || '',
              complemento: clienteData.complemento || '',
              bairro: clienteData.bairro || 'Centro',
              cidade: clienteData.cidade || 'São Paulo',
              uf: clienteData.uf || 'SP',
              cep: clienteData.cep?.replace(/\D/g, '') || '',
            },
            mensagem: {
              linha1: `Parcela ${parcelaNumero}/${numeroParcelas} - Empréstimo`,
              linha2: `Proposta: ${proposta.id}`,
              linha3: `SIMPIX - Soluções Financeiras`,
              linha4: `Valor da parcela: R$ ${valorParcela.toFixed(2)}`,
              linha5: `Vencimento: ${this.formatDateBR(this.calculateDueDateByMonth(i + 1))}`,
            },
          };

          console.log(`[CLICKSIGN → INTER] Creating boleto ${parcelaNumero}/${numeroParcelas}`);

          // PAM V1.0 DIAGNÓSTICO: Antes de chamar serviço bancário
          console.log('[LOG 3/5] Serviço de Orquestração: Prestes a chamar interBankService.emitirCobranca para a parcela', i + 1);

          const createResponse = await interBankService.emitirCobranca(boletoData);

          if (createResponse.codigoSolicitacao) {
            // Fetch collection details
            const interCollection = await interBankService.recuperarCobranca(
              createResponse.codigoSolicitacao
            );

            // Save to database
            await storage.createInterCollection({
              propostaId: proposta.id,
              codigoSolicitacao: createResponse.codigoSolicitacao,
              seuNumero: boletoData.seuNumero,
              valorNominal: String(boletoData.valorNominal),
              dataVencimento: boletoData.dataVencimento,
              situacao: interCollection.cobranca.situacao,
              dataSituacao: interCollection.cobranca.dataSituacao,
              nossoNumero: interCollection.boleto?.nossoNumero || '',
              codigoBarras: interCollection.boleto?.codigoBarras || '',
              linhaDigitavel: interCollection.boleto?.linhaDigitavel || '',
              pixTxid: interCollection.pix?.txid || '',
              pixCopiaECola: interCollection.pix?.pixCopiaECola || '',
              dataEmissao:
                interCollection.cobranca.dataEmissao || new Date().toISOString().split('T')[0],
              isActive: true,
            });

            successfulBoletos.push(parcelaNumero);
            console.log(
              `[CLICKSIGN → INTER] ✅ Boleto ${parcelaNumero} created: ${createResponse.codigoSolicitacao}`
            );
          }
        } catch (error) {
          console.error(`[CLICKSIGN → INTER] ❌ Error creating boleto ${i + 1}:`, error);
          failedBoletos.push(i + 1);
        }
      }

      // Log final result
      if (successfulBoletos.length > 0) {
        // 🎯 PAM V1.0 FIX: Atualizar status da proposta para BOLETOS_EMITIDOS
        await storage.updateProposta(proposta.id, {
          status: 'BOLETOS_EMITIDOS',
        });

        await storage.createPropostaLog({
          propostaId: proposta.id,
          autorId: 'clicksign-webhook',
          statusAnterior: proposta.status,
          statusNovo: 'BOLETOS_EMITIDOS',
          observacao: `${successfulBoletos.length} boletos gerados automaticamente após assinatura CCB (parcelas: ${successfulBoletos.join(', ')})`,
        });
      }

      if (failedBoletos.length > 0) {
        await storage.createPropostaLog({
          propostaId: proposta.id,
          autorId: 'clicksign-webhook',
          statusAnterior: proposta.status,
          statusNovo: successfulBoletos.length > 0 ? 'BOLETOS_EMITIDOS' : 'contratos_assinados',
          observacao: `Erro ao gerar ${failedBoletos.length} boletos (parcelas: ${failedBoletos.join(', ')})`,
        });
      }
    } catch (error) {
      console.error(`[CLICKSIGN → INTER] ❌ Error generating boletos:`, error);

      await storage.createPropostaLog({
        propostaId: proposta.id,
        autorId: 'clicksign-webhook',
        statusAnterior: proposta.status,
        statusNovo: 'contratos_assinados',
        observacao: `Erro ao gerar boletos automaticamente: ${(error as Error).message}`,
      });
    }
  }

  /**
   * Calculate due date
   */
  private calculateDueDate(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  /**
   * Calculate due date by month (for installments)
   */
  private calculateDueDateByMonth(monthNumber: number): string {
    const date = new Date();
    date.setMonth(date.getMonth() + monthNumber);
    return date.toISOString().split('T')[0];
  }

  /**
   * Format date to Brazilian format (DD/MM/YYYY)
   */
  private formatDateBR(dateString: string): string {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  }
}

// Export singleton instance
export const clickSignWebhookService = new ClickSignWebhookService();
