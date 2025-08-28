/**
 * Documents Repository
 * Handles all database operations for document-related data
 * PAM V1.0 - Repository pattern implementation
 * Refatorado para usar abstração IStorageProvider (Padrão Adapter)
 */

import { BaseRepository } from './base.repository.js';
import { db } from '../lib/supabase.js';
import { propostaDocumentos, propostas } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import type { PropostaDocumento } from '@shared/schema';
import { IStorageProvider } from '../modules/shared/domain/IStorageProvider';

export class DocumentsRepository extends BaseRepository<typeof propostaDocumentos> {
  private readonly BUCKET_NAME = 'documents';

  constructor(private storageProvider: IStorageProvider) {
    super('proposta_documentos');
  }

  /**
   * Get all documents for a proposal
   */
  async getProposalDocuments(propostaId: string): Promise<PropostaDocumento[]> {
    try {
      return await db
        .select()
        .from(propostaDocumentos)
        .where(eq(propostaDocumentos.propostaId, propostaId))
        .orderBy(desc(propostaDocumentos.createdAt));
    } catch (error) {
      console.error('[DOCUMENTS_REPO] Error getting proposal documents:', error);
      return [];
    }
  }

  /**
   * Get proposal by ID
   */
  async getProposalById(propostaId: string): Promise<any | null> {
    try {
      const [proposta] = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, propostaId))
        .limit(1);

      return proposta || null;
    } catch (error) {
      console.error('[DOCUMENTS_REPO] Error getting proposal by ID:', error);
      return null;
    }
  }

  /**
   * Create a document record
   */
  async createDocument(documentData: {
    proposta_id: string;
    nome_arquivo: string;
    url: string;
    tipo: string;
    tamanho: number;
  }): Promise<PropostaDocumento | null> {
    try {
      const [document] = await db
        .insert(propostaDocumentos)
        .values({
          propostaId: documentData.proposta_id,
          nomeArquivo: documentData.nome_arquivo,
          url: documentData.url,
          tipo: documentData.tipo,
          tamanho: documentData.tamanho,
          createdAt: new Date(),
        })
        .returning();

      return document;
    } catch (error) {
      console.error('[DOCUMENTS_REPO] Error creating document:', error);
      return null;
    }
  }

  /**
   * Delete a document record
   */
  async deleteDocument(documentId: number): Promise<boolean> {
    try {
      const result = await db
        .delete(propostaDocumentos)
        .where(eq(propostaDocumentos.id, documentId))
        .returning();

      return result.length > 0;
    } catch (error) {
      console.error('[DOCUMENTS_REPO] Error deleting document:', error);
      return false;
    }
  }

  /**
   * Get document by ID
   */
  async getDocumentById(documentId: number): Promise<PropostaDocumento | null> {
    try {
      const [document] = await db
        .select()
        .from(propostaDocumentos)
        .where(eq(propostaDocumentos.id, documentId))
        .limit(1);

      return document || null;
    } catch (error) {
      console.error('[DOCUMENTS_REPO] Error getting document by ID:', error);
      return null;
    }
  }

  /**
   * Upload file to storage (usando abstração IStorageProvider)
   */
  async uploadToStorage(
    filePath: string,
    fileBuffer: Buffer,
    contentType: string
  ): Promise<{ publicUrl: string } | null> {
    try {
      console.log(`[DOCUMENTS_REPO] Uploading file '${filePath}' using storage abstraction`);
      
      const uploadResult = await this.storageProvider.upload(
        fileBuffer,
        filePath,
        this.BUCKET_NAME
      );

      console.log(`[DOCUMENTS_REPO] Upload successful: ${uploadResult.publicUrl}`);
      return { publicUrl: uploadResult.publicUrl };
    } catch (error) {
      console.error('[DOCUMENTS_REPO] Error uploading to storage:', error);
      return null;
    }
  }

  /**
   * Generate signed URL for a document (usando abstração IStorageProvider)
   */
  async generateSignedUrl(path: string, expiresIn: number = 3600): Promise<string | null> {
    try {
      console.log(`[DOCUMENTS_REPO] Generating signed URL for '${path}' using storage abstraction`);
      
      const signedUrl = await this.storageProvider.getDownloadUrl(
        path,
        this.BUCKET_NAME,
        expiresIn
      );

      console.log(`[DOCUMENTS_REPO] Signed URL generated successfully`);
      return signedUrl;
    } catch (error) {
      console.error('[DOCUMENTS_REPO] Error generating signed URL:', error);
      return null;
    }
  }

  /**
   * Verifica se um documento existe no storage
   */
  async documentExists(path: string): Promise<boolean> {
    try {
      return await this.storageProvider.exists(path, this.BUCKET_NAME);
    } catch (error) {
      console.error('[DOCUMENTS_REPO] Error checking document existence:', error);
      return false;
    }
  }

  /**
   * Remove um documento do storage
   */
  async deleteFromStorage(path: string): Promise<boolean> {
    try {
      console.log(`[DOCUMENTS_REPO] Deleting file '${path}' using storage abstraction`);
      
      await this.storageProvider.delete(path, this.BUCKET_NAME);
      
      console.log(`[DOCUMENTS_REPO] File deleted successfully`);
      return true;
    } catch (error) {
      console.error('[DOCUMENTS_REPO] Error deleting from storage:', error);
      return false;
    }
  }
}

// NOTE: A instância é criada com injeção de dependência no service
// export const documentsRepository = new DocumentsRepository();
