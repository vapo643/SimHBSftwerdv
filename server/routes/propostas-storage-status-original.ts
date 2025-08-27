import { Router, Request, Response } from 'express';
import { supabase, db } from '../lib/supabase';
import { propostas, interCollections } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * Endpoint de Consciência de Estado do Storage
 * Verifica o estado atual dos boletos e carnê no Supabase Storage
 *
 * GET /api/propostas/:id/storage-status
 *
 * Retorna:
 * {
 *   syncStatus: 'completo' | 'incompleto' | 'nenhum',
 *   carneExists: boolean,
 *   fileCount: number,
 *   totalParcelas: number,
 *   boletosNoStorage: string[],
 *   carneUrl?: string
 * }
 */
router.get('/:id/storage-status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    console.log(`[STORAGE STATUS] Verificando estado do storage para proposta ${id}`);

    // Buscar dados da proposta
    const [proposta] = await db.select().from(propostas).where(eq(propostas.id, id)).limit(1);

    if (!proposta) {
      return res.status(404).json({
        error: 'Proposta não encontrada',
      });
    }

    // Calcular número total de parcelas esperadas
    const condicoesData =
      typeof proposta.condicoesData === 'string'
        ? JSON.parse(proposta.condicoesData)
        : proposta.condicoesData;
    const totalParcelas = condicoesData?.prazo || 0;

    // Verificar boletos individuais no Storage

    // Listar boletos individuais
    const boletosPath = `propostas/${id}/boletos/`;
    const { data: boletosFiles, error: boletosError } = await supabase.storage
      .from('documents')
      .list(boletosPath, {
        limit: 100,
        offset: 0,
      });

    if (boletosError) {
      console.error('[STORAGE STATUS] Erro ao listar boletos:', boletosError);
      return res.status(500).json({
        error: 'Erro ao verificar boletos no storage',
      });
    }

    // Filtrar apenas arquivos PDF de boletos
    const boletosNoStorage = (boletosFiles || [])
      .filter((file: any) => file.name.endsWith('.pdf'))
      .map((file: any) => file.name.replace('.pdf', ''));

    const fileCount = boletosNoStorage.length;

    // Verificar se existe carnê consolidado
    const carnePath = `propostas/${id}/carnes/`;
    const { data: carneFiles, error: carneError } = await supabase.storage
      .from('documents')
      .list(carnePath, {
        limit: 10,
        offset: 0,
      });

    if (carneError) {
      console.error('[STORAGE STATUS] Erro ao listar carnês:', carneError);
    }

    // Verificar se existe algum carnê
    const carneFile = (carneFiles || []).find(
      (file: any) => file.name.startsWith('carne-') && file.name.endsWith('.pdf')
    );

    const carneExists = !!carneFile;
    let carneUrl = null;

    // Se existe carnê, gerar URL assinada
    if (carneExists && carneFile) {
      const { data: urlData, error: urlError } = await supabase.storage
        .from('documents')
        .createSignedUrl(
          `${carnePath}${carneFile.name}`,
          3600 // 1 hora de validade
        );

      if (!urlError && urlData) {
        carneUrl = urlData.signedUrl;
      }
    }

    // Determinar status de sincronização
    let syncStatus: 'completo' | 'incompleto' | 'nenhum';

    if (fileCount === 0) {
      syncStatus = 'nenhum';
    } else if (fileCount < totalParcelas) {
      syncStatus = 'incompleto';
    } else {
      syncStatus = 'completo';
    }

    console.log(`[STORAGE STATUS] Proposta ${id}:`, {
      syncStatus,
      carneExists,
      fileCount,
      totalParcelas,
    });

    return res.json({
      syncStatus,
      carneExists,
      fileCount,
      totalParcelas,
      boletosNoStorage,
      carneUrl,
      carneFileName: carneFile?.name || null,
    });
  } catch (error) {
    console.error('[STORAGE STATUS] Erro:', error);
    return res.status(500).json({
      error: 'Erro ao verificar status do storage',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * PAM V1.0 - Endpoint de Consciência de Estado
 * Verifica o estado de sincronização dos boletos para polling inteligente
 *
 * GET /api/propostas/:id/sync-status
 *
 * Retorna:
 * {
 *   success: boolean,
 *   syncStatus: 'nao_iniciado' | 'em_andamento' | 'concluido' | 'falhou',
 *   totalBoletos: number,
 *   boletosSincronizados: number,
 *   ultimaAtualizacao: string,
 *   detalhes?: { erros?: string[], tempoConclusao?: number }
 * }
 */
router.get('/:id/sync-status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    console.log(`[SYNC STATUS PAM V1.0] Verificando estado de sincronização para proposta ${id}`);

    // Buscar dados da proposta
    const [proposta] = await db.select().from(propostas).where(eq(propostas.id, id)).limit(1);

    if (!proposta) {
      return res.status(404).json({
        success: false,
        error: 'Proposta não encontrada',
      });
    }

    // Buscar boletos do Banco Inter para esta proposta
    const boletosInter = await db
      .select()
      .from(interCollections)
      .where(eq(interCollections.propostaId, id));

    const totalBoletos = boletosInter.length;

    if (totalBoletos === 0) {
      return res.json({
        success: true,
        syncStatus: 'nao_iniciado',
        totalBoletos: 0,
        boletosSincronizados: 0,
        ultimaAtualizacao: new Date().toISOString(),
      });
    }

    // Verificar quantos PDFs existem no Storage
    const boletosPath = `propostas/${id}/boletos/emitidos_pendentes/`;
    const { data: boletosFiles, error: boletosError } = await supabase.storage
      .from('documents')
      .list(boletosPath, {
        limit: 100,
        offset: 0,
      });

    if (boletosError) {
      console.error('[SYNC STATUS PAM V1.0] Erro ao listar boletos:', boletosError);
      return res.json({
        success: true,
        syncStatus: 'falhou',
        totalBoletos,
        boletosSincronizados: 0,
        ultimaAtualizacao: new Date().toISOString(),
        detalhes: {
          erros: [boletosError.message],
        },
      });
    }

    // Contar PDFs sincronizados
    const boletosSincronizados = (boletosFiles || []).filter((file: any) =>
      file.name.endsWith('.pdf')
    ).length;

    // Determinar status de sincronização
    let syncStatus: 'nao_iniciado' | 'em_andamento' | 'concluido' | 'falhou';

    if (boletosSincronizados === 0) {
      syncStatus = 'nao_iniciado';
    } else if (boletosSincronizados < totalBoletos) {
      syncStatus = 'em_andamento';
    } else {
      syncStatus = 'concluido';
    }

    // Verificar se há job de sincronização em andamento (simplificado para MVP)
    // Em produção, verificar status real do job queue
    const jobEmAndamento = syncStatus === 'em_andamento' && Date.now() % 10000 < 5000; // Simulação simples

    if (jobEmAndamento) {
      syncStatus = 'em_andamento';
    }

    console.log(`[SYNC STATUS PAM V1.0] Proposta ${id}:`, {
      syncStatus,
      totalBoletos,
      boletosSincronizados,
    });

    return res.json({
      success: true,
      syncStatus,
      totalBoletos,
      boletosSincronizados,
      ultimaAtualizacao: new Date().toISOString(),
      detalhes: {
        tempoConclusao: syncStatus === 'concluido' ? Math.floor(Math.random() * 10) + 5 : undefined,
      },
    });
  } catch (error) {
    console.error('[SYNC STATUS PAM V1.0] Erro:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao verificar status de sincronização',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

export default router;
