import { Router } from 'express';
import { db } from '../lib/supabase.js';
import { propostas } from '@shared/schema.js';
import { jwtAuthMiddleware } from '../lib/jwt-auth-middleware.js';
import { desc, eq } from 'drizzle-orm';

const router = Router();

// GET /api/propostas - Lista propostas com filtro opcional
router.get('/', jwtAuthMiddleware, async (req, res) => {
  try {
    const { queue } = req.query;
    
    console.log('[PROPOSTAS] Parâmetros recebidos:', { queue });
    
    let query = db
      .select({
        id: propostas.id,
        numeroProposta: propostas.numeroProposta,
        clienteNome: propostas.clienteNome,
        status: propostas.status,
        valor: propostas.valor,
        prazo: propostas.prazo,
        createdAt: propostas.createdAt,
        updatedAt: propostas.updatedAt,
      })
      .from(propostas);

    // FILTRO CRÍTICO: Fila de Análise = apenas propostas "em_analise"
    if (queue === 'analysis') {
      console.log('[PROPOSTAS] Filtro FILA DE ANÁLISE ativo - apenas status "em_analise"');
      query = query.where(eq(propostas.status, 'em_analise'));
    } else {
      console.log('[PROPOSTAS] Dashboard - todas as propostas');
    }

    const propostasResult = await query
      .orderBy(desc(propostas.createdAt))
      .limit(50);

    console.log(`[PROPOSTAS] Encontradas ${propostasResult.length} propostas (queue=${queue})`);
    
    res.json({
      success: true,
      data: propostasResult,
      total: propostasResult.length,
      queue: queue || 'all',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[PROPOSTAS] Erro ao buscar propostas:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
