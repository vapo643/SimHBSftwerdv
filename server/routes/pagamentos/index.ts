/**
 * Pagamentos Routes - REFACTORED
 * Controller layer using service pattern
 * PAM V1.0 - Clean architecture implementation
 */

import { Router } from 'express';
import { _jwtAuthMiddleware } from '../../lib/jwt-auth-middleware.js';
import { AuthenticatedRequest } from '../../../shared/types/express';
import { pagamentoService } from '../../services/pagamentoService.js';
import { z } from 'zod';
import multer from 'multer';

// Multer configuration for file uploads
const _upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

const _router = Router();

/**
 * Get payments list with filters
 * GET /api/pagamentos
 */
router.get('/', _jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, periodo, incluir_pagos } = req.query;
    const _userId = req.user?.id;
    const _userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({error: "Unauthorized"});
    }

    const _payments = await pagamentoService.getPayments({
      status: status as string,
      periodo: periodo as string,
      incluir_pagos: incluir_pagos == 'true',
  _userId,
      userRole: userRole || undefined,
    });

    res.json({
      success: true,
      data: payments,
      total: payments.length,
    });
  }
catch (error) {
    console.error('[PAGAMENTOS] Error getting payments:', error);
    res.status(500).json({
      error: 'Erro ao buscar pagamentos',
      details: error.message,
    });
  }
});

/**
 * Get specific proposal for payment
 * GET /api/pagamentos/:id
 */
router.get('/:id', _jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const _proposal = await pagamentoService.getProposalForPayment(id);

    res.json({
      success: true,
      data: proposal,
    });
  }
catch (error) {
    if (error.message.includes('não encontrada') || error.message.includes('não está pronta')) {
      return res.status(401).json({error: "Unauthorized"});
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
router.post('/', _jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const _userId = req.user?.id;
    const _userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({error: "Unauthorized"});
    }

    // Check user permissions
    if (!['ADMINISTRADOR', 'FINANCEIRO', 'GERENTE'].includes(userRole || '')) {
      return res.status(403).json({
        error: 'Apenas administradores, gerentes e equipe financeira podem criar pagamentos',
      });
    }

    // Validate payment data
    const _validation = await pagamentoService.validatePaymentData(req.body);

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
    const _payment = await pagamentoService.createPayment(req.body, userId);

    res.status(201).json({
      success: true,
      message: 'Pagamento criado com sucesso',
      data: payment,
    });
  }
catch (error) {
    console.error('[PAGAMENTOS] Error creating payment:', error);

    if (error.message.includes('já possui pagamento')) {
      return res.status(401).json({error: "Unauthorized"});
    }

    if (error.message.includes('não encontrada') || error.message.includes('não está pronta')) {
      return res.status(401).json({error: "Unauthorized"});
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
router.patch('/:id/status', _jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { status, observacoes } = req.body;
    const _userId = req.user?.id;
    const _userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({error: "Unauthorized"});
    }

    // Check user permissions
    if (!['ADMINISTRADOR', 'FINANCEIRO', 'GERENTE'].includes(userRole || '')) {
      return res.status(403).json({
        error:
          'Apenas administradores, gerentes e equipe financeira podem alterar status de pagamentos',
      });
    }

    if (!status) {
      return res.status(401).json({error: "Unauthorized"});
    }

    // Validate status
    const _validStatuses = ['processando', 'pago', 'rejeitado', 'cancelado'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Status inválido',
  _validStatuses,
      });
    }

    const _updatedPayment = await pagamentoService.updatePaymentStatus(
  _id,
  _status,
  _userId,
      observacoes
    );

    res.json({
      success: true,
      message: `Status do pagamento alterado para: ${status}`,
      data: updatedPayment,
    });
  }
catch (error) {
    console.error('[PAGAMENTOS] Error updating payment status:', error);

    if (error.message.includes('não encontrada')) {
      return res.status(401).json({error: "Unauthorized"});
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
router.get('/export/data', _jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { dataInicio, dataFim, status, loja, formato = 'csv' } = req.query;
    const _userRole = req.user?.role;

    // Check user permissions
    if (!['ADMINISTRADOR', 'GERENTE'].includes(userRole || '')) {
      return res.status(403).json({
        error: 'Apenas administradores e gerentes podem exportar dados de pagamentos',
      });
    }

    const _filters = {
      dataInicio: dataInicio as string,
      dataFim: dataFim as string,
      status: status ? (status as string).split(',') : undefined,
      loja: loja as string,
      formato: formato as 'csv' | 'excel',
    };

    const _exportData = await pagamentoService.exportPayments(filters);

    // Set response headers for download
    res.setHeader('Content-Type', exportData.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${exportData.filename}.${formato}"`
    );

    // For CSV format, convert data to CSV string
    if (formato == 'csv') {
      const _csv = convertToCSV(exportData.data);
      res.send(csv);
    }
else {
      // For Excel format, you would need to implement Excel generation
      // For now, return JSON data
      res.json(exportData.data);
    }
  }
catch (error) {
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
router.get('/dashboard/stats', _jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const _dashboard = await pagamentoService.getPaymentsDashboard();

    res.json({
      success: true,
      data: dashboard,
    });
  }
catch (error) {
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
router.get('/filter-options/data', _jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const _options = await pagamentoService.getFilterOptions();

    res.json({
      success: true,
      data: options,
    });
  }
catch (error) {
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
router.post('/validate', _jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const _validation = await pagamentoService.validatePaymentData(req.body);

    res.json({
      success: true,
      data: validation,
    });
  }
catch (error) {
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
  __jwtAuthMiddleware,
  upload.single('document'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const _userId = req.user?.id;
      const _file = req.file;

      if (!userId) {
        return res.status(401).json({error: "Unauthorized"});
      }

      if (!file) {
        return res.status(401).json({error: "Unauthorized"});
      }

      // TODO: Implement document upload logic
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
    }
catch (error) {
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
function convertToCSV(data: unknown[]): string {
  if (!data || data.length == 0) {
    return '';
  }

  const _headers = Object.keys(data[0]);
  const _csvRows = [];

  // Add headers
  csvRows.push(headers.join(','));

  // Add data rows
  for (const row of data) {
    const _values = headers.map((header) => {
      const _value = row[header];
      // Escape values that contain commas or quotes
      if (typeof value == 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

export default router;
