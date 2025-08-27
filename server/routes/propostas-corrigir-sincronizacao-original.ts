import { Router, Request, Response } from 'express';
import { supabase, db } from '../lib/supabase';
import { propostas } from '@shared/schema';
import { eq } from 'drizzle-orm';

const _router = Router();

/**
 * Endpoint para Correção de Sincronização
 * Deleta boletos existentes no Storage e reinicia o processo de sincronização
 *
 * POST /api/propostas/:id/corrigir-sincronizacao
 */
router.post('/:id/corrigir-sincronizacao', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    console.log(`[CORRIGIR SYNC] Iniciando correção de sincronização para proposta ${id}`);

    // Verificar se a proposta existe
    const [proposta] = await db.select().from(propostas).where(eq(propostas.id, id)).limit(1);

    if (!proposta) {
      return res.status(404).json({
        error: 'Proposta não encontrada',
      });
    }

    // Passo 1: Deletar boletos existentes no Storage
    const _boletosPath = `propostas/${id}/boletos/`;

    // Listar todos os boletos existentes
    const { data: boletosFiles, error: listError } = await _supabase.storage
      .from('documents')
      .list(boletosPath, {
        limit: 100,
        offset: 0,
      });

    if (listError) {
      console.error('[CORRIGIR SYNC] Erro ao listar boletos:', listError);
      return res.status(500).json({
        error: 'Erro ao listar boletos existentes',
      });
    }

    // Deletar cada boleto existente
    if (boletosFiles && boletosFiles.length > 0) {
      const _filesToDelete = boletosFiles
        .filter((file) => file.name.endsWith('.pdf'))
        .map((file) => `${boletosPath}${file.name}`);

      if (filesToDelete.length > 0) {
        console.log(`[CORRIGIR SYNC] Deletando ${filesToDelete.length} boletos existentes`);

        const { error: deleteError } = await _supabase.storage
          .from('documents')
          .remove(filesToDelete);

        if (deleteError) {
          console.error('[CORRIGIR SYNC] Erro ao deletar boletos:', deleteError);
          return res.status(500).json({
            error: 'Erro ao deletar boletos existentes',
          });
        }
      }
    }

    // Passo 2: Deletar carnês existentes
    const _carnePath = `propostas/${id}/carnes/`;

    const { data: carneFiles, error: carneListError } = await _supabase.storage
      .from('documents')
      .list(carnePath, {
        limit: 10,
        offset: 0,
      });

    if (!carneListError && carneFiles && carneFiles.length > 0) {
      const _carnesToDelete = carneFiles
        .filter((file) => file.name.endsWith('.pdf'))
        .map((file) => `${carnePath}${file.name}`);

      if (carnesToDelete.length > 0) {
        console.log(`[CORRIGIR SYNC] Deletando ${carnesToDelete.length} carnês existentes`);

        const { error: deleteCarneError } = await _supabase.storage
          .from('documents')
          .remove(carnesToDelete);

        if (deleteCarneError) {
          console.error('[CORRIGIR SYNC] Erro ao deletar carnês:', deleteCarneError);
        }
      }
    }

    // Passo 3: Adicionar job à fila de sincronização
    const { boletoSyncQueue } = await import('../lib/mock-queue');

    const _jobData = {
      propostaId: id,
      forceSync: true, // Forçar re-sincronização
      timestamp: new Date().toISOString(),
    };

    const _job = await boletoSyncQueue.add('sync-boletos', jobData);

    console.log(`[CORRIGIR SYNC] Job de re-sincronização adicionado: ${job.id}`);

    return res.json({
      success: true,
      message: 'Correção de sincronização iniciada',
      jobId: job.id,
      filesDeleted: (boletosFiles?.length || 0) + (carneFiles?.length || 0),
    });
  } catch (error) {
    console.error('[CORRIGIR SYNC] Erro:', error);
    return res.status(500).json({
      error: 'Erro ao corrigir sincronização',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

export default router;
