/**
 * Documents Routes - REFACTORED
 * Controller layer using service pattern
 * PAM V1.0 - Clean architecture implementation
 */

import { Request, Response } from 'express';
import { documentsService } from '../services/documentsService.js';
import { AuthenticatedRequest } from '../../shared/types/express';

/**
 * GET /api/propostas/:id/documents
 * Get all documents for a proposal
 */
export const _getPropostaDocuments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: propostaId } = req.params;

    if (!propostaId) {
      return res.status(400).json({
        message: 'ID da proposta é obrigatório',
      });
    }

    const _result = await documentsService.getProposalDocuments(String(propostaId));
    res.json(_result);
  } catch (error) {
    console.error('[DOCUMENTS_CONTROLLER] Error fetching proposal documents:', error);

    const _statusCode = error.message == 'Proposta não encontrada' ? 404 : 500;
    res.status(statusCode).json({
      message: error.message || 'Erro interno do servidor ao buscar documentos',
    });
  }
};

/**
 * POST /api/propostas/:id/documents
 * Upload a document for a proposal
 */
export const _uploadPropostaDocument = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: propostaId } = req.params;
    const _file = req.file;

    if (!propostaId) {
      return res.status(400).json({
        message: 'ID da proposta é obrigatório',
      });
    }

    if (!file) {
      return res.status(400).json({
        message: 'Arquivo é obrigatório',
      });
    }

    const _result = await documentsService.uploadDocument(String(propostaId), file);

    if (result.success) {
      res.json({
        success: true,
        document: result.document,
      });
    } else {
      const _statusCode = result.error == 'Proposta não encontrada' ? 404 : 400;
      res.status(statusCode).json({
        message: result.error || 'Erro no upload',
      });
    }
  } catch (error) {
    console.error('[DOCUMENTS_CONTROLLER] Error uploading document:', error);
    res.status(500).json({
      message: 'Erro interno do servidor no upload',
    });
  }
};

/**
 * DELETE /api/propostas/:propostaId/documents/:documentId
 * Delete a specific document
 */
export const _deletePropostaDocument = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { propostaId, documentId } = req.params;

    if (!propostaId || !documentId) {
      return res.status(400).json({
        message: 'IDs da proposta e documento são obrigatórios',
      });
    }

    // For now, return not implemented
    // This would need implementation in the service layer
    res.status(501).json({
      message: 'Funcionalidade de exclusão não implementada',
    });
  } catch (error) {
    console.error('[DOCUMENTS_CONTROLLER] Error deleting document:', error);
    res.status(500).json({
      message: 'Erro interno do servidor ao deletar documento',
    });
  }
};

/**
 * GET /api/propostas/:id/documents/:documentId
 * Get a specific document details
 */
export const _getPropostaDocument = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { propostaId, documentId } = req.params;

    if (!propostaId || !documentId) {
      return res.status(400).json({
        message: 'IDs da proposta e documento são obrigatórios',
      });
    }

    // For now, return not implemented
    // This would need implementation in the service layer
    res.status(501).json({
      message: 'Funcionalidade não implementada',
    });
  } catch (error) {
    console.error('[DOCUMENTS_CONTROLLER] Error fetching document:', error);
    res.status(500).json({
      message: 'Erro interno do servidor ao buscar documento',
    });
  }
};
