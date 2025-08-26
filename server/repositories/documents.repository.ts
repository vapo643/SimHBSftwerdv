/**
 * Documents Repository
 * Handles all database operations for document-related data
 * PAM V1.0 - Repository pattern implementation
 */

import { BaseRepository } from "./base.repository.js";
import { db, createServerSupabaseAdminClient } from "../lib/supabase.js";
import { propostaDocumentos, propostas } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import type { PropostaDocumento } from "@shared/schema";

export class DocumentsRepository extends BaseRepository<typeof propostaDocumentos> {
  constructor() {
    super("proposta_documentos");
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
      console.error("[DOCUMENTS_REPO] Error getting proposal documents:", error);
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
      console.error("[DOCUMENTS_REPO] Error getting proposal by ID:", error);
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
      console.error("[DOCUMENTS_REPO] Error creating document:", error);
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
      console.error("[DOCUMENTS_REPO] Error deleting document:", error);
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
      console.error("[DOCUMENTS_REPO] Error getting document by ID:", error);
      return null;
    }
  }

  /**
   * Upload file to storage
   */
  async uploadToStorage(
    filePath: string,
    fileBuffer: Buffer,
    contentType: string
  ): Promise<{ publicUrl: string } | null> {
    try {
      const supabase = createServerSupabaseAdminClient();
      
      const { data, error } = await supabase.storage
        .from("documents")
        .upload(filePath, fileBuffer, {
          contentType,
          upsert: false,
        });

      if (error) {
        console.error("[DOCUMENTS_REPO] Upload error:", error);
        return null;
      }

      const { data: publicUrl } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("[DOCUMENTS_REPO] Error uploading to storage:", error);
      return null;
    }
  }

  /**
   * Generate signed URL for a document
   */
  async generateSignedUrl(path: string, expiresIn: number = 3600): Promise<string | null> {
    try {
      const supabase = createServerSupabaseAdminClient();
      
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(path, expiresIn);

      if (error) {
        console.error("[DOCUMENTS_REPO] Error generating signed URL:", error);
        return null;
      }

      return data.signedUrl;
    } catch (error) {
      console.error("[DOCUMENTS_REPO] Error generating signed URL:", error);
      return null;
    }
  }
}

export const documentsRepository = new DocumentsRepository();