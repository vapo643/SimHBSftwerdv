/**
 * Documents Routes - RESTORED FROM ORIGINAL
 * Controller layer using service pattern
 * PAM V4.0 - Fixed corruption from mass refactoring
 */

import { Request, Response } from 'express';
// 1. IMPORTAÇÃO CORRIGIDA: Apontar para a instância correta do DocumentsService
import { documentsService } from '../services/documentsService';
// Manter importação para upload (temporário conforme PAM)
import { documentService } from '../services/genericService';
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
        message: 'ID da proposta é obrigatório',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: 'Arquivo é obrigatório',
      });
    }

    // Using genericService with proper operation mapping
    const result = await documentService.executeOperation('upload_proposta_document', {
      propostaId: parseInt(propostaId),
      file: req.file,
      ...req.body,
    });

    res.json(result);
  } catch (error: any) {
    console.error('[DOCUMENTS_CONTROLLER] Error uploading document:', error);

    res.status(500).json({
      message: error.message || 'Erro interno do servidor ao fazer upload do documento',
    });
  }
};
