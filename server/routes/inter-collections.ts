import { Router } from 'express';
import { jwtAuthMiddleware, type AuthenticatedRequest } from '../lib/jwt-auth-middleware';
import { requireAnyRole } from '../lib/role-guards';
import { interBankService } from '../services/interBankService';
import { db } from '../lib/supabase';
import { interCollections, propostas } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getBrasiliaTimestamp } from '../lib/timezone';

const router = Router();

/**
 * Listar boletos gerados para uma proposta
 * GET /api/inter/collections/:propostaId
 */
router.get('/:propostaId', jwtAuthMiddleware, requireAnyRole, async (req: AuthenticatedRequest, res) => {
  try {
    const { propostaId } = req.params;
    
    console.log(`[INTER COLLECTIONS] Fetching collections for proposal: ${propostaId}`);
    
    // Buscar collections da proposta no banco (apenas com número de parcela preenchido)
    const collections = await db.select()
      .from(interCollections)
      .where(eq(interCollections.propostaId, propostaId))
      .orderBy(interCollections.numeroParcela);
    
    // Se tiver collections, buscar detalhes atualizados na API do Inter
    if (collections.length > 0) {
      const interService = interBankService;
      
      const updatedCollections = await Promise.all(
        collections.map(async (collection) => {
          try {
            const details = await interService.recuperarCobranca(collection.codigoSolicitacao);
            
            // Atualizar situacao no banco se mudou
            if (details.situacao !== collection.situacao) {
              await db.update(interCollections)
                .set({ 
                  situacao: details.situacao,
                  updatedAt: new Date()
                })
                .where(eq(interCollections.id, collection.id));
            }
            
            return {
              ...collection,
              ...details,
              qrCode: details.qrCode || collection.qrCode,
              codigoBarras: details.codigoBarras || collection.codigoBarras,
              linkPdf: `/api/inter/collections/${propostaId}/${collection.codigoSolicitacao}/pdf`,
              numeroParcela: collection.numeroParcela,
              totalParcelas: collection.totalParcelas
            };
          } catch (error) {
            console.error(`[INTER COLLECTIONS] Error fetching details for ${collection.codigoSolicitacao}:`, error);
            // Retornar dados do banco local se falhar buscar na API
            return {
              ...collection,
              linkPdf: `/api/inter/collections/${propostaId}/${collection.codigoSolicitacao}/pdf`
            };
          }
        })
      );
      
      res.json(updatedCollections);
    } else {
      res.json([]);
    }
    
  } catch (error) {
    console.error('[INTER COLLECTIONS] Error:', error);
    res.status(500).json({ error: 'Erro ao buscar boletos' });
  }
});

/**
 * Baixar PDF do boleto
 * GET /api/inter/collections/:propostaId/:codigoSolicitacao/pdf
 */
router.get('/:propostaId/:codigoSolicitacao/pdf', jwtAuthMiddleware, requireAnyRole, async (req: AuthenticatedRequest, res) => {
  try {
    const { propostaId, codigoSolicitacao } = req.params;
    
    console.log(`[INTER COLLECTIONS] Downloading PDF for collection: ${codigoSolicitacao}`);
    
    // Verificar se collection pertence à proposta
    const collection = await db.select()
      .from(interCollections)
      .where(
        eq(interCollections.propostaId, propostaId) &&
        eq(interCollections.codigoSolicitacao, codigoSolicitacao)
      )
      .limit(1);
    
    if (collection.length === 0) {
      return res.status(404).json({ error: 'Boleto não encontrado' });
    }
    
    // Buscar PDF na API do Inter
    const interService = interBankService;
    const pdfBuffer = await interService.obterPdfCobranca(codigoSolicitacao);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="boleto-${codigoSolicitacao}.pdf"`);
    res.send(Buffer.from(pdfBuffer));
    
  } catch (error) {
    console.error('[INTER COLLECTIONS] Error downloading PDF:', error);
    res.status(500).json({ error: 'Erro ao baixar PDF do boleto' });
  }
});

/**
 * Listar todos os boletos (para tela de cobranças)
 * GET /api/inter/collections
 */
router.get('/', jwtAuthMiddleware, requireAnyRole, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, dataInicial, dataFinal } = req.query;
    
    console.log('[INTER COLLECTIONS] Listing all collections with filters:', { status, dataInicial, dataFinal });
    
    const interService = interBankService;
    
    // Buscar collections na API do Inter
    const filters: any = {};
    if (status) filters.status = status as string;
    if (dataInicial) filters.dataInicial = dataInicial as string;
    if (dataFinal) filters.dataFinal = dataFinal as string;
    
    const collections = await interService.pesquisarCobrancas({
      dataInicial: filters.dataInicial || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dataFinal: filters.dataFinal || new Date().toISOString().split('T')[0],
      situacao: filters.status as any
    });
    
    // Enriquecer com dados das propostas
    const enrichedCollections = await Promise.all(
      collections.map(async (collection: any) => {
        // Extrair propostaId do codigoSolicitacao (formato: SIMPIX-{propostaId}-{parcela})
        const parts = collection.codigoSolicitacao?.split('-');
        if (parts && parts.length >= 2 && parts[0] === 'SIMPIX') {
          const propostaId = parts[1];
          
          const proposta = await db.select()
            .from(propostas)
            .where(eq(propostas.id, propostaId))
            .limit(1);
          
          if (proposta.length > 0) {
            return {
              ...collection,
              proposta: {
                id: proposta[0].id,
                numeroContrato: proposta[0].numeroContrato || proposta[0].id,
                nomeCliente: proposta[0].clienteNome || '',
                cpfCliente: proposta[0].clienteCpf || '',
                telefoneCliente: proposta[0].clienteTelefone || '',
                emailCliente: proposta[0].clienteEmail || ''
              }
            };
          }
        }
        
        return collection;
      })
    );
    
    res.json(enrichedCollections);
    
  } catch (error) {
    console.error('[INTER COLLECTIONS] Error listing collections:', error);
    res.status(500).json({ error: 'Erro ao listar boletos' });
  }
});

export default router;