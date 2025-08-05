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
import { interCollections, propostas } from '@shared/schema';
import { eq } from 'drizzle-orm';

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
    
    // Verificar se já existe boleto ativo para esta proposta
    const existingCollections = await db.select()
      .from(interCollections)
      .where(eq(interCollections.propostaId, validatedData.proposalId));
    
    // Filtrar apenas boletos com status "a receber" (não pagos)
    const activeCollections = existingCollections.filter(col => 
      col.situacao === 'NORMAL' || col.situacao === 'EM_ABERTO' || !col.situacao
    );
    
    if (activeCollections.length > 0) {
      console.log(`[INTER] Found ${activeCollections.length} active collections for proposal ${validatedData.proposalId}`);
      return res.status(409).json({
        success: false,
        error: 'Boleto ativo encontrado',
        message: 'Já existem boletos ativos (não pagos) para esta proposta. Aguarde o pagamento ou cancele os boletos anteriores.',
        existingCollections: activeCollections.map(col => ({
          codigo: col.codigoSolicitacao,
          valor: col.valorNominal,
          vencimento: col.dataVencimento,
          situacao: col.situacao || 'EM_ABERTO'
        }))
      });
    }

    // Buscar dados da proposta para obter o prazo (número de parcelas)
    const [proposta] = await db.select()
      .from(propostas)
      .where(eq(propostas.id, validatedData.proposalId))
      .limit(1);
    
    if (!proposta) {
      return res.status(404).json({
        success: false,
        error: 'Proposta não encontrada'
      });
    }

    // Parse dos dados da proposta
    const condicoesData = typeof proposta.condicoesData === 'string' 
      ? JSON.parse(proposta.condicoesData) 
      : proposta.condicoesData;
    
    const prazo = condicoesData?.prazo || 1;
    const valorParcela = validatedData.valorTotal / prazo;
    
    console.log(`[INTER] Criando ${prazo} boletos de R$ ${valorParcela.toFixed(2)} cada`);
    
    const createdCollections = [];
    const errors = [];
    
    // Criar um boleto para cada parcela
    for (let i = 0; i < prazo; i++) {
      try {
        // Calcular data de vencimento para cada parcela (mensal)
        const dataVencimento = new Date(validatedData.dataVencimento);
        dataVencimento.setMonth(dataVencimento.getMonth() + i);
        
        console.log(`[INTER] Criando boleto ${i + 1}/${prazo} - Vencimento: ${dataVencimento.toISOString().split('T')[0]}`);
        
        // Create collection via Inter API
        const collectionResponse = await interBankService.criarCobrancaParaProposta({
          id: `${validatedData.proposalId}-${i + 1}`, // ID único para cada parcela
          valorTotal: valorParcela, // Usar valor da parcela
          dataVencimento: dataVencimento.toISOString().split('T')[0],
          clienteData: validatedData.clienteData
        });

        // Fetch full collection details
        const collectionDetails = await interBankService.recuperarCobranca(collectionResponse.codigoSolicitacao);

        // Download PDF and save to Storage
        let pdfPath = null;
        try {
          console.log(`[INTER] 📄 Baixando PDF para boleto ${i + 1}/${prazo}`);
          const pdfBuffer = await interBankService.obterPdfCobranca(collectionResponse.codigoSolicitacao);
          pdfPath = await interBankService.salvarPdfNoStorage(
            validatedData.proposalId, 
            collectionResponse.codigoSolicitacao, 
            i + 1, 
            pdfBuffer
          );
          console.log(`[INTER] ✅ PDF salvo no Storage: ${pdfPath}`);
        } catch (pdfError) {
          console.error(`[INTER] ⚠️ Erro ao salvar PDF da parcela ${i + 1}:`, pdfError);
          // Continua mesmo se o PDF falhar - boleto ainda é válido
        }

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
          qrCode: (collectionDetails.pix as any)?.qrcode?.base64 || null, // Adicionar QR code
          pdfPath: pdfPath, // Caminho do PDF no Storage
          dataEmissao: collectionDetails.cobranca.dataEmissao,
          origemRecebimento: 'BOLETO',
          isActive: true,
          numeroParcela: i + 1,
          totalParcelas: prazo
        });
        
        createdCollections.push({
          codigoSolicitacao: collectionResponse.codigoSolicitacao,
          parcela: i + 1,
          valor: valorParcela,
          vencimento: dataVencimento.toISOString().split('T')[0]
        });
        
        console.log(`[INTER] ✅ Boleto ${i + 1}/${prazo} criado: ${collectionResponse.codigoSolicitacao}`);
        
      } catch (error) {
        console.error(`[INTER] ❌ Erro ao criar boleto ${i + 1}:`, error);
        errors.push({
          parcela: i + 1,
          erro: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }

    console.log(`[INTER] ✅ ${createdCollections.length} boletos criados com sucesso, ${errors.length} erros`);

    res.json({
      success: true,
      totalCriados: createdCollections.length,
      totalErros: errors.length,
      boletos: createdCollections,
      erros: errors,
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

    // Tratar erro específico do Inter sobre boleto duplicado
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('existe uma cobrança emitida há poucos minutos')) {
      return res.status(409).json({
        success: false,
        error: 'Boleto duplicado',
        message: 'Já existe um boleto ativo para esta proposta. Aguarde o pagamento ou cancelamento do boleto anterior antes de gerar um novo.',
        details: errorMessage
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create collection',
      details: errorMessage
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

    const webhook = await interBankService.obterWebhook();

    res.json({
      success: true,
      data: webhook,
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
 * Simulate payment (sandbox only)
 * POST /api/inter/collections/:codigoSolicitacao/pay
 */
router.post('/collections/:codigoSolicitacao/pay', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { codigoSolicitacao } = req.params;
    const { valorPago } = req.body;
    
    if (!valorPago) {
      return res.status(400).json({
        success: false,
        error: 'valorPago is required'
      });
    }

    console.log(`[INTER] Simulating payment for collection: ${codigoSolicitacao}`);

    await interBankService.pagarCobrancaSandbox(codigoSolicitacao, valorPago);

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

/**
 * Test OAuth2 authentication with undici Agent
 * GET /api/inter/test-auth
 */
router.get('/test-auth', async (req, res) => {
  try {
    console.log('[INTER TEST] Testing OAuth2 authentication with undici Agent...');
    
    // Force a new token request by clearing cache
    // @ts-ignore - Accessing private property for testing
    interBankService.tokenCache = null;
    
    // Try to get access token
    // @ts-ignore - Accessing private method for testing
    const token = await interBankService.getAccessToken();
    
    console.log('[INTER TEST] ✅ Authentication successful!');
    
    res.json({
      success: true,
      message: 'OAuth2 authentication successful with undici Agent!',
      tokenReceived: !!token,
      tokenLength: token ? token.length : 0
    });
  } catch (error) {
    console.error('[INTER TEST] ❌ Authentication failed:', error);
    
    res.status(500).json({
      success: false,
      message: 'OAuth2 authentication failed',
      error: (error as Error).message
    });
  }
});

export { router as interRoutes };