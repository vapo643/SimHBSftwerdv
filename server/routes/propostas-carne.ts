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
      
      // Validar se a proposta existe - usando Supabase diretamente como no storage.ts
      if (!id || typeof id !== 'string') {
        return res.status(400).json({
          error: 'ID da proposta inválido'
        });
      }
      
      const { createServerSupabaseAdminClient } = await import('../lib/supabase');
      const supabase = createServerSupabaseAdminClient();
      
      const { data: proposta, error } = await supabase
        .from('propostas')
        .select('id, status, cliente_nome')
        .eq('id', String(id))
        .single();
      
      if (error || !proposta) {
        console.error(`[CARNE API] ❌ Proposta não encontrada: ${id}`, error);
        return res.status(404).json({
          error: 'Proposta não encontrada'
        });
      }
      
      console.log(`[CARNE API] ✅ Proposta válida - ID: ${proposta.id}, Nome: ${proposta.cliente_nome}`);
      
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
          propostaNumero: `PROP-${proposta.id}`, // Formato padronizado
          clienteNome: proposta.cliente_nome,
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
      
      // Validar proposta (ID é UUID string) - usando Supabase diretamente
      if (!id || typeof id !== 'string') {
        return res.status(400).json({
          error: 'ID da proposta inválido'
        });
      }
      
      const { createServerSupabaseAdminClient } = await import('../lib/supabase');
      const supabase = createServerSupabaseAdminClient();
      
      const { data: proposta, error } = await supabase
        .from('propostas')
        .select('id, cliente_nome')
        .eq('id', String(id))
        .single();
      
      if (error || !proposta) {
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
        `attachment; filename="carne-proposta-${proposta.id}.pdf"`
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

/**
 * Endpoint para sincronizar boletos do Banco Inter para o Storage
 * POST /api/propostas/:id/sincronizar-boletos
 */
router.post(
  '/:id/sincronizar-boletos',
  jwtAuthMiddleware,
  requireAnyRole,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      console.log(`[BOLETO SYNC API] 🚀 Sincronização solicitada para proposta: ${id}`);
      console.log(`[BOLETO SYNC API] 👤 Usuário: ${userId}`);
      
      // Validar se a proposta existe
      const { createServerSupabaseAdminClient } = await import('../lib/supabase');
      const supabase = createServerSupabaseAdminClient();
      
      const { data: proposta, error } = await supabase
        .from('propostas')
        .select('id, status')
        .eq('id', String(id))
        .single();
      
      if (error || !proposta) {
        console.error(`[BOLETO SYNC API] ❌ Proposta não encontrada: ${id}`);
        return res.status(404).json({
          error: 'Proposta não encontrada'
        });
      }
      
      // Importar e executar o serviço de sincronização
      const { boletoStorageService } = await import('../services/boletoStorageService');
      
      // Executar sincronização em background (não bloquear a resposta)
      setImmediate(async () => {
        try {
          const resultado = await boletoStorageService.sincronizarBoletosDaProposta(id);
          console.log(`[BOLETO SYNC API] ✅ Sincronização concluída:`, resultado);
        } catch (error) {
          console.error(`[BOLETO SYNC API] ❌ Erro na sincronização:`, error);
        }
      });
      
      // Retornar resposta imediata no formato esperado pelo frontend
      return res.json({
        success: true,
        status: 'sincronização iniciada',
        propostaId: id,
        message: 'Os boletos estão sendo sincronizados em background'
      });
      
    } catch (error: any) {
      console.error(`[BOLETO SYNC API] ❌ Erro ao iniciar sincronização:`, error);
      return res.status(500).json({
        error: 'Erro ao iniciar sincronização',
        message: error.message || 'Erro desconhecido'
      });
    }
  }
);

/**
 * Endpoint para gerar carnê a partir dos boletos salvos no Storage
 * POST /api/propostas/:id/gerar-carne
 */
router.post(
  '/:id/gerar-carne',
  jwtAuthMiddleware,
  requireAnyRole,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      console.log(`[CARNE STORAGE API] 📚 Geração de carnê do Storage solicitada para proposta: ${id}`);
      console.log(`[CARNE STORAGE API] 👤 Usuário: ${userId}`);
      
      // Validar se a proposta existe
      const { createServerSupabaseAdminClient } = await import('../lib/supabase');
      const supabase = createServerSupabaseAdminClient();
      
      const { data: proposta, error } = await supabase
        .from('propostas')
        .select('id, status')
        .eq('id', String(id))
        .single();
      
      if (error || !proposta) {
        console.error(`[CARNE STORAGE API] ❌ Proposta não encontrada: ${id}`);
        return res.status(404).json({
          error: 'Proposta não encontrada'
        });
      }
      
      // Importar e executar o serviço de geração de carnê
      const { boletoStorageService } = await import('../services/boletoStorageService');
      
      console.log(`[CARNE STORAGE API] 🔄 Gerando carnê do Storage...`);
      const resultado = await boletoStorageService.gerarCarneDoStorage(id);
      
      if (resultado.success && resultado.url) {
        console.log(`[CARNE STORAGE API] ✅ Carnê gerado com sucesso`);
        
        return res.json({
          success: true,
          propostaId: id,
          url: resultado.url,
          message: 'Carnê gerado com sucesso a partir dos boletos armazenados'
        });
      } else {
        console.error(`[CARNE STORAGE API] ❌ Erro na geração do carnê:`, resultado.error);
        
        return res.status(500).json({
          success: false,
          error: 'Erro ao gerar carnê',
          message: resultado.error || 'Erro desconhecido'
        });
      }
      
    } catch (error: any) {
      console.error(`[CARNE STORAGE API] ❌ Erro ao gerar carnê:`, error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao processar requisição',
        message: error.message || 'Erro desconhecido'
      });
    }
  }
);

export default router;