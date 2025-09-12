/**
 * ClickSign API v3 Service
 * Complete implementation using Envelope API
 *
 * This is the definitive implementation following official documentation
 * API v3 uses Envelopes instead of Lists for better control
 */

import { getBrasiliaTimestamp } from '../lib/timezone.js';
import { clickSignSecurityService } from './clickSignSecurityService.js';
import { MarcarAguardandoAssinaturaUseCase } from '../modules/proposal/application/MarcarAguardandoAssinaturaUseCase.js';
import { logInfo, logError } from '../lib/logger.js';
// Removido import do cpf-cnpj-validator

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
  useBiometricAuth?: boolean;
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
  private readonly marcarAguardandoAssinaturaUseCase?: MarcarAguardandoAssinaturaUseCase;

  constructor(marcarAguardandoAssinaturaUseCase?: MarcarAguardandoAssinaturaUseCase) {
    // ALWAYS use production ClickSign API for valid legal signatures
    // ClickSign uses API v1 with query parameter authentication
    this.config = {
      apiUrl: 'https://app.clicksign.com/api/v1',
      apiToken: process.env.CLICKSIGN_API_TOKEN || '',
      environment: 'production',
    };

    if (!this.config.apiToken) {
      console.error(
        '[CLICKSIGN V1] ❌ ERROR: API token not configured! Check CLICKSIGN_API_TOKEN environment variable'
      );
      throw new Error('ClickSign API token is required but not configured');
    }

    console.log(`[CLICKSIGN V1] 🚀 Initialized in PRODUCTION mode (legal signatures)`);
    console.log(`[CLICKSIGN V1] API URL: ${this.config.apiUrl}`);
    console.log(`[CLICKSIGN V1] Token configured: ${this.config.apiToken.substring(0, 8)}***`);
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
      console.log(`[CLICKSIGN V1] ⚠️ Rate limit reached. Waiting ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    // ClickSign uses query parameter authentication
    const url = `${this.config.apiUrl}${endpoint}?access_token=${this.config.apiToken}`;
    // Use standard JSON format for v1 API
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    console.log(`[CLICKSIGN V1] 🌐 Request: ${method} ${this.config.apiUrl}${endpoint}`);
    console.log(`[CLICKSIGN V1] 📡 ${method} ${endpoint}`);
    console.log(`[CLICKSIGN V1] Headers:`, {
      'Content-Type': headers['Content-Type'],
      Accept: headers['Accept'],
      Authorization: `${this.config.apiToken.substring(0, 10)}...`,
    });

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
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
      console.log(`[CLICKSIGN V1] Response content-type: ${contentType}`);
      console.log(`[CLICKSIGN V1] Response status: ${response.status}`);

      // Handle 202 Accepted status (common for async operations like notifications)
      if (response.status === 202) {
        console.log(`[CLICKSIGN V1] ✅ Request accepted (202) - Processing asynchronously`);
        return {
          data: { status: 'accepted', message: 'Request accepted for processing' },
        } as ClickSignV3Response<T>;
      }

      // Always try to get text first to debug
      const responseText = await response.text();

      let data;
      if (responseText.trim() === '') {
        // Empty response (common for 204 No Content or some 202 responses)
        console.log(`[CLICKSIGN V1] Empty response body for status ${response.status}`);
        data = { status: response.status };
      } else {
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error(`[CLICKSIGN V1] ❌ Failed to parse JSON response!`);
          console.error(
            `[CLICKSIGN V1] Response text (first 1000 chars): ${responseText.substring(0, 1000)}`
          );
          console.error(`[CLICKSIGN V1] Full URL was: ${url}`);
          console.error(`[CLICKSIGN V1] Status: ${response.status}`);
          throw new Error(
            `Failed to parse JSON. Status: ${response.status}. Response starts with: ${responseText.substring(0, 100)}`
          );
        }
      }

      if (!response.ok) {
        console.error(`[CLICKSIGN V1] ❌ Error ${response.status}:`, data);
        console.error(`[CLICKSIGN V1] ❌ Full error details:`, {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: data,
        });
        throw new Error(
          data.errors?.[0]?.detail || data.errors?.[0]?.message || `API error: ${response.status}`
        );
      }

      return { data };
    } catch (error) {
      console.error(`[CLICKSIGN V1] ❌ Request failed:`, error);
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
   * Sanitize CPF (validation removed per user request)
   */
  private sanitizeAndValidateCPF(rawCpf: string): string {
    // Sanitize: Remove all non-numeric characters
    const cleanCpf = rawCpf.replace(/\D/g, '');

    console.log(`[CLICKSIGN V1] 🧹 CPF sanitization: ${rawCpf} → ${cleanCpf}`);

    // Basic length check only (no validation per user request)
    if (cleanCpf.length !== 11) {
      console.error(`[CLICKSIGN V1] ❌ CPF must have 11 digits: ${cleanCpf}`);
      throw new Error('CPF deve ter 11 dígitos.');
    }

    console.log(`[CLICKSIGN V1] ✅ CPF format check passed: ${cleanCpf}`);
    return cleanCpf;
  }

  /**
   * Create a document batch (ClickSign v1 doesn't have envelopes, uses batches)
   */
  async createDocumentBatch(documentData: any) {
    console.log(`[CLICKSIGN V1] 🔨 Creating document batch`);
    console.log(
      `[CLICKSIGN V1] Document data (content_base64 length):`,
      documentData.content_base64?.length || 0
    );

    // Use simple JSON format for v1 API
    // Add MIME type prefix to base64 content
    const contentWithMimeType = `data:application/pdf;base64,${documentData.content_base64}`;

    const requestBody = {
      document: {
        path: `/propostas/${Date.now()}.pdf`,
        content_base64: contentWithMimeType,
        deadline_at: documentData.deadline_at,
        auto_close: true,
        locale: 'pt-BR',
        reminders: true,
        block_after_refusal: true,
      },
    };

    console.log(`[CLICKSIGN V1] 🔨 Request body:`, JSON.stringify(requestBody, null, 2));

    const response = await this.makeRequest<any>('POST', '/documents', requestBody);

    console.log(`[CLICKSIGN V1] 📦 Document response:`, JSON.stringify(response, null, 2));

    const document = (response as any).data?.document || (response as any).document || response;
    console.log(`[CLICKSIGN V1] ✅ Document created: ${document.key}`);

    return document;
  }

  /**
   * Add document to envelope
   */
  async addDocumentToEnvelope(envelopeId: string, documentData: DocumentData) {
    console.log(`[CLICKSIGN V1] 🔨 Adding document to envelope ${envelopeId}`);
    console.log(`[CLICKSIGN V1] Document data:`, documentData);

    // Use JSON:API format
    const requestBody = {
      data: {
        type: 'documents',
        attributes: documentData,
      },
    };

    console.log(`[CLICKSIGN V1] Request body being sent:`, JSON.stringify(requestBody, null, 2));

    const response = await this.makeRequest<any>(
      'POST',
      `/envelopes/${envelopeId}/documents`,
      requestBody
    );

    console.log(`[CLICKSIGN V1] 📦 Document response:`, JSON.stringify(response, null, 2));

    const document = response.data?.data || response.data;
    console.log(`[CLICKSIGN V1] ✅ Document added to envelope: ${document.id}`);

    return document;
  }

  /**
   * Create signer (ClickSign v1 format)
   */
  async createSigner(signerData: SignerData) {
    console.log(`[CLICKSIGN V1] 👤 Creating signer`);
    console.log(`[CLICKSIGN V1] Signer data:`, {
      name: signerData.name,
      email: signerData.email,
      documentation: signerData.documentation,
      useBiometricAuth: signerData.useBiometricAuth,
    });

    // Determine authentication methods
    // For ClickSign v1: only 'email' is valid in the auths array
    // Biometric is controlled by boolean flags, not the auths array
    const auths = ['email'];

    // Use simple JSON format for v1
    const requestBody = {
      signer: {
        name: signerData.name,
        email: signerData.email,
        phone_number: signerData.phone,
        documentation: signerData.documentation,
        ...(signerData.birthday && { birthday: signerData.birthday }),
        auths: auths, // Always use 'email' for v1 API
        delivery: 'email', // Always use email delivery (not WhatsApp)
        // Enable biometric authentication flags when requested
        // Note: facial_biometrics_enabled cannot be used with selfie_enabled
        ...(signerData.useBiometricAuth && {
          facial_biometrics_enabled: true,
          // Don't enable these as they conflict with facial biometrics:
          // selfie_enabled: false,
          // liveness_enabled: false
        }),
      },
    };

    console.log(`[CLICKSIGN V1] 📡 POST /signers`);
    console.log(`[CLICKSIGN V1] Request body:`, JSON.stringify(requestBody, null, 2));
    console.log(
      `[CLICKSIGN V1] 🔐 BIOMETRIC AUTH ENABLED:`,
      signerData.useBiometricAuth ? 'YES' : 'NO'
    );
    console.log(`[CLICKSIGN V1] 🔐 Authentication methods requested:`, auths);

    const response = await this.makeRequest<any>('POST', '/signers', requestBody);

    const signer = (response as any).data?.signer || (response as any).signer || response;
    console.log(`[CLICKSIGN V1] ✅ Signer created with key: ${signer.key}`);
    console.log(`[CLICKSIGN V1] Signer response:`, JSON.stringify(signer, null, 2));
    console.log(`[CLICKSIGN V1] 🔐 Signer authentication methods returned:`, signer.auths);

    return signer;
  }

  /**
   * STEP 2: Add signer to envelope using the proper endpoint
   */
  async addSignerToEnvelopeV3(
    envelopeId: string,
    signerId: string,
    signAs: 'party' | 'witness' | 'approver' = 'party'
  ) {
    console.log(`[CLICKSIGN V1] 🚀 STEP 2: Adding signer to envelope`);
    console.log(
      `[CLICKSIGN V1] Envelope ID: ${envelopeId}, Signer ID: ${signerId}, Sign as: ${signAs}`
    );

    const requestBody = {
      signer_id: signerId,
      sign_as: signAs,
      refusable: false,
      message: 'Por favor, assine o Contrato de Crédito Bancário (CCB) do seu empréstimo.',
    };

    console.log(`[CLICKSIGN V1] 📡 POST /envelopes/${envelopeId}/signers`);
    console.log(`[CLICKSIGN V1] Request body:`, JSON.stringify(requestBody, null, 2));

    const response = await this.makeRequest<any>(
      'POST',
      `/envelopes/${envelopeId}/signers`,
      requestBody
    );

    console.log(`[CLICKSIGN V1] ✅ STEP 2 COMPLETE: Signer added to envelope`);
    console.log(`[CLICKSIGN V1] Response:`, JSON.stringify(response, null, 2));
    return response.data;
  }

  /**
   * Legacy method - DO NOT USE (kept for backwards compatibility during migration)
   */
  async addSignerToEnvelope(
    envelopeId: string,
    signerData: EnvelopeSignerData,
    fullSignerData?: SignerData
  ) {
    console.log(`[CLICKSIGN V1] ⚠️ WARNING: Using deprecated method addSignerToEnvelope`);
    console.log(`[CLICKSIGN V1] This method uses the unstable /envelopes/{id}/signers endpoint`);
    console.log(
      `[CLICKSIGN V1] Please use createSignerGlobally + createRequirementForSigner instead`
    );

    // For now, throw an error to force migration
    throw new Error(
      'addSignerToEnvelope is deprecated. Use the 2-step flow: createSignerGlobally + createRequirementForSigner'
    );
  }

  /**
   * Add requirement to envelope
   */
  async addRequirement(envelopeId: string, requirementData: RequirementData) {
    console.log(`[CLICKSIGN V1] 🔨 Adding requirement to envelope ${envelopeId}`);

    // Use correct JSON API format
    const requestBody = {
      data: {
        type: 'requirements',
        attributes: requirementData,
      },
    };

    const response = await this.makeRequest<any>(
      'POST',
      `/envelopes/${envelopeId}/requirements`,
      requestBody
    );

    console.log(`[CLICKSIGN V1] ✅ Requirement added: ${requirementData.type}`);
    return response.data?.data || response.data;
  }

  /**
   * Finish envelope (send for signature)
   */
  async finishEnvelope(envelopeId: string) {
    const response = await this.makeRequest<any>('POST', `/envelopes/${envelopeId}/finish`, {});

    console.log(`[CLICKSIGN V1] ✅ Envelope finished and sent for signature`);
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
    const response = await this.makeRequest<any>('POST', `/envelopes/${envelopeId}/cancel`, {});

    console.log(`[CLICKSIGN V1] ✅ Envelope cancelled`);
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
      webhook: webhookData,
    });

    console.log(`[CLICKSIGN V1] ✅ Webhook configured`);
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

    console.log(`[CLICKSIGN V1] ✅ WhatsApp notification sent`);
    return response.data;
  }

  /**
   * Add signer to document (v1 API)
   */
  async addSignerToDocument(documentKey: string, signerKey: string) {
    const requestBody = {
      list: {
        document_key: documentKey,
        signer_key: signerKey,
        sign_as: 'sign',
      },
    };

    console.log(`[CLICKSIGN V1] 📡 POST /lists`);
    console.log(`[CLICKSIGN V1] Request body:`, JSON.stringify(requestBody, null, 2));
    const response = await this.makeRequest<any>('POST', '/lists', requestBody);
    console.log(`[CLICKSIGN V1] 📦 List response:`, JSON.stringify(response, null, 2));
    const list = (response as any).data?.list || (response as any).list || response;
    console.log(
      `[CLICKSIGN V1] ✅ List created with request_signature_key: ${list.request_signature_key}`
    );
    return list;
  }

  /**
   * Request signature (v1 API)
   */
  async requestSignature(signerKey: string) {
    const requestBody = {
      request_signature_key: signerKey,
    };

    console.log(`[CLICKSIGN V1] 📡 POST /notifications`);
    const response = await this.makeRequest<any>('POST', '/notifications', requestBody);
    return response;
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
      useBiometricAuth?: boolean;
    }
  ) {
    try {
      // Validate and sanitize client data
      const validatedClientData = clickSignSecurityService.validateClientData(clientData);

      // Create audit log for signature request
      const auditLog = clickSignSecurityService.createAuditLog('CLICKSIGN_V1_SEND_CCB', {
        proposalId,
        clientEmail: validatedClientData.email,
      });
      console.log('[CLICKSIGN V1 AUDIT]', auditLog);

      console.log(`[CLICKSIGN V1] 🚀 Starting CCB signature flow for proposal: ${proposalId}`);

      // 1. Ensure correct base64 format (no data URI prefix)
      const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');

      // 2. Validate and sanitize CPF before proceeding
      console.log(`[CLICKSIGN V1] Validating CPF for client: ${clientData.name}`);
      const validatedCpf = this.sanitizeAndValidateCPF(clientData.cpf);

      // 3. Upload document
      console.log(`[CLICKSIGN V1] 📄 Uploading document`);
      const document = await this.createDocumentBatch({
        content_base64: cleanBase64,
        deadline_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      });
      console.log(`[CLICKSIGN V1] ✅ Document uploaded with key: ${document.key}`);

      // 4. Create signer
      console.log(`[CLICKSIGN V1] 👤 Creating signer`);
      const signer = await this.createSigner({
        name: clientData.name,
        email: clientData.email,
        phone: clientData.phone,
        documentation: validatedCpf,
        birthday: clientData.birthday,
        useBiometricAuth: clientData.useBiometricAuth,
      });
      console.log(`[CLICKSIGN V1] ✅ Signer created with key: ${signer.key}`);

      // 5. Add signer to document
      console.log(`[CLICKSIGN V1] 🔗 Adding signer to document`);
      const list = await this.addSignerToDocument(document.key, signer.key);
      console.log(`[CLICKSIGN V1] ✅ Signer added to document`);

      // 5.1 Add biometric requirement if enabled
      if (clientData.useBiometricAuth) {
        console.log(`[CLICKSIGN V1] 🔐 Adding biometric requirement for signer`);
        try {
          // Some ClickSign versions require explicit requirement configuration
          const requirementBody = {
            requirement: {
              document_key: document.key,
              signer_key: signer.key,
              type: 'selfie',
            },
          };
          console.log(`[CLICKSIGN V1] Requirement body:`, JSON.stringify(requirementBody, null, 2));

          // Try to add requirement (may not be needed in v1, but won't hurt)
          await this.makeRequest<any>('POST', '/requirements', requirementBody).catch((err) => {
            console.log(
              `[CLICKSIGN V1] ⚠️ Requirements endpoint not available in v1, continuing...`
            );
          });
        } catch (err) {
          console.log(`[CLICKSIGN V1] ⚠️ Could not add requirement, continuing with standard flow`);
        }
      }

      // 6. Request signature
      console.log(`[CLICKSIGN V1] 📧 Requesting signature`);
      const notification = await this.requestSignature(list.request_signature_key || signer.key);
      console.log(`[CLICKSIGN V1] ✅ Signature requested`);

      // 7. Build sign URL
      const signUrl = list.request_signature_key
        ? `https://app.clicksign.com/sign/${list.request_signature_key}`
        : `https://app.clicksign.com/documento/${document.key}`;

      console.log(`[CLICKSIGN V1] ✅ CCB sent for signature successfully`);
      console.log(`[CLICKSIGN V1] Sign URL generated:`, signUrl);

      // 🎯 ELO PERDIDO: Executar transição de status CCB_GERADA → AGUARDANDO_ASSINATURA
      if (this.marcarAguardandoAssinaturaUseCase) {
        try {
          logInfo('Iniciando transição de status para AGUARDANDO_ASSINATURA', { proposalId });
          await this.marcarAguardandoAssinaturaUseCase.execute({
            propostaId: proposalId,
            userId: 'sistema'
          });
          logInfo('Status da proposta atualizado para AGUARDANDO_ASSINATURA com sucesso.', { proposalId });
        } catch (error) {
          logError('Falha ao tentar atualizar status para AGUARDANDO_ASSINATURA', {
            proposalId,
            errorMessage: (error as Error).message,
            stack: (error as Error).stack
          });
          // IMPORTANTE: Não relança o erro para não quebrar o fluxo principal que já teve sucesso com o ClickSign.
        }
      } else {
        console.warn('[CLICKSIGN V1] ⚠️ MarcarAguardandoAssinaturaUseCase não disponível - status não será atualizado');
      }

      return {
        documentKey: document.key,
        signerId: signer.key,
        signUrl: signUrl,
        requestSignatureKey: list.request_signature_key || '',
        status: 'sent',
      };
    } catch (error) {
      console.error(`[CLICKSIGN V1] ❌ Failed to send CCB for signature:`, error);
      throw error;
    }
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('GET', '/envelopes?limit=1');
      console.log(`[CLICKSIGN V1] ✅ Connection test successful`);
      return true;
    } catch (error) {
      console.error(`[CLICKSIGN V1] ❌ Connection test failed:`, error);
      return false;
    }
  }
}

// Factory function to create ClickSign service with dependencies
export function createClickSignServiceV3(marcarAguardandoAssinaturaUseCase?: MarcarAguardandoAssinaturaUseCase): ClickSignServiceV3 {
  return new ClickSignServiceV3(marcarAguardandoAssinaturaUseCase);
}

// Export singleton instance (backwards compatibility - without status transition)
export const clickSignServiceV3 = new ClickSignServiceV3();
