/**
 * ClickSign API v3 Service
 * Complete implementation using Envelope API
 * 
 * This is the definitive implementation following official documentation
 * API v3 uses Envelopes instead of Lists for better control
 */

import { getBrasiliaTimestamp } from '../lib/timezone.js';
import { clickSignSecurityService } from './clickSignSecurityService.js';
import { cpf } from 'cpf-cnpj-validator';

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
  block_after_refusal?: boolean;
  documents?: Array<{
    filename: string;
    content_base64: string;
  }>; // For atomic document creation
}

interface DocumentData {
  content?: string; // base64 with Data URI format  
  content_base64?: string; // base64 with Data URI format (for atomic creation)
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
    // ALWAYS use production ClickSign API for valid legal signatures
    // NOTE: ClickSign uses v2 for their Envelope API, not v3
    this.config = {
      apiUrl: 'https://app.clicksign.com/api/v2',
      apiToken: process.env.CLICKSIGN_API_TOKEN || '',
      environment: 'production'
    };

    if (!this.config.apiToken) {
      console.error('[CLICKSIGN V2] ❌ ERROR: API token not configured! Check CLICKSIGN_API_TOKEN environment variable');
      throw new Error('ClickSign API token is required but not configured');
    }

    console.log(`[CLICKSIGN V2] 🚀 Initialized in PRODUCTION mode (legal signatures)`);
    console.log(`[CLICKSIGN V2] API URL: ${this.config.apiUrl}`);
    console.log(`[CLICKSIGN V2] Token configured: ${this.config.apiToken.substring(0, 10)}...`);
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
      console.log(`[CLICKSIGN V2] ⚠️ Rate limit reached. Waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    const url = `${this.config.apiUrl}${endpoint}`;
    // Use simple JSON for all endpoints per ClickSign documentation
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': this.config.apiToken
    };

    console.log(`[CLICKSIGN V2] 🌐 Full URL: ${url}`);
    console.log(`[CLICKSIGN V2] 📡 ${method} ${endpoint}`);
    console.log(`[CLICKSIGN V2] Headers:`, { 
      'Content-Type': headers['Content-Type'],
      'Accept': headers['Accept'],
      'Authorization': `${this.config.apiToken.substring(0, 10)}...`
    });

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

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      console.log(`[CLICKSIGN V2] Response content-type: ${contentType}`);
      
      let data;
      if (contentType?.includes('application/json') || contentType?.includes('application/vnd.api+json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error(`[CLICKSIGN V2] ❌ Non-JSON response received!`);
        console.error(`[CLICKSIGN V2] Response status: ${response.status}`);
        console.error(`[CLICKSIGN V2] Response text (first 500 chars): ${text.substring(0, 500)}`);
        throw new Error(`Expected JSON but received ${contentType}. Status: ${response.status}. This usually means the endpoint doesn't exist.`);
      }

      if (!response.ok) {
        console.error(`[CLICKSIGN V2] ❌ Error ${response.status}:`, data);
        console.error(`[CLICKSIGN V2] ❌ Full error details:`, {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: data
        });
        throw new Error(data.errors?.[0]?.detail || data.errors?.[0]?.message || `API error: ${response.status}`);
      }

      return { data };
    } catch (error) {
      console.error(`[CLICKSIGN V2] ❌ Request failed:`, error);
      throw error;
    }
  }

  /**
   * Helper function to ensure correct Data URI format
   */
  private formatBase64ToDataURI(base64Content: string): string {
    const prefix = 'data:application/pdf;base64,';

    if (base64Content.startsWith(prefix)) {
      return base64Content; // Already correct
    }

    // If has another 'data:' prefix, remove it before adding the correct one
    if (base64Content.startsWith('data:')) {
      const parts = base64Content.split(',');
      if (parts.length === 2) {
        return `${prefix}${parts[1]}`;
      }
    }
    
    // Add prefix if it's pure Base64
    return `${prefix}${base64Content}`;
  }

  /**
   * Sanitize and validate CPF
   */
  private sanitizeAndValidateCPF(rawCpf: string): string {
    // Sanitize: Remove all non-numeric characters
    const cleanCpf = rawCpf.replace(/\D/g, '');
    
    console.log(`[CLICKSIGN V2] 🧹 CPF sanitization: ${rawCpf} → ${cleanCpf}`);
    
    // Validate using the library
    if (!cpf.isValid(cleanCpf)) {
      console.error(`[CLICKSIGN V2] ❌ Invalid CPF: ${cleanCpf}`);
      throw new Error('CPF do cliente é inválido. Operação abortada em ambiente de Produção.');
    }
    
    console.log(`[CLICKSIGN V2] ✅ CPF validation passed: ${cleanCpf}`);
    return cleanCpf;
  }

  /**
   * Create a new envelope (supports atomic document creation)
   */
  async createEnvelope(envelopeData: EnvelopeData) {
    const isAtomic = envelopeData.documents && envelopeData.documents.length > 0;
    console.log(`[CLICKSIGN V2] 🔨 Creating envelope ${isAtomic ? 'with documents (ATOMIC)' : '(empty)'}`);
    console.log(`[CLICKSIGN V2] Envelope data:`, envelopeData);
    
    // Use simple JSON format from documentation
    const requestBody = {
      envelope: envelopeData
    };
    
    console.log(`[CLICKSIGN V2] 🔨 Request body:`, JSON.stringify(requestBody, null, 2));
    
    const response = await this.makeRequest<any>('POST', '/envelopes', requestBody);
    
    console.log(`[CLICKSIGN V2] 📦 Envelope response:`, JSON.stringify(response, null, 2));
    
    const envelope = response.data?.envelope || response.data;
    console.log(`[CLICKSIGN V2] ✅ Envelope created: ${envelope.id}`);
    
    return envelope;
  }

  /**
   * Add document to envelope
   */
  async addDocumentToEnvelope(envelopeId: string, documentData: DocumentData) {
    console.log(`[CLICKSIGN V2] 🔨 Adding document to envelope ${envelopeId}`);
    console.log(`[CLICKSIGN V2] Document data:`, documentData);
    
    // Use simple JSON format from documentation
    const requestBody = {
      document: {
        type: 'upload',
        content: documentData.content_base64 || documentData.content,
        filename: documentData.filename
      }
    };
    
    console.log(`[CLICKSIGN V2] Request body being sent:`, JSON.stringify(requestBody, null, 2));
    
    const response = await this.makeRequest<any>(
      'POST',
      `/envelopes/${envelopeId}/documents`,
      requestBody
    );

    console.log(`[CLICKSIGN V2] 📦 Document response:`, JSON.stringify(response, null, 2));
    
    const document = response.data?.document || response.data;
    console.log(`[CLICKSIGN V2] ✅ Document added to envelope: ${document.id}`);
    
    return document;
  }

  /**
   * STEP 1: Create signer globally (correct v3 flow)
   */
  async createSignerGlobally(signerData: SignerData) {
    console.log(`[CLICKSIGN V2] 🚀 STEP 1: Creating signer globally`);
    console.log(`[CLICKSIGN V2] Signer data:`, {
      name: signerData.name,
      email: signerData.email,
      documentation: signerData.documentation
    });
    
    // Use simple JSON format from documentation, NOT JSON:API format
    const requestBody = {
      signer: {
        name: signerData.name,
        email: signerData.email,
        phone: signerData.phone,
        documentation: signerData.documentation,
        ...(signerData.birthday && { birthday: signerData.birthday })
      }
    };

    console.log(`[CLICKSIGN V2] 📡 POST /signers (global endpoint)`);
    console.log(`[CLICKSIGN V2] Request body:`, JSON.stringify(requestBody, null, 2));

    const response = await this.makeRequest<any>(
      'POST',
      '/signers',
      requestBody
    );

    const signer = response.data?.signer || response.data;
    console.log(`[CLICKSIGN V2] ✅ STEP 1 COMPLETE: Signer created with ID: ${signer.id}`);
    console.log(`[CLICKSIGN V2] Signer response:`, JSON.stringify(signer, null, 2));
    
    return signer;
  }

  /**
   * Legacy method for backwards compatibility
   */
  async createSigner(signerData: SignerData) {
    return this.createSignerGlobally(signerData);
  }

  /**
   * STEP 2: Add signer to envelope using the proper endpoint
   */
  async addSignerToEnvelopeV3(envelopeId: string, signerId: string, signAs: 'party' | 'witness' | 'approver' = 'party') {
    console.log(`[CLICKSIGN V2] 🚀 STEP 2: Adding signer to envelope`);
    console.log(`[CLICKSIGN V2] Envelope ID: ${envelopeId}, Signer ID: ${signerId}, Sign as: ${signAs}`);
    
    const requestBody = {
      signer_id: signerId,
      sign_as: signAs,
      refusable: false,
      message: 'Por favor, assine o Contrato de Crédito Bancário (CCB) do seu empréstimo.'
    };

    console.log(`[CLICKSIGN V2] 📡 POST /envelopes/${envelopeId}/signers`);
    console.log(`[CLICKSIGN V2] Request body:`, JSON.stringify(requestBody, null, 2));

    const response = await this.makeRequest<any>(
      'POST',
      `/envelopes/${envelopeId}/signers`,
      requestBody
    );

    console.log(`[CLICKSIGN V2] ✅ STEP 2 COMPLETE: Signer added to envelope`);
    console.log(`[CLICKSIGN V2] Response:`, JSON.stringify(response, null, 2));
    return response.data;
  }

  /**
   * Legacy method - DO NOT USE (kept for backwards compatibility during migration)
   */
  async addSignerToEnvelope(envelopeId: string, signerData: EnvelopeSignerData, fullSignerData?: SignerData) {
    console.log(`[CLICKSIGN V2] ⚠️ WARNING: Using deprecated method addSignerToEnvelope`);
    console.log(`[CLICKSIGN V2] This method uses the unstable /envelopes/{id}/signers endpoint`);
    console.log(`[CLICKSIGN V2] Please use createSignerGlobally + createRequirementForSigner instead`);
    
    // For now, throw an error to force migration
    throw new Error('addSignerToEnvelope is deprecated. Use the 2-step flow: createSignerGlobally + createRequirementForSigner');
  }

  /**
   * Add requirement to envelope
   */
  async addRequirement(envelopeId: string, requirementData: RequirementData) {
    console.log(`[CLICKSIGN V2] 🔨 Adding requirement to envelope ${envelopeId}`);
    
    // Use correct JSON API format
    const requestBody = {
      data: {
        type: 'requirements',
        attributes: requirementData
      }
    };

    const response = await this.makeRequest<any>(
      'POST',
      `/envelopes/${envelopeId}/requirements`,
      requestBody
    );

    console.log(`[CLICKSIGN V2] ✅ Requirement added: ${requirementData.type}`);
    return response.data?.data || response.data;
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

    console.log(`[CLICKSIGN V2] ✅ Envelope finished and sent for signature`);
    return response.data?.data || response.data;
  }

  /**
   * Get envelope status
   */
  async getEnvelopeStatus(envelopeId: string) {
    const response = await this.makeRequest<any>('GET', `/envelopes/${envelopeId}`);
    return response.data?.data || response.data;
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

    console.log(`[CLICKSIGN V2] ✅ Envelope cancelled`);
    return response.data?.data || response.data;
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

    console.log(`[CLICKSIGN V2] ✅ Webhook configured`);
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

    console.log(`[CLICKSIGN V2] ✅ WhatsApp notification sent`);
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
      // Validate and sanitize client data
      const validatedClientData = clickSignSecurityService.validateClientData(clientData);
      
      // Create audit log for signature request
      const auditLog = clickSignSecurityService.createAuditLog(
        'CLICKSIGN_V3_SEND_CCB',
        { proposalId, clientEmail: validatedClientData.email }
      );
      console.log('[CLICKSIGN V3 AUDIT]', auditLog);

      console.log(`[CLICKSIGN V3 - ATOMIC] 🚀 Starting atomic CCB signature flow for proposal: ${proposalId}`);

      // 1. Ensure correct Data URI format
      const dataUriContent = this.formatBase64ToDataURI(pdfBase64);

      // 2. Create envelope (empty - API doesn't allow documents field)
      const envelope = await this.createEnvelope({
        name: `CCB - Proposta ${proposalId}`,
        locale: 'pt-BR',
        auto_close: true,
        deadline_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        block_after_refusal: true
      });

      console.log(`[CLICKSIGN V2] ✅ Envelope created: ${envelope.id}`);

      // 3. Add document with CORRECT field name
      const document = await this.addDocumentToEnvelope(envelope.id, {
        content_base64: dataUriContent, // Using content_base64 instead of content
        filename: `ccb_proposta_${proposalId}.pdf`
      });

      console.log(`[CLICKSIGN V2] ✅ Document added: ${document.id}`);

      // 4. Validate and sanitize CPF before proceeding
      console.log(`[CLICKSIGN V2] Validating CPF for client: ${clientData.name}`);
      const validatedCpf = this.sanitizeAndValidateCPF(clientData.cpf);
      
      // 5. STEP 1: Create signer globally (correct v3 flow)
      const signer = await this.createSignerGlobally({
        name: clientData.name,
        email: clientData.email,
        phone: clientData.phone,
        documentation: validatedCpf,
        birthday: clientData.birthday
      });

      console.log(`[CLICKSIGN V2] Global signer created with ID:`, signer.id);
      
      // 6. STEP 2: Add signer to envelope
      const signerEnvelope = await this.addSignerToEnvelopeV3(
        envelope.id,
        signer.id,
        'party' // Role: party (signatário)
      );
      
      console.log(`[CLICKSIGN V2] Signer added to envelope successfully`);

      // 7. Add selfie requirement for security (optional)
      // await this.addRequirement(envelope.id, {
      //   type: 'selfie',
      //   signer_id: signer.id
      // });

      // 8. Finish envelope
      const finishedEnvelope = await this.finishEnvelope(envelope.id);

      // 9. Get sign URL
      const signUrl = signerEnvelope?.request_signature_key 
        ? `${this.config.apiUrl.replace('/api/v3', '')}/sign/${signerEnvelope.request_signature_key}`
        : (signer.request_signature_key 
          ? `${this.config.apiUrl.replace('/api/v3', '')}/sign/${signer.request_signature_key}`
          : undefined);

      console.log(`[CLICKSIGN V2] ✅ CCB sent for signature successfully`);
      console.log(`[CLICKSIGN V2] Sign URL generated:`, signUrl);

      if (!signUrl) {
        console.error(`[CLICKSIGN V2] ⚠️ Warning: No request_signature_key received from API`);
      }

      // Get document ID from the addDocumentToEnvelope response
      const documentId = document.id;

      return {
        envelopeId: envelope.id,
        documentId: documentId,
        signerId: signer.id,
        signUrl: signUrl || '',
        requestSignatureKey: signer.request_signature_key || '',
        status: 'sent'
      };

    } catch (error) {
      console.error(`[CLICKSIGN V2] ❌ Failed to send CCB for signature:`, error);
      throw error;
    }
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('GET', '/envelopes?limit=1');
      console.log(`[CLICKSIGN V2] ✅ Connection test successful`);
      return true;
    } catch (error) {
      console.error(`[CLICKSIGN V2] ❌ Connection test failed:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const clickSignServiceV3 = new ClickSignServiceV3();