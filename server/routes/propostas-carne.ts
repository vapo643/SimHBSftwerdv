import { Router } from 'express';
import { jwtAuthMiddleware, type AuthenticatedRequest } from '../lib/jwt-auth-middleware';
import { requireAnyRole } from '../lib/role-guards';
import { pdfMergeService } from '../services/pdfMergeService';
import { db } from '../lib/supabase';
import { propostas } from '@shared/schema';
import { eq } from 'drizzle-orm';
// Import the queue system (using mock in development)
import { queues } from '../lib/mock-queue';

const router = Router();

/**
 * REFATORADO: Endpoint para SOLICITAR geração de carnê (PRODUTOR)
 * POST /api/propostas/:id/gerar-carne
 * Retorna jobId imediatamente enquanto o worker processa em background
 */
router.post(
  '/:id/gerar-carne',
  jwtAuthMiddleware,
  requireAnyRole,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      console.log(`[CARNE API - PRODUCER] 🎯 Solicitação de carnê para proposta: ${id}`);
      console.log(`[CARNE API - PRODUCER] 👤 Usuário: ${userId}`);
      
      // Validação básica
      if (!id || typeof id !== 'string') {
        return res.status(400).json({
          error: 'ID da proposta inválido'
        });
      }
      
      // Validar se a proposta existe
      const { createServerSupabaseAdminClient } = await import('../lib/supabase');
      const supabase = createServerSupabaseAdminClient();
      
      const { data: proposta, error } = await supabase
        .from('propostas')
        .select('id, status, cliente_nome')
        .eq('id', String(id))
        .single();
      
      if (error || !proposta) {
        console.error(`[CARNE API - PRODUCER] ❌ Proposta não encontrada: ${id}`, error);
        return res.status(404).json({
          error: 'Proposta não encontrada'
        });
      }
      
      console.log(`[CARNE API - PRODUCER] ✅ Proposta válida - ID: ${proposta.id}, Nome: ${proposta.cliente_nome}`);
      
      // NOVO: Adicionar job à fila em vez de processar sincronamente
      console.log(`[CARNE API - PRODUCER] 📥 Adicionando job à fila pdf-processing...`);
      
      const job = await queues.pdfProcessing.add('GENERATE_CARNE', {
        type: 'GENERATE_CARNE',
        propostaId: id,
        userId: userId,
        clienteNome: proposta.cliente_nome,
        timestamp: new Date().toISOString()
      });
      
      console.log(`[CARNE API - PRODUCER] ✅ Job ${job.id} adicionado à fila com sucesso`);
      
      // Retornar resposta IMEDIATA com o jobId
      return res.json({
        success: true,
        message: 'Geração de carnê iniciada',
        jobId: job.id,
        status: 'processing',
        data: {
          propostaId: id,
          propostaNumero: `PROP-${proposta.id}`,
          clienteNome: proposta.cliente_nome,
          hint: 'Use o jobId para consultar o status em /api/jobs/{jobId}/status'
        }
      });
      
    } catch (error: any) {
      console.error(`[CARNE API - PRODUCER] ❌ Erro ao solicitar carnê:`, error);
      return res.status(500).json({
        error: 'Erro ao solicitar geração de carnê',
        message: error.message || 'Erro desconhecido'
      });
    }
  }
);

/**
 * Endpoint LEGACY mantido temporariamente para compatibilidade
 * GET /api/propostas/:id/carne-pdf
 */
router.get(
  '/:id/carne-pdf',
  jwtAuthMiddleware,
  requireAnyRole,
  async (req: AuthenticatedRequest, res) => {
    // Redirecionar para o novo fluxo
    console.log(`[CARNE API] ⚠️ DEPRECATED: Redirecionando para novo endpoint assíncrono`);
    return res.status(410).json({
      error: 'Endpoint descontinuado',
      message: 'Use POST /api/propostas/:id/gerar-carne para iniciar a geração e GET /api/jobs/:jobId/status para consultar o status',
      deprecated: true
    });
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