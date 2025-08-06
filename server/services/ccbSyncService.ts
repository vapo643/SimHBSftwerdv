/**
 * CCB Sync Service
 * Automatically downloads signed CCBs from ClickSign and stores them in Supabase Storage
 */

import { db, supabase } from '../lib/supabase.js';
import { propostas } from '@shared/schema.js';
import { sql } from 'drizzle-orm';

class CCBSyncService {
  private isRunning = false;
  private syncInterval: NodeJS.Timeout | null = null;

  /**
   * Start the automatic sync process
   */
  startAutoSync(intervalMinutes: number = 5) {
    if (this.isRunning) {
      console.log('[CCB SYNC] ⚠️ Auto sync already running');
      return;
    }

    console.log(`[CCB SYNC] 🚀 Starting auto sync (every ${intervalMinutes} minutes)`);
    this.isRunning = true;

    // Execute immediately
    this.syncPendingCCBs();

    // Then set interval
    this.syncInterval = setInterval(() => {
      this.syncPendingCCBs();
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop the automatic sync process
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      this.isRunning = false;
      console.log('[CCB SYNC] ⛔ Auto sync stopped');
    }
  }

  /**
   * Sync all pending CCBs from ClickSign to Storage
   */
  async syncPendingCCBs() {
    try {
      console.log('[CCB SYNC] 🔄 Starting CCB synchronization...');

      // Find proposals that have been signed but not saved to Storage
      const pendingProposals = await db.execute(sql`
        SELECT 
          id, 
          clicksign_document_key as "clicksignDocumentKey",
          cliente_nome as "clienteNome"
        FROM propostas 
        WHERE 
          assinatura_eletronica_concluida = true 
          AND clicksign_document_key IS NOT NULL
          AND (caminho_ccb_assinado IS NULL OR caminho_ccb_assinado = '')
        LIMIT 10
      `);

      if (pendingProposals.length === 0) {
        console.log('[CCB SYNC] ✅ No pending CCBs to sync');
        return;
      }

      console.log(`[CCB SYNC] 📋 Found ${pendingProposals.length} CCBs to sync`);

      for (const proposal of pendingProposals) {
        await this.syncSingleCCB(
          proposal.id, 
          proposal.clicksignDocumentKey,
          proposal.clienteNome
        );
      }

      console.log('[CCB SYNC] ✅ Synchronization complete');
    } catch (error) {
      console.error('[CCB SYNC] ❌ Error during synchronization:', error);
    }
  }

  /**
   * Sync a single CCB from ClickSign to Storage
   */
  async syncSingleCCB(
    proposalId: string, 
    clicksignKey: string,
    clientName: string
  ): Promise<boolean> {
    try {
      console.log(`[CCB SYNC] 📥 Syncing CCB for proposal ${proposalId}`);

      // Import ClickSign service
      const { clickSignService } = await import('./clickSignService.js');
      
      // Download the signed document from ClickSign
      const pdfBuffer = await clickSignService.downloadSignedDocument(clicksignKey);
      
      if (!pdfBuffer || pdfBuffer.length === 0) {
        console.log(`[CCB SYNC] ⚠️ Empty PDF received for ${proposalId}`);
        return false;
      }

      // Create a clean filename
      const timestamp = Date.now();
      const cleanName = clientName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
      const filename = `CCB_${cleanName}_${proposalId}_${timestamp}.pdf`;
      
      // Storage path - organized folder structure
      const storagePath = `ccb-assinadas/${proposalId}/${filename}`;
      
      console.log(`[CCB SYNC] 💾 Saving to Storage: ${storagePath}`);
      
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true
        });
      
      if (uploadError) {
        console.error(`[CCB SYNC] ❌ Upload error for ${proposalId}:`, uploadError);
        return false;
      }

      // Update the database with the storage path
      await db.execute(sql`
        UPDATE propostas 
        SET 
          caminho_ccb_assinado = ${storagePath},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${proposalId}
      `);
      
      console.log(`[CCB SYNC] ✅ Successfully synced CCB for ${proposalId}`);
      return true;
      
    } catch (error) {
      console.error(`[CCB SYNC] ❌ Error syncing CCB for ${proposalId}:`, error);
      return false;
    }
  }

  /**
   * Force sync a specific proposal
   */
  async forceSyncProposal(proposalId: string): Promise<boolean> {
    try {
      console.log(`[CCB SYNC] 🔄 Force syncing proposal ${proposalId}`);

      // Get proposal details
      const result = await db.execute(sql`
        SELECT 
          id,
          clicksign_document_key as "clicksignDocumentKey",
          cliente_nome as "clienteNome",
          assinatura_eletronica_concluida as "assinaturaEletronicaConcluida"
        FROM propostas 
        WHERE id = ${proposalId}
        LIMIT 1
      `);

      const proposal = result[0];

      if (!proposal) {
        console.log(`[CCB SYNC] ❌ Proposal ${proposalId} not found`);
        return false;
      }

      if (!proposal.clicksignDocumentKey) {
        console.log(`[CCB SYNC] ❌ Proposal ${proposalId} has no ClickSign key`);
        return false;
      }

      if (!proposal.assinaturaEletronicaConcluida) {
        console.log(`[CCB SYNC] ⚠️ Proposal ${proposalId} not signed yet`);
        return false;
      }

      return await this.syncSingleCCB(
        proposal.id,
        proposal.clicksignDocumentKey,
        proposal.clienteNome
      );
    } catch (error) {
      console.error(`[CCB SYNC] ❌ Error force syncing ${proposalId}:`, error);
      return false;
    }
  }
}

// Create singleton instance
export const ccbSyncService = new CCBSyncService();

// Auto-start sync in production
if (process.env.NODE_ENV === 'production') {
  ccbSyncService.startAutoSync(5); // Every 5 minutes
} else {
  // In development, sync every 2 minutes
  ccbSyncService.startAutoSync(2);
}