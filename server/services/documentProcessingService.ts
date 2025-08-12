/**
 * Serviço centralizado para processamento de documentos assinados
 * Usado tanto por webhooks quanto por polling
 */

import { db, supabase } from "../lib/supabase";
import { sql } from "drizzle-orm";
import { clickSignService } from "./clickSignService";
import { z } from "zod";

export enum ProcessingSource {
  WEBHOOK = "WEBHOOK",
  POLLING = "POLLING_FALLBACK",
  MANUAL = "MANUAL_TRIGGER",
}

export class DocumentProcessingService {
  private clickSignService = clickSignService;

  /**
   * Processa um documento assinado - lógica central reutilizável
   */
  async processSignedDocument(
    proposalId: string,
    source: ProcessingSource = ProcessingSource.MANUAL,
    documentKey?: string
  ): Promise<{ success: boolean; message: string; details?: any }> {
    const startTime = Date.now();

    try {
      console.log(
        `📄 [DOCUMENT PROCESSING] Starting processing for proposal ${proposalId} via ${source}`
      );

      // 1. Buscar dados da proposta
      const proposalResult = await db.execute(sql`
        SELECT 
          id,
          cliente_nome,
          clicksign_envelope_id,
          clicksign_document_id,
          ccb_gerado,
          caminho_ccb_assinado,
          status
        FROM propostas 
        WHERE id = ${proposalId}
      `);

      if (!proposalResult || proposalResult.length === 0) {
        console.warn(`⚠️ [DOCUMENT PROCESSING] Proposal ${proposalId} not found`);
        return {
          success: false,
          message: "Proposta não encontrada",
        };
      }

      const proposal = proposalResult[0];
      const clickSignDocId =
        documentKey || proposal.clicksign_document_id || proposal.clicksign_envelope_id;

      if (!clickSignDocId) {
        console.warn(
          `⚠️ [DOCUMENT PROCESSING] No ClickSign document ID for proposal ${proposalId}`
        );
        return {
          success: false,
          message: "ID do documento ClickSign não encontrado",
        };
      }

      // 2. Verificar se já foi processado (evitar duplicação)
      if (proposal.caminho_ccb_assinado) {
        // Verificar se o arquivo existe no Storage
        const storagePath = proposal.caminho_ccb_assinado as string;
        const { data: fileExists } = await supabase.storage
          .from("documents")
          .list(storagePath.substring(0, storagePath.lastIndexOf("/")), {
            limit: 1,
            search: storagePath.split("/").pop(),
          });

        if (fileExists && fileExists.length > 0) {
          console.log(
            `✅ [DOCUMENT PROCESSING] Document already processed for proposal ${proposalId}`
          );
          return {
            success: true,
            message: "Documento já processado anteriormente",
            details: { storagePath, source: "CACHE" },
          };
        }
      }

      // 3. Baixar documento do ClickSign
      console.log(`📥 [DOCUMENT PROCESSING] Downloading document ${clickSignDocId} from ClickSign`);
      const pdfBuffer = await this.clickSignService.downloadSignedDocument(clickSignDocId);

      if (!pdfBuffer) {
        throw new Error("Failed to download document from ClickSign");
      }

      // 4. Salvar no Supabase Storage
      const fileName = `ccb_assinada_${Date.now()}.pdf`;
      const storagePath = `ccb/assinadas/${proposalId}/${fileName}`;

      console.log(`💾 [DOCUMENT PROCESSING] Saving to Storage: ${storagePath}`);
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // 5. Atualizar banco de dados
      await db.execute(sql`
        UPDATE propostas 
        SET 
          caminho_ccb_assinado = ${storagePath},
          data_assinatura = NOW(),
          atualizado_em = NOW()
        WHERE id = ${proposalId}
      `);

      // 6. Criar log de processamento
      await db.execute(sql`
        INSERT INTO proposta_logs (
          proposta_id,
          acao,
          detalhes,
          usuario_id,
          criado_em
        ) VALUES (
          ${proposalId},
          ${"CCB_ASSINADA_PROCESSADA"},
          ${JSON.stringify({
            source,
            documentKey: clickSignDocId,
            storagePath,
            processingTime: Date.now() - startTime,
          })},
          ${null},
          NOW()
        )
      `);

      const processingTime = Date.now() - startTime;

      if (source === ProcessingSource.WEBHOOK) {
        console.log(
          `✅ [DOCUMENT PROCESSING] Document for proposal ${proposalId} processed via WEBHOOK in ${processingTime}ms`
        );
      } else if (source === ProcessingSource.POLLING) {
        console.warn(
          `⚠️ [DOCUMENT PROCESSING] Document for proposal ${proposalId} processed via POLLING FALLBACK in ${processingTime}ms`
        );
      } else {
        console.log(
          `✅ [DOCUMENT PROCESSING] Document for proposal ${proposalId} processed via ${source} in ${processingTime}ms`
        );
      }

      return {
        success: true,
        message: "Documento processado com sucesso",
        details: {
          proposalId,
          storagePath,
          source,
          processingTime,
        },
      };
    } catch (error) {
      console.error(
        `❌ [DOCUMENT PROCESSING] Error processing document for proposal ${proposalId}:`,
        error
      );

      // Log do erro
      try {
        await db.execute(sql`
          INSERT INTO proposta_logs (
            proposta_id,
            acao,
            detalhes,
            usuario_id,
            criado_em
          ) VALUES (
            ${proposalId},
            ${"ERRO_PROCESSAR_CCB"},
            ${JSON.stringify({
              source,
              error: error instanceof Error ? error.message : "Unknown error",
              timestamp: new Date().toISOString(),
            })},
            ${null},
            NOW()
          )
        `);
      } catch (logError) {
        console.error("Failed to log error:", logError);
      }

      return {
        success: false,
        message: "Erro ao processar documento",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  /**
   * Processa múltiplos documentos em lote
   */
  async processBatch(
    proposals: Array<{ id: string; documentKey?: string }>,
    source: ProcessingSource
  ): Promise<Array<{ proposalId: string; success: boolean; message: string }>> {
    console.log(
      `🔄 [DOCUMENT PROCESSING] Processing batch of ${proposals.length} documents via ${source}`
    );

    const results = await Promise.allSettled(
      proposals.map(p => this.processSignedDocument(p.id, source, p.documentKey))
    );

    return results.map((result, index) => ({
      proposalId: proposals[index].id,
      success: result.status === "fulfilled" ? result.value.success : false,
      message: result.status === "fulfilled" ? result.value.message : "Processing failed",
    }));
  }
}

// Singleton instance
export const documentProcessingService = new DocumentProcessingService();
