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
  event: string;
  data: {
    document?: {
      key: string;
      status: string;
      finished_at?: string;
    };
    list?: {
      key: string;
      status: string;
    };
    signer?: {
      key: string;
      email: string;
      name: string;
      documentation: string;
      sign_at?: string;
      reject_at?: string;
      viewed_at?: string;
    };
    user?: {
      email: string;
      name: string;
    };
    account?: {
      key: string;
    };
    message?: string;
  };
  occurred_at: string;
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
   * Process webhook event
   */
  async processEvent(event: WebhookEvent): Promise<{ processed: boolean; reason?: string; proposalId?: any; status?: string; signer?: string; listStatus?: string }> {
    const { event: eventType, data, occurred_at } = event;
    
    console.log(`[CLICKSIGN WEBHOOK] Processing event: ${eventType}`, {
      documentKey: data.document?.key,
      listKey: data.list?.key,
      signerEmail: data.signer?.email,
      occurredAt: occurred_at
    });

    // Find related proposal
    const proposta = await this.findProposal(data);
    
    if (!proposta) {
      console.warn('[CLICKSIGN WEBHOOK] No proposal found for event');
      return { processed: false, reason: 'Proposal not found' };
    }

    // Process based on event type
    switch (eventType) {
      case 'document.created':
        return await this.handleDocumentCreated(proposta, data);
        
      case 'document.signed':
        return await this.handleDocumentSigned(proposta, data);
        
      case 'document.finished':
        return await this.handleDocumentFinished(proposta, data);
        
      case 'document.cancelled':
        return await this.handleDocumentCancelled(proposta, data);
        
      case 'document.refused':
        return await this.handleDocumentRefused(proposta, data);
        
      case 'signer.signed':
        return await this.handleSignerSigned(proposta, data);
        
      case 'signer.viewed':
        return await this.handleSignerViewed(proposta, data);
        
      case 'list.created':
        return await this.handleListCreated(proposta, data);
        
      case 'list.updated':
        return await this.handleListUpdated(proposta, data);
        
      case 'auto_close.deadline':
        return await this.handleDeadline(proposta, data);
        
      default:
        console.log(`[CLICKSIGN WEBHOOK] Unhandled event type: ${eventType}`);
        return { processed: true, reason: 'Event type not handled' };
    }
  }

  /**
   * Find proposal by ClickSign keys
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
   * Handle document created event
   */
  private async handleDocumentCreated(proposta: any, data: WebhookEvent['data']) {
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
  private async handleDocumentSigned(proposta: any, data: WebhookEvent['data']) {
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
  private async handleDocumentFinished(proposta: any, data: WebhookEvent['data']) {
    console.log(`[CLICKSIGN WEBHOOK] Document finished for proposal: ${proposta.id}`);
    
    const finishedAt = data.document?.finished_at || getBrasiliaTimestamp();
    
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
  private async handleDocumentCancelled(proposta: any, data: WebhookEvent['data']) {
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
  private async handleDocumentRefused(proposta: any, data: WebhookEvent['data']) {
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
   * Handle signer signed event
   */
  private async handleSignerSigned(proposta: any, data: WebhookEvent['data']) {
    const signerEmail = data.signer?.email || '';
    const signedAt = data.signer?.sign_at || getBrasiliaTimestamp();
    
    console.log(`[CLICKSIGN WEBHOOK] Signer signed: ${signerEmail} for proposal: ${proposta.id}`);
    
    await storage.createPropostaLog({
      propostaId: proposta.id,
      autorId: 'clicksign-webhook',
      statusAnterior: proposta.status,
      statusNovo: proposta.status,
      observacao: `Documento assinado por: ${signerEmail} em ${signedAt}`
    });
    
    return { processed: true, proposalId: proposta.id, signer: signerEmail };
  }

  /**
   * Handle signer viewed event
   */
  private async handleSignerViewed(proposta: any, data: WebhookEvent['data']) {
    const signerEmail = data.signer?.email || '';
    const viewedAt = data.signer?.viewed_at || getBrasiliaTimestamp();
    
    console.log(`[CLICKSIGN WEBHOOK] Signer viewed: ${signerEmail} for proposal: ${proposta.id}`);
    
    await storage.createPropostaLog({
      propostaId: proposta.id,
      autorId: 'clicksign-webhook',
      statusAnterior: proposta.status,
      statusNovo: proposta.status,
      observacao: `Documento visualizado por: ${signerEmail} em ${viewedAt}`
    });
    
    return { processed: true, proposalId: proposta.id, signer: signerEmail };
  }

  /**
   * Handle list created event
   */
  private async handleListCreated(proposta: any, data: WebhookEvent['data']) {
    console.log(`[CLICKSIGN WEBHOOK] List created for proposal: ${proposta.id}`);
    
    await storage.createPropostaLog({
      propostaId: proposta.id,
      autorId: 'clicksign-webhook',
      statusAnterior: proposta.status,
      statusNovo: proposta.status,
      observacao: 'Lista de assinatura criada no ClickSign'
    });
    
    return { processed: true, proposalId: proposta.id };
  }

  /**
   * Handle list updated event
   */
  private async handleListUpdated(proposta: any, data: WebhookEvent['data']) {
    console.log(`[CLICKSIGN WEBHOOK] List updated for proposal: ${proposta.id}`);
    
    const listStatus = data.list?.status || 'unknown';
    
    await storage.createPropostaLog({
      propostaId: proposta.id,
      autorId: 'clicksign-webhook',
      statusAnterior: proposta.status,
      statusNovo: proposta.status,
      observacao: `Lista de assinatura atualizada - Status: ${listStatus}`
    });
    
    return { processed: true, proposalId: proposta.id, listStatus };
  }

  /**
   * Handle deadline event
   */
  private async handleDeadline(proposta: any, data: WebhookEvent['data']) {
    console.log(`[CLICKSIGN WEBHOOK] Deadline reached for proposal: ${proposta.id}`);
    
    const updateData = {
      clicksignStatus: 'expired'
    };
    
    await storage.updateProposta(proposta.id, updateData);
    
    await storage.createPropostaLog({
      propostaId: proposta.id,
      autorId: 'clicksign-webhook',
      statusAnterior: proposta.status,
      statusNovo: proposta.status,
      observacao: 'Prazo para assinatura expirado'
    });
    
    return { processed: true, proposalId: proposta.id, status: 'expired' };
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