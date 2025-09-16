import { Router } from 'express';
import { db } from '../lib/supabase.js';
import { propostas } from '@shared/schema.js';
import { jwtAuthMiddleware } from '../lib/jwt-auth-middleware.js';
import { desc } from 'drizzle-orm';

const router = Router();

// GET /api/propostas - Lista todas as propostas
router.get('/', jwtAuthMiddleware, async (req, res) => {
  try {
    console.log('[PROPOSTAS] Buscando propostas no banco de dados...');
    
    const propostasResult = await db
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
      .from(propostas)
      .orderBy(desc(propostas.createdAt))
      .limit(50);

    console.log(`[PROPOSTAS] Encontradas ${propostasResult.length} propostas`);
    
    res.json({
      success: true,
      data: propostasResult,
      total: propostasResult.length,
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
