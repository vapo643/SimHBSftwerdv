/**
 * Documents Service
 * Business logic for document operations
 * PAM V1.0 - Service layer implementation
 */

import { documentsRepository } from '../repositories/documents.repository.js';

export class DocumentsService {
  /**
   * Get documents for a proposal
   */
  async getProposalDocuments(propostaId: string): Promise<{
    propostaId: string;
    totalDocuments: number;
    documents: any[];
  }> {
    try {
      // Get proposal to check CCB document
      const proposta = await documentsRepository.getProposalById(propostaId);

      if (!proposta) {
        throw new Error('Proposta não encontrada');
      }

      const documents = [];

      // Add CCB if exists
      if (proposta.ccb_documento_url) {
        documents.push({
          name: 'CCB - Cédula de Crédito Bancário',
          url: proposta.ccb_documento_url,
          type: 'application/pdf',
          category: 'ccb',
          uploadDate: 'Sistema',
          isRequired: true,
        });
      }

      // Get other documents
      const propostaDocuments = await documentsRepository.getProposalDocuments(propostaId);

      for (const doc of propostaDocuments) {
        try {
          // Extract file path from URL
          const documentsIndex = doc.url.indexOf('/documents/');
          let filePath;

          if (documentsIndex !== -1) {
            filePath = doc.url.substring(documentsIndex + '/documents/'.length);
          } else {
            const urlParts = doc.url.split('/');
            const fileName = urlParts[urlParts.length - 1];
            filePath = `proposta-${propostaId}/${fileName}`;
          }

          console.log(`[DOCUMENTS_SERVICE] Generating signed URL for: ${filePath}`);

          // Generate signed URL
          const signedUrl = await documentsRepository.generateSignedUrl(filePath, 3600);

          documents.push({
            name: doc.nomeArquivo,
            url: signedUrl || doc.url, // Fallback to original URL
            type: doc.tipo || 'application/octet-stream',
            size: doc.tamanho ? `${Math.round(doc.tamanho / 1024)} KB` : undefined,
            uploadDate: doc.createdAt,
            category: 'supporting',
          });
        } catch (error) {
          console.error(
            `[DOCUMENTS_SERVICE] Error generating signed URL for ${doc.nomeArquivo}:`,
            error
          );
          // Fallback to original URL
          documents.push({
            name: doc.nomeArquivo,
            url: doc.url,
            type: doc.tipo || 'application/octet-stream',
            size: doc.tamanho ? `${Math.round(doc.tamanho / 1024)} KB` : undefined,
            uploadDate: doc.createdAt,
            category: 'supporting',
          });
        }
      }

      return {
        propostaId,
        totalDocuments: documents.length,
        documents,
      };
    } catch (error: any) {
      console.error('[DOCUMENTS_SERVICE] Error getting proposal documents:', error);
      throw error;
    }
  }

  /**
   * Upload a document for a proposal
   */
  async uploadDocument(
    propostaId: string,
    file: any
  ): Promise<{
    success: boolean;
    document?: any;
    error?: string;
  }> {
    try {
      // Verify proposal exists
      const proposta = await documentsRepository.getProposalById(propostaId);

      if (!proposta) {
        return {
          success: false,
          error: 'Proposta não encontrada',
        };
      }

      // Generate unique file name
      const timestamp = Date.now();
      const fileName = `${timestamp}-${file.originalname}`;
      const filePath = `proposta-${propostaId}/${fileName}`;

      // Upload to storage
      const uploadResult = await documentsRepository.uploadToStorage(
        filePath,
        file.buffer,
        file.mimetype
      );

      if (!uploadResult) {
        return {
          success: false,
          error: 'Erro no upload do arquivo',
        };
      }

      // Save document record
      const document = await documentsRepository.createDocument({
        proposta_id: propostaId,
        nome_arquivo: file.originalname,
        url: uploadResult.publicUrl,
        tipo: file.mimetype,
        tamanho: file.size,
      });

      return {
        success: true,
        document: {
          name: file.originalname,
          fileName: fileName,
          url: uploadResult.publicUrl,
          type: file.mimetype,
          size: `${Math.round(file.size / 1024)} KB`,
          uploadDate: new Date().toISOString(),
          category: 'supporting',
        },
      };
    } catch (error: any) {
      console.error('[DOCUMENTS_SERVICE] Error uploading document:', error);
      return {
        success: false,
        error: error.message || 'Erro interno do servidor no upload',
      };
    }
  }

  /**
   * Download a document (generate signed URL)
   */
  async downloadDocument(path: string): Promise<{
    success: boolean;
    url?: string;
    filename?: string;
    contentType?: string;
    error?: string;
  }> {
    try {
      console.log(`[DOCUMENTS_SERVICE] Downloading document: ${path}`);

      const signedUrl = await documentsRepository.generateSignedUrl(path, 3600);

      if (!signedUrl) {
        const isNotFound = path.includes('not-found');
        return {
          success: false,
          error: isNotFound ? 'Documento não encontrado' : 'Erro ao acessar documento',
        };
      }

      console.log(`[DOCUMENTS_SERVICE] Signed URL generated for: ${path}`);

      return {
        success: true,
        url: signedUrl,
        filename: `documento-${path.split('/').pop()}`,
        contentType: 'application/pdf',
      };
    } catch (error: any) {
      console.error('[DOCUMENTS_SERVICE] Error downloading document:', error);
      return {
        success: false,
        error: error.message || 'Erro interno do servidor',
      };
    }
  }
}

export const documentsService = new DocumentsService();
