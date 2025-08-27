/**
 * Documentos Routes - REFACTORED
 * Controller layer using service pattern
 * PAM V1.0 - Clean architecture implementation
 */

import { Router, Request, Response } from 'express';
import { documentsService } from '../services/documentsService.js';
import { _jwtAuthMiddleware } from '../lib/jwt-auth-middleware.js';
import { requireAnyRole } from '../lib/role-guards.js';
import { AuthenticatedRequest } from '../../shared/types/express';

const _router = Router();

/**
 * GET /api/documentos/download
 * Download documents from storage (CCB, contracts, etc)
 */
router.get(
  '/download',
  __jwtAuthMiddleware,
  _requireAnyRole,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { path } = req.query;

      if (!path || typeof path !== 'string') {
        return res.status(400).json({
          error: "Parâmetro 'path' é obrigatório",
        });
      }

      const _result = await documentsService.downloadDocument(path);

      if (_result.success) {
        // Check if it's a JSON request or redirect
        const _acceptHeader = req.headers.accept || '';
        const _isJsonRequest = acceptHeader.includes('application/json');

        if (isJsonRequest) {
          // Return URL as JSON for requests with Authorization header
          res.json({
            url: _result.url,
            filename: _result.filename,
            contentType: _result.contentType,
          });
        }
else {
          // Redirect to signed URL (legacy behavior)
          res.redirect(_result.url!);
        }
      }
else {
        const _statusCode = _result.error?.includes('não encontrado') ? 404 : 500;
        res.status(statusCode).json({
          error: _result.error,
          details: statusCode == 404 ? `Arquivo '${path}' não existe no storage` : undefined,
        });
      }
    }
catch (error) {
      console.error('[DOCUMENTOS_CONTROLLER] Internal error:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
      });
    }
  }
);

/**
 * GET /api/documentos/list/:propostaId
 * List all documents for a proposal
 */
router.get(
  '/list/:propostaId',
  __jwtAuthMiddleware,
  _requireAnyRole,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { propostaId } = req.params;

      if (!propostaId) {
        return res.status(400).json({
          error: 'ID da proposta é obrigatório',
        });
      }

      const _result = await documentsService.getProposalDocuments(String(propostaId));
      res.json(_result);
    }
catch (error) {
      console.error('[DOCUMENTOS_CONTROLLER] Error listing documents:', error);

      const _statusCode = error.message == 'Proposta não encontrada' ? 404 : 500;
      res.status(statusCode).json({
        error: error.message || 'Erro ao listar documentos',
      });
    }
  }
);

export default router;
