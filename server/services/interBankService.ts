/**
 * Banco Inter API Integration Service
 * Complete wrapper for Inter Bank Collection API (Cobrança/Boletos)
 * 
 * Features:
 * - Boleto/PIX collection creation and management
 * - Full CRUD operations on collections
 * - PDF generation
 * - Webhook management
 * - Payment tracking and status updates
 * - Comprehensive error handling
 * 
 * Documentation: https://developers.inter.co/references/cobranca-bolepix
 * API Version: v3
 */

import https from 'https';
import { Agent as UndiciAgent } from 'undici';

interface InterBankConfig {
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  certificate: string; // Base64 encoded certificate
  privateKey: string; // Base64 encoded private key
  contaCorrente?: string;
  environment: 'sandbox' | 'production';
}

interface InterTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface ClientData {
  cpfCnpj: string;
  tipoPessoa: 'FISICA' | 'JURIDICA';
  nome: string;
  email?: string;
  ddd?: string;
  telefone?: string;
  endereco: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

interface CobrancaRequest {
  seuNumero: string; // Max 15 chars - Unique identifier
  valorNominal: number; // 2.5 to 99999999.99
  // REMOVED dataEmissao - NOT VALID IN API v3
  dataVencimento: string; // YYYY-MM-DD format
  numDiasAgenda: number; // 0-60 days for auto cancellation
  pagador: ClientData;
  desconto?: {
    codigo: 'PERCENTUALDATAINFORMADA' | 'VALORFIXODATAINFORMADA' | 'PERCENTUAL' | 'VALORFIXO';
    taxa?: number;
    valor?: number;
    data?: string; // For DATAINFORMADA codes
    quantidadeDias?: number; // Still required by API v3
  };
  multa?: {
    codigo: 'PERCENTUAL' | 'VALORFIXO';
    taxa?: number;
    valor?: number;
  };
  mora?: {
    codigo: 'TAXAMENSAL' | 'TAXADIARIA' | 'VALORFIXO';
    taxa?: number;
    valor?: number;
  };
  mensagem?: {
    linha1?: string;
    linha2?: string;
    linha3?: string;
    linha4?: string;
    linha5?: string;
  };
  // REMOVED formasRecebimento - NOT VALID IN API v3
}

interface CobrancaResponse {
  codigoSolicitacao: string;
}

interface CobrancaDetalhada {
  cobranca: {
    codigoSolicitacao: string;
    seuNumero: string;
    dataEmissao: string;
    dataVencimento: string;
    valorNominal: number;
    tipoCobranca: 'SIMPLES' | 'PARCELADO' | 'RECORRENTE';
    situacao: 'RECEBIDO' | 'A_RECEBER' | 'MARCADO_RECEBIDO' | 'ATRASADO' | 'CANCELADO' | 'EXPIRADO' | 'FALHA_EMISSAO' | 'EM_PROCESSAMENTO' | 'PROTESTO';
    dataSituacao: string;
    valorTotalRecebido?: number;
    origemRecebimento?: 'BOLETO' | 'PIX';
    pagador: ClientData;
  };
  boleto?: {
    nossoNumero: string;
    codigoBarras: string;
    linhaDigitavel: string;
  };
  pix?: {
    txid: string;
    pixCopiaECola: string;
  };
}

interface WebhookData {
  url: string;
  eventos: ('cobranca_criada' | 'cobranca_paga' | 'cobranca_cancelada' | 'cobranca_expirada')[];
}

class InterBankService {
  private config: InterBankConfig;
  private tokenCache: {
    token: string;
    expiresAt: number;
  } | null = null;

  constructor() {
    // Auto-detect if we're using production credentials based on presence of INTER_CONTA_CORRENTE
    const isProduction = !!process.env.INTER_CONTA_CORRENTE;
    
    this.config = {
      environment: isProduction ? 'production' : 'sandbox',
      apiUrl: isProduction 
        ? 'https://cdpj.partners.bancointer.com.br'
        : 'https://cdpj-sandbox.partners.uatinter.co',
      clientId: process.env.INTER_CLIENT_ID || '',
      clientSecret: process.env.INTER_CLIENT_SECRET || '',
      certificate: process.env.INTER_CERTIFICATE || '',
      privateKey: process.env.INTER_PRIVATE_KEY || '',
      contaCorrente: process.env.INTER_CONTA_CORRENTE || ''
    };
    
    console.log(`[INTER] 🏦 Initialized in ${this.config.environment} mode`);
    console.log(`[INTER] 🌐 API URL: ${this.config.apiUrl}`);

    if (!this.config.clientId || !this.config.clientSecret) {
      console.warn('[INTER] ⚠️ Client credentials not configured. Inter Bank integration will not work.');
    }
  }

  /**
   * Get OAuth2 access token (cached for 60 minutes)
   */
  private async getAccessToken(): Promise<string> {
    try {
      // Check if we have a valid cached token
      if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
        return this.tokenCache.token;
      }

      console.log('[INTER] 🔑 Requesting new access token...');

      const tokenUrl = new URL(`${this.config.apiUrl}/oauth/v2/token`);
      
      console.log(`[INTER] 🌐 Token URL: ${tokenUrl.hostname}${tokenUrl.pathname}`);
      console.log(`[INTER] 📄 Using form-based authentication per official docs`);
      console.log(`[INTER] 🔓 Certificate configured: ${this.config.certificate ? '✅ Present' : '❌ Missing'}`);
      console.log(`[INTER] 🔑 Private Key configured: ${this.config.privateKey ? '✅ Present' : '❌ Missing'}`);

      // Follow official Inter Bank documentation format
      // client_id and client_secret are REQUIRED per official docs
      const formBody = new URLSearchParams({
        'client_id': this.config.clientId,
        'client_secret': this.config.clientSecret,
        'grant_type': 'client_credentials',
        'scope': 'boleto-cobranca.read boleto-cobranca.write webhook.read webhook.write' // All required scopes for API v3
      });
      
      // Log client_id length for debugging
      console.log(`[INTER] 📊 Client ID length: ${this.config.clientId.length} chars`);
      console.log(`[INTER] 📊 Client Secret length: ${this.config.clientSecret.length} chars`);
      
      console.log(`[INTER] 📝 Form parameters: client_id=***, grant_type=client_credentials, scope=${formBody.get('scope')}`);
      console.log(`[INTER] 📝 Form body string length: ${formBody.toString().length} chars`);
      console.log(`[INTER] 📝 Form body preview: ${formBody.toString().substring(0, 100)}...`);

      // Não logar o form body completo pois contém credenciais
      console.log(`[INTER] 🔒 Using mTLS certificate authentication`);

      // Prepare certificate and key in proper PEM format
      let cert = this.config.certificate;
      let key = this.config.privateKey;

      // CRITICAL FIX: Add line breaks to PEM format certificates
      // The certificates are valid PEM but in single line format
      // Node.js requires proper line breaks in PEM format
      
      console.log('[INTER] 🔄 Formatting certificates with proper line breaks...');

      // Fix certificate: Add line breaks after headers and every 64 characters
      if (cert.includes('-----BEGIN CERTIFICATE-----') && !cert.includes('\n')) {
        console.log('[INTER] 📋 Certificate is single-line PEM, adding line breaks...');
        // Extract the base64 content between headers
        const certMatch = cert.match(/-----BEGIN CERTIFICATE-----(.*?)-----END CERTIFICATE-----/);
        if (certMatch && certMatch[1]) {
          const base64Content = certMatch[1].trim();
          // Add line breaks every 64 characters
          const formattedContent = base64Content.match(/.{1,64}/g)?.join('\n') || base64Content;
          cert = `-----BEGIN CERTIFICATE-----\n${formattedContent}\n-----END CERTIFICATE-----`;
          console.log('[INTER] ✅ Certificate formatted with line breaks');
        }
      }

      // Fix private key: Add line breaks after headers and every 64 characters
      if (key.includes('-----BEGIN') && key.includes('KEY-----') && !key.includes('\n')) {
        console.log('[INTER] 🔑 Private key is single-line PEM, adding line breaks...');
        // Extract the base64 content between headers (works for both RSA and regular private keys)
        const keyMatch = key.match(/-----BEGIN (.+?)-----(.*?)-----END (.+?)-----/);
        if (keyMatch && keyMatch[2]) {
          const keyType = keyMatch[1];
          const base64Content = keyMatch[2].trim();
          // Add line breaks every 64 characters
          const formattedContent = base64Content.match(/.{1,64}/g)?.join('\n') || base64Content;
          key = `-----BEGIN ${keyType}-----\n${formattedContent}\n-----END ${keyType}-----`;
          console.log('[INTER] ✅ Private key formatted with line breaks');
        }
      }

      // Não logar previews de certificados por segurança
      console.log('[INTER] ✅ Certificates formatted and ready');

      // SANDBOX ONLY: Try alternative approach
      if (this.config.environment === 'sandbox') {
        console.log('[INTER] ⚠️ SANDBOX MODE: Using alternative HTTPS configuration');
      }

      // Create Undici agent for proper mTLS support with Node.js fetch
      console.log('[INTER] 🔧 Creating Undici agent for mTLS...');
      const undiciAgent = new UndiciAgent({
        connect: {
          cert: cert,
          key: key,
          ca: [], // Use system CA
          rejectUnauthorized: true // Always validate certificates in production
        }
      });

      console.log('[INTER] 🚀 Making mTLS request with Undici agent...');

      // Declare response variable to use throughout the method
      let response: any;

      // Try using node fetch with undici dispatcher
      try {
        const fetchResponse = await fetch(tokenUrl.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
            // No Authorization header - credentials sent as form parameters per Inter docs
          },
          body: formBody.toString(),
          // Use dispatcher instead of agent for undici
          // @ts-ignore - dispatcher is supported but not in types
          dispatcher: undiciAgent
        });

        console.log(`[INTER] 📡 Response status: ${fetchResponse.status}`);
        console.log(`[INTER] 📡 Response headers:`, fetchResponse.headers);

        response = {
          ok: fetchResponse.ok,
          status: fetchResponse.status,
          headers: fetchResponse.headers,
          text: async () => await fetchResponse.text(),
          json: async () => await fetchResponse.json()
        };

        if (!response.ok) {
          const errorText = await response.text();
          console.log(`[INTER] ❌ Error response body: ${errorText}`);
          
          // Try to parse error details
          if (fetchResponse.status === 400) {
            console.log('[INTER] 🔍 Bad Request - possible causes:');
            console.log('[INTER]   - Invalid grant_type or scope');
            console.log('[INTER]   - Invalid client credentials');
            console.log('[INTER]   - Missing required parameters');
            console.log('[INTER]   - Response headers:', Object.fromEntries(fetchResponse.headers.entries()));
          }
        }

        // Return early if fetch succeeded
        return response;
      } catch (fetchError) {
        console.error(`[INTER] ❌ Fetch error: ${(fetchError as Error).message}`);
        
        // Fallback to raw HTTPS request
        console.log('[INTER] 🔄 Falling back to raw HTTPS request...');
        
        response = await new Promise<any>((resolve, reject) => {
          const options = {
            hostname: tokenUrl.hostname,
            port: tokenUrl.port || 443,
            path: tokenUrl.pathname,
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
              'Content-Length': Buffer.byteLength(formBody.toString())
              // No Authorization header - credentials sent as form parameters per Inter docs
            },
            cert: cert,
            key: key,
            rejectUnauthorized: false,
            requestCert: true,
            ciphers: 'ALL',
            secureProtocol: 'TLS_method'
          };

          const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
              resolve({
                ok: res.statusCode && res.statusCode >= 200 && res.statusCode < 300,
                status: res.statusCode,
                headers: res.headers,
                text: async () => data,
                json: async () => {
                  try {
                    return JSON.parse(data);
                  } catch (e) {
                    throw new Error('Invalid JSON response');
                  }
                }
              });
            });
          });

          req.on('error', (e) => {
            console.error(`[INTER] ❌ Request error: ${e.message}`);
            reject(e);
          });

          req.write(formBody.toString());
          req.end();
        });

      }

      console.log(`[INTER] 📡 Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`[INTER] ❌ Error response body: ${errorText}`);
        
        // Tentar parse JSON do erro
        try {
          const errorJson = JSON.parse(errorText);
          console.log(`[INTER] ❌ Parsed error JSON:`, errorJson);
        } catch (e) {
          console.log(`[INTER] ❌ Error response is not JSON`);
        }
        
        throw new Error(`Token request failed: ${response.status} - ${errorText}`);
      }

      const tokenData: InterTokenResponse = await response.json();
      
      // Cache token with 5 minute buffer before expiration
      this.tokenCache = {
        token: tokenData.access_token,
        expiresAt: Date.now() + ((tokenData.expires_in - 300) * 1000)
      };

      console.log(`[INTER] ✅ Access token obtained successfully (expires in ${tokenData.expires_in}s)`);
      return tokenData.access_token;

    } catch (error) {
      console.error('[INTER] ❌ Failed to get access token:', error);
      throw error;
    }
  }

  /**
   * Make authenticated request to Inter API WITH mTLS
   * CRITICAL FIX: Now properly uses HTTPS with mTLS configuration like getAccessToken
   */
  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT' = 'GET', data?: any, additionalHeaders?: Record<string, string>): Promise<any> {
    try {
      const token = await this.getAccessToken();
      const url = new URL(`${this.config.apiUrl}${endpoint}`);

      console.log('[INTER] ========== REQUEST DETAILS ==========');
      console.log(`[INTER] 🌐 FULL URL: ${url.toString()}`);
      console.log(`[INTER] 🔧 METHOD: ${method}`);
      console.log(`[INTER] 🪙 TOKEN (first 20 chars):', ${token.substring(0, 20)}...`);
      console.log('[INTER] ===================================');

      // CRITICAL: Use HTTPS request with mTLS like getAccessToken
      return new Promise((resolve, reject) => {
        // Format certificates first (same logic as getAccessToken)
        let cert = this.config.certificate;
        let key = this.config.privateKey;

        // Fix certificate format if needed
        if (cert.includes('-----BEGIN CERTIFICATE-----') && !cert.includes('\n')) {
          console.log('[INTER] 📋 Certificate is single-line PEM, adding line breaks...');
          const certMatch = cert.match(/-----BEGIN CERTIFICATE-----(.*?)-----END CERTIFICATE-----/);
          if (certMatch && certMatch[1]) {
            const base64Content = certMatch[1].trim();
            const formattedContent = base64Content.match(/.{1,64}/g)?.join('\n') || base64Content;
            cert = `-----BEGIN CERTIFICATE-----\n${formattedContent}\n-----END CERTIFICATE-----`;
          }
        }

        // Fix private key format if needed
        if (key.includes('-----BEGIN') && key.includes('KEY-----') && !key.includes('\n')) {
          console.log('[INTER] 🔑 Private key is single-line PEM, adding line breaks...');
          const keyMatch = key.match(/-----BEGIN (.+?)-----(.*?)-----END (.+?)-----/);
          if (keyMatch && keyMatch[2]) {
            const keyType = keyMatch[1];
            const base64Content = keyMatch[2].trim();
            const formattedContent = base64Content.match(/.{1,64}/g)?.join('\n') || base64Content;
            key = `-----BEGIN ${keyType}-----\n${formattedContent}\n-----END ${keyType}-----`;
          }
        }

        // Prepare headers
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'User-Agent': 'SIMPIX-Inter-Integration/1.0', // Added per Claude's suggestion
          ...additionalHeaders // Merge additional headers (like Accept: application/pdf)
        };

        // Add account header if configured
        if (this.config.contaCorrente) {
          headers['x-conta-corrente'] = this.config.contaCorrente;
          console.log('[INTER] 🏦 CONTA CORRENTE HEADER ADDED:', this.config.contaCorrente);
        } else {
          console.log('[INTER] ⚠️ NO CONTA CORRENTE CONFIGURED!');
        }

        // Prepare body if needed
        let body: string | undefined;
        if (data && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify(data); // NO CUSTOM STRINGIFY - Use standard JSON
          console.log('[INTER] 📦 REQUEST BODY:', body);
        }

        console.log('[INTER] 🔑 ALL HEADERS:', JSON.stringify(headers, null, 2));

        const options = {
          hostname: url.hostname,
          port: url.port || 443,
          path: url.pathname + url.search,
          method: method,
          headers: {
            ...headers,
            ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {})
          },
          cert: cert,
          key: key,
          rejectUnauthorized: this.config.environment === 'production',
          requestCert: true,
          timeout: 30000
        };

        const req = https.request(options, (res) => {
          const chunks: Buffer[] = [];
          
          console.log('[INTER] ========== RESPONSE DETAILS ==========');
          console.log(`[INTER] 📊 STATUS: ${res.statusCode} ${res.statusMessage}`);
          console.log('[INTER] 📋 RESPONSE HEADERS:', res.headers);
          
          // Check if response is PDF
          const isPdf = res.headers['content-type']?.includes('application/pdf');
          
          res.on('data', (chunk) => { 
            chunks.push(Buffer.from(chunk));
          });
          
          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            
            if (!res.statusCode || res.statusCode >= 400) {
              console.log('[INTER] ❌❌❌ ERROR RESPONSE ❌❌❌');
              console.log(`[INTER] 🚨 Status Code: ${res.statusCode}`);
              
              const errorText = buffer.toString('utf-8');
              console.log(`[INTER] 🚨 Error Body: "${errorText}"`);
              console.log(`[INTER] 🚨 Error Body Length: ${errorText.length} chars`);
              
              if (errorText.length === 0) {
                console.log('[INTER] 📋 EMPTY ERROR BODY!');
                console.log('[INTER] 📋 Response headers for debugging:', res.headers);
              } else {
                try {
                  const errorJson = JSON.parse(errorText);
                  console.log('[INTER] 📋 Error as JSON:', JSON.stringify(errorJson, null, 2));
                } catch (e) {
                  console.log('[INTER] 📋 Error is not JSON, raw text:', errorText);
                }
              }
              
              console.log('[INTER] ❌❌❌ END ERROR RESPONSE ❌❌❌');
              reject(new Error(`Inter API error: ${res.statusCode} - ${errorText || 'Empty response'}`));
              return;
            }

            console.log('[INTER] ✅ Response OK');
            console.log('[INTER] =====================================');

            // Handle empty responses (204 No Content or DELETE)
            if (res.statusCode === 204 || buffer.length === 0) {
              resolve(null);
              return;
            }

            // Return buffer directly for PDF responses
            if (isPdf) {
              console.log(`[INTER] 📄 PDF response received (${buffer.length} bytes)`);
              resolve(buffer);
              return;
            }

            // Parse JSON response
            try {
              const responseText = buffer.toString('utf-8');
              resolve(JSON.parse(responseText));
            } catch (e) {
              // Return raw text if not JSON
              resolve(buffer.toString('utf-8'));
            }
          });
        });

        req.on('error', (e) => {
          console.error(`[INTER] ❌ Request error for ${endpoint}:`, e);
          reject(e);
        });

        // Set timeout
        req.setTimeout(30000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });

        // Write body if present
        if (body) {
          req.write(body);
        }
        
        req.end();
      });

    } catch (error) {
      console.error(`[INTER] Request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Test Inter API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('[INTER] 🔍 Testing connection...');
      console.log('[INTER] 📋 Configuration check:');
      console.log(`[INTER]   - Environment: ${this.config.environment}`);
      console.log(`[INTER]   - API URL: ${this.config.apiUrl}`);
      console.log(`[INTER]   - Client ID: ${this.config.clientId ? '✅ Present (' + this.config.clientId.substring(0, 8) + '...)' : '❌ Missing'}`);
      console.log(`[INTER]   - Client Secret: ${this.config.clientSecret ? '✅ Present (' + this.config.clientSecret.substring(0, 8) + '...)' : '❌ Missing'}`);
      console.log(`[INTER]   - Certificate: ${this.config.certificate ? '✅ Present (' + this.config.certificate.length + ' chars)' : '❌ Missing'}`);
      console.log(`[INTER]   - Private Key: ${this.config.privateKey ? '✅ Present (' + this.config.privateKey.length + ' chars)' : '❌ Missing'}`);
      console.log(`[INTER]   - Conta Corrente: ${this.config.contaCorrente ? '✅ Present (' + this.config.contaCorrente + ')' : '❌ Missing'}`);

      if (!this.config.clientId || !this.config.clientSecret) {
        console.log('[INTER] ❌ No client credentials configured');
        return false;
      }

      await this.getAccessToken();
      console.log('[INTER] ✅ Connection test successful');
      return true;
    } catch (error) {
      console.error('[INTER] ❌ Connection test failed:', error);
      return false;
    }
  }

  /**
   * Create a new collection (boleto/PIX)
   */
  async emitirCobranca(cobrancaData: CobrancaRequest): Promise<CobrancaResponse> {
    try {
      console.log(`[INTER] 📤 Creating collection: ${cobrancaData.seuNumero}`);
      
      // Log COMPLETE request data for debugging
      console.log('[INTER] 📋 COMPLETE Request data:', JSON.stringify(cobrancaData, null, 2));

      const response = await this.makeRequest('/cobranca/v3/cobrancas', 'POST', cobrancaData);
      
      console.log(`[INTER] ✅ Collection created successfully: ${response.codigoSolicitacao}`);
      return response;

    } catch (error) {
      console.error('[INTER] ❌ Failed to create collection:', error);
      throw error;
    }
  }

  /**
   * Get detailed collection information
   */
  async recuperarCobranca(codigoSolicitacao: string): Promise<CobrancaDetalhada> {
    try {
      console.log(`[INTER] 📋 Retrieving collection: ${codigoSolicitacao}`);

      const response = await this.makeRequest(`/cobranca/v3/cobrancas/${codigoSolicitacao}`);
      
      console.log(`[INTER] ✅ Collection retrieved successfully`);
      return response;

    } catch (error) {
      console.error('[INTER] ❌ Failed to retrieve collection:', error);
      throw error;
    }
  }

  /**
   * Search collections with filters
   */
  async pesquisarCobrancas(filters: {
    dataInicial: string; // YYYY-MM-DD
    dataFinal: string; // YYYY-MM-DD
    filtrarDataPor?: 'VENCIMENTO' | 'EMISSAO' | 'PAGAMENTO';
    situacao?: 'RECEBIDO' | 'A_RECEBER' | 'MARCADO_RECEBIDO' | 'ATRASADO' | 'CANCELADO' | 'EXPIRADO';
    pessoaPagadora?: string;
    cpfCnpjPessoaPagadora?: string;
    seuNumero?: string;
    tipoCobranca?: 'SIMPLES' | 'PARCELADO' | 'RECORRENTE';
    itensPorPagina?: number;
    paginaAtual?: number;
  }): Promise<any> {
    try {
      console.log(`[INTER] 🔍 Searching collections from ${filters.dataInicial} to ${filters.dataFinal}`);

      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          if (key === 'itensPorPagina') {
            queryParams.append('paginacao.itensPorPagina', value.toString());
          } else if (key === 'paginaAtual') {
            queryParams.append('paginacao.paginaAtual', value.toString());
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });

      const response = await this.makeRequest(`/cobranca/v3/cobrancas?${queryParams.toString()}`);
      
      console.log(`[INTER] ✅ Found ${response.totalElementos} collections`);
      return response;

    } catch (error) {
      console.error('[INTER] ❌ Failed to search collections:', error);
      throw error;
    }
  }

  /**
   * Edit an existing collection
   */
  async editarCobranca(codigoSolicitacao: string, updateData: Partial<CobrancaRequest>): Promise<any> {
    try {
      console.log(`[INTER] ✏️ Editing collection: ${codigoSolicitacao}`);

      const response = await this.makeRequest(`/cobranca/v3/cobrancas/${codigoSolicitacao}`, 'PATCH', updateData);
      
      console.log(`[INTER] ✅ Collection edited successfully`);
      return response;

    } catch (error) {
      console.error('[INTER] ❌ Failed to edit collection:', error);
      throw error;
    }
  }

  /**
   * Cancel a collection
   */
  async cancelarCobranca(codigoSolicitacao: string, motivoCancelamento: string): Promise<any> {
    try {
      console.log(`[INTER] ❌ Cancelling collection: ${codigoSolicitacao}`);

      const response = await this.makeRequest(
        `/cobranca/v3/cobrancas/${codigoSolicitacao}/cancelamento`, 
        'POST', 
        { motivoCancelamento }
      );
      
      console.log(`[INTER] ✅ Collection cancelled successfully`);
      return response;

    } catch (error) {
      console.error('[INTER] ❌ Failed to cancel collection:', error);
      throw error;
    }
  }

  /**
   * Get collection PDF
   */
  async obterPdfCobranca(codigoSolicitacao: string): Promise<Buffer> {
    try {
      console.log(`[INTER] 📄 Getting PDF for collection: ${codigoSolicitacao}`);

      // Use makeRequest instead of direct fetch to ensure proper mTLS
      const response = await this.makeRequest(`/cobranca/v3/cobrancas/${codigoSolicitacao}/pdf`, 'GET', null, {
        'Accept': 'application/pdf'
      });
      
      // Check if response is a Buffer
      if (Buffer.isBuffer(response)) {
        console.log(`[INTER] ✅ PDF retrieved successfully (${response.length} bytes)`);
        return response;
      }
      
      // If not a buffer, try to convert
      if (typeof response === 'string') {
        const pdfBuffer = Buffer.from(response, 'base64');
        console.log(`[INTER] ✅ PDF retrieved and converted from base64 (${pdfBuffer.length} bytes)`);
        return pdfBuffer;
      }
      
      throw new Error('Invalid PDF response format');

    } catch (error) {
      console.error('[INTER] ❌ Failed to get PDF:', error);
      throw error;
    }
  }

  /**
   * Get collections summary/metrics
   */
  async obterSumarioCobrancas(filters: {
    dataInicial: string;
    dataFinal: string;
    filtrarDataPor?: 'VENCIMENTO' | 'EMISSAO' | 'PAGAMENTO';
  }): Promise<any> {
    try {
      console.log(`[INTER] 📊 Getting collections summary`);

      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });

      const response = await this.makeRequest(`/cobranca/v3/cobrancas/sumario?${queryParams.toString()}`);
      
      console.log(`[INTER] ✅ Summary retrieved successfully`);
      return response;

    } catch (error) {
      console.error('[INTER] ❌ Failed to get summary:', error);
      throw error;
    }
  }

  /**
   * Setup webhook for collection events
   */
  async configurarWebhook(webhookData: WebhookData): Promise<any> {
    try {
      console.log(`[INTER] 🔗 Setting up webhook: ${webhookData.url}`);

      const response = await this.makeRequest('/webhook', 'PUT', webhookData);
      
      console.log(`[INTER] ✅ Webhook configured successfully`);
      return response;

    } catch (error) {
      console.error('[INTER] ❌ Failed to configure webhook:', error);
      throw error;
    }
  }

  /**
   * Get current webhook configuration
   */
  async obterWebhook(): Promise<any> {
    try {
      console.log(`[INTER] 🔗 Getting webhook configuration`);

      const response = await this.makeRequest('/webhook');
      
      console.log(`[INTER] ✅ Webhook configuration retrieved`);
      return response;

    } catch (error) {
      console.error('[INTER] ❌ Failed to get webhook:', error);
      throw error;
    }
  }

  /**
   * Delete webhook
   */
  async excluirWebhook(): Promise<any> {
    try {
      console.log(`[INTER] 🗑️ Deleting webhook`);

      const response = await this.makeRequest('/webhook', 'DELETE');
      
      console.log(`[INTER] ✅ Webhook deleted successfully`);
      return response;

    } catch (error) {
      console.error('[INTER] ❌ Failed to delete webhook:', error);
      throw error;
    }
  }

  /**
   * Simulate payment (sandbox only)
   */
  async pagarCobrancaSandbox(codigoSolicitacao: string, valorPago: number): Promise<any> {
    try {
      if (this.config.environment !== 'sandbox') {
        throw new Error('Payment simulation is only available in sandbox environment');
      }

      console.log(`[INTER] 💰 Simulating payment for collection: ${codigoSolicitacao}`);

      const response = await this.makeRequest(
        `/cobranca/v3/cobrancas/${codigoSolicitacao}/pagamento`, 
        'POST', 
        { valorPago }
      );
      
      console.log(`[INTER] ✅ Payment simulated successfully`);
      return response;

    } catch (error) {
      console.error('[INTER] ❌ Failed to simulate payment:', error);
      throw error;
    }
  }

  /**
   * Complete workflow: Create collection from Simpix proposal
   */
  async criarCobrancaParaProposta(proposalData: {
    id: string;
    valorTotal: number;
    dataVencimento: string;
    clienteData: {
      nome: string;
      cpf: string;
      email: string;
      telefone?: string;
      endereco: string;
      numero: string;
      complemento?: string;
      bairro: string;
      cidade: string;
      uf: string;
      cep: string;
    };
  }): Promise<CobrancaResponse> {
    try {
      console.log(`[INTER] 🚀 Creating collection for proposal: ${proposalData.id}`);

      // Extract DDD and phone number from telefone
      let ddd = '';
      let telefoneNumero = '';
      if (proposalData.clienteData.telefone) {
        // Remove all non-numeric characters
        const cleanPhone = proposalData.clienteData.telefone.replace(/\D/g, '');
        if (cleanPhone.length >= 10) {
          ddd = cleanPhone.substring(0, 2);
          telefoneNumero = cleanPhone.substring(2);
        }
      }

      // Função para remover acentos e caracteres especiais
      const removeAccents = (str: string): string => {
        return str.normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9\s]/g, ' ')
          .trim();
      };

      // Correção automática para CEP 29165460 (Serra, ES)
      let cidade = proposalData.clienteData.cidade;
      let uf = proposalData.clienteData.uf;
      const cepLimpo = proposalData.clienteData.cep.replace(/\D/g, '');
      
      if (cepLimpo === '29165460') {
        console.log('[INTER] 📍 Corrigindo cidade/UF para CEP 29165460: Serra, ES');
        cidade = 'Serra';
        uf = 'ES';
      }

      // Remove caracteres especiais de todos os campos de texto
      const nomeClean = removeAccents(proposalData.clienteData.nome);
      const enderecoClean = removeAccents(proposalData.clienteData.endereco);
      const bairroClean = removeAccents(proposalData.clienteData.bairro);
      const cidadeClean = removeAccents(cidade);

      console.log('[INTER] 🧹 Dados limpos:', {
        nome: nomeClean,
        endereco: enderecoClean,
        bairro: bairroClean,
        cidade: cidadeClean
      });

      // Garantir que o valor está em formato decimal com 2 casas
      const valorDecimal = Number(proposalData.valorTotal).toFixed(2);
      console.log('[INTER] 💰 Valor formatado:', valorDecimal);

      // REMOVED: dataEmissao is not valid in API v3

      const cobrancaData: CobrancaRequest = {
        seuNumero: proposalData.id.substring(0, 15), // Max 15 chars
        valorNominal: parseFloat(valorDecimal), // Garantir que é um número decimal
        // REMOVED dataEmissao - NOT VALID IN API v3 per Gemini analysis
        dataVencimento: proposalData.dataVencimento,
        numDiasAgenda: 30, // 30 days after due date for auto cancellation
        pagador: {
          nome: nomeClean,
          cpfCnpj: proposalData.clienteData.cpf.replace(/\D/g, ''), // Remove formatting
          tipoPessoa: proposalData.clienteData.cpf.replace(/\D/g, '').length <= 11 ? 'FISICA' : 'JURIDICA',
          email: proposalData.clienteData.email,
          ddd: ddd || '27', // Default to ES if not provided
          telefone: telefoneNumero || '000000000',
          endereco: enderecoClean,
          numero: proposalData.clienteData.numero,
          complemento: proposalData.clienteData.complemento || '',
          bairro: bairroClean,
          cidade: cidadeClean,
          uf: uf,
          cep: cepLimpo
        },
        // Desconto com valores válidos para API v3
        desconto: {
          codigo: 'PERCENTUALDATAINFORMADA',
          taxa: 0.01, // Mínimo exigido pela API (0.01%)
          quantidadeDias: 0, // Obrigatório para este código
          data: proposalData.dataVencimento // Data até quando o desconto é válido
        },
        // Multa e mora são opcionais mas vamos incluir com valores padrão
        multa: {
          codigo: 'PERCENTUAL',
          taxa: 2.00 // 2% de multa padrão
        },
        mora: {
          codigo: 'TAXAMENSAL', 
          taxa: 1.00 // 1% ao mês
        },
        mensagem: {
          linha1: 'SIMPIX - Empréstimo Pessoal',
          linha2: `Proposta: ${proposalData.id}`,
          linha3: 'Pague via PIX ou boleto bancário',
          linha4: 'Dúvidas: contato@simpix.com.br',
          linha5: 'www.simpix.com.br'
        }
        // REMOVED formasRecebimento - NOT VALID IN API v3 per Gemini analysis
      };

      console.log('[INTER] 🔥🔥🔥 FINAL COBRANCA DATA BEFORE SENDING 🔥🔥🔥');
      console.log('[INTER] Full object:', JSON.stringify(cobrancaData, null, 2));
      console.log('[INTER] Field check:');
      console.log('[INTER]   - seuNumero:', cobrancaData.seuNumero);
      console.log('[INTER]   - valorNominal:', cobrancaData.valorNominal, 'type:', typeof cobrancaData.valorNominal);
      console.log('[INTER]   - dataVencimento:', cobrancaData.dataVencimento);
      console.log('[INTER]   - multa present?', !!cobrancaData.multa);
      console.log('[INTER]   - mora present?', !!cobrancaData.mora);
      console.log('[INTER]   - desconto present?', !!cobrancaData.desconto);
      console.log('[INTER]   - mensagem present?', !!cobrancaData.mensagem);
      console.log('[INTER] 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥');

      const result = await this.emitirCobranca(cobrancaData);
      
      console.log(`[INTER] ✅ Collection created for proposal successfully`);
      return result;

    } catch (error) {
      console.error('[INTER] ❌ Failed to create collection for proposal:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const interBankService = new InterBankService();