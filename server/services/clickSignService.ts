/**
 * ClickSign Integration Service
 * Complete API wrapper for ClickSign electronic signature platform
 * 
 * Features:
 * - Document upload and management
 * - Signer creation and management
 * - Electronic signature workflow
 * - Webhook handling
 * - Status tracking
 * 
 * Documentation: https://developers.clicksign.com/
 */

interface ClickSignConfig {
  apiUrl: string;
  apiToken: string;
  environment: 'sandbox' | 'production';
}

interface ClientData {
  name: string;
  email: string;
  cpf: string;
  phone?: string;
}

interface ClickSignDocument {
  key: string;
  filename: string;
  uploads: Array<{
    key: string;
    created_at: string;
    original_name: string;
  }>;
  status: string;
  created_at: string;
}

interface ClickSignSigner {
  key: string;
  email: string;
  phone: string;
  name: string;
  documentation: string;
  birthday: string | null;
  has_documentation: boolean;
  delivery: string;
  created_at: string;
}

interface ClickSignList {
  key: string;
  name: string;
  status: string;
  signers: Array<{
    key: string;
    email: string;
    sign_url: string;
    request_signature_key: string;
  }>;
  created_at: string;
}

interface ClickSignResult {
  documentKey: string;
  signerKey: string;
  listKey: string;
  signUrl: string;
}

class ClickSignService {
  private config: ClickSignConfig;

  constructor() {
    this.config = {
      apiUrl: process.env.NODE_ENV === 'production' 
        ? 'https://app.clicksign.com/api/v1'
        : 'https://sandbox.clicksign.com/api/v1',
      apiToken: process.env.CLICKSIGN_API_TOKEN || '',
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
    };

    if (!this.config.apiToken) {
      console.warn('[CLICKSIGN] ⚠️ API token not configured. ClickSign integration will not work.');
    }
  }

  /**
   * Test ClickSign API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.config.apiToken) {
        console.log('[CLICKSIGN] ❌ No API token configured');
        return false;
      }

      const response = await fetch(`${this.config.apiUrl}/account?access_token=${this.config.apiToken}`);
      const success = response.ok;
      
      console.log(`[CLICKSIGN] ${success ? '✅' : '❌'} Connection test: ${response.status} ${response.statusText}`);
      return success;
    } catch (error) {
      console.error('[CLICKSIGN] ❌ Connection test failed:', error);
      return false;
    }
  }

  /**
   * Upload CCB document to ClickSign
   */
  async uploadDocument(fileBuffer: Buffer, filename: string): Promise<ClickSignDocument> {
    try {
      console.log(`[CLICKSIGN] 📤 Uploading document: ${filename}`);

      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: 'application/pdf' });
      formData.append('document[archive]', blob, filename);
      formData.append('document[path]', `/CCB/${filename}`);
      formData.append('document[content_type]', 'application/pdf');

      const response = await fetch(
        `${this.config.apiUrl}/documents?access_token=${this.config.apiToken}`,
        {
          method: 'POST',
          body: formData
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`ClickSign upload failed: ${response.status} - ${errorData}`);
      }

      const document: ClickSignDocument = await response.json();
      console.log(`[CLICKSIGN] ✅ Document uploaded successfully: ${document.key}`);
      
      return document;
    } catch (error) {
      console.error('[CLICKSIGN] ❌ Document upload failed:', error);
      throw error;
    }
  }

  /**
   * Create a signer for the document
   */
  async createSigner(clientData: ClientData): Promise<ClickSignSigner> {
    try {
      console.log(`[CLICKSIGN] 👤 Creating signer for: ${clientData.email}`);

      const payload = {
        signer: {
          email: clientData.email,
          phone: clientData.phone || '',
          name: clientData.name,
          documentation: clientData.cpf.replace(/\D/g, ''), // Remove non-digits
          birthday: null,
          has_documentation: true,
          delivery: 'email' // Send notification via email
        }
      };

      const response = await fetch(
        `${this.config.apiUrl}/signers?access_token=${this.config.apiToken}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`ClickSign signer creation failed: ${response.status} - ${errorData}`);
      }

      const signer: ClickSignSigner = await response.json();
      console.log(`[CLICKSIGN] ✅ Signer created successfully: ${signer.key}`);
      
      return signer;
    } catch (error) {
      console.error('[CLICKSIGN] ❌ Signer creation failed:', error);
      throw error;
    }
  }

  /**
   * Create signature list (envelope) for the document
   */
  async createSignatureList(documentKey: string, signerKey: string, clientName: string): Promise<ClickSignList> {
    try {
      console.log(`[CLICKSIGN] 📋 Creating signature list for document: ${documentKey}`);

      const payload = {
        list: {
          document_key: documentKey,
          name: `CCB - ${clientName}`,
          description: `Assinatura eletrônica do CCB para ${clientName}`,
          locale: 'pt-BR',
          sequence_enabled: false,
          reminder_enabled: true,
          deadline_enabled: true,
          deadline_at: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString() // 7 days from now
        }
      };

      const response = await fetch(
        `${this.config.apiUrl}/lists?access_token=${this.config.apiToken}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`ClickSign list creation failed: ${response.status} - ${errorData}`);
      }

      const list: ClickSignList = await response.json();
      console.log(`[CLICKSIGN] ✅ Signature list created successfully: ${list.key}`);
      
      return list;
    } catch (error) {
      console.error('[CLICKSIGN] ❌ Signature list creation failed:', error);
      throw error;
    }
  }

  /**
   * Add signer to signature list
   */
  async addSignerToList(listKey: string, signerKey: string): Promise<string> {
    try {
      console.log(`[CLICKSIGN] ➕ Adding signer ${signerKey} to list ${listKey}`);

      const payload = {
        request_signature: {
          list_key: listKey,
          signer_key: signerKey,
          sign_as: 'sign', // Electronic signature type
          message: 'Por favor, assine digitalmente este CCB para concluir seu empréstimo.',
          url: '' // ClickSign will generate the signing URL
        }
      };

      const response = await fetch(
        `${this.config.apiUrl}/list/${listKey}/request_signature?access_token=${this.config.apiToken}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`ClickSign add signer failed: ${response.status} - ${errorData}`);
      }

      const result = await response.json();
      const signUrl = result.request_signature?.url || '';
      
      console.log(`[CLICKSIGN] ✅ Signer added to list successfully. Sign URL: ${signUrl}`);
      
      return signUrl;
    } catch (error) {
      console.error('[CLICKSIGN] ❌ Add signer to list failed:', error);
      throw error;
    }
  }

  /**
   * Complete workflow: Send CCB for signature
   */
  async sendCCBForSignature(ccbBuffer: Buffer, filename: string, clientData: ClientData): Promise<ClickSignResult> {
    try {
      console.log(`[CLICKSIGN] 🚀 Starting complete CCB signature workflow for: ${clientData.name}`);

      // Step 1: Upload document
      const document = await this.uploadDocument(ccbBuffer, filename);

      // Step 2: Create signer
      const signer = await this.createSigner(clientData);

      // Step 3: Create signature list
      const list = await this.createSignatureList(document.key, signer.key, clientData.name);

      // Step 4: Add signer to list and get signing URL
      const signUrl = await this.addSignerToList(list.key, signer.key);

      console.log(`[CLICKSIGN] ✅ Complete workflow finished successfully`);

      return {
        documentKey: document.key,
        signerKey: signer.key,
        listKey: list.key,
        signUrl: signUrl
      };
    } catch (error) {
      console.error('[CLICKSIGN] ❌ Complete workflow failed:', error);
      throw error;
    }
  }

  /**
   * Get document status
   */
  async getDocumentStatus(documentKey: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.config.apiUrl}/documents/${documentKey}?access_token=${this.config.apiToken}`
      );

      if (!response.ok) {
        throw new Error(`Failed to get document status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[CLICKSIGN] ❌ Get document status failed:', error);
      throw error;
    }
  }

  /**
   * Get signature list status
   */
  async getListStatus(listKey: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.config.apiUrl}/lists/${listKey}?access_token=${this.config.apiToken}`
      );

      if (!response.ok) {
        throw new Error(`Failed to get list status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[CLICKSIGN] ❌ Get list status failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const clickSignService = new ClickSignService();