/**
 * Documents Routes - RESTORED FROM ORIGINAL
 * Controller layer using service pattern
 * PAM V4.0 - Fixed corruption from mass refactoring
 */

import { Request, Response } from 'express';
// 1. IMPORTAÇÃO UNIFICADA: Apontar apenas para a instância correta do DocumentsService
import { documentsService } from '../services/documentsService';
import { AuthenticatedRequest } from '../../shared/types/express';

/**
 * GET /api/propostas/:id/documents
 * Get all documents for a proposal
 */
export const getPropostaDocuments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: propostaId } = req.params;

    if (!propostaId) {
      return res.status(400).json({
        message: 'ID da proposta é obrigatório',
      });
    }

    // 2. CHAMADA CORRIGIDA: Invocar o método getProposalDocuments do serviço correto
    const result = await documentsService.getProposalDocuments(propostaId);

    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[DOCUMENTS_CONTROLLER] Error fetching proposal documents:', error);

    const statusCode = error.message === 'Proposta não encontrada' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Erro interno do servidor ao buscar documentos',
    });
  }
};

/**
 * POST /api/propostas/:id/documents
 * Upload a document for a proposal
 */
export const uploadPropostaDocument = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: propostaId } = req.params;

    if (!propostaId) {
      return res.status(400).json({
        success: false,
        message: 'ID da proposta é obrigatório',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Arquivo é obrigatório',
      });
    }

    // 2. CHAMADA CORRIGIDA: Invocar o método uploadDocument do serviço correto
    const result = await documentsService.uploadDocument(propostaId, req.file);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
    console.error('[DOCUMENTS_CONTROLLER] Error uploading document:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro interno do servidor ao fazer upload do documento',
    });
  }
};
