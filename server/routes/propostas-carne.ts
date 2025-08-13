import { Router } from 'express';
import { jwtAuthMiddleware, type AuthenticatedRequest } from '../lib/jwt-auth-middleware';
import { requireAnyRole } from '../lib/role-guards';
import { pdfMergeService } from '../services/pdfMergeService';
import { db } from '../lib/supabase';
import { propostas } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * Endpoint para gerar e baixar carnê de boletos (PDF consolidado)
 * GET /api/propostas/:id/carne-pdf
 */
router.get(
  '/:id/carne-pdf',
  jwtAuthMiddleware,
  requireAnyRole,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      console.log(`[CARNE API] 📚 Requisição de carnê para proposta: ${id}`);
      console.log(`[CARNE API] 👤 Usuário: ${userId}`);
      
      // Validar se a proposta existe
      // Converter ID para número se necessário
      const numericId = parseInt(id);
      if (isNaN(numericId)) {
        return res.status(400).json({
          error: 'ID da proposta inválido'
        });
      }
      
      const proposta = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, numericId))
        .limit(1);
      
      if (!proposta || proposta.length === 0) {
        console.error(`[CARNE API] ❌ Proposta não encontrada: ${id}`);
        return res.status(404).json({
          error: 'Proposta não encontrada'
        });
      }
      
      console.log(`[CARNE API] ✅ Proposta válida - ID: ${proposta[0].id}`);
      
      // Gerar o carnê (download e fusão dos PDFs)
      console.log(`[CARNE API] 🔄 Iniciando geração do carnê...`);
      
      const pdfBuffer = await pdfMergeService.gerarCarneParaProposta(id);
      
      if (!pdfBuffer || pdfBuffer.length === 0) {
        console.error(`[CARNE API] ❌ Falha ao gerar carnê - buffer vazio`);
        return res.status(500).json({
          error: 'Falha ao gerar carnê',
          message: 'O PDF gerado está vazio'
        });
      }
      
      console.log(`[CARNE API] ✅ Carnê gerado com sucesso (${pdfBuffer.length} bytes)`);
      
      // Salvar no Supabase Storage e obter URL assinada
      console.log(`[CARNE API] 💾 Salvando carnê no storage...`);
      
      const signedUrl = await pdfMergeService.salvarCarneNoStorage(id, pdfBuffer);
      
      if (!signedUrl) {
        console.error(`[CARNE API] ❌ Falha ao gerar URL de download`);
        return res.status(500).json({
          error: 'Falha ao gerar URL de download'
        });
      }
      
      console.log(`[CARNE API] ✅ URL assinada gerada com sucesso`);
      
      // Retornar resposta de sucesso
      return res.json({
        success: true,
        message: 'Carnê gerado com sucesso',
        data: {
          propostaId: id,
          propostaNumero: `PROP-${proposta[0].id}`, // Formato padronizado
          downloadUrl: signedUrl,
          size: pdfBuffer.length,
          expiresIn: '1 hora'
        }
      });
      
    } catch (error: any) {
      console.error(`[CARNE API] ❌ Erro ao gerar carnê:`, error);
      
      // Tratar diferentes tipos de erro
      if (error.message?.includes('Nenhum boleto encontrado')) {
        return res.status(404).json({
          error: 'Nenhum boleto encontrado',
          message: 'Esta proposta não possui boletos gerados'
        });
      }
      
      if (error.message?.includes('não foi possível baixar')) {
        return res.status(502).json({
          error: 'Falha ao baixar boletos',
          message: 'Não foi possível baixar os boletos do banco'
        });
      }
      
      // Erro genérico
      return res.status(500).json({
        error: 'Erro ao gerar carnê',
        message: error.message || 'Erro desconhecido ao processar carnê'
      });
    }
  }
);

/**
 * Endpoint alternativo para download direto do carnê (sem salvar no Storage)
 * GET /api/propostas/:id/carne-pdf/download
 */
router.get(
  '/:id/carne-pdf/download',
  jwtAuthMiddleware,
  requireAnyRole,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      
      console.log(`[CARNE API] 📥 Download direto de carnê para proposta: ${id}`);
      
      // Validar proposta
      // Converter ID para número se necessário
      const numericId = parseInt(id);
      if (isNaN(numericId)) {
        return res.status(400).json({
          error: 'ID da proposta inválido'
        });
      }
      
      const proposta = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, numericId))
        .limit(1);
      
      if (!proposta || proposta.length === 0) {
        return res.status(404).json({
          error: 'Proposta não encontrada'
        });
      }
      
      // Gerar o carnê
      const pdfBuffer = await pdfMergeService.gerarCarneParaProposta(id);
      
      // Configurar headers para download direto
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="carne-proposta-${proposta[0].id}.pdf"`
      );
      res.setHeader('Content-Length', pdfBuffer.length.toString());
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      
      // Enviar PDF diretamente
      res.send(pdfBuffer);
      
    } catch (error: any) {
      console.error(`[CARNE API] ❌ Erro no download direto:`, error);
      
      return res.status(500).json({
        error: 'Erro ao baixar carnê',
        message: error.message || 'Erro desconhecido'
      });
    }
  }
);

export default router;