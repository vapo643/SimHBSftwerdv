/**
 * ClickSign API v3 Service
 * Complete implementation using Envelope API
 * 
 * This is the definitive implementation following official documentation
 * API v3 uses Envelopes instead of Lists for better control
 */

import { getBrasiliaTimestamp } from '../lib/timezone.js';

interface ClickSignV3Config {
  apiUrl: string;
  apiToken: string;
  environment: 'sandbox' | 'production';
}

interface EnvelopeData {
  name: string;
  locale?: string;
  auto_close?: boolean;
  deadline_at?: string;
  sequence_enabled?: boolean;
  block_after_refusal?: boolean;
}

interface DocumentData {
  type: 'upload' | 'template';
  content?: string; // base64 for upload
  filename?: string;
  template_id?: string; // for template type
}

interface SignerData {
  name: string;
  email: string;
  phone: string;
  documentation: string; // CPF/CNPJ
  birthday?: string;
  company?: string;
}

interface EnvelopeSignerData {
  signer_id: string;
  sign_as: 'party' | 'witness' | 'approver';
  refusable?: boolean;
  message?: string;
  group?: number;
}

interface RequirementData {
  type: 'selfie' | 'pix' | 'document' | 'certificate';
  signer_id: string;
}

interface WebhookData {
  url: string;
  events: string[];
}

interface ClickSignV3Response<T> {
  data: T;
  errors?: Array<{
    code: string;
    message: string;
    field?: string;
  }>;
}

class ClickSignServiceV3 {
  private config: ClickSignV3Config;
  private rateLimitRemaining: number = 300;
  private rateLimitReset: Date = new Date();

  constructor() {
    this.config = {
      apiUrl: process.env.NODE_ENV === 'production' 
        ? 'https://app.clicksign.com/api/v3'
        : 'https://sandbox.clicksign.com/api/v3',
      apiToken: process.env.CLICKSIGN_API_TOKEN || '',
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
    };

    if (!this.config.apiToken) {
      console.warn('[CLICKSIGN V3] ⚠️ API token not configured');
    }

    console.log(`[CLICKSIGN V3] 🚀 Initialized in ${this.config.environment} mode`);
  }

  /**
   * Make authenticated request to ClickSign API
   */
  private async makeRequest<T>(
    method: string,
    endpoint: string,
    body?: any
  ): Promise<ClickSignV3Response<T>> {
    // Check rate limit
    if (this.rateLimitRemaining <= 0 && new Date() < this.rateLimitReset) {
      const waitTime = this.rateLimitReset.getTime() - Date.now();
      console.log(`[CLICKSIGN V3] ⚠️ Rate limit reached. Waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    const url = `${this.config.apiUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${this.config.apiToken}`
    };

    console.log(`[CLICKSIGN V3] 📡 ${method} ${endpoint}`);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });

      // Update rate limit info
      const rateLimitHeader = response.headers.get('X-RateLimit-Remaining');
      const rateLimitResetHeader = response.headers.get('X-RateLimit-Reset');
      
      if (rateLimitHeader) {
        this.rateLimitRemaining = parseInt(rateLimitHeader);
      }
      if (rateLimitResetHeader) {
        this.rateLimitReset = new Date(parseInt(rateLimitResetHeader) * 1000);
      }

      const data = await response.json();

      if (!response.ok) {
        console.error(`[CLICKSIGN V3] ❌ Error ${response.status}:`, data);
        throw new Error(data.errors?.[0]?.message || `API error: ${response.status}`);
      }

      return { data };
    } catch (error) {
      console.error(`[CLICKSIGN V3] ❌ Request failed:`, error);
      throw error;
    }
  }

  /**
   * Create a new envelope
   */
  async createEnvelope(envelopeData: EnvelopeData) {
    const response = await this.makeRequest<any>('POST', '/envelopes', {
      envelope: envelopeData
    });

    console.log(`[CLICKSIGN V3] ✅ Envelope created: ${response.data.id}`);
    return response.data;
  }

  /**
   * Add document to envelope
   */
  async addDocumentToEnvelope(envelopeId: string, documentData: DocumentData) {
    const response = await this.makeRequest<any>(
      'POST',
      `/envelopes/${envelopeId}/documents`,
      { document: documentData }
    );

    console.log(`[CLICKSIGN V3] ✅ Document added to envelope: ${response.data.id}`);
    return response.data;
  }

  /**
   * Create a signer
   */
  async createSigner(signerData: SignerData) {
    const response = await this.makeRequest<any>('POST', '/signers', {
      signer: signerData
    });

    console.log(`[CLICKSIGN V3] ✅ Signer created: ${response.data.id}`);
    return response.data;
  }

  /**
   * Add signer to envelope
   */
  async addSignerToEnvelope(envelopeId: string, signerData: EnvelopeSignerData) {
    const response = await this.makeRequest<any>(
      'POST',
      `/envelopes/${envelopeId}/signers`,
      signerData
    );

    console.log(`[CLICKSIGN V3] ✅ Signer added to envelope`);
    return response.data;
  }

  /**
   * Add requirement to envelope
   */
  async addRequirement(envelopeId: string, requirementData: RequirementData) {
    const response = await this.makeRequest<any>(
      'POST',
      `/envelopes/${envelopeId}/requirements`,
      { requirement: requirementData }
    );

    console.log(`[CLICKSIGN V3] ✅ Requirement added: ${requirementData.type}`);
    return response.data;
  }

  /**
   * Finish envelope (send for signature)
   */
  async finishEnvelope(envelopeId: string) {
    const response = await this.makeRequest<any>(
      'POST',
      `/envelopes/${envelopeId}/finish`,
      {}
    );

    console.log(`[CLICKSIGN V3] ✅ Envelope finished and sent for signature`);
    return response.data;
  }

  /**
   * Get envelope status
   */
  async getEnvelopeStatus(envelopeId: string) {
    const response = await this.makeRequest<any>('GET', `/envelopes/${envelopeId}`);
    return response.data;
  }

  /**
   * Cancel envelope
   */
  async cancelEnvelope(envelopeId: string) {
    const response = await this.makeRequest<any>(
      'POST',
      `/envelopes/${envelopeId}/cancel`,
      {}
    );

    console.log(`[CLICKSIGN V3] ✅ Envelope cancelled`);
    return response.data;
  }

  /**
   * Download signed document
   */
  async downloadDocument(envelopeId: string, documentId: string) {
    const response = await this.makeRequest<any>(
      'GET',
      `/envelopes/${envelopeId}/documents/${documentId}/download`
    );
    return response.data;
  }

  /**
   * Configure webhook
   */
  async configureWebhook(webhookData: WebhookData) {
    const response = await this.makeRequest<any>('POST', '/webhooks', {
      webhook: webhookData
    });

    console.log(`[CLICKSIGN V3] ✅ Webhook configured`);
    return response.data;
  }

  /**
   * Send WhatsApp notification
   */
  async sendWhatsAppNotification(
    envelopeId: string,
    signerId: string,
    phone: string,
    message?: string
  ) {
    const response = await this.makeRequest<any>(
      'POST',
      `/envelopes/${envelopeId}/signers/${signerId}/whatsapp`,
      { phone, message }
    );

    console.log(`[CLICKSIGN V3] ✅ WhatsApp notification sent`);
    return response.data;
  }

  /**
   * Complete flow: Create and send CCB for signature
   */
  async sendCCBForSignature(
    proposalId: string,
    pdfBase64: string,
    clientData: {
      name: string;
      email: string;
      cpf: string;
      phone: string;
      birthday?: string;
    }
  ) {
    try {
      console.log(`[CLICKSIGN V3] 🚀 Starting CCB signature flow for proposal: ${proposalId}`);

      // 1. Create envelope
      const envelope = await this.createEnvelope({
        name: `CCB - Proposta ${proposalId}`,
        locale: 'pt-BR',
        auto_close: true,
        deadline_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        sequence_enabled: false,
        block_after_refusal: true
      });

      // 2. Add document
      const document = await this.addDocumentToEnvelope(envelope.id, {
        type: 'upload',
        content: pdfBase64,
        filename: `ccb_proposta_${proposalId}.pdf`
      });

      // 3. Create signer
      const signer = await this.createSigner({
        name: clientData.name,
        email: clientData.email,
        phone: clientData.phone,
        documentation: clientData.cpf.replace(/\D/g, ''),
        birthday: clientData.birthday
      });

      // 4. Add signer to envelope
      await this.addSignerToEnvelope(envelope.id, {
        signer_id: signer.id,
        sign_as: 'party',
        refusable: false,
        message: 'Por favor, assine o Contrato de Crédito Bancário (CCB) do seu empréstimo.'
      });

      // 5. Add selfie requirement for security
      await this.addRequirement(envelope.id, {
        type: 'selfie',
        signer_id: signer.id
      });

      // 6. Finish envelope
      const finishedEnvelope = await this.finishEnvelope(envelope.id);

      // 7. Get sign URL
      const signUrl = `${this.config.apiUrl.replace('/api/v3', '')}/sign/${signer.request_signature_key}`;

      console.log(`[CLICKSIGN V3] ✅ CCB sent for signature successfully`);

      return {
        envelopeId: envelope.id,
        documentId: document.id,
        signerId: signer.id,
        signUrl,
        requestSignatureKey: signer.request_signature_key,
        status: 'sent'
      };

    } catch (error) {
      console.error(`[CLICKSIGN V3] ❌ Failed to send CCB for signature:`, error);
      throw error;
    }
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('GET', '/envelopes?limit=1');
      console.log(`[CLICKSIGN V3] ✅ Connection test successful`);
      return true;
    } catch (error) {
      console.error(`[CLICKSIGN V3] ❌ Connection test failed:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const clickSignServiceV3 = new ClickSignServiceV3();