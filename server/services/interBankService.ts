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
  nome: string;
  cpfCnpj: string;
  email: string;
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
    this.config = {
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
      apiUrl: process.env.NODE_ENV === 'production' 
        ? 'https://cdpj.partners.bancointer.com.br'
        : 'https://cdpj-sandbox.partners.uatinter.co',
      clientId: process.env.INTER_CLIENT_ID || '',
      clientSecret: process.env.INTER_CLIENT_SECRET || '',
      certificate: process.env.INTER_CERTIFICATE || '',
      privateKey: process.env.INTER_PRIVATE_KEY || '',
      contaCorrente: process.env.INTER_CONTA_CORRENTE || ''
    };

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

      const tokenUrl = `${this.config.apiUrl}/oauth/v2/token`;
      const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`
        },
        body: 'grant_type=client_credentials&scope=boleto-cobranca.read boleto-cobranca.write'
      });

      if (!response.ok) {
        const errorText = await response.text();
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
  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET', data?: any): Promise<any> {
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
      }

      const options: RequestInit = {
        method,
        headers
      };

      if (data && (method === 'POST' || method === 'PATCH')) {
        options.body = JSON.stringify(data);
      }

      console.log(`[INTER] ${method} ${endpoint}`);
      
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[INTER] Error ${response.status}: ${errorText}`);
        throw new Error(`Inter API error: ${response.status} - ${errorText}`);
      }

      // Handle empty responses (204 No Content)
      if (response.status === 204) {
        return null;
      }

      return await response.json();

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
        throw new Error(`PDF request failed: ${response.status} - ${errorText}`);
      }

      const pdfBuffer = Buffer.from(await response.arrayBuffer());
      
      console.log(`[INTER] ✅ PDF retrieved successfully (${pdfBuffer.length} bytes)`);
      return pdfBuffer;

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

      const cobrancaData: CobrancaRequest = {
        seuNumero: proposalData.id.substring(0, 15), // Max 15 chars
        valorNominal: proposalData.valorTotal,
        dataVencimento: proposalData.dataVencimento,
        numDiasAgenda: 30, // 30 days after due date for auto cancellation
        pagador: {
          nome: proposalData.clienteData.nome,
          cpfCnpj: proposalData.clienteData.cpf.replace(/\D/g, ''), // Remove formatting
          email: proposalData.clienteData.email,
          telefone: proposalData.clienteData.telefone || '',
          endereco: proposalData.clienteData.endereco,
          numero: proposalData.clienteData.numero,
          complemento: proposalData.clienteData.complemento || '',
          bairro: proposalData.clienteData.bairro,
          cidade: proposalData.clienteData.cidade,
          uf: proposalData.clienteData.uf,
          cep: proposalData.clienteData.cep.replace(/\D/g, '') // Remove formatting
        },
        mensagem: {
          linha1: 'SIMPIX - Empréstimo Pessoal',
          linha2: `Proposta: ${proposalData.id}`,
          linha3: 'Pague via PIX ou boleto bancário',
          linha4: 'Dúvidas: contato@simpix.com.br',
          linha5: 'www.simpix.com.br'
        },
        formasRecebimento: ['BOLETO', 'PIX']
      };

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