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
import {
  _createCircuitBreaker,
  INTER_BREAKER_OPTIONS,
  _isCircuitBreakerOpen,
  _formatCircuitBreakerError,
} from '../lib/circuit-breaker';
import { rateLimitService } from './rateLimitService.js'; // PAM V1.0 - Rate Limiting inteligente

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
    situacao:
      | 'RECEBIDO'
      | 'A_RECEBER'
      | 'MARCADO_RECEBIDO'
      | 'ATRASADO'
      | 'CANCELADO'
      | 'EXPIRADO'
      | 'FALHA_EMISSAO'
      | 'EM_PROCESSAMENTO'
      | 'PROTESTO';
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
  private tokenBreaker: unknown;
  private apiBreaker: unknown;

  constructor() {
    // Auto-detect if we're using production credentials based on presence of INTER_CONTA_CORRENTE
    const _isProduction = !!process.env.INTER_CONTA_CORRENTE;

    this.config = {
      environment: isProduction ? 'production' : 'sandbox',
      apiUrl: isProduction
        ? 'https://cdpj.partners.bancointer.com.br'
        : 'https://cdpj-sandbox.partners.uatinter.co',
      clientId: process.env.INTER_CLIENT_ID || '',
      clientSecret: process.env.INTER_CLIENT_SECRET || '',
      certificate: process.env.INTER_CERTIFICATE || '',
      privateKey: process.env.INTER_PRIVATE_KEY || '',
      contaCorrente: process.env.INTER_CONTA_CORRENTE || '',
    };

    console.log(`[INTER] 🏦 Initialized in ${this._config.environment} mode`);
    console.log(`[INTER] 🌐 API URL: ${this._config.apiUrl}`);

    if (!this._config.clientId || !this._config.clientSecret) {
      console.warn(
        '[INTER] ⚠️ Client credentials not configured. Inter Bank integration will not work.'
      );
    }

    console.log('[INTER] 🔴 Circuit Breakers will be initialized on first use');
  }

  /**
   * Initialize circuit breakers lazily
   */
  private initializeBreakers() {
    if (!this.tokenBreaker) {
      this.tokenBreaker = createCircuitBreaker(async () => this.getAccessTokenDirect(), {
        ...INTER_BREAKER_OPTIONS,
        name: 'interTokenBreaker',
      });
    }

    if (!this.apiBreaker) {
      this.apiBreaker = createCircuitBreaker(
        async (
          endpoint: string,
          method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT' = 'GET',
          data?: unknown,
          headers?: unknown
        ) => {
          return this.makeRequestDirect(endpoint, method, _data, headers);
        },
        { ...INTER_BREAKER_OPTIONS, name: 'interApiBreaker' }
      );
    }
  }

  /**
   * Get OAuth2 access token WITH circuit breaker protection
   */
  private async getAccessToken(): Promise<string> {
    this.initializeBreakers();

    try {
      return await this.tokenBreaker.fire();
    } catch (error) {
      if (isCircuitBreakerOpen(error)) {
        console.log(formatCircuitBreakerError(error, 'Inter Token API'));
        throw new Error('Inter Bank token service temporarily unavailable');
      }
      throw error;
    }
  }

  /**
   * Direct token fetch (called by circuit breaker)
   */
  private async getAccessTokenDirect(): Promise<string> {
    try {
      // Check if we have a valid cached token
      if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
        return this.tokenCache.token;
      }

      console.log('[INTER] 🔑 Requesting new access token...');

      const _tokenUrl = new URL(`${this._config.apiUrl}/oauth/v2/token`);

      console.log(`[INTER] 🌐 Token URL: ${tokenUrl.hostname}${tokenUrl.pathname}`);
      console.log(`[INTER] 📄 Using form-based authentication per official docs`);
      console.log(
        `[INTER] 🔓 Certificate configured: ${this._config.certificate ? '✅ Present' : '❌ Missing'}`
      );
      console.log(
        `[INTER] 🔑 Private Key configured: ${this._config.privateKey ? '✅ Present' : '❌ Missing'}`
      );

      // Follow official Inter Bank documentation format
      // client_id and client_secret are REQUIRED per official docs
      const _formBody = new URLSearchParams({
        client_id: this._config.clientId,
        client_secret: this._config.clientSecret,
        grant_type: 'client_credentials',
        scope: 'boleto-cobranca.read boleto-cobranca.write webhook.read webhook.write', // All required scopes for API v3
      });

      // Log client_id length for debugging
      console.log(`[INTER] 📊 Client ID length: ${this._config.clientId.length} chars`);
      console.log(`[INTER] 📊 Client Secret length: ${this._config.clientSecret.length} chars`);

      console.log(
        `[INTER] 📝 Form parameters: client_id=***, grant_type=client_credentials, scope=${formBody.get('scope')}`
      );
      console.log(`[INTER] 📝 Form body string length: ${formBody.toString().length} chars`);
      console.log(`[INTER] 📝 Form body preview: ${formBody.toString().substring(0, 100)}...`);

      // Não logar o form body completo pois contém credenciais
      console.log(`[INTER] 🔒 Using mTLS certificate authentication`);

      // Prepare certificate and key in proper PEM format
      let _cert = this._config.certificate;
      let _key = this._config.privateKey;

      // CRITICAL FIX: Add line breaks to PEM format certificates
      // The certificates are valid PEM but in single line format
      // Node.js requires proper line breaks in PEM format

      console.log('[INTER] 🔄 Formatting certificates with proper line breaks...');

      // Fix certificate: Add line breaks after headers and every 64 characters
      if (cert.includes('-----BEGIN CERTIFICATE-----') && !cert.includes('\n')) {
        console.log('[INTER] 📋 Certificate is single-line PEM, adding line breaks...');
        // Extract the base64 content between headers
        const _certMatch = cert.match(/-----BEGIN CERTIFICATE-----(.*?)-----END CERTIFICATE-----/);
        if (certMatch && certMatch[1]) {
          const _base64Content = certMatch[1].trim();
          // Add line breaks every 64 characters
          const _formattedContent = base64Content.match(/.{1,64}/g)?.join('\n') || base64Content;
          cert = `-----BEGIN CERTIFICATE-----\n${formattedContent}\n-----END CERTIFICATE-----`;
          console.log('[INTER] ✅ Certificate formatted with line breaks');
        }
      }

      // Fix private key: Add line breaks after headers and every 64 characters
      if (key.includes('-----BEGIN') && key.includes('KEY-----') && !key.includes('\n')) {
        console.log('[INTER] 🔑 Private key is single-line PEM, adding line breaks...');
        // Extract the base64 content between headers (works for both RSA and regular private keys)
        const _keyMatch = key.match(/-----BEGIN (.+?)-----(.*?)-----END (.+?)-----/);
        if (keyMatch && keyMatch[2]) {
          const _keyType = keyMatch[1];
          const _base64Content = keyMatch[2].trim();
          // Add line breaks every 64 characters
          const _formattedContent = base64Content.match(/.{1,64}/g)?.join('\n') || base64Content;
          key = `-----BEGIN ${keyType}-----\n${formattedContent}\n-----END ${keyType}-----`;
          console.log('[INTER] ✅ Private key formatted with line breaks');
        }
      }

      // Não logar previews de certificados por segurança
      console.log('[INTER] ✅ Certificates formatted and ready');

      // SANDBOX ONLY: Try alternative approach
      if (this._config.environment == 'sandbox') {
        console.log('[INTER] ⚠️ SANDBOX MODE: Using alternative HTTPS configuration');
      }

      // Create Undici agent for proper mTLS support with Node.js fetch
      console.log('[INTER] 🔧 Creating Undici agent for mTLS...');
      const _undiciAgent = new UndiciAgent({
        connect: {
          cert: cert,
          key: key,
          ca: [], // Use system CA
          rejectUnauthorized: true, // Always validate certificates in production
        },
      });

      console.log('[INTER] 🚀 Making mTLS request with Undici agent...');

      // Declare response variable to use throughout the method
      let response: unknown;

      // Try using node fetch with undici dispatcher
      try {
        const _fetchResponse = await fetch(tokenUrl.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            // No Authorization header - credentials sent as form parameters per Inter docs
          },
          body: formBody.toString(),
          // Use dispatcher instead of agent for undici
          // @ts-ignore - dispatcher is supported but not in types
          dispatcher: undiciAgent,
        });

        console.log(`[INTER] 📡 Response status: ${fetchResponse.status}`);
        console.log(`[INTER] 📡 Response headers:`, fetchResponse.headers);

        response = {
          ok: fetchResponse.ok,
          status: fetchResponse.status,
          headers: fetchResponse.headers,
          text: async () => await fetchResponse.text(),
          json: async () => await fetchResponse.json(),
        };

        if (!response.ok) {
          const _errorText = await response.text();
          console.log(`[INTER] ❌ Error response body: ${errorText}`);

          // Try to parse error details
          if (fetchResponse.status == 400) {
            console.log('[INTER] 🔍 Bad Request - possible causes:');
            console.log('[INTER]   - Invalid grant_type or scope');
            console.log('[INTER]   - Invalid client credentials');
            console.log('[INTER]   - Missing required parameters');
            console.log(
              '[INTER]   - Response headers:',
              Object.fromEntries(fetchResponse.headers.entries())
            );
          }
        }

        // Return early if fetch succeeded
        return response;
      } catch (fetchError) {
        console.error(`[INTER] ❌ Fetch error: ${(fetchError as Error).message}`);

        // Fallback to raw HTTPS request
        console.log('[INTER] 🔄 Falling back to raw HTTPS request...');

        response = await new Promise<unknown>((resolve, reject) => {
          const _options = {
            hostname: tokenUrl.hostname,
            port: tokenUrl.port || 443,
            path: tokenUrl.pathname,
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Accept: 'application/json',
              'Content-Length': Buffer.byteLength(formBody.toString()),
              // No Authorization header - credentials sent as form parameters per Inter docs
            },
            cert: cert,
            key: key,
            rejectUnauthorized: false,
            requestCert: true,
            ciphers: 'ALL',
            secureProtocol: 'TLS_method',
          };

          const _req = https.request(options, (res) => {
            let _data = '';
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => {
              resolve({
                ok: res.statusCode && res.statusCode >= 200 && res.statusCode < 300,
                status: res.statusCode,
                headers: res.headers,
                text: async () => data,
                json: async () => {
                  try {
                    return JSON.parse(_data);
                  } catch (e) {
                    throw new Error('Invalid JSON response');
                  }
                },
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
        const _errorText = await response.text();
        console.log(`[INTER] ❌ Error response body: ${errorText}`);

        // Tentar parse JSON do erro
        try {
          const _errorJson = JSON.parse(errorText);
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
        expiresAt: Date.now() + (tokenData.expires_in - 300) * 1000,
      };

      console.log(
        `[INTER] ✅ Access token obtained successfully (expires in ${tokenData.expires_in}s)`
      );
      return tokenData.access_token;
    } catch (error) {
      console.error('[INTER] ❌ Failed to get access token:', error);
      throw error;
    }
  }

  /**
   * Make authenticated request to Inter API WITH circuit breaker protection
   */
  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT' = 'GET',
    data?: unknown,
    additionalHeaders?: Record<string, string>
  ): Promise<unknown> {
    this.initializeBreakers();

    try {
      return await this.apiBreaker.fire(endpoint, method, _data, additionalHeaders);
    } catch (error) {
      if (isCircuitBreakerOpen(error)) {
        console.log(formatCircuitBreakerError(error, 'Inter API'));
        throw new Error('Inter Bank API temporarily unavailable - circuit breaker is OPEN');
      }
      throw error;
    }
  }

  /**
   * Direct API request (called by circuit breaker)
   * CRITICAL FIX: Now properly uses HTTPS with mTLS configuration like getAccessToken
   */
  private async makeRequestDirect(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT' = 'GET',
    data?: unknown,
    additionalHeaders?: Record<string, string>
  ): Promise<unknown> {
    try {
      const _token = await this.getAccessToken();
      const _url = new URL(`${this._config.apiUrl}${endpoint}`);

      console.log('[INTER] ======= REQUEST DETAILS =======');
      console.log(`[INTER] 🌐 FULL URL: ${url.toString()}`);
      console.log(`[INTER] 🔧 METHOD: ${method}`);
      console.log(`[INTER] 🪙 TOKEN (first 20 chars):', ${token.substring(0, 20)}...`);
      console.log('[INTER] ========================');

      // CRITICAL: Use HTTPS request with mTLS like getAccessToken
      return new Promise((resolve, reject) => {
        // Format certificates first (same logic as getAccessToken)
        let _cert = this._config.certificate;
        let _key = this._config.privateKey;

        // Fix certificate format if needed
        if (cert.includes('-----BEGIN CERTIFICATE-----') && !cert.includes('\n')) {
          console.log('[INTER] 📋 Certificate is single-line PEM, adding line breaks...');
          const _certMatch = cert.match(
            /-----BEGIN CERTIFICATE-----(.*?)-----END CERTIFICATE-----/
          );
          if (certMatch && certMatch[1]) {
            const _base64Content = certMatch[1].trim();
            const _formattedContent = base64Content.match(/.{1,64}/g)?.join('\n') || base64Content;
            cert = `-----BEGIN CERTIFICATE-----\n${formattedContent}\n-----END CERTIFICATE-----`;
          }
        }

        // Fix private key format if needed
        if (key.includes('-----BEGIN') && key.includes('KEY-----') && !key.includes('\n')) {
          console.log('[INTER] 🔑 Private key is single-line PEM, adding line breaks...');
          const _keyMatch = key.match(/-----BEGIN (.+?)-----(.*?)-----END (.+?)-----/);
          if (keyMatch && keyMatch[2]) {
            const _keyType = keyMatch[1];
            const _base64Content = keyMatch[2].trim();
            const _formattedContent = base64Content.match(/.{1,64}/g)?.join('\n') || base64Content;
            key = `-----BEGIN ${keyType}-----\n${formattedContent}\n-----END ${keyType}-----`;
          }
        }

        // Prepare headers
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'User-Agent': 'SIMPIX-Inter-Integration/1.0', // Added per Claude's suggestion
          ...additionalHeaders, // Merge additional headers (like Accept: application/pdf)
        };

        // Add account header if configured
        if (this._config.contaCorrente) {
          headers['x-conta-corrente'] = this._config.contaCorrente;
          console.log('[INTER] 🏦 CONTA CORRENTE HEADER ADDED:', this._config.contaCorrente);
        } else {
          console.log('[INTER] ⚠️ NO CONTA CORRENTE CONFIGURED!');
        }

        // Prepare body if needed
        let body: string | undefined;
        if (data && (method == 'POST' || method == 'PATCH' || method == 'PUT')) {
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify(_data); // NO CUSTOM STRINGIFY - Use standard JSON
          console.log('[INTER] 📦 REQUEST BODY:', body);
        }

        console.log('[INTER] 🔑 ALL HEADERS:', JSON.stringify(headers, null, 2));

        const _options = {
          hostname: url.hostname,
          port: url.port || 443,
          path: url.pathname + url.search,
          method: method,
          headers: {
            ...headers,
            ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
          },
          cert: cert,
          key: key,
          rejectUnauthorized: this._config.environment == 'production',
          requestCert: true,
          timeout: 30000,
        };

        const _req = https.request(options, (res) => {
          const chunks: Buffer[] = [];

          console.log('[INTER] ======= RESPONSE DETAILS =======');
          console.log(`[INTER] 📊 STATUS: ${res.statusCode} ${res.statusMessage}`);
          console.log('[INTER] 📋 RESPONSE HEADERS:', res.headers);

          // Check if response is PDF
          const _isPdf = res.headers['content-type']?.includes('application/pdf');
          console.log(`[INTER] 🔍 Response Content-Type: ${res.headers['content-type']}`);
          console.log(`[INTER] 🔍 Is PDF Response: ${isPdf}`);

          res.on('data', (chunk) => {
            chunks.push(Buffer.from(chunk));
          });

          res.on('end', () => {
            const _buffer = Buffer.concat(chunks);
            console.log(`[INTER] 📦 Response buffer size: ${buffer.length} bytes`);

            if (!res.statusCode || res.statusCode >= 400) {
              console.log('[INTER] ❌❌❌ ERROR RESPONSE ❌❌❌');
              console.log(`[INTER] 🚨 Status Code: ${res.statusCode}`);

              const _errorText = buffer.toString('utf-8');
              console.log(`[INTER] 🚨 Error Body: "${errorText}"`);
              console.log(`[INTER] 🚨 Error Body Length: ${errorText.length} chars`);

              // Enhanced PDF-specific error logging
              if (endpoint.includes('/pdf')) {
                console.log('[INTER] 📄 PDF ENDPOINT ERROR ANALYSIS:');
                console.log(`[INTER] 📄 Requested endpoint: ${endpoint}`);
                console.log(`[INTER] 📄 Accept header sent: ${headers['Accept']}`);
                console.log(`[INTER] 📄 Content-Type received: ${res.headers['content-type']}`);
              }

              if (errorText.length == 0) {
                console.log('[INTER] 📋 EMPTY ERROR BODY!');
                console.log('[INTER] 📋 Response headers for debugging:', res.headers);
              } else {
                try {
                  const _errorJson = JSON.parse(errorText);
                  console.log('[INTER] 📋 Error as JSON:', JSON.stringify(errorJson, null, 2));
                } catch (e) {
                  console.log('[INTER] 📋 Error is not JSON, raw text:', errorText);
                }
              }

              console.log('[INTER] ❌❌❌ END ERROR RESPONSE ❌❌❌');
              reject(
                new Error(`Inter API error: ${res.statusCode} - ${errorText || 'Empty response'}`)
              );
              return;
            }

            console.log('[INTER] ✅ Response OK');
            console.log('[INTER] =========================');

            // Handle empty responses (204 No Content or DELETE)
            if (res.statusCode == 204 || buffer.length == 0) {
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
              const _responseText = buffer.toString('utf-8');
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
      console.log(`[INTER]   - Environment: ${this._config.environment}`);
      console.log(`[INTER]   - API URL: ${this._config.apiUrl}`);
      console.log(
        `[INTER]   - Client ID: ${this._config.clientId ? '✅ Present (' + this._config.clientId.substring(0, 8) + '...)' : '❌ Missing'}`
      );
      console.log(
        `[INTER]   - Client Secret: ${this._config.clientSecret ? '✅ Present (' + this._config.clientSecret.substring(0, 8) + '...)' : '❌ Missing'}`
      );
      console.log(
        `[INTER]   - Certificate: ${this._config.certificate ? '✅ Present (' + this._config.certificate.length + ' chars)' : '❌ Missing'}`
      );
      console.log(
        `[INTER]   - Private Key: ${this._config.privateKey ? '✅ Present (' + this._config.privateKey.length + ' chars)' : '❌ Missing'}`
      );
      console.log(
        `[INTER]   - Conta Corrente: ${this._config.contaCorrente ? '✅ Present (' + this._config.contaCorrente + ')' : '❌ Missing'}`
      );

      if (!this._config.clientId || !this._config.clientSecret) {
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
   * Create a new collection (boleto/PIX) with Rate Limiting
   */
  async emitirCobranca(cobrancaData: CobrancaRequest): Promise<CobrancaResponse> {
    try {
      console.log(`[INTER] 📤 Creating collection: ${cobrancaData.seuNumero}`);

      // Log COMPLETE request data for debugging
      console.log('[INTER] 📋 COMPLETE Request data:', JSON.stringify(cobrancaData, null, 2));

      // PAM V1.0 - Execute with intelligent rate limiting
      const _response = await rateLimitService.executeWithRateLimit(
        'inter-api-cobranca',
        async () => this.makeRequest('/cobranca/v3/cobrancas', 'POST', cobrancaData),
        {
          maxRequestsPerSecond: 5,
          maxRetries: 3,
          baseDelayMs: 1000,
          maxDelayMs: 30000,
        }
      );

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
  async recuperarCobranca(codigoSolicitacao: string): Promise<unknown> {
    try {
      console.log(`[INTER] 📋 Retrieving collection: ${codigoSolicitacao}`);

      const _response = await this.makeRequest(`/cobranca/v3/cobrancas/${codigoSolicitacao}`);

      console.log(`[INTER] 📊 Collection data:`, JSON.stringify(_response, null, 2));

      // Enriquecer dados com campos adicionais
      const _enrichedData = {
        ...response,
        // Garantir que temos a linha digitável completa
        linhaDigitavel: response.boleto?.linhaDigitavel || response.linhaDigitavel,
        codigoBarras: response.boleto?.codigoBarras || response.codigoBarras,
        // Se tiver PIX, gerar QR code
        qrCode: response.pix?.pixCopiaECola
          ? this.generateQRCodeBase64(response.pix.pixCopiaECola)
          : null,
        pixCopiaECola: response.pix?.pixCopiaECola || null,
      };

      console.log(`[INTER] ✅ Collection retrieved and enriched successfully`);
      console.log(`[INTER] 📊 Linha digitável: ${enrichedData.linhaDigitavel}`);
      console.log(`[INTER] 📊 Código de barras: ${enrichedData.codigoBarras}`);
      console.log(`[INTER] 📊 PIX disponível: ${enrichedData.pixCopiaECola ? 'Sim' : 'Não'}`);

      return enrichedData;
    } catch (error) {
      console.error('[INTER] ❌ Failed to retrieve collection:', error);
      throw error;
    }
  }

  /**
   * Gera QR Code em base64 a partir do código PIX
   */
  private generateQRCodeBase64(pixCode: string): string | null {
    try {
      // Por enquanto, retornar null - em produção, usar biblioteca QR code
      console.log(`[INTER] ⚠️ QR Code generation not implemented yet`);
      return null;
    } catch (error) {
      console.error('[INTER] ❌ Failed to generate QR code:', error);
      return null;
    }
  }

  /**
   * Search collections with filters
   */
  async pesquisarCobrancas(filters: {
    dataInicial: string; // YYYY-MM-DD
    dataFinal: string; // YYYY-MM-DD
    filtrarDataPor?: 'VENCIMENTO' | 'EMISSAO' | 'PAGAMENTO';
    situacao?:
      | 'RECEBIDO'
      | 'A_RECEBER'
      | 'MARCADO_RECEBIDO'
      | 'ATRASADO'
      | 'CANCELADO'
      | 'EXPIRADO';
    pessoaPagadora?: string;
    cpfCnpjPessoaPagadora?: string;
    seuNumero?: string;
    tipoCobranca?: 'SIMPLES' | 'PARCELADO' | 'RECORRENTE';
    itensPorPagina?: number;
    paginaAtual?: number;
  }): Promise<unknown> {
    try {
      console.log(
        `[INTER] 🔍 Searching collections from ${filters.dataInicial} to ${filters.dataFinal}`
      );

      const _queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          if (key == 'itensPorPagina') {
            queryParams.append('paginacao.itensPorPagina', value.toString());
          } else if (key == 'paginaAtual') {
            queryParams.append('paginacao.paginaAtual', value.toString());
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });

      const _response = await this.makeRequest(`/cobranca/v3/cobrancas?${queryParams.toString()}`);

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
  async editarCobranca(
    codigoSolicitacao: string,
    updateData: Partial<CobrancaRequest>
  ): Promise<unknown> {
    try {
      console.log(`🔍 [AUDIT-INTER] ==== EDITANDO COBRANÇA ====`);
      console.log(`🔍 [AUDIT-INTER] Código Solicitação: ${codigoSolicitacao}`);
      console.log(`🔍 [AUDIT-INTER] Payload Exato Enviado:`, JSON.stringify(updateData, null, 2));

      const _response = await this.makeRequest(
        `/cobranca/v3/cobrancas/${codigoSolicitacao}`,
        'PATCH',
        updateData
      );

      console.log(`🔍 [AUDIT-INTER] Resposta Completa da API:`, {
        statusRecebido: response ? 'Success' : 'Null response',
        dadosRetornados: JSON.stringify(_response, null, 2),
      });
      console.log(`🔍 [AUDIT-INTER] ==== FIM EDIÇÃO ====`);

      return response;
    } catch (error) {
      console.error('🔍 [AUDIT-INTER] ❌ Erro ao editar cobrança:', error);
      throw error;
    }
  }

  /**
   * Cancel a collection
   */
  async cancelarCobranca(
    codigoSolicitacao: string,
    motivoCancelamento: string = 'CANCELAMENTO_ADMINISTRATIVO'
  ): Promise<unknown> {
    try {
      console.log(`🔍 [AUDIT-INTER] ==== CANCELANDO COBRANÇA ====`);
      console.log(`🔍 [AUDIT-INTER] Código Solicitação: ${codigoSolicitacao}`);
      console.log(`🔍 [AUDIT-INTER] Motivo: ${motivoCancelamento}`);

      const _response = await this.makeRequest(
        `/cobranca/v3/cobrancas/${codigoSolicitacao}/cancelamento`,
        'POST',
        { motivoCancelamento }
      );

      console.log(`🔍 [AUDIT-INTER] Resposta do Cancelamento:`, JSON.stringify(_response, null, 2));
      console.log(`🔍 [AUDIT-INTER] ==== FIM CANCELAMENTO ====`);

      return response;
    } catch (error) {
      console.error('🔍 [AUDIT-INTER] ❌ Erro ao cancelar cobrança:', error);
      throw error;
    }
  }

  /**
   * Get collection PDF using direct API endpoint
   * CORREÇÃO: API Inter exige Accept: application/json mas retorna PDF
   */
  async obterPdfCobranca(codigoSolicitacao: string): Promise<Buffer> {
    console.log(`[INTER] 📄 SOLUÇÃO IDENTIFICADA: API v3 retorna PDF como base64 em JSON`);
    console.log(`[INTER] 🔍 Processando codigoSolicitacao: ${codigoSolicitacao}`);

    try {
      // Verificar se cobrança existe
      console.log(`[INTER] 🔍 STEP 1: Verificando se cobrança existe...`);
      await this.recuperarCobranca(codigoSolicitacao);
      console.log(`[INTER] ✅ Cobrança existe, prosseguindo para PDF...`);

      // FAZER REQUISIÇÃO PARA O ENDPOINT /pdf
      console.log(`[INTER] 🔍 STEP 2: Buscando PDF (esperando JSON com base64)...`);
      const _response = await this.makeRequest(
        `/cobranca/v3/cobrancas/${codigoSolicitacao}/pdf`,
        'GET',
        _null,
        {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }
      );

      console.log(`[INTER] 📊 Tipo de resposta:`, typeof response);

      // SOLUÇÃO PRINCIPAL: API retorna JSON com PDF em base64
      if (typeof response == 'object' && response !== null) {
        console.log(`[INTER] 📋 Resposta é JSON, procurando campo base64...`);
        console.log(`[INTER] 📋 Campos disponíveis no JSON:`, Object.keys(_response));

        // Procurar possíveis campos que contenham o PDF base64
        const _possibleFields = [
          'pdf',
          'arquivo',
          'base64',
          'conteudo',
          'content',
          'data',
          'document',
          'boleto',
          'file',
          'documento',
        ];

        let _base64String = null;
        let _foundField = null;

        for (const field of possibleFields) {
          if (response[field]) {
            console.log(
              `[INTER] ✅ Campo '${field}' encontrado com ${response[field].length} caracteres`
            );
            base64String = response[field];
            foundField = field;
            break;
          }
        }

        // Se não encontrou em campo direto, verificar estrutura aninhada
        if (!base64String && response.data) {
          console.log(`[INTER] 🔍 Verificando estrutura aninhada em 'data'...`);
          if (typeof response.data == 'string') {
            base64String = response.data;
            foundField = 'data';
          } else if (response.data.pdf) {
            base64String = response.data.pdf;
            foundField = 'data.pdf';
          }
        }

        // Se ainda não encontrou, logar toda a estrutura para debug
        if (!base64String) {
          console.log(`[INTER] ⚠️ PDF não encontrado nos campos conhecidos`);
          console.log(`[INTER] 📋 Estrutura completa do JSON (primeiros 500 chars):`);
          console.log(JSON.stringify(_response, null, 2).substring(0, 500));

          // Tentar campos menos óbvios
          for (const key in response) {
            if (typeof response[key] == 'string' && response[key].length > 1000) {
              console.log(
                `[INTER] 🔍 Campo '${key}' tem ${response[key].length} chars, pode ser base64`
              );
              base64String = response[key];
              foundField = key;
              break;
            }
          }
        }

        if (base64String) {
          console.log(`[INTER] ✅ Base64 encontrado no campo '${foundField}'`);
          console.log(`[INTER] 📊 Tamanho do base64: ${base64String.length} caracteres`);

          // Limpar possíveis prefixos de data URL
          if (base64String.startsWith('data:application/pdf;base64,')) {
            base64String = base64String.replace('data:application/pdf;base64,', '');
            console.log(`[INTER] 🔧 Removido prefixo data URL`);
          }

          // Converter base64 para Buffer
          const _pdfBuffer = Buffer.from(base64String, 'base64');
          console.log(`[INTER] ✅ PDF convertido: ${pdfBuffer.length} bytes`);

          // Validar se é realmente um PDF
          const _pdfMagic = pdfBuffer.slice(0, 5).toString('ascii');
          if (pdfMagic.startsWith('%PDF')) {
            console.log(`[INTER] ✅ PDF VÁLIDO CONFIRMADO! Magic bytes: ${pdfMagic}`);
            return pdfBuffer;
          } else {
            console.log(
              `[INTER] ⚠️ Buffer não parece ser PDF. Primeiros bytes:`,
              pdfBuffer.slice(0, 20)
            );
            // Tentar retornar mesmo assim
            return pdfBuffer;
          }
        }
      }

      // Se response é Buffer direto (improvável na v3)
      if (response instanceof Buffer) {
        console.log(`[INTER] 📊 Resposta é Buffer direto`);
        const _pdfMagic = response.slice(0, 5).toString('utf8');
        if (pdfMagic.startsWith('%PDF')) {
          console.log(`[INTER] ✅ PDF binário válido (${response.length} bytes)`);
          return response;
        }
      }

      // Se response é string (pode ser base64 direto)
      if (typeof response == 'string') {
        console.log(`[INTER] 📊 Resposta é string, tentando decodificar como base64...`);
        try {
          const _pdfBuffer = Buffer.from(_response, 'base64');
          const _pdfMagic = pdfBuffer.slice(0, 5).toString('utf8');

          if (pdfMagic.startsWith('%PDF')) {
            console.log(`[INTER] ✅ Base64 decodificado com sucesso (${pdfBuffer.length} bytes)`);
            return pdfBuffer;
          }
        } catch (decodeError) {
          console.error(`[INTER] ❌ Falha ao decodificar base64:`, decodeError);
        }
      }

      // Se chegou aqui, não conseguiu processar
      console.error(`[INTER] ❌ Não foi possível processar a resposta:`, {
        type: typeof response,
        isBuffer: response instanceof Buffer,
        isObject: typeof response == 'object',
        keys: typeof response == 'object' ? Object.keys(_response) : 'N/A',
      });

      throw new Error('PDF não encontrado na resposta da API - formato inesperado');
    } catch (error) {
      console.error('[INTER] ❌ Erro ao obter PDF:', error.message);

      // Tentar endpoints alternativos
      if (!error.message?.includes('não encontrado na API')) {
        console.log('[INTER] 🔄 Tentando endpoints alternativos...');
        return this.tentarEndpointsAlternativos(codigoSolicitacao);
      }

      throw error;
    }
  }

  // Método auxiliar para tentar endpoints alternativos
  private async tentarEndpointsAlternativos(codigoSolicitacao: string): Promise<Buffer> {
    console.log(`[INTER] 🔄 Testando endpoints alternativos para PDF...`);

    const _alternativeEndpoints = [
      `/cobranca/v3/cobrancas/${codigoSolicitacao}/pdf/download`,
      `/cobranca/v3/cobrancas/${codigoSolicitacao}/arquivo`,
      `/cobranca/v3/cobrancas/${codigoSolicitacao}/documento`,
      `/banking/v2/cobrancas/${codigoSolicitacao}/pdf`,
    ];

    for (const endpoint of alternativeEndpoints) {
      try {
        console.log(`[INTER] 🔄 Tentando: ${endpoint}`);

        const _response = await this.makeRequest(endpoint, 'GET', null, {
          Accept: 'application/pdf, application/json',
          'Content-Type': 'application/json',
        });

        // Processar resposta similar ao método principal
        if (typeof response == 'object' && response.pdf) {
          console.log(`[INTER] ✅ PDF encontrado em endpoint alternativo!`);
          return Buffer.from(response.pdf, 'base64');
        }

        if (
          response instanceof Buffer &&
          response.slice(0, 5).toString('utf8').startsWith('%PDF')
        ) {
          console.log(`[INTER] ✅ PDF binário encontrado em endpoint alternativo!`);
          return response;
        }
      } catch (err) {
        console.log(`[INTER] ❌ Endpoint ${endpoint} falhou`);
      }
    }

    throw new Error('Nenhum endpoint funcionou para obter o PDF');
  }

  /**
   * Método de debug para analisar resposta da API
   * USADO PARA DIAGNOSTICAR O PROBLEMA DO PDF
   */
  async debugPdfResponse(codigoSolicitacao: string): Promise<unknown> {
    console.log(`[INTER] 🔍 DEBUG MODE: Analisando resposta completa da API`);

    try {
      const _response = await this.makeRequest(`/cobranca/v3/cobrancas/${codigoSolicitacao}/pdf`);

      console.log('[INTER] 🔍 RESPOSTA COMPLETA DA API:');
      console.log('Data type:', typeof response);

      if (response instanceof Buffer) {
        console.log('Buffer size:', response.length);
        console.log('Is PDF:', response.slice(0, 5).toString('utf8').startsWith('%PDF'));
      } else if (typeof response == 'object') {
        console.log('Object keys:', Object.keys(_response));
        console.log('Sample (first 1000 chars):');
        console.log(JSON.stringify(_response, null, 2).substring(0, 1000));

        // Verificar cada campo
        for (const key in response) {
          const _value = response[key];
          console.log(`Field '${key}':`, {
            type: typeof value,
            length: typeof value == 'string' ? value.length : 'N/A',
            preview: typeof value == 'string' ? value.substring(0, 50) + '...' : value,
          });
        }
      }

      return response;
    } catch (error) {
      console.error('[INTER] ❌ Debug failed:', error.message);
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
  }): Promise<unknown> {
    try {
      console.log(`[INTER] 📊 Getting collections summary`);

      const _queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });

      const _response = await this.makeRequest(
        `/cobranca/v3/cobrancas/sumario?${queryParams.toString()}`
      );

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
  async configurarWebhook(webhookData: WebhookData): Promise<unknown> {
    try {
      console.log(`[INTER] 🔗 Setting up webhook: ${webhookData.url}`);

      const _response = await this.makeRequest('/webhook', 'PUT', webhookData);

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
  async obterWebhook(): Promise<unknown> {
    try {
      console.log(`[INTER] 🔗 Getting webhook configuration`);

      const _response = await this.makeRequest('/webhook');

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
  async excluirWebhook(): Promise<unknown> {
    try {
      console.log(`[INTER] 🗑️ Deleting webhook`);

      const _response = await this.makeRequest('/webhook', 'DELETE');

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
  async pagarCobrancaSandbox(codigoSolicitacao: string, valorPago: number): Promise<unknown> {
    try {
      if (this._config.environment !== 'sandbox') {
        throw new Error('Payment simulation is only available in sandbox environment');
      }

      console.log(`[INTER] 💰 Simulating payment for collection: ${codigoSolicitacao}`);

      const _response = await this.makeRequest(
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
      let _ddd = '';
      let _telefoneNumero = '';
      if (proposalData.clienteData.telefone) {
        // Remove all non-numeric characters
        const _cleanPhone = proposalData.clienteData.telefone.replace(/\D/g, '');
        if (cleanPhone.length >= 10) {
          ddd = cleanPhone.substring(0, 2);
          telefoneNumero = cleanPhone.substring(2);
        }
      }

      // Função para remover acentos e caracteres especiais
      const _removeAccents = (str: string): string => {
        return str
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9\s]/g, ' ')
          .trim();
      };

      // Correção automática para CEP 29165460 (Serra, ES)
      let _cidade = proposalData.clienteData.cidade;
      let _uf = proposalData.clienteData.uf;
      const _cepLimpo = proposalData.clienteData.cep.replace(/\D/g, '');

      if (cepLimpo == '29165460') {
        console.log('[INTER] 📍 Corrigindo cidade/UF para CEP 29165460: Serra, ES');
        cidade = 'Serra';
        uf = 'ES';
      }

      // Remove caracteres especiais de todos os campos de texto
      const _nomeClean = removeAccents(proposalData.clienteData.nome);
      const _enderecoClean = removeAccents(proposalData.clienteData.endereco);
      const _bairroClean = removeAccents(proposalData.clienteData.bairro);
      const _cidadeClean = removeAccents(cidade);

      console.log('[INTER] 🧹 Dados limpos:', {
        nome: nomeClean,
        endereco: enderecoClean,
        bairro: bairroClean,
        cidade: cidadeClean,
      });

      // Garantir que o valor está em formato decimal com 2 casas
      const _valorDecimal = Number(proposalData.valorTotal).toFixed(2);
      console.log('[INTER] 💰 Valor formatado:', valorDecimal);

      // REMOVED: dataEmissao is not valid in API v3

      // 🔥 FIX: Garantir seuNumero único para cada parcela
      // Se o ID contém "-" seguido de número no final (ex: "proposta-id-1"), preservar isso
      let _seuNumeroUnico = proposalData.id;

      // Se o ID é muito longo, precisamos ser inteligentes ao truncar
      if (seuNumeroUnico.length > 15) {
        // Verificar se tem sufixo de parcela (ex: "-1", "-2", etc)
        const _parcelaMatch = seuNumeroUnico.match(/-(\d+)$/);
        if (parcelaMatch) {
          // Tem sufixo de parcela, preservar ele
          const _sufixoParcela = parcelaMatch[0]; // ex: "-1"
          const _prefixo = seuNumeroUnico.substring(0, 15 - sufixoParcela.length);
          seuNumeroUnico = prefixo + sufixoParcela;
        } else {
          // Não tem sufixo, apenas truncar
          seuNumeroUnico = seuNumeroUnico.substring(0, 15);
        }
      }

      console.log(`[INTER] 🔑 seuNumero único gerado: ${seuNumeroUnico}`);

      const cobrancaData: CobrancaRequest = {
        seuNumero: seuNumeroUnico, // Agora é único para cada parcela
        valorNominal: parseFloat(valorDecimal), // Garantir que é um número decimal
        // REMOVED dataEmissao - NOT VALID IN API v3 per Gemini analysis
        dataVencimento: proposalData.dataVencimento,
        numDiasAgenda: 30, // 30 days after due date for auto cancellation
        pagador: {
          nome: nomeClean,
          cpfCnpj: proposalData.clienteData.cpf.replace(/\D/g, ''), // Remove formatting
          tipoPessoa:
            proposalData.clienteData.cpf.replace(/\D/g, '').length <= 11 ? 'FISICA' : 'JURIDICA',
          email: proposalData.clienteData.email,
          ddd: ddd || '27', // Default to ES if not provided
          telefone: telefoneNumero || '000000000',
          endereco: enderecoClean,
          numero: proposalData.clienteData.numero,
          complemento: proposalData.clienteData.complemento || '',
          bairro: bairroClean,
          cidade: cidadeClean,
          uf: uf,
          cep: cepLimpo,
        },
        // Desconto com valores válidos para API v3
        desconto: {
          codigo: 'PERCENTUALDATAINFORMADA',
          taxa: 0.01, // Mínimo exigido pela API (0.01%)
          quantidadeDias: 0, // Obrigatório para este código
          data: proposalData.dataVencimento, // Data até quando o desconto é válido
        },
        // Multa e mora são opcionais mas vamos incluir com valores padrão
        multa: {
          codigo: 'PERCENTUAL',
          taxa: 2.0, // 2% de multa padrão
        },
        mora: {
          codigo: 'TAXAMENSAL',
          taxa: 1.0, // 1% ao mês
        },
        mensagem: {
          linha1: 'SIMPIX - Empréstimo Pessoal',
          linha2: `Proposta: ${proposalData.id}`,
          linha3: 'Pague via PIX ou boleto bancário',
          linha4: 'Dúvidas: contato@simpix.com.br',
          linha5: 'www.simpix.com.br',
        },
        // REMOVED formasRecebimento - NOT VALID IN API v3 per Gemini analysis
      };

      console.log('[INTER] 🔥🔥🔥 FINAL COBRANCA DATA BEFORE SENDING 🔥🔥🔥');
      console.log('[INTER] Full object:', JSON.stringify(cobrancaData, null, 2));
      console.log('[INTER] Field check:');
      console.log('[INTER]   - seuNumero:', cobrancaData.seuNumero);
      console.log(
        '[INTER]   - valorNominal:',
        cobrancaData.valorNominal,
        'type:',
        typeof cobrancaData.valorNominal
      );
      console.log('[INTER]   - dataVencimento:', cobrancaData.dataVencimento);
      console.log('[INTER]   - multa present?', !!cobrancaData.multa);
      console.log('[INTER]   - mora present?', !!cobrancaData.mora);
      console.log('[INTER]   - desconto present?', !!cobrancaData.desconto);
      console.log('[INTER]   - mensagem present?', !!cobrancaData.mensagem);
      console.log('[INTER] 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥');

      const _result = await this.emitirCobranca(cobrancaData);

      console.log(`[INTER] ✅ Collection created for proposal successfully`);
      return result;
    } catch (error) {
      console.error('[INTER] ❌ Failed to create collection for proposal:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const _interBankService = new InterBankService();
