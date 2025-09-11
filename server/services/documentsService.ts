/**
 * Documents Service
 * Business logic for document operations
 * PAM V1.0 - Service layer implementation
 * Refatorado para usar abstração IStorageProvider (Padrão Adapter + Injeção de Dependência)
 */

import { DocumentsRepository } from '../repositories/documents.repository.js';
import { IStorageProvider } from '../modules/shared/domain/IStorageProvider';
import { SupabaseStorageAdapter } from '../modules/shared/infrastructure/SupabaseStorageAdapter';
import { createServerSupabaseAdminClient } from '../lib/supabase';

export class DocumentsService {
  private documentsRepository: DocumentsRepository;

  constructor(storageProvider?: IStorageProvider) {
    // Usar provider injetado ou criar instância padrão do Supabase
    const provider =
      storageProvider || new SupabaseStorageAdapter(createServerSupabaseAdminClient());
    this.documentsRepository = new DocumentsRepository(provider);
  }

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
      const proposta = await this.documentsRepository.getProposalById(propostaId);

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
      console.log('--- DIAGNÓSTICO DE SERVIÇO BACKEND ---');
      console.log(`[SERVICE LOG] ID da Proposta recebido: ${propostaId}`);

      const bucketName = 'documents';
      const folderPath = `docs-prop/${propostaId}`;
      console.log(`[SERVICE LOG] A consultar Supabase Storage: Bucket='${bucketName}', Caminho='${folderPath}'`);

      // PRIMEIRO: Verificar registros na base de dados
      const propostaDocuments = await this.documentsRepository.getProposalDocuments(propostaId);
      console.log(`[SERVICE LOG] Documentos encontrados na BASE DE DADOS: ${propostaDocuments.length}`);

      // SEGUNDO: Listar arquivos reais no storage (DIAGNÓSTICO CRÍTICO)
      try {
        console.log('[SERVICE LOG] === INICIANDO LISTAGEM DE ARQUIVOS NO STORAGE ===');
        const fileList = await this.documentsRepository.listProposalFilesInStorage(propostaId);
        
        console.log('[SERVICE LOG] Resultado bruto da operação .listFiles():', fileList);
        console.log(`[SERVICE LOG] Número de ficheiros encontrados no STORAGE: ${fileList?.length || 0}`);
        
        if (fileList && fileList.length > 0) {
          console.log('[SERVICE LOG] Arquivos encontrados no storage:', fileList);
        } else {
          console.log('[SERVICE LOG] ⚠️ NENHUM ARQUIVO ENCONTRADO NO STORAGE!');
        }
      } catch (storageError) {
        console.error('[SERVICE LOG] ERRO EXPLÍCITO retornado pelo Supabase Storage:', storageError);
      }
      console.log('--- FIM DO DIAGNÓSTICO DE SERVIÇO ---');

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
            filePath = `docs-prop/${propostaId}/${fileName}`;
          }

          console.log(`[DOCUMENTS_SERVICE] Generating signed URL for: ${filePath}`);

          // Generate signed URL
          const signedUrl = await this.documentsRepository.generateSignedUrl(filePath, 604800); // 7 dias em segundos

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
      const proposta = await this.documentsRepository.getProposalById(propostaId);

      if (!proposta) {
        return {
          success: false,
          error: 'Proposta não encontrada',
        };
      }

      // Generate unique file name
      const timestamp = Date.now();
      const fileName = `${timestamp}-${file.originalname}`;
      const filePath = `docs-prop/${propostaId}/${fileName}`;

      // Upload to storage (usando abstração IStorageProvider)
      const uploadResult = await this.documentsRepository.uploadToStorage(
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

      // --- INÍCIO DO BLOCO DE DIAGNÓSTICO OBRIGATÓRIO ---
      const documentDataToSave = {
        proposta_id: propostaId,
        nome_arquivo: file.originalname,
        url: uploadResult.publicUrl,
        tipo: file.mimetype,
        tamanho: file.size,
      };

      console.log('--- DIAGNÓSTICO DE ESCRITA NA BASE DE DADOS ---');
      console.log('[DB WRITE LOG] Tentando salvar os seguintes metadados:', JSON.stringify(documentDataToSave, null, 2));

      let document;
      try {
        document = await this.documentsRepository.createDocument(documentDataToSave);
        console.log('[DB WRITE LOG] SUCESSO! Resposta da base de dados:', document);
      } catch (dbError) {
        console.error('[DB WRITE LOG] ERRO EXPLÍCITO ao tentar salvar na base de dados:', dbError);
        throw dbError; // Re-throw para manter o comportamento original
      }
      console.log('--- FIM DO DIAGNÓSTICO DE ESCRITA ---');
      // --- FIM DO BLOCO DE DIAGNÓSTICO OBRIGATÓRIO ---

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

      const signedUrl = await this.documentsRepository.generateSignedUrl(path, 3600);

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

  /**
   * Delete a document (from both storage and database)
   * PAM V1.0 - Complete document deletion implementation
   */
  async deleteDocument(documentId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      console.log(`[DOCUMENTS_SERVICE] Deleting document with ID: ${documentId}`);

      // Convert string ID to number for repository call
      const docId = parseInt(documentId);
      if (isNaN(docId)) {
        return {
          success: false,
          error: 'ID do documento inválido',
        };
      }

      // Get document to retrieve file path before deletion
      const document = await this.documentsRepository.getDocumentById(docId);
      
      if (!document) {
        return {
          success: false,
          error: 'Documento não encontrado',
        };
      }

      // Extract file path from URL for storage deletion
      let filePath = '';
      try {
        const documentsIndex = document.url.indexOf('/documents/');
        if (documentsIndex !== -1) {
          filePath = document.url.substring(documentsIndex + '/documents/'.length);
        } else {
          // Fallback: construct path from document metadata
          const timestamp = document.createdAt ? new Date(document.createdAt).getTime() : Date.now();
          filePath = `docs-prop/${document.propostaId}/${timestamp}-${document.nomeArquivo}`;
        }

        console.log(`[DOCUMENTS_SERVICE] Extracted file path: ${filePath}`);
      } catch (error) {
        console.error('[DOCUMENTS_SERVICE] Error extracting file path:', error);
        // Continue with database deletion even if storage path extraction fails
      }

      // Delete from storage first
      let storageDeleted = false;
      if (filePath) {
        storageDeleted = await this.documentsRepository.deleteFromStorage(filePath);
        if (!storageDeleted) {
          console.warn(`[DOCUMENTS_SERVICE] Failed to delete file from storage: ${filePath}`);
          // Continue with database deletion even if storage deletion fails
        }
      }

      // Delete from database
      const databaseDeleted = await this.documentsRepository.deleteDocument(docId);
      
      if (!databaseDeleted) {
        return {
          success: false,
          error: 'Falha ao remover documento da base de dados',
        };
      }

      console.log(`[DOCUMENTS_SERVICE] Document deleted successfully: ${documentId}`);
      
      return {
        success: true,
      };

    } catch (error: any) {
      console.error('[DOCUMENTS_SERVICE] Error deleting document:', error);
      return {
        success: false,
        error: error.message || 'Erro interno do servidor ao deletar documento',
      };
    }
  }
}

// Instância padrão com Supabase Storage Adapter
export const documentsService = new DocumentsService();

// Para testes ou outros provedores de storage, usar:
// const customDocumentsService = new DocumentsService(customStorageProvider);
