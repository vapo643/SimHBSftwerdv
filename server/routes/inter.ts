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
      clientId: process.env.INTER_CLIENT_ID ? '✅ Present (' + process.env.INTER_CLIENT_ID.substring(0, 8) + '...)' : '❌ Missing',
      clientSecret: process.env.INTER_CLIENT_SECRET ? '✅ Present (' + process.env.INTER_CLIENT_SECRET.substring(0, 8) + '...)' : '❌ Missing',
      certificate: process.env.INTER_CERTIFICATE ? '✅ Present (' + process.env.INTER_CERTIFICATE.length + ' chars)' : '❌ Missing',
      privateKey: process.env.INTER_PRIVATE_KEY ? '✅ Present (' + process.env.INTER_PRIVATE_KEY.length + ' chars)' : '❌ Missing',
      contaCorrente: process.env.INTER_CONTA_CORRENTE ? '✅ Present (' + process.env.INTER_CONTA_CORRENTE + ')' : '❌ Missing',
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
      apiUrl: process.env.NODE_ENV === 'production' 
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

    // TODO: Store collection data in database
    // This will be implemented when we add the inter_collections table

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

export { router as interRoutes };