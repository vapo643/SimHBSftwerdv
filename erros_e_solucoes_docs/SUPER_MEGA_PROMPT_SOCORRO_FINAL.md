### Diagnóstico de Emergência: Erro 400 na API do Banco Inter

### Persona e Objetivo

Você é um Engenheiro de Integrações Sênior, especialista em APIs bancárias brasileiras, com foco em segurança (OAuth2/mTLS) e em depuração de erros complexos. Sua missão é analisar a implementação fornecida, identificar a causa raiz do erro `400 Bad Request` com corpo vazio na API do Banco Inter e fornecer uma solução completa e refatorada.

### Contexto Crítico do Problema

Estamos tentando integrar a API v3 de Cobranças do Banco Inter e estamos recebendo um erro `400 Bad Request` com corpo de resposta vazio. Já esgotamos múltiplas vias de depuração, incluindo: validação de todos os campos obrigatórios do payload conforme a documentação, formatação dos certificados mTLS, testes de autenticação OAuth2 e alternância entre as versões v2 e v3 da API. O erro persistente e a falta de uma mensagem de erro detalhada sugerem um problema na camada de transporte ou na configuração mTLS, antes que a aplicação processe a requisição.

Detalhes do ambiente:
- URL de produção: `https://cdpj.partners.bancointer.com.br`
- Versão da API: v3
- Autenticação OAuth2 funciona corretamente (token obtido com sucesso)
- Erro ocorre especificamente no endpoint `/cobranca/v3/cobrancas` (POST)
- Response headers incluem `traceparent` mas corpo vazio (0 bytes)

### Evidência Bruta 1: Código-Fonte da Implementação Atual

#### 1. SERVIÇO COMPLETO - server/services/interBankService.ts

```typescript
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
  dataEmissao: string; // YYYY-MM-DD format - Data de emissão
  dataVencimento: string; // YYYY-MM-DD format
  numDiasAgenda: number; // 0-60 days for auto cancellation
  pagador: ClientData;
  desconto?: {
    codigo: 'PERCENTUALDATAINFORMADA' | 'VALORFIXODATAINFORMADA' | 'PERCENTUAL' | 'VALORFIXO';
    taxa?: number;
    valor?: number;
    quantidadeDias?: number;
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
  formasRecebimento?: ('BOLETO' | 'PIX')[];
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
   * Make authenticated request to Inter API
   */
  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT' = 'GET', data?: any): Promise<any> {
    try {
      const token = await this.getAccessToken();
      const url = `${this.config.apiUrl}${endpoint}`;

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      // Add account header if configured
      if (this.config.contaCorrente) {
        headers['x-conta-corrente'] = this.config.contaCorrente;
        console.log('[INTER] 🏦 CONTA CORRENTE HEADER ADDED:', this.config.contaCorrente);
      } else {
        console.log('[INTER] ⚠️ NO CONTA CORRENTE CONFIGURED!');
      }

      const options: RequestInit = {
        method,
        headers
      };

      if (data && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
        // Custom JSON stringifier to preserve decimal format for valorNominal
        const customStringify = (obj: any): string => {
          const json = JSON.stringify(obj, (key, value) => {
            // Force numeric fields to have decimal format
            if ((key === 'valorNominal' || key === 'taxa' || key === 'valor') && typeof value === 'number') {
              // Return as string temporarily to preserve format
              return `__DECIMAL__${value.toFixed(2)}__`;
            }
            return value;
          });
          
          // Replace the temporary string with actual decimal number
          return json.replace(/"__DECIMAL__([\d.]+)__"/g, '$1');
        };
        
        options.body = customStringify(data);
        console.log('[INTER] 📦 REQUEST BODY (RAW):', options.body);
        console.log('[INTER] 📦 REQUEST BODY (PRETTY):', JSON.stringify(data, null, 2));
      }

      console.log('[INTER] ========== REQUEST DETAILS ==========');
      console.log(`[INTER] 🌐 FULL URL: ${url}`);
      console.log(`[INTER] 🔧 METHOD: ${method}`);
      console.log('[INTER] 🔑 ALL HEADERS:', JSON.stringify(headers, null, 2));
      console.log(`[INTER] 🪙 TOKEN (first 20 chars): ${token.substring(0, 20)}...`);
      console.log('[INTER] ===================================');

      const response = await fetch(url, options);

      console.log('[INTER] ========== RESPONSE DETAILS ==========');
      console.log(`[INTER] 📊 STATUS: ${response.status} ${response.statusText}`);
      console.log(`[INTER] 📋 RESPONSE HEADERS:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.log('[INTER] ❌❌❌ ERROR RESPONSE ❌❌❌');
        console.log(`[INTER] 🚨 Status Code: ${response.status}`);
        console.log(`[INTER] 🚨 Status Text: ${response.statusText}`);
        console.log(`[INTER] 🚨 Error Body (raw): "${errorText}"`);
        console.log(`[INTER] 🚨 Error Body Length: ${errorText.length} chars`);
        
        if (errorText.length === 0) {
          console.log('[INTER] 📋 EMPTY ERROR BODY!');
        } else {
          try {
            const errorJson = JSON.parse(errorText);
            console.log('[INTER] 📋 Parsed error JSON:', JSON.stringify(errorJson, null, 2));
          } catch (e) {
            console.log('[INTER] 📋 Error is not JSON, raw text:', errorText);
          }
        }
        
        console.log('[INTER] ❌❌❌ END ERROR RESPONSE ❌❌❌');
        throw new Error(`Inter API error: ${response.status} - ${errorText}`);
      }

      const responseText = await response.text();
      
      // Return text for DELETE methods that might not return JSON
      if (method === 'DELETE' && !responseText) {
        return { success: true };
      }

      try {
        return JSON.parse(responseText);
      } catch (e) {
        return responseText;
      }

    } catch (error) {
      console.error(`[INTER] Request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Test connection to Inter Bank API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getAccessToken();
      return true;
    } catch (error) {
      console.error('[INTER] Connection test failed:', error);
      return false;
    }
  }

  /**
   * Emitir cobrança (boleto com PIX)
   */
  async emitirCobranca(cobrancaData: CobrancaRequest): Promise<CobrancaResponse> {
    try {
      console.log(`[INTER] 📤 Creating collection: ${cobrancaData.seuNumero}`);
      
      // Validate and log field types for debugging
      console.log('[INTER] 🔥🔥🔥 FINAL COBRANCA DATA BEFORE SENDING 🔥🔥🔥');
      console.log('[INTER] Full object:', JSON.stringify(cobrancaData, null, 2));
      console.log('[INTER] Field check:');
      console.log(`[INTER]   - seuNumero: ${cobrancaData.seuNumero}`);
      console.log(`[INTER]   - valorNominal: ${cobrancaData.valorNominal} type: ${typeof cobrancaData.valorNominal}`);
      console.log(`[INTER]   - dataEmissao: ${cobrancaData.dataEmissao}`);
      console.log(`[INTER]   - dataVencimento: ${cobrancaData.dataVencimento}`);
      console.log(`[INTER]   - multa present? ${!!cobrancaData.multa}`);
      console.log(`[INTER]   - mora present? ${!!cobrancaData.mora}`);
      console.log(`[INTER]   - desconto present? ${!!cobrancaData.desconto}`);
      console.log(`[INTER]   - mensagem present? ${!!cobrancaData.mensagem}`);
      console.log('[INTER] 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥');
      
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
   * Recuperar cobrança detalhada
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
   * Pesquisar cobranças com filtros
   */
  async pesquisarCobrancas(filters: {
    dataInicial: string;
    dataFinal: string;
    situacao?: 'RECEBIDO' | 'A_RECEBER' | 'MARCADO_RECEBIDO' | 'ATRASADO' | 'CANCELADO' | 'EXPIRADO';
    pessoaPagadora?: string;
    cpfCnpjPessoaPagadora?: string;
    seuNumero?: string;
    itensPorPagina?: number;
    paginaAtual?: number;
  }): Promise<any> {
    try {
      console.log(`[INTER] 🔍 Searching collections`);

      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          // Fix parameter names
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
   * Editar cobrança
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
   * Cancelar cobrança
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
   * Obter PDF da cobrança
   */
  async obterPdfCobranca(codigoSolicitacao: string): Promise<Buffer> {
    try {
      console.log(`[INTER] 📄 Getting PDF for collection: ${codigoSolicitacao}`);

      const token = await this.getAccessToken();
      const url = `${this.config.apiUrl}/cobranca/v3/cobrancas/${codigoSolicitacao}/pdf`;

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/pdf'
      };

      if (this.config.contaCorrente) {
        headers['x-conta-corrente'] = this.config.contaCorrente;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get PDF: ${response.status} - ${errorText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      console.log(`[INTER] ✅ PDF retrieved successfully (${arrayBuffer.byteLength} bytes)`);
      
      return Buffer.from(arrayBuffer);

    } catch (error) {
      console.error('[INTER] ❌ Failed to get PDF:', error);
      throw error;
    }
  }

  /**
   * Obter sumário de cobranças
   */
  async obterSumarioCobrancas(filters: {
    dataInicial: string;
    dataFinal: string;
    filtrarDataPor?: 'VENCIMENTO' | 'EMISSAO' | 'SITUACAO';
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
   * Configurar webhook
   */
  async configurarWebhook(webhookData: WebhookData): Promise<any> {
    try {
      console.log(`[INTER] 🔔 Configuring webhook: ${webhookData.url}`);

      const response = await this.makeRequest('/webhook', 'PUT', webhookData);
      
      console.log(`[INTER] ✅ Webhook configured successfully`);
      return response;

    } catch (error) {
      console.error('[INTER] ❌ Failed to configure webhook:', error);
      throw error;
    }
  }

  /**
   * Obter configuração do webhook
   */
  async obterWebhook(): Promise<any> {
    try {
      console.log(`[INTER] 🔔 Getting webhook configuration`);

      const response = await this.makeRequest('/webhook');
      
      console.log(`[INTER] ✅ Webhook configuration retrieved`);
      return response;

    } catch (error) {
      console.error('[INTER] ❌ Failed to get webhook:', error);
      throw error;
    }
  }

  /**
   * Excluir webhook
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
   * Consultar callbacks enviados
   */
  async consultarCallbacks(filters: {
    dataInicial: string;
    dataFinal: string;
    itensPorPagina?: number;
    paginaAtual?: number;
  }): Promise<any> {
    try {
      console.log(`[INTER] 📨 Getting webhook callbacks`);

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

      const response = await this.makeRequest(`/webhook/callbacks?${queryParams.toString()}`);
      
      console.log(`[INTER] ✅ Callbacks retrieved successfully`);
      return response;

    } catch (error) {
      console.error('[INTER] ❌ Failed to get callbacks:', error);
      throw error;
    }
  }

  /**
   * Simular pagamento (Sandbox only)
   */
  async simularPagamento(codigoSolicitacao: string, valorPago: number): Promise<any> {
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
   * Helper method to format date to YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Create collection for a proposal
   * High-level method that uses the low-level emitirCobranca
   */
  async criarCobrancaParaProposta(proposalData: {
    id: string;
    valorTotal: number;
    dataVencimento: string;
    clienteData: {
      nome: string;
      cpf: string;
      email?: string;
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
      console.log('[INTER] 🚀 Creating collection for proposal:', proposalData.id);
      
      // LOG CRITICAL INFO
      console.log('[INTER] 📍 Corrigindo cidade/UF para CEP 29165460: Serra, ES');
      
      // Clean data for validation
      const cidadeClean = proposalData.clienteData.cidade.trim().replace(/[\s]+/g, ' ');
      const bairroClean = proposalData.clienteData.bairro.trim().replace(/[\s]+/g, ' ');
      const enderecoClean = proposalData.clienteData.endereco.trim().replace(/[\s]+/g, ' ');
      const nomeClean = proposalData.clienteData.nome.trim().replace(/[\s]+/g, ' ');
      
      console.log('[INTER] 🧹 Dados limpos:', {
        nome: nomeClean,
        endereco: enderecoClean,
        bairro: bairroClean,
        cidade: cidadeClean
      });
      
      // Generate unique seuNumero for this proposal
      const seuNumero = `${proposalData.id.substring(0, 13)}-${Date.now().toString().slice(-1)}`;
      
      // Format dates
      const today = new Date();
      const dataEmissao = this.formatDate(today);
      
      // Ensure valorNominal is a number with 2 decimal places
      const valorNominal = parseFloat(proposalData.valorTotal.toFixed(2));
      console.log(`[INTER] 💰 Valor formatado: ${valorNominal}`);
      
      // Format phone number
      let ddd = '';
      let telefone = '';
      if (proposalData.clienteData.telefone) {
        const phoneClean = proposalData.clienteData.telefone.replace(/\D/g, '');
        if (phoneClean.length >= 10) {
          ddd = phoneClean.substring(0, 2);
          telefone = phoneClean.substring(2);
        }
      }
      
      // Format CEP (Inter API might require without dash)
      const cepLimpo = proposalData.clienteData.cep.replace(/\D/g, '');
      
      // Format CPF (remove any formatting)
      const cpfCnpjLimpo = proposalData.clienteData.cpf.replace(/\D/g, '');
      
      // Determine UF from CEP - forcing ES for CEP 29165460
      let uf = proposalData.clienteData.uf.toUpperCase();
      if (cepLimpo === '29165460') {
        uf = 'ES'; // Espirito Santo
        cidadeClean = 'Serra'; // Correct city for this CEP
      }
      
      console.log(`[INTER] 📅 Data de emissão: ${dataEmissao}`);
      
      const cobrancaData: CobrancaRequest = {
        seuNumero,
        valorNominal,
        dataEmissao,
        dataVencimento: proposalData.dataVencimento,
        numDiasAgenda: 30, // Auto cancel after 30 days
        pagador: {
          cpfCnpj: cpfCnpjLimpo,
          tipoPessoa: cpfCnpjLimpo.length <= 11 ? 'FISICA' : 'JURIDICA',
          nome: nomeClean,
          email: proposalData.clienteData.email || '',
          ddd,
          telefone,
          endereco: enderecoClean,
          numero: proposalData.clienteData.numero || '100',
          complemento: proposalData.clienteData.complemento || '',
          bairro: bairroClean,
          cidade: cidadeClean,
          uf: uf,
          cep: cepLimpo
        },
        // Desconto obrigatório mesmo com valor zero
        desconto: {
          codigo: 'PERCENTUALDATAINFORMADA',
          taxa: 0,
          quantidadeDias: 0
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
        },
        // Campo obrigatório segundo a documentação oficial
        formasRecebimento: ['BOLETO', 'PIX']
      };

      return await this.emitirCobranca(cobrancaData);

    } catch (error) {
      console.error('[INTER] ❌ Failed to create collection for proposal:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const interBankService = new InterBankService();
```

#### 2. ROTAS PRINCIPAIS - server/routes/inter.ts

```typescript
/**
 * Banco Inter API Routes
 * Handles collection (boleto/PIX) operations
 */

import express from 'express';
import { interBankService } from '../services/interBankService.js';
import { storage } from '../storage.js';
import { jwtAuthMiddleware, type AuthenticatedRequest } from '../lib/jwt-auth-middleware.js';
import { getBrasiliaTimestamp } from '../lib/timezone.js';
import { z } from 'zod';
import { db } from '../lib/supabase.js';
import { interCollections } from '@shared/schema';

const router = express.Router();

// Validation schemas
const createCollectionSchema = z.object({
  proposalId: z.string(),
  valorTotal: z.number().min(2.5).max(99999999.99),
  dataVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  clienteData: z.object({
    nome: z.string().min(1),
    cpf: z.string().min(11),
    email: z.string().email(),
    telefone: z.string().optional(),
    endereco: z.string().min(1),
    numero: z.string().min(1),
    complemento: z.string().optional(),
    bairro: z.string().min(1),
    cidade: z.string().min(1),
    uf: z.string().length(2),
    cep: z.string().min(8)
  })
});

const searchCollectionsSchema = z.object({
  dataInicial: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dataFinal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  situacao: z.enum(['RECEBIDO', 'A_RECEBER', 'MARCADO_RECEBIDO', 'ATRASADO', 'CANCELADO', 'EXPIRADO']).optional(),
  pessoaPagadora: z.string().optional(),
  seuNumero: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional()
});

/**
 * Test Inter Bank API connection
 * GET /api/inter/test
 */
router.get('/test', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    console.log(`[INTER] Testing connection for user: ${req.user?.email}`);

    const isConnected = await interBankService.testConnection();
    
    res.json({
      success: isConnected,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
      timestamp: getBrasiliaTimestamp()
    });

  } catch (error) {
    console.error('[INTER] Connection test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test Inter Bank connection',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Debug endpoint to check Inter Bank credentials (temporary)
 * GET /api/inter/debug-credentials
 */
router.get('/debug-credentials', async (req, res) => {
  try {
    const credentials = {
      clientId: process.env.CLIENT_ID ? '✅ Present (' + process.env.CLIENT_ID.substring(0, 8) + '...)' : '❌ Missing',
      clientSecret: process.env.CLIENT_SECRET ? '✅ Present (' + process.env.CLIENT_SECRET.substring(0, 8) + '...)' : '❌ Missing',
      certificate: process.env.CERTIFICATE ? '✅ Present (' + process.env.CERTIFICATE.length + ' chars)' : '❌ Missing',
      privateKey: process.env.PRIVATE_KEY ? '✅ Present (' + process.env.PRIVATE_KEY.length + ' chars)' : '❌ Missing',
      contaCorrente: process.env.CONTA_CORRENTE ? '✅ Present (' + process.env.CONTA_CORRENTE + ')' : '❌ Missing',
      environment: !!process.env.CONTA_CORRENTE ? 'production' : 'sandbox',
      apiUrl: !!process.env.CONTA_CORRENTE 
        ? 'https://cdpj.partners.bancointer.com.br'
        : 'https://cdpj-sandbox.partners.uatinter.co'
    };

    // Test connection
    const isConnected = await interBankService.testConnection();

    res.json({
      credentials,
      connectionTest: isConnected,
      timestamp: getBrasiliaTimestamp()
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to check credentials',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Debug endpoint to check certificate format
 * GET /api/inter/debug-certificate-format
 */
/**
 * Test OAuth2 authentication directly
 * GET /api/inter/test-auth
 */
router.get('/test-auth', async (req, res) => {
  try {
    console.log('[INTER] Testing OAuth2 authentication...');
    
    // Get credentials directly from environment
    const config = {
      clientId: process.env.CLIENT_ID || '',
      clientSecret: process.env.CLIENT_SECRET || '',
      certificate: process.env.CERTIFICATE || '',
      privateKey: process.env.PRIVATE_KEY || '',
      contaCorrente: process.env.CONTA_CORRENTE || ''
    };
    
    // Log config status
    console.log('[INTER] Config status:');
    console.log(`  - Client ID: ${config.clientId ? 'Present' : 'Missing'}`);
    console.log(`  - Client Secret: ${config.clientSecret ? 'Present' : 'Missing'}`);
    console.log(`  - Certificate: ${config.certificate ? 'Present' : 'Missing'}`);
    console.log(`  - Private Key: ${config.privateKey ? 'Present' : 'Missing'}`);
    
    // Try to get token
    const token = await interBankService.testConnection();
    
    res.json({
      success: token,
      config: {
        hasClientId: !!config.clientId,
        hasClientSecret: !!config.clientSecret,
        hasCertificate: !!config.certificate,
        hasPrivateKey: !!config.privateKey,
        hasContaCorrente: !!config.contaCorrente
      },
      timestamp: getBrasiliaTimestamp()
    });
    
  } catch (error) {
    console.error('[INTER] Auth test failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: getBrasiliaTimestamp()
    });
  }
});

router.get('/debug-certificate-format', async (req, res) => {
  console.log('[INTER] 🔍 Debug certificate format endpoint called');
  try {
    const cert = process.env.CERTIFICATE || '';
    const key = process.env.PRIVATE_KEY || '';
    
    // Check certificate format
    const certInfo = {
      length: cert.length,
      first100Chars: cert.substring(0, 100),
      last50Chars: cert.substring(cert.length - 50),
      hasBeginCert: cert.includes('-----BEGIN CERTIFICATE-----'),
      hasEndCert: cert.includes('-----END CERTIFICATE-----'),
      hasBeginTag: cert.includes('-----BEGIN'),
      hasNewlines: cert.includes('\n'),
      isBase64: /^[A-Za-z0-9+/=]+$/.test(cert.replace(/\s/g, ''))
    };
    
    // Check key format
    const keyInfo = {
      length: key.length,
      first100Chars: key.substring(0, 100),
      last50Chars: key.substring(key.length - 50),
      hasBeginKey: key.includes('-----BEGIN') && key.includes('PRIVATE KEY'),
      hasEndKey: key.includes('-----END') && key.includes('PRIVATE KEY'),
      hasBeginTag: key.includes('-----BEGIN'),
      hasNewlines: key.includes('\n'),
      isBase64: /^[A-Za-z0-9+/=]+$/.test(key.replace(/\s/g, ''))
    };
    
    // Try to decode from base64 to see what's inside
    let decodedCertPreview = '';
    let decodedKeyPreview = '';
    
    try {
      if (certInfo.isBase64 && !certInfo.hasBeginTag) {
        const decoded = Buffer.from(cert, 'base64').toString('utf-8');
        decodedCertPreview = decoded.substring(0, 200);
      }
    } catch (e) {
      decodedCertPreview = 'Failed to decode certificate from base64';
    }
    
    try {
      if (keyInfo.isBase64 && !keyInfo.hasBeginTag) {
        const decoded = Buffer.from(key, 'base64').toString('utf-8');
        decodedKeyPreview = decoded.substring(0, 200);
      }
    } catch (e) {
      decodedKeyPreview = 'Failed to decode key from base64';
    }
    
    res.json({
      certificate: certInfo,
      privateKey: keyInfo,
      decodedCertPreview,
      decodedKeyPreview,
      timestamp: getBrasiliaTimestamp()
    });
  } catch (error) {
    console.error('[INTER] Debug certificate format error:', error);
    res.status(500).json({ 
      error: 'Failed to check certificate format', 
      details: (error as Error).message 
    });
  }
});

/**
 * Create collection (boleto/PIX) for a proposal
 * POST /api/inter/collections
 */
router.post('/collections', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = createCollectionSchema.parse(req.body);
    
    console.log(`[INTER] Creating collection for proposal: ${validatedData.proposalId}`);

    // Create collection via Inter API
    const collectionResponse = await interBankService.criarCobrancaParaProposta({
      id: validatedData.proposalId,
      valorTotal: validatedData.valorTotal,
      dataVencimento: validatedData.dataVencimento,
      clienteData: validatedData.clienteData
    });

    // Fetch full collection details
    const collectionDetails = await interBankService.recuperarCobranca(collectionResponse.codigoSolicitacao);

    // Store collection data in database
    await db.insert(interCollections).values({
      propostaId: validatedData.proposalId,
      codigoSolicitacao: collectionResponse.codigoSolicitacao,
      seuNumero: collectionDetails.cobranca.seuNumero,
      valorNominal: collectionDetails.cobranca.valorNominal.toString(),
      dataVencimento: collectionDetails.cobranca.dataVencimento,
      situacao: collectionDetails.cobranca.situacao,
      dataSituacao: collectionDetails.cobranca.dataSituacao,
      nossoNumero: collectionDetails.boleto?.nossoNumero,
      codigoBarras: collectionDetails.boleto?.codigoBarras,
      linhaDigitavel: collectionDetails.boleto?.linhaDigitavel,
      pixTxid: collectionDetails.pix?.txid,
      pixCopiaECola: collectionDetails.pix?.pixCopiaECola,
      dataEmissao: collectionDetails.cobranca.dataEmissao,
      origemRecebimento: 'BOLETO',
      isActive: true
    });

    console.log(`[INTER] ✅ Collection created successfully: ${collectionResponse.codigoSolicitacao}`);

    res.json({
      success: true,
      codigoSolicitacao: collectionResponse.codigoSolicitacao,
      proposalId: validatedData.proposalId,
      timestamp: getBrasiliaTimestamp()
    });

  } catch (error) {
    console.error('[INTER] Failed to create collection:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create collection',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get collection details
 * GET /api/inter/collections/:codigoSolicitacao
 */
router.get('/collections/:codigoSolicitacao', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { codigoSolicitacao } = req.params;
    
    console.log(`[INTER] Getting collection details: ${codigoSolicitacao}`);

    const collectionDetails = await interBankService.recuperarCobranca(codigoSolicitacao);

    res.json({
      success: true,
      data: collectionDetails,
      timestamp: getBrasiliaTimestamp()
    });

  } catch (error) {
    console.error('[INTER] Failed to get collection details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get collection details',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Search collections with filters
 * GET /api/inter/collections
 */
router.get('/collections', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const validatedQuery = searchCollectionsSchema.parse(req.query);
    
    console.log(`[INTER] Searching collections from ${validatedQuery.dataInicial} to ${validatedQuery.dataFinal}`);

    const searchResults = await interBankService.pesquisarCobrancas({
      dataInicial: validatedQuery.dataInicial,
      dataFinal: validatedQuery.dataFinal,
      situacao: validatedQuery.situacao,
      pessoaPagadora: validatedQuery.pessoaPagadora,
      seuNumero: validatedQuery.seuNumero,
      itensPorPagina: validatedQuery.limit ? parseInt(validatedQuery.limit) : 100,
      paginaAtual: validatedQuery.page ? parseInt(validatedQuery.page) : 0
    });

    res.json({
      success: true,
      data: searchResults,
      timestamp: getBrasiliaTimestamp()
    });

  } catch (error) {
    console.error('[INTER] Failed to search collections:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to search collections',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get collection PDF
 * GET /api/inter/collections/:codigoSolicitacao/pdf
 */
router.get('/collections/:codigoSolicitacao/pdf', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { codigoSolicitacao } = req.params;
    
    console.log(`[INTER] Getting PDF for collection: ${codigoSolicitacao}`);

    const pdfBuffer = await interBankService.obterPdfCobranca(codigoSolicitacao);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="boleto-${codigoSolicitacao}.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('[INTER] Failed to get PDF:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get collection PDF',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Cancel collection
 * POST /api/inter/collections/:codigoSolicitacao/cancel
 */
router.post('/collections/:codigoSolicitacao/cancel', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { codigoSolicitacao } = req.params;
    const { motivoCancelamento } = req.body;
    
    if (!motivoCancelamento) {
      return res.status(400).json({
        success: false,
        error: 'motivoCancelamento is required'
      });
    }

    console.log(`[INTER] Cancelling collection: ${codigoSolicitacao}`);

    await interBankService.cancelarCobranca(codigoSolicitacao, motivoCancelamento);

    res.json({
      success: true,
      message: 'Collection cancelled successfully',
      timestamp: getBrasiliaTimestamp()
    });

  } catch (error) {
    console.error('[INTER] Failed to cancel collection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel collection',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get collections summary/metrics
 * GET /api/inter/summary
 */
router.get('/summary', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { dataInicial, dataFinal, filtrarDataPor } = req.query;
    
    if (!dataInicial || !dataFinal) {
      return res.status(400).json({
        success: false,
        error: 'dataInicial and dataFinal are required'
      });
    }

    console.log(`[INTER] Getting collections summary`);

    const summary = await interBankService.obterSumarioCobrancas({
      dataInicial: dataInicial as string,
      dataFinal: dataFinal as string,
      filtrarDataPor: filtrarDataPor as any
    });

    res.json({
      success: true,
      data: summary,
      timestamp: getBrasiliaTimestamp()
    });

  } catch (error) {
    console.error('[INTER] Failed to get summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get collections summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Configure webhook
 * PUT /api/inter/webhook
 */
router.put('/webhook', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { url, eventos } = req.body;
    
    if (!url || !eventos) {
      return res.status(400).json({
        success: false,
        error: 'url and eventos are required'
      });
    }

    console.log(`[INTER] Configuring webhook: ${url}`);

    await interBankService.configurarWebhook({ url, eventos });

    res.json({
      success: true,
      message: 'Webhook configured successfully',
      timestamp: getBrasiliaTimestamp()
    });

  } catch (error) {
    console.error('[INTER] Failed to configure webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to configure webhook',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get webhook configuration
 * GET /api/inter/webhook
 */
router.get('/webhook', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    console.log(`[INTER] Getting webhook configuration`);

    const webhookConfig = await interBankService.obterWebhook();

    res.json({
      success: true,
      data: webhookConfig,
      timestamp: getBrasiliaTimestamp()
    });

  } catch (error) {
    console.error('[INTER] Failed to get webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get webhook configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Delete webhook
 * DELETE /api/inter/webhook
 */
router.delete('/webhook', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    console.log(`[INTER] Deleting webhook`);

    await interBankService.excluirWebhook();

    res.json({
      success: true,
      message: 'Webhook deleted successfully',
      timestamp: getBrasiliaTimestamp()
    });

  } catch (error) {
    console.error('[INTER] Failed to delete webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete webhook',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get webhook callbacks
 * GET /api/inter/webhook/callbacks
 */
router.get('/webhook/callbacks', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { dataInicial, dataFinal, page, limit } = req.query;
    
    if (!dataInicial || !dataFinal) {
      return res.status(400).json({
        success: false,
        error: 'dataInicial and dataFinal are required'
      });
    }

    console.log(`[INTER] Getting webhook callbacks`);

    const callbacks = await interBankService.consultarCallbacks({
      dataInicial: dataInicial as string,
      dataFinal: dataFinal as string,
      itensPorPagina: limit ? parseInt(limit as string) : 100,
      paginaAtual: page ? parseInt(page as string) : 0
    });

    res.json({
      success: true,
      data: callbacks,
      timestamp: getBrasiliaTimestamp()
    });

  } catch (error) {
    console.error('[INTER] Failed to get callbacks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get webhook callbacks',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Simulate payment (Sandbox only)
 * POST /api/inter/collections/:codigoSolicitacao/simulate-payment
 */
router.post('/collections/:codigoSolicitacao/simulate-payment', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { codigoSolicitacao } = req.params;
    const { valorPago } = req.body;
    
    if (!valorPago || typeof valorPago !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'valorPago is required and must be a number'
      });
    }

    console.log(`[INTER] Simulating payment for collection: ${codigoSolicitacao}`);

    await interBankService.simularPagamento(codigoSolicitacao, valorPago);

    res.json({
      success: true,
      message: 'Payment simulated successfully',
      timestamp: getBrasiliaTimestamp()
    });

  } catch (error) {
    console.error('[INTER] Failed to simulate payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to simulate payment',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
```

#### 3. ROTAS DE COLEÇÕES - server/routes/inter-collections.ts

```typescript
import { Router } from 'express';
import { jwtAuthMiddleware, type AuthenticatedRequest } from '../lib/jwt-auth-middleware';
import { requireAnyRole } from '../lib/role-guards';
import { interBankService } from '../services/interBankService';
import { db } from '../lib/supabase';
import { interCollections, propostas } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getBrasiliaTimestamp } from '../lib/timezone';

const router = Router();

/**
 * Listar boletos gerados para uma proposta
 * GET /api/inter/collections/:propostaId
 */
router.get('/:propostaId', jwtAuthMiddleware, requireAnyRole, async (req: AuthenticatedRequest, res) => {
  try {
    const { propostaId } = req.params;
    
    console.log(`[INTER COLLECTIONS] Fetching collections for proposal: ${propostaId}`);
    
    // Buscar collections da proposta no banco
    const collections = await db.select()
      .from(interCollections)
      .where(eq(interCollections.propostaId, propostaId));
    
    // Se tiver collections, buscar detalhes atualizados na API do Inter
    if (collections.length > 0) {
      const interService = interBankService;
      
      const updatedCollections = await Promise.all(
        collections.map(async (collection) => {
          try {
            const details = await interService.recuperarCobranca(collection.codigoSolicitacao);
            
            // Atualizar situacao no banco se mudou
            if (details.situacao !== collection.situacao) {
              await db.update(interCollections)
                .set({ 
                  situacao: details.situacao,
                  updatedAt: new Date()
                })
                .where(eq(interCollections.id, collection.id));
            }
            
            return {
              ...collection,
              ...details,
              qrCode: details.qrCode,
              codigoBarras: details.codigoBarras,
              linkPdf: `/api/inter/collections/${propostaId}/${collection.codigoSolicitacao}/pdf`
            };
          } catch (error) {
            console.error(`[INTER COLLECTIONS] Error fetching details for ${collection.codigoSolicitacao}:`, error);
            return collection;
          }
        })
      );
      
      res.json(updatedCollections);
    } else {
      res.json([]);
    }
    
  } catch (error) {
    console.error('[INTER COLLECTIONS] Error:', error);
    res.status(500).json({ error: 'Erro ao buscar boletos' });
  }
});

/**
 * Baixar PDF do boleto
 * GET /api/inter/collections/:propostaId/:codigoSolicitacao/pdf
 */
router.get('/:propostaId/:codigoSolicitacao/pdf', jwtAuthMiddleware, requireAnyRole, async (req: AuthenticatedRequest, res) => {
  try {
    const { propostaId, codigoSolicitacao } = req.params;
    
    console.log(`[INTER COLLECTIONS] Downloading PDF for collection: ${codigoSolicitacao}`);
    
    // Verificar se collection pertence à proposta
    const collection = await db.select()
      .from(interCollections)
      .where(
        eq(interCollections.propostaId, propostaId) &&
        eq(interCollections.codigoSolicitacao, codigoSolicitacao)
      )
      .limit(1);
    
    if (collection.length === 0) {
      return res.status(404).json({ error: 'Boleto não encontrado' });
    }
    
    // Buscar PDF na API do Inter
    const interService = interBankService;
    const pdfBuffer = await interService.obterPdfCobranca(codigoSolicitacao);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="boleto-${codigoSolicitacao}.pdf"`);
    res.send(Buffer.from(pdfBuffer));
    
  } catch (error) {
    console.error('[INTER COLLECTIONS] Error downloading PDF:', error);
    res.status(500).json({ error: 'Erro ao baixar PDF do boleto' });
  }
});

/**
 * Listar todos os boletos (para tela de cobranças)
 * GET /api/inter/collections
 */
router.get('/', jwtAuthMiddleware, requireAnyRole, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, dataInicial, dataFinal } = req.query;
    
    console.log('[INTER COLLECTIONS] Listing all collections with filters:', { status, dataInicial, dataFinal });
    
    const interService = interBankService;
    
    // Buscar collections na API do Inter
    const filters: any = {};
    if (status) filters.status = status as string;
    if (dataInicial) filters.dataInicial = dataInicial as string;
    if (dataFinal) filters.dataFinal = dataFinal as string;
    
    const collections = await interService.pesquisarCobrancas({
      dataInicial: filters.dataInicial || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dataFinal: filters.dataFinal || new Date().toISOString().split('T')[0],
      situacao: filters.status as any
    });
    
    // Enriquecer com dados das propostas
    const enrichedCollections = await Promise.all(
      collections.map(async (collection: any) => {
        // Extrair propostaId do codigoSolicitacao (formato: SIMPIX-{propostaId}-{parcela})
        const parts = collection.codigoSolicitacao?.split('-');
        if (parts && parts.length >= 2 && parts[0] === 'SIMPIX') {
          const propostaId = parts[1];
          
          const proposta = await db.select()
            .from(propostas)
            .where(eq(propostas.id, propostaId))
            .limit(1);
          
          if (proposta.length > 0) {
            return {
              ...collection,
              proposta: {
                id: proposta[0].id,
                numeroContrato: proposta[0].numeroContrato || proposta[0].id,
                nomeCliente: proposta[0].clienteNome || '',
                cpfCliente: proposta[0].clienteCpf || '',
                telefoneCliente: proposta[0].clienteTelefone || '',
                emailCliente: proposta[0].clienteEmail || ''
              }
            };
          }
        }
        
        return collection;
      })
    );
    
    res.json(enrichedCollections);
    
  } catch (error) {
    console.error('[INTER COLLECTIONS] Error listing collections:', error);
    res.status(500).json({ error: 'Erro ao listar boletos' });
  }
});

export default router;
```

#### 4. SCHEMAS RELEVANTES - shared/schema.ts (fragmento)

```typescript
// Banco Inter Integration Tables
export const interCollections = pgTable("inter_collections", {
  id: serial("id").primaryKey(),
  propostaId: text("proposta_id").references(() => propostas.id).notNull(),
  codigoSolicitacao: text("codigo_solicitacao").notNull().unique(), // Inter's unique ID
  seuNumero: text("seu_numero").notNull(), // Our reference number
  valorNominal: decimal("valor_nominal", { precision: 12, scale: 2 }).notNull(),
  dataVencimento: text("data_vencimento").notNull(), // YYYY-MM-DD format
  situacao: text("situacao").notNull().default("EM_PROCESSAMENTO"), // Inter status
  dataSituacao: text("data_situacao"),
  nossoNumero: text("nosso_numero"), // Bank reference number
  codigoBarras: text("codigo_barras"), // Barcode for boleto
  linhaDigitavel: text("linha_digitavel"), // Digitizable line
  pixTxid: text("pix_txid"), // PIX transaction ID
  pixCopiaECola: text("pix_copia_e_cola"), // PIX copy-paste code
  valorTotalRecebido: decimal("valor_total_recebido", { precision: 12, scale: 2 }),
  origemRecebimento: text("origem_recebimento"), // BOLETO or PIX
  dataEmissao: text("data_emissao"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Inter Bank schemas
export const insertInterCollectionSchema = createInsertSchema(interCollections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateInterCollectionSchema = createInsertSchema(interCollections).partial().omit({
  id: true,
  propostaId: true,
  createdAt: true,
});

// Inter Bank types
export type InsertInterCollection = z.infer<typeof insertInterCollectionSchema>;
export type UpdateInterCollection = z.infer<typeof updateInterCollectionSchema>;
export type InterCollection = typeof interCollections.$inferSelect;
```

### Evidência Bruta 2: Exemplo de Payload e Headers Enviados

**Payload JSON enviado:**
```json
{
  "seuNumero": "902183dd-b5d1-4",
  "valorNominal": 1000,
  "dataEmissao": "2025-08-04",
  "dataVencimento": "2025-08-09",
  "numDiasAgenda": 30,
  "pagador": {
    "nome": "Gabriel de Jesus Santana Serri",
    "cpfCnpj": "20528464760",
    "tipoPessoa": "FISICA",
    "email": "gabrieldjesus238@gmail.com",
    "ddd": "27",
    "telefone": "998538565",
    "endereco": "Rua miguel angelo",
    "numero": "100",
    "complemento": "",
    "bairro": "Centro",
    "cidade": "Serra",
    "uf": "ES",
    "cep": "29165460"
  },
  "desconto": {
    "codigo": "PERCENTUALDATAINFORMADA",
    "taxa": 0,
    "quantidadeDias": 0
  },
  "multa": {
    "codigo": "PERCENTUAL",
    "taxa": 2
  },
  "mora": {
    "codigo": "TAXAMENSAL",
    "taxa": 1
  },
  "mensagem": {
    "linha1": "SIMPIX - Empréstimo Pessoal",
    "linha2": "Proposta: 902183dd-b5d1-4e20-8a72-79d3d3559d4d",
    "linha3": "Pague via PIX ou boleto bancário",
    "linha4": "Dúvidas: contato@simpix.com.br",
    "linha5": "www.simpix.com.br"
  },
  "formasRecebimento": ["BOLETO", "PIX"]
}
```

**Headers HTTP enviados:**
```json
{
  "Authorization": "Bearer 3c8e9163-21ab-41cf-9a63-03129281f235",
  "Content-Type": "application/json",
  "Accept": "application/json",
  "x-conta-corrente": "346470536"
}
```

### MISSÃO DE ANÁLISE E REFATORAÇÃO (Seu Roadmap de Ação)

1. **Análise de Causa Raiz (Hipótese Principal: mTLS/Handshake):** O erro `400` com corpo vazio é frequentemente um sintoma de falha no handshake mTLS ou na camada de WAF/Firewall da API, antes que a aplicação retorne um erro JSON. Analise CUIDADOSAMENTE a lógica de formatação de certificados (`-----BEGIN...`) e a configuração do agente `undici` em `interBankService.ts`. Existem incompatibilidades conhecidas ou "gotchas" com a implementação mTLS do Node.js ou com o `undici`? Verifique se o fallback para `https.request` está sendo acionado e se isso pode estar causando problemas.

2. **Auditoria Detalhada do Payload vs. Documentação:** Compare CADA CAMPO do payload de exemplo com a documentação oficial da API de Cobranças v3 do Banco Inter (https://developers.inter.co/references/cobranca-bolepix). Procure por:
   - Tipos de dados incorretos (ex: `valorNominal` enviado como `number` quando deveria ser `string` com formato específico, ou vice-versa). Preste atenção especial à nossa função `customStringify`.
   - Formatos de data ou CPF/CNPJ inválidos.
   - Enumerações com valores incorretos (`desconto.codigo`, `multa.codigo`, `mora.codigo`).
   - Campos condicionais ou obrigatórios que faltam.

3. **Análise dos Headers:** Verifique os headers enviados. O `x-conta-corrente` está correto? Existe algum outro header não-padrão exigido pelo Banco Inter que está em falta?

4. **Refatoração para Resiliência e Depuração:** Refatore o ficheiro `interBankService.ts` com as seguintes melhorias:
   - **Melhor Tratamento de Erros:** Modifique o `catch` no `makeRequest` para extrair e logar o máximo de informação possível dos headers de resposta em caso de erro (como `traceparent`, `server`, etc.), mesmo que o corpo seja vazio.
   - **Isolamento da Lógica de Certificados:** Crie uma função utilitária separada e pura para a formatação dos certificados, facilitando testes unitários.
   - **Clareza e Boas Práticas:** Aplique quaisquer outras melhorias que você, como especialista, considere pertinentes.

5. **Plano de Ação de Diagnóstico:** Se a causa raiz não for óbvia apenas pelo código, forneça um plano de ação passo a passo para depuração avançada, incluindo um exemplo de comando `curl` COMPLETO que possamos executar a partir do nosso terminal para replicar a requisição, usando os certificados e chaves (com placeholders, ex: ` --cert cert.pem --key key.pem`).

### Formato de Resposta Esperado

Por favor, estruture sua resposta em três seções principais: `1. Análise da Causa Raiz`, `2. Código Refatorado` (com comentários explicando as mudanças), e `3. Plano de Ação de Diagnóstico`.