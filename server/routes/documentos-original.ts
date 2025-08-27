/**
 * Documentos Routes - REFACTORED
 * Controller layer using service pattern
 * PAM V1.0 - Clean architecture implementation
 */

import { Router, Request, Response } from 'express';
import { documentsService } from '../services/documentsService.js';
import { jwtAuthMiddleware } from '../lib/jwt-auth-middleware.js';
import { requireAnyRole } from '../lib/role-guards.js';
import { AuthenticatedRequest } from '../../shared/types/express';

const router = Router();

/**
 * GET /api/documentos/download
 * Download documents from storage (CCB, contracts, etc)
 */
router.get(
  '/download',
  jwtAuthMiddleware,
  requireAnyRole,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { path } = req.query;

      if (!path || typeof path !== 'string') {
        return res.status(400).json({
          error: "Parâmetro 'path' é obrigatório",
        });
      }

      const result = await documentsService.downloadDocument(path);

      if (result.success) {
        // Check if it's a JSON request or redirect
        const acceptHeader = req.headers.accept || '';
        const isJsonRequest = acceptHeader.includes('application/json');

        if (isJsonRequest) {
          // Return URL as JSON for requests with Authorization header
          res.json({
            url: result.url,
            filename: result.filename,
            contentType: result.contentType,
          });
        } else {
          // Redirect to signed URL (legacy behavior)
          res.redirect(result.url!);
        }
      } else {
        const statusCode = result.error?.includes('não encontrado') ? 404 : 500;
        res.status(statusCode).json({
          error: result.error,
          details: statusCode === 404 ? `Arquivo '${path}' não existe no storage` : undefined,
        });
      }
    } catch (error: unknown) {
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
  jwtAuthMiddleware,
  requireAnyRole,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { propostaId } = req.params;

      if (!propostaId) {
        return res.status(400).json({
          error: 'ID da proposta é obrigatório',
        });
      }

      const result = await documentsService.getProposalDocuments(String(propostaId));
      res.json(result);
    } catch (error: unknown) {
      console.error('[DOCUMENTOS_CONTROLLER] Error listing documents:', error);

      const statusCode = error.message === 'Proposta não encontrada' ? 404 : 500;
      res.status(statusCode).json({
        error: error.message || 'Erro ao listar documentos',
      });
    }
  }
);

export default router;
