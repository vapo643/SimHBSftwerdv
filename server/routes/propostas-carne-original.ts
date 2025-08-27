import { Router } from 'express';
import { jwtAuthMiddleware, type AuthenticatedRequest } from '../lib/jwt-auth-middleware';
import { requireAnyRole } from '../lib/role-guards';
import { pdfMergeService } from '../services/pdfMergeService';
import { db } from '../lib/supabase';
import { propostas } from '@shared/schema';
import { eq } from 'drizzle-orm';
// Import the queue system (using mock in development)
import { queues } from '../lib/mock-queue';

const _router = Router();

/**
 * REFATORADO: Endpoint para SOLICITAR geração de carnê (PRODUTOR)
 * POST /api/propostas/:id/gerar-carne
 * Retorna jobId imediatamente enquanto o worker processa em background
 */
router.post(
  '/:id/gerar-carne',
  _jwtAuthMiddleware,
  _requireAnyRole,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { codigosSolicitacao } = req.body; // Lista opcional de códigos para carnê parcial
      const _userId = req.user?.id;

      console.log(`[CARNE API - PRODUCER] 🎯 Solicitação de carnê para proposta: ${id}`);
      console.log(`[CARNE API - PRODUCER] 👤 Usuário: ${userId}`);

      if (codigosSolicitacao && Array.isArray(codigosSolicitacao)) {
        console.log(
          `[CARNE API - PRODUCER] 📋 Carnê parcial solicitado: ${codigosSolicitacao.length} boletos`
        );
      }

      // Validação básica
      if (!id || typeof id !== 'string') {
        return res.status(400).json({
          error: 'ID da proposta inválido',
        });
      }

      // Validar se a proposta existe
      const { createServerSupabaseAdminClient } = await import('../lib/supabase');
      const _supabase = createServerSupabaseAdminClient();

      const { data: proposta, error } = await supabase
        .from('propostas')
        .select('id, status, cliente_nome')
        .eq('id', String(id))
        .single();

      if (error || !proposta) {
        console.error(`[CARNE API - PRODUCER] ❌ Proposta não encontrada: ${id}`, error);
        return res.status(404).json({
          error: 'Proposta não encontrada',
        });
      }

      console.log(
        `[CARNE API - PRODUCER] ✅ Proposta válida - ID: ${proposta.id}, Nome: ${proposta.cliente_nome}`
      );

      // VERIFICAR SE JÁ EXISTE CARNÊ NO STORAGE
      console.log(`[CARNE API - PRODUCER] 🔍 Verificando se já existe carnê no Storage...`);

      // PAM V1.0 - DIAGNÓSTICO APROFUNDADO: Log do caminho e resultado EXATO
      const _gearCarneStoragePath = `propostas/${id}/carnes`;
      console.log(
        `[PAM V1.0 DIAGNÓSTICO] 🔍 /gerar-carne CAMINHO_EXATO: "${gearCarneStoragePath}"`
      );

      const { data: existingFiles, error: listError } = await _supabase.storage
        .from('documents')
        .list(gearCarneStoragePath, {
          limit: 1,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      // PAM V1.0 - DIAGNÓSTICO APROFUNDADO: Log COMPLETO do resultado
      console.log(`[PAM V1.0 DIAGNÓSTICO] 🔍 /gerar-carne RESULTADO_COMPLETO:`);
      console.log(`[PAM V1.0 DIAGNÓSTICO]   - Bucket: documents`);
      console.log(`[PAM V1.0 DIAGNÓSTICO]   - Path: ${gearCarneStoragePath}`);
      console.log(`[PAM V1.0 DIAGNÓSTICO]   - listError:`, listError);
      console.log(
        `[PAM V1.0 DIAGNÓSTICO]   - existingFiles length:`,
        existingFiles ? existingFiles.length : 'null'
      );
      console.log(
        `[PAM V1.0 DIAGNÓSTICO]   - existingFiles data:`,
        JSON.stringify(existingFiles, null, 2)
      );

      if (!listError && existingFiles && existingFiles.length > 0) {
        // Carnê já existe - retornar URL do arquivo existente
        const _fileName = existingFiles[0].name;
        const _filePath = `propostas/${id}/carnes/${fileName}`;

        console.log(`[CARNE API - PRODUCER] ✅ Carnê já existe: ${fileName}`);

        // PAM V1.0 - DIAGNÓSTICO: Log DETALHES do arquivo encontrado
        console.log(`[PAM V1.0 DIAGNÓSTICO] 🔍 /gerar-carne ARQUIVO_ENCONTRADO:`);
        console.log(`[PAM V1.0 DIAGNÓSTICO]   - fileName: ${fileName}`);
        console.log(`[PAM V1.0 DIAGNÓSTICO]   - filePath: ${filePath}`);
        console.log(
          `[PAM V1.0 DIAGNÓSTICO]   - arquivo completo:`,
          JSON.stringify(existingFiles[0], null, 2)
        );

        // Gerar URL assinada para o carnê existente
        const { data: signedUrlData, error: signedUrlError } = await _supabase.storage
          .from('documents')
          .createSignedUrl(filePath, 3600); // 1 hora

        if (!signedUrlError && signedUrlData?.signedUrl) {
          return res.json({
            success: true,
            message: 'Carnê já foi gerado anteriormente',
            status: 'completed',
            existingFile: true,
            data: {
              propostaId: id,
              url: signedUrlData.signedUrl,
              fileName: fileName,
              hint: 'Use a URL para fazer download do carnê existente',
            },
          });
        }
      }

      // NOVO: Adicionar job à fila em vez de processar sincronamente
      console.log(`[CARNE API - PRODUCER] 📥 Adicionando job à fila pdf-processing...`);

      const _job = await queues.pdfProcessing.add('GENERATE_CARNE', {
        type: 'GENERATE_CARNE',
        propostaId: id,
        userId: userId,
        clienteNome: proposta.cliente_nome,
        codigosSolicitacao: codigosSolicitacao, // Lista opcional para carnê parcial
        timestamp: new Date().toISOString(),
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
          hint: 'Use o jobId para consultar o status em /api/jobs/{jobId}/status',
        },
      });
    } catch (error) {
      console.error(`[CARNE API - PRODUCER] ❌ Erro ao solicitar carnê:`, error);
      return res.status(500).json({
        error: 'Erro ao solicitar geração de carnê',
        message: error.message || 'Erro desconhecido',
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
  _jwtAuthMiddleware,
  _requireAnyRole,
  async (req: AuthenticatedRequest, res) => {
    // Redirecionar para o novo fluxo
    console.log(`[CARNE API] ⚠️ DEPRECATED: Redirecionando para novo endpoint assíncrono`);
    return res.status(410).json({
      error: 'Endpoint descontinuado',
      message:
        'Use POST /api/propostas/:id/gerar-carne para iniciar a geração e GET /api/jobs/:jobId/status para consultar o status',
      deprecated: true,
    });
  }
);

/**
 * Endpoint alternativo para download direto do carnê (sem salvar no Storage)
 * GET /api/propostas/:id/carne-pdf/download
 */
router.get(
  '/:id/carne-pdf/download',
  _jwtAuthMiddleware,
  _requireAnyRole,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;

      console.log(`[CARNE API] 📥 Download direto de carnê para proposta: ${id}`);

      // Validar proposta (ID é UUID string) - usando Supabase diretamente
      if (!id || typeof id !== 'string') {
        return res.status(400).json({
          error: 'ID da proposta inválido',
        });
      }

      const { createServerSupabaseAdminClient } = await import('../lib/supabase');
      const _supabase = createServerSupabaseAdminClient();

      const { data: proposta, error } = await supabase
        .from('propostas')
        .select('id, cliente_nome')
        .eq('id', String(id))
        .single();

      if (error || !proposta) {
        return res.status(404).json({
          error: 'Proposta não encontrada',
        });
      }

      // Gerar o carnê
      const _pdfBuffer = await pdfMergeService.gerarCarneParaProposta(id);

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
    } catch (error) {
      console.error(`[CARNE API] ❌ Erro no download direto:`, error);

      return res.status(500).json({
        error: 'Erro ao baixar carnê',
        message: error.message || 'Erro desconhecido',
      });
    }
  }
);

/**
 * REFATORADO: Endpoint para SOLICITAR sincronização de boletos (PRODUTOR)
 * POST /api/propostas/:id/sincronizar-boletos
 * Retorna jobId imediatamente enquanto o worker processa em background
 */
router.post(
  '/:id/sincronizar-boletos',
  _jwtAuthMiddleware,
  _requireAnyRole,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const _userId = req.user?.id;

      console.log(
        `[BOLETO SYNC API - PRODUCER] 🎯 Solicitação de sincronização para proposta: ${id}`
      );
      console.log(`[BOLETO SYNC API - PRODUCER] 👤 Usuário: ${userId}`);

      // Validação básica
      if (!id || typeof id !== 'string') {
        return res.status(400).json({
          error: 'ID da proposta inválido',
        });
      }

      // Validar se a proposta existe
      const { createServerSupabaseAdminClient } = await import('../lib/supabase');
      const _supabase = createServerSupabaseAdminClient();

      const { data: proposta, error } = await supabase
        .from('propostas')
        .select('id, status, cliente_nome')
        .eq('id', String(id))
        .single();

      if (error || !proposta) {
        console.error(`[BOLETO SYNC API - PRODUCER] ❌ Proposta não encontrada: ${id}`);
        return res.status(404).json({
          error: 'Proposta não encontrada',
        });
      }

      console.log(`[BOLETO SYNC API - PRODUCER] ✅ Proposta válida - ID: ${proposta.id}`);

      // NOVO: Adicionar job à fila boleto-sync em vez de processar sincronamente
      console.log(`[BOLETO SYNC API - PRODUCER] 📥 Adicionando job à fila boleto-sync...`);

      const _job = await queues.boletoSync.add('SYNC_BOLETOS', {
        type: 'SYNC_BOLETOS',
        propostaId: id,
        userId: userId,
        clienteNome: proposta.cliente_nome,
        timestamp: new Date().toISOString(),
      });

      console.log(`[BOLETO SYNC API - PRODUCER] ✅ Job ${job.id} adicionado à fila com sucesso`);

      // Retornar resposta IMEDIATA com o jobId
      return res.json({
        success: true,
        message: 'Sincronização de boletos iniciada',
        jobId: job.id,
        status: 'processing',
        data: {
          propostaId: id,
          propostaNumero: `PROP-${proposta.id}`,
          clienteNome: proposta.cliente_nome,
          hint: 'Use o jobId para consultar o status em /api/jobs/{jobId}/status',
        },
      });
    } catch (error) {
      console.error(`[BOLETO SYNC API - PRODUCER] ❌ Erro ao solicitar sincronização:`, error);
      return res.status(500).json({
        error: 'Erro ao solicitar sincronização',
        message: error.message || 'Erro desconhecido',
      });
    }
  }
);

// Endpoint duplicado removido - Usando o endpoint assíncrono refatorado acima

export default router;
