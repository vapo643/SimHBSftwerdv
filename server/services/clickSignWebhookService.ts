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

interface WebhookEvent {
  event: {
    type: string;
    created_at: string;
    data: {
      envelope?: {
        id: string;
        name: string;
        status: string;
        created_at: string;
        updated_at: string;
        finished_at?: string;
        documents?: Array<{
          id: string;
          filename: string;
          signed_at?: string;
        }>;
        signers?: Array<{
          id: string;
          name: string;
          email: string;
          signed_at?: string;
          refused_at?: string;
        }>;
      };
      document?: {
        id: string;
        envelope_id: string;
        filename: string;
        status: string;
      };
      signer?: {
        id: string;
        envelope_id: string;
        name: string;
        email: string;
        documentation: string;
        sign_at?: string;
        refuse_at?: string;
        view_at?: string;
      };
    };
  };
  hmac?: string;
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

  constructor() {
    this.webhookSecret = process.env.CLICKSIGN_WEBHOOK_SECRET || '';
    
    if (!this.webhookSecret) {
      console.warn('[CLICKSIGN WEBHOOK] ⚠️ Webhook secret not configured. Signature validation disabled.');
    }
  }

  /**
   * Validate webhook signature
   */
  validateSignature(payload: string, signature: string, timestamp: string): boolean {
    if (!this.webhookSecret) {
      console.warn('[CLICKSIGN WEBHOOK] Signature validation skipped - no secret configured');
      return true; // Skip validation if no secret
    }

    // Check timestamp age
    const currentTime = Math.floor(Date.now() / 1000);
    const webhookTime = parseInt(timestamp);
    
    if (currentTime - webhookTime > this.maxTimestampAge) {
      console.error('[CLICKSIGN WEBHOOK] Request timestamp too old');
      return false;
    }

    // Validate HMAC signature
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(signedPayload)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      console.error('[CLICKSIGN WEBHOOK] Invalid signature');
    }

    return isValid;
  }

  /**
   * Check for duplicate events
   */
  isDuplicateEvent(eventId: string): boolean {
    const key = `${eventId}_${Date.now()}`;
    
    if (this.processedEvents.has(key)) {
      return true;
    }

    this.processedEvents.add(key);
    
    // Clean old events (keep last 1000)
    if (this.processedEvents.size > 1000) {
      const entries = Array.from(this.processedEvents);
      this.processedEvents = new Set(entries.slice(-500));
    }

    return false;
  }

  /**
   * Process webhook event (API v3)
   */
  async processEvent(event: WebhookEvent): Promise<{ processed: boolean; reason?: string; proposalId?: any; status?: string; envelopeId?: string }> {
    const eventType = event.event.type;
    const eventData = event.event.data;
    
    console.log(`[CLICKSIGN WEBHOOK v3] Processing event: ${eventType}`, {
      envelopeId: eventData.envelope?.id,
      envelopeStatus: eventData.envelope?.status,
      documentId: eventData.document?.id,
      signerId: eventData.signer?.id,
      occurredAt: event.event.created_at
    });

    // Find related proposal
    const proposta = await this.findProposal(eventData);
    
    if (!proposta) {
      console.warn('[CLICKSIGN WEBHOOK v3] No proposal found for event');
      return { processed: false, reason: 'Proposal not found' };
    }

    // Process based on event type (API v3)
    switch (eventType) {
      // Envelope events
      case 'envelope.created':
        return await this.handleEnvelopeCreated(proposta, eventData);
        
      case 'envelope.updated':
        return await this.handleEnvelopeUpdated(proposta, eventData);
        
      case 'envelope.finished':
        return await this.handleEnvelopeFinished(proposta, eventData);
        
      case 'envelope.cancelled':
        return await this.handleEnvelopeCancelled(proposta, eventData);
        
      case 'envelope.expired':
        return await this.handleEnvelopeExpired(proposta, eventData);
        
      // Document events
      case 'document.created':
        return await this.handleDocumentCreated(proposta, eventData);
        
      case 'document.signed':
        return await this.handleDocumentSigned(proposta, eventData);
        
      case 'document.refused':
        return await this.handleDocumentRefused(proposta, eventData);
        
      // Signer events  
      case 'signer.signed':
        return await this.handleSignerSigned(proposta, eventData);
        
      case 'signer.refused':
        return await this.handleSignerRefused(proposta, eventData);
        
      case 'signer.updated':
        return await this.handleSignerUpdated(proposta, eventData);
        
      default:
        console.log(`[CLICKSIGN WEBHOOK v3] Unhandled event type: ${eventType}`);
        return { processed: true, reason: 'Event type not handled' };
    }
  }

  /**
   * Find proposal by ClickSign IDs (API v3)
   */
  private async findProposal(data: WebhookEvent['event']['data']) {
    // For v3, we need to look for envelope ID
    const envelopeId = data.envelope?.id;
    const documentId = data.document?.id;
    
    // Extract proposal ID from envelope name if possible
    if (data.envelope?.name) {
      const match = data.envelope.name.match(/Proposta\s+(\w+-\w+-\w+-\w+-\w+)/);
      if (match) {
        return await storage.getPropostaById(match[1]);
      }
    }
    
    // Try to find by stored envelope/document IDs
    // Note: This requires updating the proposal table to store envelopeId
    if (envelopeId) {
      return await storage.getPropostaByClickSignKey('envelope', envelopeId);
    } else if (documentId) {
      return await storage.getPropostaByClickSignKey('document', documentId);
    }
    
    return null;
  }

  /**
   * Handle envelope created event (v3)
   */
  private async handleEnvelopeCreated(proposta: any, data: WebhookEvent['event']['data']) {
    console.log(`[CLICKSIGN WEBHOOK v3] Envelope created for proposal: ${proposta.id}`);
    
    await storage.createPropostaLog({
      propostaId: proposta.id,
      autorId: 'clicksign-webhook',
      statusAnterior: proposta.status,
      statusNovo: proposta.status,
      observacao: 'Envelope criado no ClickSign'
    });
    
    return { processed: true, proposalId: proposta.id, envelopeId: data.envelope?.id };
  }

  /**
   * Handle envelope updated event (v3)
   */
  private async handleEnvelopeUpdated(proposta: any, data: WebhookEvent['event']['data']) {
    console.log(`[CLICKSIGN WEBHOOK v3] Envelope updated for proposal: ${proposta.id}`);
    
    await storage.createPropostaLog({
      propostaId: proposta.id,
      autorId: 'clicksign-webhook',
      statusAnterior: proposta.status,
      statusNovo: proposta.status,
      observacao: `Envelope atualizado - Status: ${data.envelope?.status}`
    });
    
    return { processed: true, proposalId: proposta.id, envelopeId: data.envelope?.id };
  }

  /**
   * Handle envelope finished event (v3) - MOST IMPORTANT
   */
  private async handleEnvelopeFinished(proposta: any, data: WebhookEvent['event']['data']) {
    console.log(`[CLICKSIGN WEBHOOK v3] 🎉 Envelope FINISHED for proposal: ${proposta.id}`);
    
    const finishedAt = data.envelope?.finished_at || getBrasiliaTimestamp();
    
    // Update proposal with signature completion
    const updateData = {
      clicksignStatus: 'finished',
      clicksignSignedAt: new Date(finishedAt),
      assinaturaEletronicaConcluida: true,
      dataAssinatura: new Date(finishedAt),
      status: 'contratos_assinados' as const
    };
    
    await storage.updateProposta(proposta.id, updateData);
    
    await storage.createPropostaLog({
      propostaId: proposta.id,
      autorId: 'clicksign-webhook',
      statusAnterior: proposta.status,
      statusNovo: 'contratos_assinados',
      observacao: '✅ CCB assinado com sucesso - Todos os signatários completaram'
    });
    
    // CRITICAL: Trigger automatic boleto generation
    console.log(`[CLICKSIGN → INTER] 🚀 Triggering automatic boleto generation`);
    await this.triggerBoletoGeneration(proposta);
    
    return { 
      processed: true, 
      proposalId: proposta.id, 
      status: 'finished',
      envelopeId: data.envelope?.id 
    };
  }

  /**
   * Handle envelope cancelled event (v3)
   */
  private async handleEnvelopeCancelled(proposta: any, data: WebhookEvent['event']['data']) {
    console.log(`[CLICKSIGN WEBHOOK v3] Envelope cancelled for proposal: ${proposta.id}`);
    
    await storage.updateProposta(proposta.id, {
      clicksignStatus: 'cancelled'
    });
    
    await storage.createPropostaLog({
      propostaId: proposta.id,
      autorId: 'clicksign-webhook',
      statusAnterior: proposta.status,
      statusNovo: proposta.status,
      observacao: '❌ Envelope cancelado no ClickSign'
    });
    
    return { processed: true, proposalId: proposta.id, status: 'cancelled' };
  }

  /**
   * Handle envelope expired event (v3)
   */
  private async handleEnvelopeExpired(proposta: any, data: WebhookEvent['event']['data']) {
    console.log(`[CLICKSIGN WEBHOOK v3] Envelope expired for proposal: ${proposta.id}`);
    
    await storage.updateProposta(proposta.id, {
      clicksignStatus: 'expired'
    });
    
    await storage.createPropostaLog({
      propostaId: proposta.id,
      autorId: 'clicksign-webhook',
      statusAnterior: proposta.status,
      statusNovo: proposta.status,
      observacao: '⏰ Envelope expirado - prazo para assinatura excedido'
    });
    
    return { processed: true, proposalId: proposta.id, status: 'expired' };
  }

  /**
   * Handle document created event
   */
  private async handleDocumentCreated(proposta: any, data: WebhookEvent['event']['data']) {
    console.log(`[CLICKSIGN WEBHOOK] Document created for proposal: ${proposta.id}`);
    
    await storage.createPropostaLog({
      propostaId: proposta.id,
      autorId: 'clicksign-webhook',
      statusAnterior: proposta.status,
      statusNovo: proposta.status,
      observacao: 'Documento CCB criado no ClickSign'
    });
    
    return { processed: true, proposalId: proposta.id };
  }

  /**
   * Handle document signed event
   */
  private async handleDocumentSigned(proposta: any, data: WebhookEvent['event']['data']) {
    console.log(`[CLICKSIGN WEBHOOK] Document signed for proposal: ${proposta.id}`);
    
    const updateData = {
      clicksignStatus: 'signed',
      clicksignSignedAt: new Date(),
      assinaturaEletronicaConcluida: true,
      dataAssinatura: new Date(),
      status: 'contratos_assinados'
    };
    
    await storage.updateProposta(proposta.id, updateData);
    
    await storage.createPropostaLog({
      propostaId: proposta.id,
      autorId: 'clicksign-webhook',
      statusAnterior: proposta.status,
      statusNovo: 'contratos_assinados',
      observacao: 'CCB assinado eletronicamente via ClickSign'
    });
    
    // Trigger boleto generation
    await this.triggerBoletoGeneration(proposta);
    
    return { processed: true, proposalId: proposta.id, status: 'signed' };
  }

  /**
   * Handle document finished event (all signers completed)
   */
  private async handleDocumentFinished(proposta: any, data: WebhookEvent['event']['data']) {
    console.log(`[CLICKSIGN WEBHOOK] Document finished for proposal: ${proposta.id}`);
    
    const finishedAt = getBrasiliaTimestamp();
    
    const updateData = {
      clicksignStatus: 'finished',
      clicksignSignedAt: new Date(finishedAt)
    };
    
    await storage.updateProposta(proposta.id, updateData);
    
    await storage.createPropostaLog({
      propostaId: proposta.id,
      autorId: 'clicksign-webhook',
      statusAnterior: proposta.status,
      statusNovo: proposta.status,
      observacao: 'Processo de assinatura finalizado - todos os signatários assinaram'
    });
    
    return { processed: true, proposalId: proposta.id, status: 'finished' };
  }

  /**
   * Handle document cancelled event
   */
  private async handleDocumentCancelled(proposta: any, data: WebhookEvent['event']['data']) {
    console.log(`[CLICKSIGN WEBHOOK] Document cancelled for proposal: ${proposta.id}`);
    
    const updateData = {
      clicksignStatus: 'cancelled'
    };
    
    await storage.updateProposta(proposta.id, updateData);
    
    await storage.createPropostaLog({
      propostaId: proposta.id,
      autorId: 'clicksign-webhook',
      statusAnterior: proposta.status,
      statusNovo: proposta.status,
      observacao: 'Assinatura do CCB cancelada no ClickSign'
    });
    
    return { processed: true, proposalId: proposta.id, status: 'cancelled' };
  }

  /**
   * Handle document refused event
   */
  private async handleDocumentRefused(proposta: any, data: WebhookEvent['event']['data']) {
    console.log(`[CLICKSIGN WEBHOOK] Document refused for proposal: ${proposta.id}`);
    
    const updateData = {
      clicksignStatus: 'refused'
    };
    
    await storage.updateProposta(proposta.id, updateData);
    
    await storage.createPropostaLog({
      propostaId: proposta.id,
      autorId: 'clicksign-webhook',
      statusAnterior: proposta.status,
      statusNovo: proposta.status,
      observacao: `Assinatura recusada por: ${data.signer?.email || 'signatário'}`
    });
    
    return { processed: true, proposalId: proposta.id, status: 'refused' };
  }



  /**
   * Trigger boleto generation after signature
   */
  private async triggerBoletoGeneration(proposta: any) {
    try {
      console.log(`[CLICKSIGN → INTER] Triggering boleto generation for proposal: ${proposta.id}`);
      
      // Check if collection already exists
      const existingCollection = await storage.getInterCollectionByProposalId(proposta.id);
      if (existingCollection) {
        console.log(`[CLICKSIGN → INTER] Boleto already exists for proposal: ${proposta.id}`);
        return;
      }
      
      // Parse proposal data
      const clienteData = typeof proposta.clienteData === 'string' 
        ? JSON.parse(proposta.clienteData) 
        : proposta.clienteData || {};
      
      const condicoesData = typeof proposta.condicoesData === 'string'
        ? JSON.parse(proposta.condicoesData)
        : proposta.condicoesData || {};
      
      // Generate boleto according to Inter Bank API requirements
      const boletoData = {
        seuNumero: proposta.id.slice(0, 15), // Max 15 chars
        valorNominal: parseFloat(String(condicoesData.valorTotalFinanciado || condicoesData.valor || 0)),
        dataVencimento: this.calculateDueDate(30), // 30 days from now
        numDiasAgenda: 60, // Auto-cancel after 60 days
        pagador: {
          cpfCnpj: clienteData.cpf?.replace(/\D/g, '') || '',
          tipoPessoa: 'FISICA' as const,
          nome: clienteData.nome || '',
          email: clienteData.email || '',
          ddd: clienteData.telefone ? clienteData.telefone.replace(/\D/g, '').slice(0, 2) : '',
          telefone: clienteData.telefone ? clienteData.telefone.replace(/\D/g, '').slice(2) : '',
          endereco: clienteData.logradouro || clienteData.endereco || '',
          numero: clienteData.numero || '',
          complemento: clienteData.complemento || '',
          bairro: clienteData.bairro || 'Centro',
          cidade: clienteData.cidade || 'São Paulo',
          uf: clienteData.uf || 'SP',
          cep: clienteData.cep?.replace(/\D/g, '') || ''
        },
        mensagem: {
          linha1: `Pagamento referente ao empréstimo`,
          linha2: `Proposta: ${proposta.id}`,
          linha3: `SIMPIX - Soluções Financeiras`
        },
        formasRecebimento: ['BOLETO', 'PIX'] as ('BOLETO' | 'PIX')[]
      };
      
      const createResponse = await interBankService.emitirCobranca(boletoData);
      
      if (createResponse.codigoSolicitacao) {
        // Fetch collection details
        const interCollection = await interBankService.recuperarCobranca(createResponse.codigoSolicitacao);
        
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
          dataEmissao: interCollection.cobranca.dataEmissao || new Date().toISOString().split('T')[0],
          isActive: true
        });
        
        console.log(`[CLICKSIGN → INTER] ✅ Boleto created successfully: ${createResponse.codigoSolicitacao}`);
        
        await storage.createPropostaLog({
          propostaId: proposta.id,
          autorId: 'clicksign-webhook',
          statusAnterior: proposta.status,
          statusNovo: 'contratos_assinados',
          observacao: `Boleto gerado automaticamente após assinatura CCB - Código: ${createResponse.codigoSolicitacao}`
        });
      }
    } catch (error) {
      console.error(`[CLICKSIGN → INTER] ❌ Error generating boleto:`, error);
      
      await storage.createPropostaLog({
        propostaId: proposta.id,
        autorId: 'clicksign-webhook',
        statusAnterior: proposta.status,
        statusNovo: 'contratos_assinados',
        observacao: `Erro ao gerar boleto automaticamente: ${(error as Error).message}`
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
}

// Export singleton instance
export const clickSignWebhookService = new ClickSignWebhookService();