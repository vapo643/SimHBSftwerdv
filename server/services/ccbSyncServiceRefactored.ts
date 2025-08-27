/**
 * CCB Sync Service - Refactored
 * Acts as a safety net polling fallback for webhook-based processing
 * Runs with reduced frequency (every 6 hours instead of every 2 minutes)
 */

import { db } from '../lib/supabase';
import { sql } from 'drizzle-orm';
import { documentProcessingService, ProcessingSource } from './documentProcessingService';

export class CCBSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastSyncTime: Date | null = null;
  private syncStats = {
    totalSyncs: 0,
    documentsProcessed: 0,
    lastSuccessTime: null as Date | null,
    failedAttempts: 0,
  };

  /**
   * Start automatic synchronization with reduced frequency
   * Now acts as a safety net for missed webhook events
   */
  startAutoSync(intervalHours: number = 6) {
    if (this.isRunning) {
      console.log('[CCB SYNC] ⚠️ Fallback polling already running');
      return;
    }

    console.log(`[CCB SYNC] 🚀 Starting fallback polling (every ${intervalHours} hours)`);
    console.log(`[CCB SYNC] ℹ️ Primary processing via webhooks, polling is safety net only`);

    this.isRunning = true;

    // Don't run immediately - let webhooks handle recent events
    // First check after 1 hour
    setTimeout(
      () => {
        this.syncPendingCCBs();
      },
      60 * 60 * 1000
    ); // 1 hour

    // Then run periodically
    this.syncInterval = setInterval(
      () => {
        this.syncPendingCCBs();
      },
      intervalHours * 60 * 60 * 1000
    ); // Convert hours to milliseconds
  }

  /**
   * Stop the automatic sync process
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      this.isRunning = false;
      console.log('[CCB SYNC] ⛔ Fallback polling stopped');
    }
  }

  /**
   * Sync pending CCBs - now only processes old/missed documents
   * Acts as a safety net for webhook failures
   */
  async syncPendingCCBs() {
    const _startTime = Date.now();

    try {
      console.log('[CCB SYNC] 🔍 Running fallback check for missed documents...');
      this.syncStats.totalSyncs++;
      this.lastSyncTime = new Date();

      // Only check for documents that:
      // 1. Have been waiting for signature for more than 3 hours
      // 2. Are marked as signed but haven't been processed
      // 3. Don't have a stored CCB file
      const _pendingProposals = await db.execute(sql`
        SELECT 
          p.id,
          p.clicksign_document_id,
          p.clicksign_envelope_id,
          p.cliente_nome,
          p.data_aprovacao,
          p.assinatura_eletronica_concluida,
          p.caminho_ccb_assinado,
          p.atualizado_em
        FROM propostas p
        WHERE 
          -- Has ClickSign document
          (p.clicksign_document_id IS NOT NULL OR p.clicksign_envelope_id IS NOT NULL)
          -- CCB was generated
          AND p.ccb_gerado = true
          -- But no signed file stored
          AND (p.caminho_ccb_assinado IS NULL OR p.caminho_ccb_assinado = '')
          -- Has been waiting for more than 3 hours
          AND p.atualizado_em < NOW() - INTERVAL '3 hours'
          -- Is in a state that should have signature
          AND p.status IN ('pronto_pagamento', 'em_formalizacao', 'assinado')
        ORDER BY p.atualizado_em ASC
        LIMIT 10
      `);

      if (!pendingProposals || pendingProposals.length == 0) {
        console.log('[CCB SYNC] ✅ No missed documents found (webhook system working correctly)');
        return;
      }

      const _proposals = pendingProposals;
      console.warn(
        `[CCB SYNC] ⚠️ Found ${proposals.length} potentially missed documents (older than 3 hours)`
      );

      // Process in batch
      const _processingTasks = proposals.map((proposal) => ({
        id: proposal.id as string,
        documentKey: (proposal.clicksign_document_id || proposal.clicksign_envelope_id) as string,
      }));

      const _results = await documentProcessingService.processBatch(
        _processingTasks,
        ProcessingSource.POLLING
      );

      // Count successes
      const _successCount = results.filter((r) => r.success).length;
      const _failureCount = results.filter((r) => !r.success).length;

      this.syncStats.documentsProcessed += successCount;
      this.syncStats.failedAttempts += failureCount;

      if (successCount > 0) {
        this.syncStats.lastSuccessTime = new Date();
        console.warn(
          `⚠️ [CCB SYNC] Processed ${successCount} documents via POLLING FALLBACK (webhook may have failed)`
        );
      }

      if (failureCount > 0) {
        console.error(`❌ [CCB SYNC] Failed to process ${failureCount} documents`);
      }

      // Log sync statistics
      const _processingTime = Date.now() - startTime;
      console.log(`[CCB SYNC] 📊 Fallback sync completed in ${processingTime}ms`);
      console.log(`[CCB SYNC] 📈 Stats:`, {
        totalSyncs: this.syncStats.totalSyncs,
        documentsProcessed: this.syncStats.documentsProcessed,
        lastSuccessTime: this.syncStats.lastSuccessTime,
        failedAttempts: this.syncStats.failedAttempts,
      });

      // Alert if we're processing too many documents via polling
      if (successCount > 5) {
        console.error(
          `🚨 [CCB SYNC] WARNING: Processed ${successCount} documents via polling. Webhook system may need attention!`
        );

        // Log alert for monitoring
        await db.execute(sql`
          INSERT INTO system_alerts (
  _type,
  _severity,
  _message,
  _details,
            created_at
          ) VALUES (
            ${'webhook_failure_suspected'},
            ${'high'},
            ${`High number of documents (${successCount}) processed via polling fallback`},
            ${JSON.stringify({
              documentsProcessed: successCount,
              proposalIds: results.filter((r) => r.success).map((r) => r.proposalId),
              syncTime: new Date().toISOString(),
            })},
            NOW()
          )
        `);
      }
    }
catch (error) {
      console.error('[CCB SYNC] ❌ Error during fallback sync:', error);
      this.syncStats.failedAttempts++;
    }
  }

  /**
   * Get sync statistics for monitoring
   */
  getSyncStats() {
    return {
      ...this.syncStats,
      isRunning: this.isRunning,
      lastSyncTime: this.lastSyncTime,
    };
  }

  /**
   * Manually trigger a sync for a specific proposal
   * Useful for debugging or manual intervention
   */
  async syncSingleProposal(proposalId: string): Promise<boolean> {
    try {
      console.log(`[CCB SYNC] 🔧 Manual sync triggered for proposal ${proposalId}`);

      const _result = await documentProcessingService.processSignedDocument(
        _proposalId,
        ProcessingSource.MANUAL
      );

      return _result.success;
    }
catch (error) {
      console.error(`[CCB SYNC] ❌ Manual sync failed for ${proposalId}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const _ccbSyncService = new CCBSyncService();
