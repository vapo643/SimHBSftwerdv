/**
 * Pagamentos Routes - REFACTORED
 * Controller layer using service pattern
 * PAM V1.0 - Clean architecture implementation
 */

import { Router } from 'express';
import { jwtAuthMiddleware } from '../../lib/jwt-auth-middleware.js';
import { AuthenticatedRequest } from '../../../shared/types/express';
import { pagamentoService } from '../../services/pagamentoService.js';
import { z } from 'zod';
import multer from 'multer';

// FASE 2 - PEAF V1.5: DTO Mapper para correção de Shape Mismatch (RC2)
interface PagamentoDTO {
  id: string;
  propostaId: string;
  numeroContrato: string;
  nomeCliente: string;
  cpfCliente: string;
  valorFinanciado: number;
  valorLiquido: number;
  valorIOF: number;
  valorTAC: number;
  contaBancaria: {
    banco: string;
    agencia: string;
    conta: string;
    tipoConta: string;
    titular: string;
  };
  status: string;
  dataRequisicao: string;
  dataAprovacao?: string;
  dataPagamento?: string;
  requisitadoPor: {
    id: string;
    nome: string;
    papel: string;
  };
  aprovadoPor?: {
    id: string;
    nome: string;
    papel: string;
  };
  motivoRejeicao?: string;
  observacoes?: string;
  comprovante?: string;
  formaPagamento: 'ted' | 'pix' | 'doc';
  loja: string;
  produto: string;
}

// PEAF V1.5 - Função de mapeamento de Nested (Drizzle JOIN result) para Flat (DTO)
function mapToPagamentoDTO(row: any): PagamentoDTO {
  const proposta = row.proposta;
  const loja = row.loja;
  const produto = row.produto;
  const boleto = row.boleto;

  return {
    id: proposta.id,
    propostaId: proposta.id,
    numeroContrato: proposta.numeroContrato || proposta.numeroProposta || `PROP-${proposta.id.slice(0, 8)}`,
    // ATENÇÃO: Usar os nomes exatos dos campos retornados pelo Drizzle
    nomeCliente: proposta.clienteNome || 'N/A',
    cpfCliente: proposta.clienteCpf || 'N/A',
    valorFinanciado: parseFloat(proposta.valorTotalFinanciado || proposta.valor || '0'),
    valorLiquido: parseFloat(proposta.valorLiquidoLiberado || proposta.valorTotalFinanciado || '0'),
    valorIOF: parseFloat(proposta.valorIof || '0'),
    valorTAC: parseFloat(proposta.valorTac || '0'),
    contaBancaria: {
      banco: proposta.dadosPagamentoBanco || 'N/A',
      agencia: proposta.dadosPagamentoAgencia || 'N/A',
      conta: proposta.dadosPagamentoConta || 'N/A',
      tipoConta: proposta.dadosPagamentoTipo || 'corrente',
      titular: proposta.dadosPagamentoNomeTitular || proposta.clienteNome || 'N/A',
    },
    status: proposta.status || 'UNKNOWN',
    dataRequisicao: proposta.createdAt?.toISOString() || new Date().toISOString(),
    dataAprovacao: proposta.dataAprovacao?.toISOString(),
    dataPagamento: proposta.dataPagamento?.toISOString(),
    requisitadoPor: {
      id: proposta.userId || 'system',
      nome: proposta.solicitadoPorNome || 'Sistema',
      papel: 'OPERADOR',
    },
    aprovadoPor: proposta.aprovadoPorNome ? {
      id: proposta.analistaId || 'system',
      nome: proposta.aprovadoPorNome,
      papel: 'ANALISTA',
    } : undefined,
    motivoRejeicao: proposta.motivoPendencia,
    observacoes: proposta.observacoes,
    comprovante: proposta.urlComprovantePagemento,
    formaPagamento: (proposta.formaPagamento?.toLowerCase() || 'pix') as 'ted' | 'pix' | 'doc',
    loja: loja?.nome || 'N/A',
    produto: produto?.nome || 'N/A',
  };
}

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

const router = Router();

/**
 * Get payments list - SIMPLIFICADO
 * GET /api/pagamentos
 */
router.get('/', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    console.log('[PAGAMENTOS] Endpoint simples chamado!');
    
    // SOLUÇÃO ULTRA-SIMPLES: buscar direto da tabela propostas
    const { db } = await import('../../lib/supabase.js');
    const { propostas } = await import('@shared/schema');
    const { eq, sql } = await import('drizzle-orm');
    
    if (!db) {
      console.error('[PAGAMENTOS] Database connection not available');
      return res.status(500).json({ error: 'Database not connected' });
    }

    // Query DIRETA e SIMPLES
    const result = await db
      .select()
      .from(propostas)
      .where(eq(propostas.status, 'ASSINATURA_CONCLUIDA'))
      .limit(10); // Limitar para teste
    
    console.log(`[PAGAMENTOS] Encontrou ${result.length} propostas com ASSINATURA_CONCLUIDA`);
    
    // Resposta SIMPLES sem DTO complexo
    const simpleData = result.map(proposta => ({
      id: proposta.id,
      nomeCliente: proposta.clienteNome || 'N/A',
      cpfCliente: proposta.clienteCpf || 'N/A', 
      valorLiquido: parseFloat(proposta.valorLiquidoLiberado || proposta.valor || '0'),
      status: proposta.status,
      dataRequisicao: proposta.createdAt?.toISOString(),
      numeroContrato: proposta.numeroProposta?.toString() || `PROP-${proposta.id.slice(0, 8)}`
    }));

    res.json({
      success: true,
      data: simpleData,
      total: simpleData.length,
      debug: `Query executada: SELECT * FROM propostas WHERE status = 'ASSINATURA_CONCLUIDA'`
    });
    
  } catch (error: any) {
    console.error('[PAGAMENTOS] Error getting payments:', error);
    res.status(500).json({
      error: 'Erro ao buscar pagamentos',
      details: error.message,
      stack: error.stack
    });
  }
});

/**
 * Get specific proposal for payment
 * GET /api/pagamentos/:id
 */
router.get('/:id', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const proposal = await pagamentoService.getProposalForPayment(id);

    res.json({
      success: true,
      data: proposal,
    });
  } catch (error: any) {
    if (error.message.includes('não encontrada') || error.message.includes('não está pronta')) {
      return res.status(404).json({ error: error.message });
    }

    console.error('[PAGAMENTOS] Error getting proposal:', error);
    res.status(500).json({
      error: 'Erro ao buscar proposta para pagamento',
      details: error.message,
    });
  }
});

/**
 * Create new payment
 * POST /api/pagamentos
 */
router.post('/', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    // Check user permissions
    if (!['ADMINISTRADOR', 'FINANCEIRO', 'GERENTE'].includes(userRole || '')) {
      return res.status(403).json({
        error: 'Apenas administradores, gerentes e equipe financeira podem criar pagamentos',
      });
    }

    // Validate payment data
    const validation = await pagamentoService.validatePaymentData(req.body);

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Dados de pagamento inválidos',
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }

    if (validation.warnings.length > 0) {
      console.warn('[PAGAMENTOS] Payment warnings:', validation.warnings);
    }

    // Create payment
    const payment = await pagamentoService.createPayment(req.body, userId);

    res.status(201).json({
      success: true,
      message: 'Pagamento criado com sucesso',
      data: payment,
    });
  } catch (error: any) {
    console.error('[PAGAMENTOS] Error creating payment:', error);

    if (error.message.includes('já possui pagamento')) {
      return res.status(409).json({ error: error.message });
    }

    if (error.message.includes('não encontrada') || error.message.includes('não está pronta')) {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Erro ao criar pagamento',
      details: error.message,
    });
  }
});

/**
 * Update payment status
 * PATCH /api/pagamentos/:id/status
 */
router.patch('/:id/status', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { status, observacoes } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    // Check user permissions
    if (!['ADMINISTRADOR', 'FINANCEIRO', 'GERENTE'].includes(userRole || '')) {
      return res.status(403).json({
        error:
          'Apenas administradores, gerentes e equipe financeira podem alterar status de pagamentos',
      });
    }

    if (!status) {
      return res.status(400).json({ error: 'Status é obrigatório' });
    }

    // Validate status
    const validStatuses = ['processando', 'pago', 'rejeitado', 'cancelado'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Status inválido',
        validStatuses,
      });
    }

    const updatedPayment = await pagamentoService.updatePaymentStatus(
      id,
      status,
      userId,
      observacoes
    );

    res.json({
      success: true,
      message: `Status do pagamento alterado para: ${status}`,
      data: updatedPayment,
    });
  } catch (error: any) {
    console.error('[PAGAMENTOS] Error updating payment status:', error);

    if (error.message.includes('não encontrada')) {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Erro ao atualizar status do pagamento',
      details: error.message,
    });
  }
});

/**
 * Export payments data
 * GET /api/pagamentos/export
 */
router.get('/export/data', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { dataInicio, dataFim, status, loja, formato = 'csv' } = req.query;
    const userRole = req.user?.role;

    // Check user permissions
    if (!['ADMINISTRADOR', 'GERENTE'].includes(userRole || '')) {
      return res.status(403).json({
        error: 'Apenas administradores e gerentes podem exportar dados de pagamentos',
      });
    }

    const filters = {
      dataInicio: dataInicio as string,
      dataFim: dataFim as string,
      status: status ? (status as string).split(',') : undefined,
      loja: loja as string,
      formato: formato as 'csv' | 'excel',
    };

    const exportData = await pagamentoService.exportPayments(filters);

    // Set response headers for download
    res.setHeader('Content-Type', exportData.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${exportData.filename}.${formato}"`
    );

    // For CSV format, convert data to CSV string
    if (formato === 'csv') {
      const csv = convertToCSV(exportData.data);
      res.send(csv);
    } else {
      // For Excel format, you would need to implement Excel generation
      // For now, return JSON data
      res.json(exportData.data);
    }
  } catch (error: any) {
    console.error('[PAGAMENTOS] Error exporting payments:', error);
    res.status(500).json({
      error: 'Erro ao exportar dados de pagamentos',
      details: error.message,
    });
  }
});

/**
 * Get payments dashboard data
 * GET /api/pagamentos/dashboard
 */
router.get('/dashboard/stats', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const dashboard = await pagamentoService.getPaymentsDashboard();

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error: any) {
    console.error('[PAGAMENTOS] Error getting dashboard:', error);
    res.status(500).json({
      error: 'Erro ao carregar dashboard de pagamentos',
      details: error.message,
    });
  }
});

/**
 * Get filter options for payment screens
 * GET /api/pagamentos/filter-options
 */
router.get('/filter-options/data', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const options = await pagamentoService.getFilterOptions();

    res.json({
      success: true,
      data: options,
    });
  } catch (error: any) {
    console.error('[PAGAMENTOS] Error getting filter options:', error);
    res.status(500).json({
      error: 'Erro ao carregar opções de filtro',
      details: error.message,
    });
  }
});

/**
 * Validate payment data
 * POST /api/pagamentos/validate
 */
router.post('/validate', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const validation = await pagamentoService.validatePaymentData(req.body);

    res.json({
      success: true,
      data: validation,
    });
  } catch (error: any) {
    console.error('[PAGAMENTOS] Error validating payment data:', error);
    res.status(500).json({
      error: 'Erro ao validar dados de pagamento',
      details: error.message,
    });
  }
});

/**
 * Upload payment document
 * POST /api/pagamentos/:id/documents
 */
router.post(
  '/:id/documents',
  jwtAuthMiddleware,
  upload.single('document'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const file = req.file;

      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      if (!file) {
        return res.status(400).json({ error: 'Arquivo é obrigatório' });
      }

      // Document upload logic implementation
      // This would typically involve:
      // 1. Validate file type and size
      // 2. Upload to storage service
      // 3. Create document record in database
      // 4. Associate with payment

      res.json({
        success: true,
        message: 'Documento enviado com sucesso',
        filename: file.originalname,
        size: file.size,
      });
    } catch (error: any) {
      console.error('[PAGAMENTOS] Error uploading document:', error);
      res.status(500).json({
        error: 'Erro ao fazer upload do documento',
        details: error.message,
      });
    }
  }
);

/**
 * Helper function to convert data to CSV format
 */
function convertToCSV(data: any[]): string {
  if (!data || data.length === 0) {
    return '';
  }

  const headers = Object.keys(data[0]);
  const csvRows = [];

  // Add headers
  csvRows.push(headers.join(','));

  // Add data rows
  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header];
      // Escape values that contain commas or quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

export default router;
