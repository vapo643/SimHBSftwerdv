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
    this.config = {
      apiUrl: 'https://app.clicksign.com/api/v3',
      apiToken: process.env.CLICKSIGN_API_TOKEN || '',
      environment: 'production'
    };

    if (!this.config.apiToken) {
      console.error('[CLICKSIGN V3] ❌ ERROR: API token not configured! Check CLICKSIGN_API_TOKEN environment variable');
      throw new Error('ClickSign API token is required but not configured');
    }

    console.log(`[CLICKSIGN V3] 🚀 Initialized in PRODUCTION mode (legal signatures)`);
    console.log(`[CLICKSIGN V3] API URL: ${this.config.apiUrl}`);
    console.log(`[CLICKSIGN V3] Token configured: ${this.config.apiToken.substring(0, 10)}...`);
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
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
      'Authorization': this.config.apiToken
    };

    console.log(`[CLICKSIGN V3] 📡 ${method} ${endpoint}`);
    console.log(`[CLICKSIGN V3] Headers:`, { 
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

      const data = await response.json();

      if (!response.ok) {
        console.error(`[CLICKSIGN V3] ❌ Error ${response.status}:`, data);
        console.error(`[CLICKSIGN V3] ❌ Full error details:`, {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: data
        });
        throw new Error(data.errors?.[0]?.detail || data.errors?.[0]?.message || `API error: ${response.status}`);
      }

      return { data };
    } catch (error) {
      console.error(`[CLICKSIGN V3] ❌ Request failed:`, error);
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
    
    console.log(`[CLICKSIGN V3] 🧹 CPF sanitization: ${rawCpf} → ${cleanCpf}`);
    
    // Validate using the library
    if (!cpf.isValid(cleanCpf)) {
      console.error(`[CLICKSIGN V3] ❌ Invalid CPF: ${cleanCpf}`);
      throw new Error('CPF do cliente é inválido. Operação abortada em ambiente de Produção.');
    }
    
    console.log(`[CLICKSIGN V3] ✅ CPF validation passed: ${cleanCpf}`);
    return cleanCpf;
  }

  /**
   * Create a new envelope (supports atomic document creation)
   */
  async createEnvelope(envelopeData: EnvelopeData) {
    const isAtomic = envelopeData.documents && envelopeData.documents.length > 0;
    console.log(`[CLICKSIGN V3] 🔨 Creating envelope ${isAtomic ? 'with documents (ATOMIC)' : '(empty)'}`);
    console.log(`[CLICKSIGN V3] Envelope data:`, envelopeData);
    
    // Use correct JSON API format per ClickSign documentation
    const requestBody = {
      data: {
        type: 'envelopes',
        attributes: envelopeData
      }
    };
    
    console.log(`[CLICKSIGN V3] 🔨 Request body:`, JSON.stringify(requestBody, null, 2));
    
    const response = await this.makeRequest<any>('POST', '/envelopes', requestBody);
    
    console.log(`[CLICKSIGN V3] 📦 Envelope response:`, JSON.stringify(response, null, 2));
    
    const envelopeId = response.data?.data?.id || response.data?.id;
    console.log(`[CLICKSIGN V3] ✅ Envelope created: ${envelopeId}`);
    
    return response.data?.data || response.data;
  }

  /**
   * Add document to envelope
   */
  async addDocumentToEnvelope(envelopeId: string, documentData: DocumentData) {
    console.log(`[CLICKSIGN V3] 🔨 Adding document to envelope ${envelopeId}`);
    console.log(`[CLICKSIGN V3] Document data:`, documentData);
    
    // Use correct JSON API format
    const requestBody = {
      data: {
        type: 'documents',
        attributes: documentData
      }
    };
    
    console.log(`[CLICKSIGN V3] Request body being sent:`, JSON.stringify(requestBody, null, 2));
    
    const response = await this.makeRequest<any>(
      'POST',
      `/envelopes/${envelopeId}/documents`,
      requestBody
    );

    console.log(`[CLICKSIGN V3] 📦 Document response:`, JSON.stringify(response, null, 2));
    
    const documentId = response.data?.data?.id || response.data?.id;
    console.log(`[CLICKSIGN V3] ✅ Document added to envelope: ${documentId}`);
    
    return response.data?.data || response.data;
  }

  /**
   * STEP 1: Create signer globally (correct v3 flow)
   */
  async createSignerGlobally(signerData: SignerData) {
    console.log(`[CLICKSIGN V3] 🚀 STEP 1: Creating signer globally`);
    console.log(`[CLICKSIGN V3] Signer data:`, {
      name: signerData.name,
      email: signerData.email,
      documentation: signerData.documentation
    });
    
    const requestBody = {
      data: {
        type: 'signers',
        attributes: {
          name: signerData.name,
          email: signerData.email,
          documentation: signerData.documentation,
          ...(signerData.birthday && { birthday: signerData.birthday })
        }
      }
    };

    console.log(`[CLICKSIGN V3] 📡 POST /signers (global endpoint)`);
    console.log(`[CLICKSIGN V3] Request body:`, JSON.stringify(requestBody, null, 2));

    const response = await this.makeRequest<any>(
      'POST',
      '/signers',
      requestBody
    );

    const signer = response.data?.data || response.data;
    console.log(`[CLICKSIGN V3] ✅ STEP 1 COMPLETE: Signer created with ID: ${signer.id}`);
    console.log(`[CLICKSIGN V3] Signer response:`, JSON.stringify(signer, null, 2));
    
    return signer;
  }

  /**
   * Legacy method for backwards compatibility
   */
  async createSigner(signerData: SignerData) {
    return this.createSignerGlobally(signerData);
  }

  /**
   * STEP 2: Create requirement to link signer to envelope (correct v3 flow)
   */
  async createRequirementForSigner(envelopeId: string, signerId: string, signerRole: 'party' | 'witness' | 'approver' = 'party') {
    console.log(`[CLICKSIGN V3] 🚀 STEP 2: Creating requirement to link signer to envelope`);
    console.log(`[CLICKSIGN V3] Envelope ID: ${envelopeId}, Signer ID: ${signerId}, Role: ${signerRole}`);
    
    const requestBody = {
      data: {
        type: 'requirements',
        attributes: {
          action: 'sign',
          group: 0,
          order: 0,
          refusable: false
        },
        relationships: {
          signer: {
            data: {
              type: 'signers',
              id: signerId
            }
          },
          document: {
            data: null // Will sign all documents
          }
        }
      }
    };

    console.log(`[CLICKSIGN V3] 📡 POST /envelopes/${envelopeId}/requirements`);
    console.log(`[CLICKSIGN V3] Request body:`, JSON.stringify(requestBody, null, 2));

    const response = await this.makeRequest<any>(
      'POST',
      `/envelopes/${envelopeId}/requirements`,
      requestBody
    );

    console.log(`[CLICKSIGN V3] ✅ STEP 2 COMPLETE: Requirement created`);
    console.log(`[CLICKSIGN V3] Requirement response:`, JSON.stringify(response, null, 2));
    return response.data?.data || response.data;
  }

  /**
   * Legacy method - DO NOT USE (kept for backwards compatibility during migration)
   */
  async addSignerToEnvelope(envelopeId: string, signerData: EnvelopeSignerData, fullSignerData?: SignerData) {
    console.log(`[CLICKSIGN V3] ⚠️ WARNING: Using deprecated method addSignerToEnvelope`);
    console.log(`[CLICKSIGN V3] This method uses the unstable /envelopes/{id}/signers endpoint`);
    console.log(`[CLICKSIGN V3] Please use createSignerGlobally + createRequirementForSigner instead`);
    
    // For now, throw an error to force migration
    throw new Error('addSignerToEnvelope is deprecated. Use the 2-step flow: createSignerGlobally + createRequirementForSigner');
  }

  /**
   * Add requirement to envelope
   */
  async addRequirement(envelopeId: string, requirementData: RequirementData) {
    console.log(`[CLICKSIGN V3] 🔨 Adding requirement to envelope ${envelopeId}`);
    
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

    console.log(`[CLICKSIGN V3] ✅ Requirement added: ${requirementData.type}`);
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

    console.log(`[CLICKSIGN V3] ✅ Envelope finished and sent for signature`);
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

    console.log(`[CLICKSIGN V3] ✅ Envelope cancelled`);
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

      console.log(`[CLICKSIGN V3] ✅ Envelope created: ${envelope.id}`);

      // 3. Add document with CORRECT field name
      const document = await this.addDocumentToEnvelope(envelope.id, {
        content_base64: dataUriContent, // Using content_base64 instead of content
        filename: `ccb_proposta_${proposalId}.pdf`
      });

      console.log(`[CLICKSIGN V3] ✅ Document added: ${document.id}`);

      // 4. Validate and sanitize CPF before proceeding
      console.log(`[CLICKSIGN V3] Validating CPF for client: ${clientData.name}`);
      const validatedCpf = this.sanitizeAndValidateCPF(clientData.cpf);
      
      // 5. STEP 1: Create signer globally (correct v3 flow)
      const signer = await this.createSignerGlobally({
        name: clientData.name,
        email: clientData.email,
        phone: clientData.phone,
        documentation: validatedCpf,
        birthday: clientData.birthday
      });

      console.log(`[CLICKSIGN V3] Global signer created with ID:`, signer.id);
      
      // 6. STEP 2: Create requirement to link signer to envelope
      const requirement = await this.createRequirementForSigner(
        envelope.id,
        signer.id,
        'party' // Role: party (signatário)
      );
      
      console.log(`[CLICKSIGN V3] Requirement created, signer linked to envelope`);

      // 7. Add selfie requirement for security (optional)
      // await this.addRequirement(envelope.id, {
      //   type: 'selfie',
      //   signer_id: signer.id
      // });

      // 8. Finish envelope
      const finishedEnvelope = await this.finishEnvelope(envelope.id);

      // 9. Get sign URL - we need to fetch the requirement to get the signing key
      const signUrl = requirement.attributes?.sign_link || 
        (signer.attributes?.request_signature_key 
          ? `${this.config.apiUrl.replace('/api/v3', '')}/sign/${signer.attributes.request_signature_key}`
          : undefined);

      console.log(`[CLICKSIGN V3] ✅ CCB sent for signature successfully`);
      console.log(`[CLICKSIGN V3] Sign URL generated:`, signUrl);

      if (!signUrl) {
        console.error(`[CLICKSIGN V3] ⚠️ Warning: No request_signature_key received from API`);
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