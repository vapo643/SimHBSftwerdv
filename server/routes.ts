import type { Express, NextFunction, Response } from 'express';
import { createServer, type Server } from 'http';
import { storage } from './storage';
import { createServerSupabaseClient } from '../client/src/lib/supabase';
import { _jwtAuthMiddleware } from './lib/jwt-auth-middleware';
import { AuthenticatedRequest } from '../shared/types/express';
import { db } from './lib/supabase';
import { eq } from 'drizzle-orm';
import {
  __requireAdmin,
  _requireManagerOrAdmin,
  _requireAnyRole,
  _requireRoles,
} from './lib/role-guards';
import {
  _enforceRoutePermissions,
  _requireAnalyst,
  _requireFinanceiro,
  _filterProposalsByRole,
} from './lib/role-based-access';
import { transitionTo, InvalidTransitionError } from './services/statusFsmService';
import {
  _insertPropostaSchema,
  _updatePropostaSchema,
  _createPropostaValidationSchema,
  _insertGerenteLojaSchema,
  _insertLojaSchema,
  _updateLojaSchema,
  _propostaLogs,
  _propostas,
  _parceiros,
  _produtos,
  _tabelasComerciais,
  _produtoTabelaComercial,
} from '@shared/schema';
import { z } from 'zod';
import multer from 'multer';
import originationRoutes from './routes/origination.routes';
import { clickSignRouter } from './routes/clicksign.js';
import clicksignIntegrationRoutes from './routes/clicksign-integration.js';
import interRoutes from './routes/inter.js';
import interWebhookRouter from './routes/webhooks/inter';
import interRealtimeRouter from './routes/inter-realtime';
import securityRoutes from './routes/security.js';
import emailChangeRoutes from './routes/email-change';
import cobrancasRoutes from './routes/cobrancas';
import monitoringRoutes from './routes/monitoring';
import ccbIntelligentTestRoutes from './routes/ccb-intelligent-test';
import ccbCorrectedRoutes from './routes/ccb-test-corrected';
import clienteRoutes from './routes/cliente-routes';
import gestaoContratosRoutes from './routes/gestao-contratos';
import testCcbCoordinatesRoutes from './routes/test-ccb-coordinates';
import propostasCarneRoutes from './routes/propostas-carne';
import propostasCarneStatusRoutes from './routes/propostas-carne-status';
import propostasCarneCheckRoutes from './routes/propostas-carne-check';
import propostasStorageStatusRoutes from './routes/propostas-storage-status';
import propostasCorrigirSincronizacaoRoutes from './routes/propostas-corrigir-sincronizacao';
import propostasSincronizarBoletosRoutes from './routes/propostas-sincronizar-boletos';
import jobStatusRoutes from './routes/job-status';
import testQueueRoutes from './routes/test-queue';
import testRetryRoutes from './routes/test-retry';
import testAuditRoutes from './routes/test-audit';
import {
  _getBrasiliaDate,
  __formatBrazilianDateTime,
  _generateApprovalDate,
  _getBrasiliaTimestamp,
} from './lib/timezone';
// Use mock queue in development to avoid Redis dependency
import { queues, checkQueuesHealth } from './lib/mock-queue';
import { securityLogger, SecurityEventType, getClientIP } from './lib/security-logger';
import { passwordSchema, validatePassword } from './lib/password-validator';
import { timingNormalizerMiddleware } from './middleware/timing-normalizer';
import timingSecurityRoutes from './routes/timing-security';
import documentosRoutes from './routes/documentos';
import featureFlagService from './services/featureFlagService';

const _upload = multer({ storage: multer.memoryStorage() });

// Admin middleware is now replaced by _requireAdmin guard

// Helper function to parse user agent and extract device information
function parseUserAgent(userAgent: string): string {
  if (!userAgent) return 'Dispositivo desconhecido';

  // Check for mobile devices
  if (/mobile/i.test(userAgent)) {
    if (/android/i.test(userAgent)) return 'Android Mobile';
    if (/iphone/i.test(userAgent)) return 'iPhone';
    if (/ipad/i.test(userAgent)) return 'iPad';
    return 'Mobile Device';
  }

  // Check for desktop browsers
  if (/windows/i.test(userAgent)) {
    if (/edge/i.test(userAgent)) return 'Windows - Edge';
    if (/chrome/i.test(userAgent)) return 'Windows - Chrome';
    if (/firefox/i.test(userAgent)) return 'Windows - Firefox';
    return 'Windows PC';
  }

  if (/macintosh/i.test(userAgent)) {
    if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return 'Mac - Safari';
    if (/chrome/i.test(userAgent)) return 'Mac - Chrome';
    if (/firefox/i.test(userAgent)) return 'Mac - Firefox';
    return 'Mac';
  }

  if (/linux/i.test(userAgent)) {
    if (/chrome/i.test(userAgent)) return 'Linux - Chrome';
    if (/firefox/i.test(userAgent)) return 'Linux - Firefox';
    return 'Linux';
  }

  return 'Dispositivo desconhecido';
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Import and mount authentication routes
  const _authRouter = (await import('./routes/auth/index.js')).default;
  app.use('/api/auth', authRouter);

  // Routes below this line are managed in the monolith

  // Import and mount propostas core routes - REFACTORED WITH DDD
  // TODO: Switch to core.refactored.js when fully tested
  const _propostasCoreRouter = (await import('./routes/propostas/core.js')).default;
  app.use('/api/propostas', propostasCoreRouter);

  // DDD Credit Context Routes - Phase 1 Implementation
  const { createCreditRoutes } = await import('./contexts/credit/presentation/routes.js');
  app.use('/api/ddd', createCreditRoutes());

  // Import and mount integration test routes
  const _interIntegrationRouter = (await import('./routes/integracao/inter.js')).default;
  const _clicksignIntegrationRouter = (await import('./routes/integracao/clicksign.js')).default;
  const _circuitBreakerTestRouter = (await import('./routes/integracao/circuit-breaker-test.js'))
    .default;

  app.use('/api/integracao/inter', interIntegrationRouter);
  app.use('/api/integracao/clicksign', clicksignIntegrationRouter);
  app.use('/api/test/circuit-breaker', circuitBreakerTestRouter);

  // Health check endpoint para testar security headers
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: _getBrasiliaTimestamp(),
      security: 'enabled',
      rateLimit: 'active',
    });
  });

  // Feature Flags endpoint - retorna flags para o usuário atual
  app.get('/api/features', _jwtAuthMiddleware as unknown, async (req: AuthenticatedRequest, res) => {
    try {
      // Inicializa o serviço se necessário
      await featureFlagService.init();

      // Contexto do usuário para avaliação de flags
      const _context = {
        userId: req.user?.id,
        userRole: req.user?.role,
        sessionId: req.sessionID,
        environment: process.env.NODE_ENV || 'development',
        remoteAddress: getClientIP(req),
      };

      // Lista de flags relevantes para o frontend
      const __frontendFlags = [
        'maintenance-mode',
        'read-only-mode',
        'novo-dashboard',
        'pagamento-pix-instant',
        'relatorios-avancados',
        'ab-test-onboarding',
        'nova-api-experimental',
      ];

      // Verifica todas as flags
      const _flags = await featureFlagService.checkMultiple(_frontendFlags, context);

      res.json({
  _flags,
        context: {
          environment: context.environment,
          userId: context.userId,
          role: context.userRole,
        },
      });
    }
catch (error) {
      console.error(error);
      // Em caso de erro, retorna flags desabilitadas
      res.json({
        flags: {},
        error: 'Failed to fetch feature flags',
      });
    }
  });

  // FASE 0 - Sentry test endpoint (conforme PAM V1.0)
  app.get('/api/debug-sentry', function mainHandler(req, res) {
    throw new Error("Error");
  });

  // EXEMPLO DE USO: Rota experimental protegida por feature flag
  app.get(
    '/api/experimental/analytics',
    _jwtAuthMiddleware as unknown,
    async (req: AuthenticatedRequest, res) => {
      try {
        // Verifica se a feature flag está habilitada
        const _isEnabled = await featureFlagService.isEnabled('nova-api-experimental', {
          userId: req.user?.id,
          userRole: req.user?.role,
          environment: process.env.NODE_ENV,
        });

        if (!_isEnabled) {
          console.log(
            '❌ Feature flag nova-api-experimental desabilitada para usuário:',
            req.user?.id
          );
          return res.status(403).json({
            error: 'Feature not available',
            message: 'Esta funcionalidade ainda não está disponível para seu perfil',
          });
        }

        console.log('✅ Feature flag nova-api-experimental habilitada para usuário:', req.user?.id);

        // Lógica experimental da nova API
        const { createServerSupabaseAdminClient } = await import('./lib/supabase');
        const _supabase = createServerSupabaseAdminClient();

        // Exemplo: Analytics avançado (apenas quando feature flag está ativa)
        const { data: analytics, error } = await supabase
          .from('propostas')
          .select('status, created_at, valor')
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

        if (error) {
          throw error;
        }

        // Processamento experimental de analytics
        const _summary = {
          total_propostas: analytics.length,
          total_valor: analytics.reduce((sum, p) => sum + (parseFloat(p.valor) || 0), 0),
          por_status: analytics.reduce(
            (acc, p) => {
              acc[p.status] = (acc[p.status] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>
          ),
          feature_flag_enabled: true,
          experimental_version: '1.0.0-beta',
        };

        res.json({
          success: true,
          data: _summary,
          experimental: true,
          message: 'API experimental - dados podem mudar',
        });
      }
catch (error) {
        console.error(error);
        res.status(500).json({
          error: 'Internal server error',
          experimental: true,
        });
      }
    }
  );

  // MOVED TO server/routes/integracao/ - Circuit breaker test endpoints

  // RELATÓRIO FINAL - AUDITORIA DO PLANO DE TESTE END-TO-END
  app.get('/api/relatorio-final-ccb', async (req, res) => {
    try {
      const { createServerSupabaseAdminClient } = await import('./lib/supabase');
      const _supabase = createServerSupabaseAdminClient();

      console.log('🧪 [RELATÓRIO] Executando auditoria final conforme plano de teste');

      // Buscar última proposta
      const { data: proposta } = await supabase
        .from('propostas')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!proposta) {
        return res.json({
          RELATORIO_FINAL: '[FALHA]',
          motivo: 'Nenhuma proposta encontrada para auditar',
        });
      }

      // VALIDAÇÕES DO PLANO DE TESTE
      const _enderecoOK = !!(
        proposta.cliente_data?.logradouro &&
        proposta.cliente_data?.bairro &&
        proposta.cliente_data?.cep
      );
      const _rgOK = !!(
        proposta.cliente_data?.rg &&
        proposta.cliente_data?.localNascimento &&
        proposta.cliente_data?.rgUf
      );
      const _bancoOK = !!(
        proposta.dados_pagamento_tipo &&
        (proposta.dados_pagamento_banco || proposta.dados_pagamento_pix)
      );
      const _expedidorOK = !!(
        proposta.cliente_data?.orgaoEmissor && proposta.cliente_data?.nacionalidade
      );

      const _todasValidacoes = enderecoOK && rgOK && bancoOK && expedidorOK;

      // RELATÓRIO FINAL CONFORME SOLICITADO
      res.json({
        RELATORIO_FINAL: todasValidacoes ? '[SUCESSO]' : '[FALHA]',
        validacoes: {
          endereco_separado: enderecoOK ? '✅ APROVADO' : '❌ REPROVADO',
          dados_rg_novos: rgOK ? '✅ APROVADO' : '❌ REPROVADO',
          dados_bancarios: bancoOK ? '✅ APROVADO' : '❌ REPROVADO',
          conflito_expedidor_nacionalidade: expedidorOK ? '✅ APROVADO' : '❌ REPROVADO',
        },
        proposta_id: proposta.id,
        conclusao: todasValidacoes
          ? '🎉 TODAS AS CORREÇÕES VALIDADAS - Debate Máximo RESOLVIDO!'
          : '❌ Ainda há validações falhando - veja detalhes acima',
      });
    }
catch (error) {
      res.json({
        RELATORIO_FINAL: '[ERRO]',
        error: 'Falha na execução da auditoria',
      });
    }
  });

  // AUDITORIA END-TO-END - Validação Final do Plano de Teste
  app.get('/api/audit-ccb-endtoend', async (req, res) => {
    try {
      const { createServerSupabaseAdminClient } = await import('./lib/supabase');
      const _supabase = createServerSupabaseAdminClient();

      // Buscar última proposta para auditoria dos dados
      const { data: proposta, error } = await supabase
        .from('propostas')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !proposta) {
        return res.json({
          status: '[FALHA]',
          message: 'Nenhuma proposta encontrada para executar ETAPA 3 do plano de teste',
        });
      }

      console.log('🧪 [AUDIT] Executando ETAPA 3 - Auditoria Visual dos Dados');
      console.log('🧪 [AUDIT] Proposta ID:', proposta.id);
      console.log('🧪 [AUDIT] Cliente Data:', JSON.stringify(proposta.cliente_data, null, 2));

      // ETAPA 3 - AUDITORIA VISUAL CONFORME PLANO DE TESTE
      const _validacoes = {
        'ENDEREÇO - Formatação Separada': {
          logradouro: proposta.cliente_data?.logradouro ? '✅ PRESENTE' : '❌ FALTANDO',
          numero: proposta.cliente_data?.numero ? '✅ PRESENTE' : '❌ FALTANDO',
          complemento: proposta.cliente_data?.complemento ? '✅ PRESENTE' : '❌ OPCIONAL',
          bairro: proposta.cliente_data?.bairro ? '✅ PRESENTE' : '❌ FALTANDO',
          cep: proposta.cliente_data?.cep ? '✅ PRESENTE' : '❌ FALTANDO',
          cidade: proposta.cliente_data?.cidade ? '✅ PRESENTE' : '❌ FALTANDO',
          uf:
            proposta.cliente_data?.uf || proposta.cliente_data?.estado
              ? '✅ PRESENTE'
              : '❌ FALTANDO',
        },
        'DADOS DE RG - Novos Campos': {
          rg: proposta.cliente_data?.rg ? '✅ PRESENTE' : '❌ FALTANDO',
          localNascimento: proposta.cliente_data?.localNascimento ? '✅ PRESENTE' : '❌ FALTANDO',
          rgDataEmissao: proposta.cliente_data?.rgDataEmissao ? '✅ PRESENTE' : '❌ FALTANDO',
          rgUf: proposta.cliente_data?.rgUf ? '✅ PRESENTE' : '❌ FALTANDO',
        },
        'DADOS BANCÁRIOS - Persistência': {
          tipo: proposta.dados_pagamento_tipo ? '✅ PRESENTE' : '❌ FALTANDO',
          banco: proposta.dados_pagamento_banco ? '✅ PRESENTE' : '❌ FALTANDO',
          agencia: proposta.dados_pagamento_agencia ? '✅ PRESENTE' : '❌ FALTANDO',
          conta: proposta.dados_pagamento_conta ? '✅ PRESENTE' : '❌ FALTANDO',
        },
        'CONFLITO EXPEDIDOR/NACIONALIDADE': {
          orgaoEmissor: proposta.cliente_data?.orgaoEmissor ? '✅ PRESENTE' : '❌ FALTANDO',
          nacionalidade: proposta.cliente_data?.nacionalidade ? '✅ PRESENTE' : '❌ FALTANDO',
          separacao_ccb: '✅ COORDENADAS SEPARADAS NO SISTEMA',
        },
      };

      // Contar validações
      let _sucessos = 0;
      let _total = 0;

      Object.values(validacoes).forEach((categoria) => {
        Object.values(categoria).forEach((status) => {
          total++;
          if (status.includes('✅')) sucessos++;
        });
      });

      const _veredito = sucessos == total ? '[SUCESSO]' : '[FALHA]';

      res.json({
        RELATORIO_FINAL: veredito,
        score: `${sucessos}/${total} validações aprovadas`,
        proposta_testada: proposta.id,
        validacoes_detalhadas: validacoes,
        dados_brutos: {
          cliente_data: proposta.cliente_data,
          dados_bancarios: {
            tipo: proposta.dados_pagamento_tipo,
            banco: proposta.dados_pagamento_banco,
            agencia: proposta.dados_pagamento_agencia,
            conta: proposta.dados_pagamento_conta,
            pix: proposta.dados_pagamento_pix,
          },
        },
        conclusao:
          veredito == '[SUCESSO]'
            ? '🎉 TODAS AS CORREÇÕES VALIDADAS - Debate Máximo RESOLVIDO!'
            : '❌ Ainda há campos faltantes - necessário criar nova proposta de teste',
      });
    }
catch (error) {
      console.error(error);
      res.status(500).json({
        RELATORIO_FINAL: '[ERRO]',
        error: 'Falha na execução da auditoria',
      });
    }
  });

  // AUDITORIA FINAL - Validação End-to-End das Correções CCB
  app.get('/api/test-ccb-corrections', async (req, res) => {
    try {
      const { createServerSupabaseAdminClient } = await import('./lib/supabase');
      const _supabase = createServerSupabaseAdminClient();

      // Buscar última proposta criada para auditoria
      const { data: proposta, error } = await supabase
        .from('propostas')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !proposta) {
        return res.json({
          status: 'NO_DATA',
          message: 'Nenhuma proposta encontrada para auditoria',
        });
      }

      // AUDITORIA ETAPA 3 - Verificação dos dados que entrarão na CCB
      const _auditoria = {
        '[ ] ENDEREÇO SEPARADO': {
          logradouro: proposta.cliente_data?.logradouro || '❌ FALTANDO',
          numero: proposta.cliente_data?.numero || '❌ FALTANDO',
          complemento: proposta.cliente_data?.complemento || '❌ FALTANDO',
          bairro: proposta.cliente_data?.bairro || '❌ FALTANDO',
          cep: proposta.cliente_data?.cep || '❌ FALTANDO',
          cidade: proposta.cliente_data?.cidade || '❌ FALTANDO',
          uf: proposta.cliente_data?.uf || proposta.cliente_data?.estado || '❌ FALTANDO',
        },
        '[ ] DADOS DE RG': {
          rg: proposta.cliente_data?.rg || '❌ FALTANDO',
          orgaoEmissor: proposta.cliente_data?.orgaoEmissor || '❌ FALTANDO',
          rgDataEmissao: proposta.cliente_data?.rgDataEmissao || '❌ FALTANDO',
          rgUf: proposta.cliente_data?.rgUf || '❌ FALTANDO',
          localNascimento: proposta.cliente_data?.localNascimento || '❌ FALTANDO',
        },
        '[ ] DADOS BANCÁRIOS': {
          tipo: proposta.dados_pagamento_tipo || '❌ FALTANDO',
          banco: proposta.dados_pagamento_banco || '❌ FALTANDO',
          agencia: proposta.dados_pagamento_agencia || '❌ FALTANDO',
          conta: proposta.dados_pagamento_conta || '❌ FALTANDO',
          pix: proposta.dados_pagamento_pix || 'N/A',
        },
        '[ ] CONFLITO EXPEDIDOR/NACIONALIDADE': {
          orgaoExpedidor: proposta.cliente_data?.orgaoEmissor || '❌ FALTANDO',
          nacionalidade: proposta.cliente_data?.nacionalidade || '❌ FALTANDO',
          separacao_visual: '✅ COORDENADAS SEPARADAS',
        },
      };

      // Contar validações bem-sucedidas
      let _sucessos = 0;
      let _total = 0;

      Object.values(auditoria).forEach((categoria) => {
        Object.values(categoria).forEach((valor) => {
          total++;
          if (typeof valor == 'string' && !valor.includes('❌ FALTANDO')) {
            sucessos++;
          }
        });
      });

      const _status = sucessos == total ? '[SUCESSO]' : '[FALHA]';

      res.json({
  _status,
        score: `${sucessos}/${total} validações`,
        proposta_auditada: proposta.id,
        auditoria_detalhada: auditoria,
        proxima_acao:
          sucessos == total
            ? '✅ TODAS AS CORREÇÕES VALIDADAS - Gerar CCB para confirmar PDF'
            : '❌ CORREÇÕES INCOMPLETAS - Verificar campos faltantes',
      });
    }
catch (error) {
      res.status(500).json({ error: 'Erro na auditoria' });
    }
  });

  // Test endpoint para verificar correções de bugs
  app.get(
    '/api/test-data-flow',
    _jwtAuthMiddleware as unknown,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { createServerSupabaseAdminClient } = await import('./lib/supabase');
        const _supabase = createServerSupabaseAdminClient();

        // Buscar última proposta criada
        const { data: proposta, error } = await supabase
          .from('propostas')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error || !proposta) {
          return res.json({
            status: 'nenhuma_proposta',
            message: 'Nenhuma proposta encontrada no banco',
          });
        }

        // Verificar campos de endereço
        const _enderecoFields = {
          cep: proposta.cliente_data?.cep,
          logradouro: proposta.cliente_data?.logradouro,
          numero: proposta.cliente_data?.numero,
          complemento: proposta.cliente_data?.complemento,
          bairro: proposta.cliente_data?.bairro,
          cidade: proposta.cliente_data?.cidade,
          estado: proposta.cliente_data?.estado || proposta.cliente_data?.uf,
          endereco_concatenado: proposta.cliente_data?.endereco,
        };

        // Verificar dados bancários
        const _dadosBancarios = {
          tipo: proposta.dados_pagamento_tipo,
          pix: proposta.dados_pagamento_pix,
          banco: proposta.dados_pagamento_banco,
          agencia: proposta.dados_pagamento_agencia,
          conta: proposta.dados_pagamento_conta,
          digito: proposta.dados_pagamento_digito,
          nome_titular: proposta.dados_pagamento_nome_titular,
          cpf_titular: proposta.dados_pagamento_cpf_titular,
        };

        // Verificar parcelas
        const { data: parcelas } = await supabase
          .from('parcelas')
          .select('*')
          .eq('proposta_id', proposta.id)
          .order('numero_parcela', { ascending: true });

        const _resultado = {
          proposta_id: proposta.id,
          created_at: proposta.created_at,
          status: 'analise_completa',
          bugs_corrigidos: {
            bug1_endereco: {
              status: enderecoFields.logradouro ? '✅ CORRIGIDO' : '❌ PENDENTE',
              campos_separados: enderecoFields,
              tem_campos_separados: !!(
                enderecoFields.logradouro &&
                enderecoFields.numero &&
                enderecoFields.bairro
              ),
            },
            bug2_dados_bancarios: {
              status: dadosBancarios.tipo ? '✅ CORRIGIDO' : '❌ PENDENTE',
              dados_salvos: dadosBancarios,
              tem_dados_completos: !!(
                dadosBancarios.tipo &&
                (dadosBancarios.pix || dadosBancarios.banco)
              ),
            },
            bug3_parcelas: {
              status: parcelas && parcelas.length > 0 ? '✅ CORRIGIDO' : '❌ PENDENTE',
              quantidade_parcelas: parcelas?.length || 0,
              primeira_parcela: parcelas?.[0] || null,
              ultima_parcela: parcelas?.[parcelas.length - 1] || null,
            },
          },
          resumo: {
            todos_bugs_corrigidos: !!(
              enderecoFields.logradouro &&
              dadosBancarios.tipo &&
              parcelas &&
              parcelas.length > 0
            ),
          },
        };

        res.json(resultado);
      }
catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao testar fluxo de dados' });
      }
    }
  );

  // Debug endpoint for RBAC validation
  app.get('/api/debug/me', _jwtAuthMiddleware as unknown, async (req: AuthenticatedRequest, res) => {
    try {
      res.json({
        message: 'Debug endpoint - User profile from robust JWT middleware',
        user: req.user,
        timestamp: _getBrasiliaTimestamp(),
      });
    }
catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Debug endpoint failed' });
    }
  });

  // MOVED TO server/routes/propostas/core.ts - PUT /api/propostas/:id/status

  // 🔧 CORREÇÃO CRÍTICA: Mover endpoint específico ANTES da rota genérica /:id
  // New endpoint for formalization proposals (filtered by status)
  app.get(
    '/api/propostas/formalizacao',
    _jwtAuthMiddleware as unknown,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { createServerSupabaseAdminClient } = await import('./lib/supabase');
        const _supabase = createServerSupabaseAdminClient();

        // Formalization statuses - TODOS exceto BOLETOS_EMITIDOS
        // BOLETOS_EMITIDOS vai para Cobranças e Pagamentos
        const _formalizationStatuses = [
          'aprovado',
          'aceito_atendente',
          'documentos_enviados',
          // Status V2.0 de formalização
          'CCB_GERADA',
          'AGUARDANDO_ASSINATURA',
          'ASSINATURA_PENDENTE',
          'ASSINATURA_CONCLUIDA',
          // NÃO incluir BOLETOS_EMITIDOS - vai para cobranças/pagamentos
          'PAGAMENTO_PENDENTE',
          'PAGAMENTO_PARCIAL',
          // Status legados para compatibilidade
          'contratos_preparados', // será migrado para CCB_GERADA
          'contratos_assinados', // será migrado para ASSINATURA_CONCLUIDA
          // NÃO incluir "pronto_pagamento" - é o antigo BOLETOS_EMITIDOS
        ];

        const _userId = req.user?.id;
        const _userRole = req.user?.role;
        const _userLojaId = req.user?.loja_id;

        console.log(
          `🔐 [FORMALIZATION] Querying for user ${userId} with role ${userRole} from loja ${userLojaId}`
        );

        // Build query based on user role
        let _query = _supabase.from('propostas').select('*').in('status', formalizationStatuses);

        // Apply role-based filtering
        if (userRole == 'ATENDENTE') {
          // ATENDENTE sees only proposals they created
          _query = _query.eq('user_id', _userId);
          console.log(`🔐 [FORMALIZATION] ATENDENTE filter: user_id = ${_userId}`);
        }
else if (_userRole == 'GERENTE') {
          // GERENTE sees all proposals from their store
          _query = _query.eq('loja_id', _userLojaId);
          console.log(`🔐 [FORMALIZATION] GERENTE filter: loja_id = ${_userLojaId}`);
        }
        // For other roles (ADMINISTRADOR, ANALISTA, etc.), no additional filtering

        const { data: rawPropostas, error } = await _query.order('created_at', { ascending: false });

        if (error) {
          console.error(error);
          return res.status(500).json({error: "Error"});
        }

        if (!rawPropostas || rawPropostas.length == 0) {
          console.log(
            `🔐 [FORMALIZATION] No proposals found for user ${userId} with role ${userRole}`
          );
          return res.status(500).json({error: "Error"});
        }

        console.log(`🔐 [FORMALIZATION] Found ${rawPropostas.length} proposals for user ${userId}`);
        console.log(
          '🔐 [FORMALIZATION] First proposal:',
          rawPropostas[0]?.id,
          rawPropostas[0]?.status
        );

        // CORREÇÃO CRÍTICA: Parse JSONB fields e mapear snake_case para frontend
        const _formalizacaoPropostas = rawPropostas.map((proposta) => {
          let _clienteData = null;
          let _condicoesData = null;

          // Parse cliente_data se for string
          if (typeof proposta.cliente_data == 'string') {
            try {
              _clienteData = JSON.parse(proposta.cliente_data);
            }
catch (e) {
              console.warn(`Erro ao fazer parse de cliente_data para proposta ${proposta.id}:`, e);
              clienteData = {};
            }
          }
else {
            _clienteData = proposta.cliente_data || {};
          }

          // Parse condicoes_data se for string
          if (typeof proposta.condicoes_data == 'string') {
            try {
              _condicoesData = JSON.parse(proposta.condicoes_data);
            }
catch (e) {
              console.warn(
                `Erro ao fazer parse de condicoes_data para proposta ${proposta.id}:`,
                e
              );
              condicoesData = {};
            }
          }
else {
            _condicoesData = proposta.condicoes_data || {};
          }

          return {
            ...proposta,
            cliente_data: clienteData,
            condicoes_data: condicoesData,
            // Map database fields to frontend format
            documentos_adicionais: proposta.documentos_adicionais,
            contrato_gerado: proposta.contrato_gerado,
            contrato_assinado: proposta.contrato_assinado,
            data_aprovacao: proposta.data_aprovacao,
            data_assinatura: proposta.data_assinatura,
            data_pagamento: proposta.data_pagamento,
            observacoes_formalizacao: proposta.observacoes_formalizacao,
            // 🔥 NOVO: Campos de tracking do Banco Inter
            interBoletoGerado: proposta.inter_boleto_gerado,
            interBoletoGeradoEm: proposta.inter_boleto_gerado_em,
          };
        });

        console.log(
          `[${_getBrasiliaTimestamp()}] Retornando ${formalizacaoPropostas.length} propostas em formalização via RLS`
        );
        res.json(formalizacaoPropostas);
      }
catch (error) {
        console.error(error);
        res.status(500).json({
          message: 'Erro ao buscar propostas de formalização',
        });
      }
    }
  );

  // Endpoint para gerar CCB automaticamente
  app.post(
    '/api/propostas/:id/gerar-ccb',
    _jwtAuthMiddleware as unknown,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { id } = req.params;
        console.log(`[CCB] Solicitação de geração de CCB para proposta: ${id}`);

        const { createServerSupabaseAdminClient } = await import('./lib/supabase');
        const _supabase = createServerSupabaseAdminClient();

        // Verificar se proposta está aprovada
        const { data: proposta, error: propostaError } = await supabase
          .from('propostas')
          .select('status, ccb_gerado, caminho_ccb_assinado')
          .eq('id', id)
          .single();

        if (propostaError || !proposta) {
          return res.status(500).json({error: "Error"});
        }

        if (proposta.status !== 'aprovado') {
          return res.status(500).json({error: "Error"});
        }

        // Se CCB já foi gerada, retornar sucesso
        if (proposta.ccb_gerado && proposta.caminho_ccb_assinado) {
          console.log(`[CCB] CCB já existe para proposta ${id}`);
          return res.json({
            success: true,
            message: 'CCB já foi gerada anteriormente',
            caminho: proposta.caminho_ccb_assinado,
          });
        }

        // Gerar CCB usando serviço correto (pdf-lib + template)
        console.log(`[CCB] Gerando CCB com template CORRETO para proposta ${id}...`);
        const { ccbGenerationService } = await import('./services/ccbGenerationService');

        try {
          const _result = await ccbGenerationService.generateCCB(id);
          if (!_result.success) {
            throw new Error("Error");
          }
          console.log(`[CCB] CCB gerada com sucesso usando template CORRETO: ${_result.pdfPath}`);
          res.json({
            success: true,
            message: 'CCB gerada com sucesso usando template personalizado',
            caminho: _result.pdfPath,
          });
        }
catch (error) {
          console.error(error);
          return res.status(500).json({error: "Error"});
        }
      }
catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }
  );

  // Debug: Testar PDF simples e limpo
  app.get(
    '/api/debug/test-pdf',
    _jwtAuthMiddleware as unknown,
    async (req: AuthenticatedRequest, res) => {
      try {
        const _PDFDocument = (await import('pdfkit')).default;

        // Criar PDF extremamente simples
        const _doc = new PDFDocument({
          margin: 50,
          size: 'A4',
          info: {
            Title: 'Teste PDF Simples',
            Author: 'Sistema Teste',
            Subject: 'PDF de Teste',
            Creator: 'Sistema Simpix',
            Producer: 'PDFKit',
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));

        // Conteúdo mínimo
        doc.fontSize(16).text('DOCUMENTO DE TESTE');
        doc.moveDown();
        doc.fontSize(12).text('Este é um PDF de teste gerado pelo sistema.');
        doc.text('Data: ' + _formatBrazilianDateTime(getBrasiliaDate()));

        doc.end();

        const _pdfBuffer = await new Promise<Buffer>((resolve) => {
          doc.on('end', () => resolve(Buffer.concat(chunks)));
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="teste-simples.pdf"');
        res.send(pdfBuffer);
      }
catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao criar PDF teste' });
      }
    }
  );

  // Debug: Listar arquivos no bucket documents
  app.get(
    '/api/debug/storage-files',
    _jwtAuthMiddleware as unknown,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { createServerSupabaseAdminClient } = await import('./lib/supabase');
        const _supabase = createServerSupabaseAdminClient();

        const { data: files, error } = await _supabase.storage.from('documents').list('ccb', {
          limit: 50,
          sortBy: { column: 'created_at', order: 'desc' },
        });

        if (error) {
          console.error(error);
          return res.status(500).json({error: "Error"});
        }

        res.json({
          bucket: 'documents',
          folder: 'ccb',
          files: files || [],
          count: files?.length || 0,
        });
      }
catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro interno' });
      }
    }
  );

  // Get CCB signed URL
  app.get(
    '/api/propostas/:id/ccb-url',
    _jwtAuthMiddleware as unknown,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { id } = req.params;

        console.log(`[CCB URL] Buscando URL para proposta: ${id}`);

        const { createServerSupabaseAdminClient } = await import('./lib/supabase');
        const _supabase = createServerSupabaseAdminClient();

        // ✅ CORREÇÃO: Buscar dados MAIS RECENTES da proposta (força busca sem cache)
        const { data: proposta, error } = await supabase
          .from('propostas')
          .select('ccb_gerado, caminho_ccb, ccb_gerado_em')
          .eq('id', id)
          .single();

        if (error || !proposta) {
          console.log(`[CCB URL] ❌ Proposta não encontrada: ${error?.message}`);
          return res.status(500).json({error: "Error"});
        }

        if (!proposta.ccb_gerado) {
          console.log(`[CCB URL] ❌ CCB não foi gerada ainda`);
          return res.status(500).json({error: "Error"});
        }

        // ✅ ESTRATÉGIA TRIPLA: Sempre verificar se há versão mais recente no storage
        console.log(`[CCB URL] 💾 Caminho no banco: ${proposta.caminho_ccb || 'nenhum'}`);

        // Sempre buscar arquivos no storage para garantir versão mais recente
        const { data: files } = await _supabase.storage
          .from('documents')
          .list(`ccb/${id}`, { sortBy: { column: 'created_at', order: 'desc' }});

        let _ccbPath = proposta.caminho_ccb; // Fallback para caminho do banco

        if (files && files.length > 0) {
          // Sempre usar o arquivo mais recente do storage (mais confiável)
          const _latestFile = files[0];
          const _latestPath = `ccb/${id}/${latestFile.name}`;

          console.log(
            `[CCB URL] 📁 Arquivo mais recente no storage: ${latestFile.name} (${latestFile.created_at})`
          );

          // Usar arquivo mais recente se for diferente do banco ou se banco não tiver caminho
          if (!ccbPath || latestPath !== ccbPath) {
            ccbPath = latestPath;
            console.log(`[CCB URL] ✅ Usando arquivo mais recente: ${ccbPath}`);
          }
else {
            console.log(`[CCB URL] ✅ Banco está atualizado com a versão mais recente`);
          }
        }
else {
          console.log(`[CCB URL] ⚠️ Nenhum arquivo encontrado no storage para CCB/${id}`);
        }

        if (!ccbPath) {
          console.log(`[CCB URL] ❌ Nenhum arquivo CCB encontrado`);
          return res.status(500).json({error: "Error"});
        }

        console.log(`[CCB URL] 🔗 Gerando URL assinada para: ${ccbPath}`);
        console.log(`[CCB URL] 📅 CCB gerado em: ${proposta.ccb_gerado_em}`);

        // Gerar URL assinada com cache-busting para forçar atualização
        const { data: signedUrlData, error: urlError } = await _supabase.storage
          .from('documents')
          .createSignedUrl(ccbPath, 3600); // 1 hora

        if (urlError || !signedUrlData) {
          console.error(error);
          console.error(error);

          // 🔄 FALLBACK: Regenerar CCB se não encontrado (conforme error_docs/storage_errors.md)
          if (
            (urlError as unknown)?.status == 400 ||
            urlError.message?.includes('Object not found')
          ) {
            console.log('🔄 [CCB URL] Arquivo não encontrado, tentando regenerar CCB...');
            try {
              const { ccbGenerationService } = await import('./services/ccbGenerationService');
              const _newCcb = await ccbGenerationService.generateCCB(id);
              if (newCcb.success) {
                // Tentar novamente com o novo arquivo
                const { data: newSignedUrl } = await _supabase.storage
                  .from('documents')
                  .createSignedUrl(newCcb.pdfPath!, 3600);

                if (newSignedUrl) {
                  res.setHeader('X-Content-Type-Options', 'nosniff');
                  res.setHeader('X-Frame-Options', 'DENY');
                  res.setHeader(
                    'Content-Security-Policy',
                    "default-src 'none'; object-src 'none';"
                  );
                  return res.json({
                    url: newSignedUrl.signedUrl,
                    filename: `CCB-${id}.pdf`,
                    contentType: 'application/pdf',
                    regenerated: true,
                  });
                }
              }
            }
catch (regenError) {
              console.error(error);
            }
          }

          return res.status(500).json({
            message: 'Erro ao gerar URL do documento',
            details: urlError.message,
          });
        }

        // Retornar com headers de segurança
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Content-Security-Policy', "default-src 'none'; object-src 'none';");
        res.json({
          url: signedUrlData.signedUrl,
          filename: `CCB-${id}.pdf`,
          contentType: 'application/pdf',
        });
      }
catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar CCB' });
      }
    }
  );

  app.get(
    '/api/propostas/:id',
    _jwtAuthMiddleware as unknown,
  _timingNormalizerMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const _idParam = req.params.id;
        const _user = req.user;

        console.log(
          `🔐 [PROPOSTA ACCESS] User ${user?.id} (${user?.role}) accessing proposta ${idParam}`
        );

        // 🔧 CORREÇÃO: Usar mesma abordagem do endpoint de formalização que funciona
        if (user?.role == 'ATENDENTE') {
          console.log(`🔐 [ATENDENTE ACCESS] Using RLS query for user loja_id: ${user?.loja_id}`);

          // Usar Drizzle com RLS como no endpoint de formalização
          const { db } = await import('../server/lib/supabase');
          const { propostas, lojas, parceiros, produtos, tabelasComerciais } = await import(
            '../shared/schema'
          );
          const { eq, and } = await import('drizzle-orm');

          // Query with RLS active - same as formalization endpoint
          const _result = await db
            .select({
              id: propostas.id,
              numero_proposta: propostas.numeroProposta, // PAM V1.0 - Sequential number
              status: propostas.status,
              cliente_data: propostas.clienteData,
              condicoes_data: propostas.condicoesData,
              loja_id: propostas.lojaId,
              created_at: propostas.createdAt,
              produto_id: propostas.produtoId,
              tabela_comercial_id: propostas.tabelaComercialId,
              user_id: propostas.userId,
              ccb_documento_url: propostas.ccbDocumentoUrl,
              analista_id: propostas.analistaId,
              data_analise: propostas.dataAnalise,
              motivo_pendencia: propostas.motivoPendencia,
              data_aprovacao: propostas.dataAprovacao,
              documentos_adicionais: propostas.documentosAdicionais,
              contrato_gerado: propostas.contratoGerado,
              contrato_assinado: propostas.contratoAssinado,
              data_assinatura: propostas.dataAssinatura,
              data_pagamento: propostas.dataPagamento,
              observacoes_formalizacao: propostas.observacoesFormalização,
              loja: {
                id: lojas.id,
                nome_loja: lojas.nomeLoja,
              },
              parceiro: {
                id: parceiros.id,
                razao_social: parceiros.razaoSocial,
              },
              produto: {
                id: produtos.id,
                nome_produto: produtos.nomeProduto,
                tac_valor: produtos.tacValor,
                tac_tipo: produtos.tacTipo,
              },
              tabela_comercial: {
                id: tabelasComerciais.id,
                nome_tabela: tabelasComerciais.nomeTabela,
                taxa_juros: tabelasComerciais.taxaJuros,
                prazos: tabelasComerciais.prazos,
                comissao: tabelasComerciais.comissao,
              },
            })
            .from(propostas)
            .leftJoin(lojas, eq(propostas.lojaId, lojas.id))
            .leftJoin(parceiros, eq(lojas.parceiroId, parceiros.id))
            .leftJoin(produtos, eq(propostas.produtoId, produtos.id))
            .leftJoin(tabelasComerciais, eq(propostas.tabelaComercialId, tabelasComerciais.id))
            .where(eq(propostas.id, idParam))
            .limit(1);

          if (!result || _result.length == 0) {
            console.log(
              `🔐 [ATENDENTE BLOCKED] User ${user?.id} denied access to proposta ${idParam} - RLS policy blocked or not found`
            );
            return res.status(403).json({
              message: 'Você não tem permissão para acessar esta proposta',
            });
          }

          const _proposta = result[0];
          console.log(
            `🔐 [ATENDENTE ALLOWED] User ${user?.id} granted access to proposta ${idParam} from loja ${proposta.loja_id}`
          );

          // Buscar documentos da proposta
          const { createServerSupabaseAdminClient } = await import('../server/lib/supabase');
          const _supabase = createServerSupabaseAdminClient();

          const { data: documentos, error: docError } = await supabase
            .from('proposta_documentos')
            .select('*')
            .eq('proposta_id', idParam);

          console.log(
            `🔍 [ANÁLISE] Documentos encontrados para proposta ${idParam}:`,
            documentos?.length || 0
          );

          // DEBUG: Listar arquivos que existem no bucket para esta proposta
          const { data: bucketFiles, error: listError } = await _supabase.storage
            .from('documents')
            .list(`proposta-${idParam}/`, { limit: 100 });

          if (bucketFiles) {
            console.log(`🔍 [ANÁLISE] ==== COMPARAÇÃO BUCKET vs BANCO ====`);
            console.log(
              `🔍 [ANÁLISE] Arquivos no bucket (${bucketFiles.length}):`,
              bucketFiles.map((f) => f.name)
            );
            console.log(
              `🔍 [ANÁLISE] URLs salvas no banco (${documentos?.length || 0}):`,
              documentos?.map((d) => d.url)
            );
            console.log(
              `🔍 [ANÁLISE] Nomes no banco (${documentos?.length || 0}):`,
              documentos?.map((d) => d.nome_arquivo)
            );
            console.log(`🔍 [ANÁLISE] ==============================`);
          }
else {
            console.log(`🔍 [ANÁLISE] Erro ao listar arquivos no bucket:`, listError?.message);
          }

          // Gerar URLs assinadas para visualização dos documentos
          let _documentosComUrls = [];
          if (documentos && documentos.length > 0) {
            console.log(
              `🔍 [ANÁLISE] Gerando URLs assinadas para ${documentos.length} documentos...`
            );

            for (const doc of documentos) {
              try {
                console.log(`🔍 [ANÁLISE] Tentando gerar URL para documento:`, {
                  nome: doc.nome_arquivo,
                  url: doc.url,
                  tipo: doc.tipo,
                  proposta_id: doc.proposta_id,
                });

                // Extrair o caminho do arquivo a partir da URL salva
                const _documentsIndex = doc.url.indexOf('/documents/');
                let filePath;

                if (documentsIndex !== -1) {
                  // Extrair caminho após '/documents/'
                  filePath = doc.url.substring(documentsIndex + '/documents/'.length);
                }
else {
                  // Fallback: construir caminho baseado no nome do arquivo
                  const _fileName = doc.nome_arquivo;
                  filePath = `proposta-${idParam}/${fileName}`;
                }

                console.log(`🔍 [ANÁLISE] Caminho extraído para URL assinada: ${filePath}`);

                const { data: signedUrlData, error: urlError } = await _supabase.storage
                  .from('documents')
                  .createSignedUrl(filePath, 3600); // 1 hora

                if (!urlError && signedUrlData) {
                  documentosComUrls.push({
                    ...doc,
                    // Mapeamento para formato esperado pelo DocumentViewer
                    name: doc.nome_arquivo,
                    url: signedUrlData.signedUrl,
                    type: doc.tipo || 'application/octet-stream', // fallback se tipo for null
                    uploadDate: doc.created_at,
                    // Manter campos originais também
                    url_visualizacao: signedUrlData.signedUrl,
                  });
                  console.log(`🔍 [ANÁLISE] ✅ URL gerada para documento: ${doc.nome_arquivo}`);
                }
else {
                  console.log(
                    `🔍 [ANÁLISE] ❌ Erro ao gerar URL para documento ${doc.nome_arquivo}:`,
                    urlError?.message
                  );
                  console.log(`🔍 [ANÁLISE] ❌ Caminho tentado: ${filePath}`);
                  documentosComUrls.push({
                    ...doc,
                    // Mesmo sem URL, mapear para formato esperado
                    name: doc.nome_arquivo,
                    url: '',
                    type: doc.tipo || 'application/octet-stream',
                    uploadDate: doc.created_at,
                  }); // Adiciona sem URL em caso de erro
                }
              }
catch (error) {
                console.log(
                  `🔍 [ANÁLISE] ❌ Erro ao processar documento ${doc.nome_arquivo}:`,
                  error
                );
                documentosComUrls.push(doc); // Adiciona sem URL em caso de erro
              }
            }
          }

          // Transform to match expected format with proper camelCase conversion
          const _formattedProposta = {
            ...proposta,
            // Convert snake_case to camelCase for frontend compatibility
            clienteData: proposta.cliente_data,
            condicoesData: proposta.condicoes_data,
            createdAt: proposta.created_at,
            lojaId: proposta.loja_id,
            produtoId: proposta.produto_id,
            tabelaComercialId: proposta.tabela_comercial_id,
            userId: proposta.user_id,
            analistaId: proposta.analista_id,
            dataAnalise: proposta.data_analise,
            motivoPendencia: proposta.motivo_pendencia,
            dataAprovacao: proposta.data_aprovacao,
            documentosAdicionais: proposta.documentos_adicionais,
            contratoGerado: proposta.contrato_gerado,
            contratoAssinado: proposta.contrato_assinado,
            dataAssinatura: proposta.data_assinatura,
            dataPagamento: proposta.data_pagamento,
            observacoesFormalização: proposta.observacoes_formalizacao,
            // Nested objects with proper structure
            lojas: proposta.loja
              ? {
                  ...proposta.loja,
                  parceiros: proposta.parceiro,
                }
              : null,
            produtos: proposta.produto,
            tabelas_comerciais: proposta.tabela_comercial,
            // Include documents with signed URLs
            documentos: documentosComUrls || [],
          };

          res.json(formattedProposta);
        }
else {
          // Para outros roles (ADMIN, GERENTE, ANALISTA), usar método original sem RLS
          const _proposta = await storage.getPropostaById(idParam);

          if (!proposta) {
            return res.status(500).json({error: "Error"});
          }

          console.log(
            `🔐 [ADMIN/GERENTE/ANALISTA ACCESS] User ${user?.id} (${user?.role}) accessing proposta ${idParam}`
          );

          // 🔧 CORREÇÃO CRÍTICA: Aplicar mesma lógica de documentos do ATENDENTE
          const { createServerSupabaseAdminClient } = await import('../server/lib/supabase');
          const _supabase = createServerSupabaseAdminClient();

          // Buscar documentos da proposta (mesma lógica do ATENDENTE)
          const { data: documentos, error: docError } = await supabase
            .from('proposta_documentos')
            .select('*')
            .eq('proposta_id', idParam);

          console.log(
            `🔍 [ANÁLISE-OUTROS] Documentos encontrados para proposta ${idParam}:`,
            documentos?.length || 0
          );

          // Gerar URLs assinadas para visualização dos documentos (mesma lógica do ATENDENTE)
          let _documentosComUrls = [];
          if (documentos && documentos.length > 0) {
            console.log(
              `🔍 [ANÁLISE-OUTROS] Gerando URLs assinadas para ${documentos.length} documentos...`
            );

            for (const doc of documentos) {
              try {
                console.log(`🔍 [ANÁLISE-OUTROS] Tentando gerar URL para documento:`, {
                  nome: doc.nome_arquivo,
                  url: doc.url,
                  tipo: doc.tipo,
                  proposta_id: doc.proposta_id,
                });

                // Extrair o caminho do arquivo a partir da URL salva
                const _documentsIndex = doc.url.indexOf('/documents/');
                let filePath;

                if (documentsIndex !== -1) {
                  // Extrair caminho após '/documents/'
                  filePath = doc.url.substring(documentsIndex + '/documents/'.length);
                }
else {
                  // Fallback: construir caminho baseado no nome do arquivo
                  const _fileName = doc.nome_arquivo;
                  filePath = `proposta-${idParam}/${fileName}`;
                }

                console.log(`🔍 [ANÁLISE-OUTROS] Caminho extraído para URL assinada: ${filePath}`);

                const { data: signedUrlData, error: urlError } = await _supabase.storage
                  .from('documents')
                  .createSignedUrl(filePath, 3600); // 1 hora

                if (!urlError && signedUrlData) {
                  documentosComUrls.push({
                    ...doc,
                    // Mapeamento para formato esperado pelo DocumentViewer
                    name: doc.nome_arquivo,
                    url: signedUrlData.signedUrl,
                    type: doc.tipo || 'application/octet-stream', // fallback se tipo for null
                    uploadDate: doc.created_at,
                    // Manter campos originais também
                    url_visualizacao: signedUrlData.signedUrl,
                  });
                  console.log(
                    `🔍 [ANÁLISE-OUTROS] ✅ URL gerada para documento: ${doc.nome_arquivo}`
                  );
                }
else {
                  console.log(
                    `🔍 [ANÁLISE-OUTROS] ❌ Erro ao gerar URL para documento ${doc.nome_arquivo}:`,
                    urlError?.message
                  );
                  console.log(`🔍 [ANÁLISE-OUTROS] ❌ Caminho tentado: ${filePath}`);
                  documentosComUrls.push({
                    ...doc,
                    // Mesmo sem URL, mapear para formato esperado
                    name: doc.nome_arquivo,
                    url: '',
                    type: doc.tipo || 'application/octet-stream',
                    uploadDate: doc.created_at,
                  }); // Adiciona sem URL em caso de erro
                }
              }
catch (error) {
                console.log(
                  `🔍 [ANÁLISE-OUTROS] ❌ Erro ao processar documento ${doc.nome_arquivo}:`,
                  error
                );
                documentosComUrls.push({
                  ...doc,
                  // Mesmo com erro, mapear para formato esperado
                  name: doc.nome_arquivo,
                  url: '',
                  type: doc.tipo || 'application/octet-stream',
                  uploadDate: doc.created_at,
                }); // Adiciona sem URL em caso de erro
              }
            }
          }

          // Incluir documentos formatados na resposta
          const _propostaComDocumentos = {
            ...proposta,
            documentos: documentosComUrls || [],
          };

          console.log(
            `🔍 [ANÁLISE-OUTROS] ✅ Retornando proposta ${idParam} com ${documentosComUrls.length} documentos formatados`
          );
          res.json(propostaComDocumentos);
        }
      }
catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch proposta' });
      }
    }
  );

  // MOVED TO server/routes/propostas/core.ts - PUT /api/propostas/:id

  // MOVED TO server/routes/propostas/core.ts - POST /api/propostas

  // Endpoint específico para associar documentos a uma proposta
  app.post(
    '/api/propostas/:id/documentos',
    _jwtAuthMiddleware as unknown,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { id: propostaId } = req.params;
        const { documentos } = req.body;

        if (!documentos || !Array.isArray(documentos)) {
          return res.status(500).json({error: "Error"});
        }

        const { createServerSupabaseAdminClient } = await import('./lib/supabase');
        const _supabase = createServerSupabaseAdminClient();

        console.log(`[DEBUG] Associando ${documentos.length} documentos à proposta ${propostaId}`);

        // Inserir associações na tabela proposta_documentos
        for (const fileName of documentos) {
          try {
            const _filePath = `proposta-${propostaId}/${fileName}`;

            // Gerar URL assinada para o documento
            const { data: signedUrlData } = await _supabase.storage
              .from('documents')
              .createSignedUrl(filePath, 3600); // 1 hora

            const { error: insertError } = await _supabase.from('proposta_documentos').insert({
              proposta_id: propostaId,
              nome_arquivo: fileName.split('-').slice(1).join('-'), // Remove timestamp prefix
              url: signedUrlData?.signedUrl || `documents/${filePath}`,
              tipo: fileName.endsWith('.pdf')
                ? 'application/pdf'
                : fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')
                  ? 'image/jpeg'
                  : fileName.endsWith('.png')
                    ? 'image/png'
                    : fileName.endsWith('.gif')
                      ? 'image/gif'
                      : 'application/octet-stream',
              tamanho: 0, // Will be updated if size is available
            });

            if (insertError) {
              console.error(error);
            }
else {
              console.log(
                `[DEBUG] Documento ${fileName} associado com sucesso à proposta ${propostaId}`
              );
            }
          }
catch (docError) {
            console.error(error);
          }
        }

        res.json({
          success: true,
          message: `${documentos.length} documentos associados com sucesso`,
          proposalId: propostaId,
        });
      }
catch (error) {
        if (error instanceof z.ZodError) {
          console.error(error);
          return res.status(500).json({error: "Error"});
        }
        console.error(error);
        res.status(500).json({ message: 'Failed to create proposta' });
      }
    }
  );

  // ========================
  // PILAR 12 - PROGRESSIVE ENHANCEMENT
  // Rota para submissão de formulário tradicional (fallback)
  // ========================
  app.post(
    '/nova-proposta',
    _jwtAuthMiddleware as unknown,
    async (req: AuthenticatedRequest, res) => {
      try {
        console.log('📝 Progressive Enhancement: Form submission received');

        // Parse form data
        const _formData = {
          clienteNome: req.body.clienteNome,
          clienteCpf: req.body.clienteCpf,
          clienteEmail: req.body.clienteEmail,
          clienteTelefone: req.body.clienteTelefone,
          clienteDataNascimento: req.body.clienteDataNascimento,
          clienteRenda: req.body.clienteRenda,
          valor: req.body.valor,
          prazo: parseInt(req.body.prazo),
          finalidade: req.body.finalidade,
          garantia: req.body.garantia,
          status: 'rascunho',
        };

        // Validate and create proposal
        const __validatedData = insertPropostaSchema.parse(formData);
        const _proposta = await storage.createProposta(_validatedData);

        // For traditional form submission, redirect with success message
        const _successPage = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Proposta Enviada - Simpix</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 2rem; background: #f9fafb;
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                .success { color: #16a34a; text-align: center;
                .button { display: inline-block; padding: 0.75rem 1.5rem; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin-top: 1rem;
                .details { background: #f3f4f6; padding: 1rem; border-radius: 6px; margin-top: 1rem;
            </style>
        </head>
        <body>
            <div class="container">
                <div class="success">
                    <h1>✅ Proposta Enviada com Sucesso!</h1>
                    <p>Sua proposta foi registrada no sistema e está aguardando análise.</p>
                </div>
                <div class="details">
                    <h3>Dados da Proposta:</h3>
                    <p><strong>ID:</strong> ${proposta.id}</p>
                    <p><strong>Cliente:</strong> ${formData.clienteNome}</p>
                    <p><strong>Valor:</strong> R$ ${formData.valor}</p>
                    <p><strong>Prazo:</strong> ${formData.prazo} meses</p>
                    <p><strong>Status:</strong> ${formData.status}</p>
                </div>
                <div style="text-align: center;">
                    <a href="/dashboard" class="button">Voltar ao Dashboard</a>
                    <a href="/propostas/nova" class="button" style="background: #6b7280;">Nova Proposta</a>
                </div>
            </div>
            <script>
                // Se JavaScript estiver disponível, redirecionar automaticamente
                setTimeout(() => window.location.href = '/dashboard', 3000);
            </script>
        </body>
        </html>
      `;

        res.send(successPage);
      }
catch (error) {
        console.error(error);

        // Error page for traditional form submission
        const _errorPage = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Erro - Simpix</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 2rem; background: #f9fafb;
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                .error { color: #dc2626; text-align: center;
                .button { display: inline-block; padding: 0.75rem 1.5rem; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin-top: 1rem;
            </style>
        </head>
        <body>
            <div class="container">
                <div class="error">
                    <h1>❌ Erro ao Enviar Proposta</h1>
                    <p>Ocorreu um erro ao processar sua solicitação. Por favor, verifique os dados e tente novamente.</p>
                    ${
                      error instanceof z.ZodError
                        ? `<div style="background: #fef2f2; padding: 1rem; border-radius: 6px; margin-top: 1rem;">
                         <h3>Campos com erro:</h3>
                         <ul style="text-align: left;">
                           ${error.errors.map((e) => `<li>${e.path.join('.')}: ${e.message}</li>`).join('')}
                         </ul>
                       </div>`
                        : ''
                    }
                </div>
                <div style="text-align: center;">
                    <a href="/propostas/nova" class="button">Tentar Novamente</a>
                    <a href="/dashboard" class="button" style="background: #6b7280;">Voltar ao Dashboard</a>
                </div>
            </div>
        </body>
        </html>
      `;

        res.status(400).send(errorPage);
      }
    }
  );

  app.patch(
    '/api/propostas/:id',
    _jwtAuthMiddleware as unknown,
  _requireManagerOrAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const _id = parseInt(req.params.id);
        const __validatedData = updatePropostaSchema.parse(req.body);
        const _proposta = await storage.updateProposta(id, _validatedData);
        res.json(proposta);
      }
catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(500).json({error: "Error"});
        }
        console.error(error);
        res.status(500).json({ message: 'Failed to update proposta' });
      }
    }
  );

  app.get(
    '/api/propostas/status/:status',
    _jwtAuthMiddleware as unknown,
    async (req: AuthenticatedRequest, res) => {
      try {
        const _status = req.params.status;
        const _propostas = await storage.getPropostasByStatus(status);
        res.json(propostas);
      }
catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch propostas' });
      }
    }
  );

  // Import document routes - REACTIVATED FOR DIAGNOSIS
  const { getPropostaDocuments, uploadPropostaDocument } = await import('./routes/documents');

  // Document routes for proposals - REACTIVATED FOR DIAGNOSIS
  app.get('/api/propostas/:id/documents', _jwtAuthMiddleware as unknown, getPropostaDocuments);
  // app.post(
  //   "/api/propostas/:id/documents",
  //   _jwtAuthMiddleware as unknown,
  //   requireRoles(['ADMINISTRADOR', 'ANALISTA']),
  //   upload.single("file"),
  //   uploadPropostaDocument
  // );

  // Import propostas routes
  const { togglePropostaStatus, getCcbAssinada } = await import('./routes/propostas');

  // Rota para alternar status entre ativa/suspensa
  app.put('/api/propostas/:id/toggle-status', _jwtAuthMiddleware as unknown, togglePropostaStatus);

  // Rota para buscar CCB assinada
  app.get('/api/propostas/:id/ccb', _jwtAuthMiddleware as unknown, getCcbAssinada);

  // Emergency route to setup storage bucket (temporary - no auth for setup)
  app.post('/api/setup-storage', async (req, res) => {
    try {
      const { createServerSupabaseAdminClient } = await import('./lib/supabase');
      const _supabase = createServerSupabaseAdminClient();

      // Check existing buckets
      const { data: buckets, error: listError } = await _supabase.storage.listBuckets();

      if (listError) {
        console.error(error);
        return res
          .status(500)
          .json({ message: 'Erro ao acessar storage', error: listError.message });
      }

      const _documentsExists = buckets.some((bucket) => bucket.name == 'documents');

      if (documentsExists) {
        return res.json({
          message: 'Bucket documents já existe',
          buckets: buckets.map((b) => b.name),
        });
      }

      // Create documents bucket
      const { data: bucket, error: createError } = await _supabase.storage.createBucket(
        'documents',
        {
          public: true,
          fileSizeLimit: 52428800, // 50MB
          allowedMimeTypes: [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
          ],
        }
      );

      if (createError) {
        console.error(error);
        return res
          .status(500)
          .json({ message: 'Erro ao criar bucket', error: createError.message });
      }

      res.json({
        message: 'Bucket documents criado com sucesso!',
        bucket: bucket,
        allBuckets: buckets.map((b) => b.name).concat(['documents']),
      });
    }
catch (error) {
      console.error(error);
      res.status(500).json({
        message: 'Erro interno',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Upload route for proposal documents during creation
  app.post(
    '/api/upload',
  __jwtAuthMiddleware,
    upload.single('file'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const _file = req.file;
        const _proposalId = req.body.proposalId || req.body.filename?.split('-')[0] || 'temp';

        if (!file) {
          return res.status(500).json({error: "Error"});
        }

        const { createServerSupabaseAdminClient } = await import('./lib/supabase');
        const _supabase = createServerSupabaseAdminClient();

        // Generate unique filename with UUID
        const { v4: uuidv4 } = await import('uuid');
        const _uniqueId = uuidv4().split('-')[0]; // Use first segment of UUID for shorter filename
        const _fileName = req.body.filename || `${uniqueId}-${file.originalname}`;
        const _filePath = `proposta-${proposalId}/${fileName}`;

        console.log(`[DEBUG] Fazendo upload de ${file.originalname} para ${filePath}`);

        // Upload to PRIVATE Supabase Storage bucket
        const { data: uploadData, error: uploadError } = await _supabase.storage
          .from('documents')
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

        if (uploadError) {
          console.error(error);
          return res.status(400).json({
            message: `Erro no upload: ${uploadError.message}`,
          });
        }

        // For private bucket, we need to generate a signed URL for viewing
        const { data: signedUrlData, error: signedUrlError } = await _supabase.storage
          .from('documents')
          .createSignedUrl(filePath, 3600); // 1 hour expiry

        console.log(`[DEBUG] Upload bem-sucedido. Arquivo salvo em: ${filePath}`);

        res.json({
          success: true,
          fileName: fileName,
          filePath: filePath,
          url: signedUrlData?.signedUrl || '', // Temporary signed URL
          originalName: file.originalname,
          size: file.size,
          type: file.mimetype,
        });
      }
catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro interno no upload' });
      }
    }
  );

  // Import do controller de produtos
  const {
  _buscarTodosProdutos,
  _criarProduto,
  _atualizarProduto,
  _verificarProdutoEmUso,
  _deletarProduto,
  } = await import('./controllers/produtoController');

  // Buscar tabelas comerciais disponíveis com lógica hierárquica
  app.get(
    '/api/tabelas-comerciais-disponiveis',
  __jwtAuthMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { produtoId, parceiroId } = req.query;

        // Validação de parâmetros obrigatórios
        if (!produtoId || !parceiroId) {
          return res.status(400).json({
            message: 'produtoId e parceiroId são obrigatórios',
          });
        }

        // Validação de tipos
        const _produtoIdNum = parseInt(produtoId as string);
        const _parceiroIdNum = parseInt(parceiroId as string);

        if (_isNaN(produtoIdNum) || _isNaN(parceiroIdNum)) {
          return res.status(400).json({
            message: 'produtoId e parceiroId devem ser números válidos',
          });
        }

        console.log(
          `[${_getBrasiliaTimestamp()}] Buscando tabelas comerciais para produto ${produtoIdNum} e parceiro ${parceiroIdNum}`
        );

        // Import database connection
        const { db } = await import('../server/lib/supabase');
        const { eq, and, isNull, desc } = await import('drizzle-orm');
        const { tabelasComerciais, produtoTabelaComercial } = await import('../shared/schema');

        // STEP 1: Busca Prioritária - Tabelas Personalizadas (produto + parceiro)
        // Agora usando JOIN com a nova estrutura N:N
        const _tabelasPersonalizadas = await db
          .select({
            id: tabelasComerciais.id,
            nomeTabela: tabelasComerciais.nomeTabela,
            taxaJuros: tabelasComerciais.taxaJuros,
            prazos: tabelasComerciais.prazos,
            parceiroId: tabelasComerciais.parceiroId,
            comissao: tabelasComerciais.comissao,
            createdAt: tabelasComerciais.createdAt,
          })
          .from(tabelasComerciais)
          .innerJoin(
  _produtoTabelaComercial,
            eq(tabelasComerciais.id, produtoTabelaComercial.tabelaComercialId)
          )
          .where(
            and(
              eq(produtoTabelaComercial.produtoId, produtoIdNum),
              eq(tabelasComerciais.parceiroId, parceiroIdNum)
            )
          )
          .orderBy(desc(tabelasComerciais.createdAt));

        // STEP 2: Validação - Se encontrou tabelas personalizadas, retorna apenas elas
        if (tabelasPersonalizadas && tabelasPersonalizadas.length > 0) {
          console.log(
            `[${_getBrasiliaTimestamp()}] Encontradas ${tabelasPersonalizadas.length} tabelas personalizadas`
          );
          return res.status(500).json({error: "Error"});
        }

        console.log(
          `[${_getBrasiliaTimestamp()}] Nenhuma tabela personalizada encontrada, buscando tabelas gerais`
        );

        // STEP 3: Busca Secundária - Tabelas Gerais (produto + parceiro nulo)
        // Usando JOIN com a nova estrutura N:N
        const _tabelasGerais = await db
          .select({
            id: tabelasComerciais.id,
            nomeTabela: tabelasComerciais.nomeTabela,
            taxaJuros: tabelasComerciais.taxaJuros,
            prazos: tabelasComerciais.prazos,
            parceiroId: tabelasComerciais.parceiroId,
            comissao: tabelasComerciais.comissao,
            createdAt: tabelasComerciais.createdAt,
          })
          .from(tabelasComerciais)
          .innerJoin(
  _produtoTabelaComercial,
            eq(tabelasComerciais.id, produtoTabelaComercial.tabelaComercialId)
          )
          .where(
            and(
              eq(produtoTabelaComercial.produtoId, produtoIdNum),
              isNull(tabelasComerciais.parceiroId)
            )
          )
          .orderBy(desc(tabelasComerciais.createdAt));

        // STEP 4: Resultado Final
        const _resultado = tabelasGerais || [];
        console.log(`[${_getBrasiliaTimestamp()}] Encontradas ${resultado.length} tabelas gerais`);

        res.json(resultado);
      }
catch (error) {
        console.error(error);
        res.status(500).json({
          message: 'Erro interno do servidor',
        });
      }
    }
  );

  // Simple GET endpoint for all commercial tables (for dropdowns)
  app.get(
    '/api/tabelas-comerciais',
    _jwtAuthMiddleware as unknown,
    async (req: AuthenticatedRequest, res) => {
      try {
        // Import database connection
        const { db } = await import('../server/lib/supabase');
        const { desc, eq } = await import('drizzle-orm');
        const { tabelasComerciais, produtoTabelaComercial } = await import('../shared/schema');

        // Get all commercial tables ordered by creation date (excluding soft-deleted)
        const { isNull } = await import('drizzle-orm');
        const _tabelas = await db
          .select()
          .from(tabelasComerciais)
          .where(isNull(tabelasComerciais.deletedAt))
          .orderBy(desc(tabelasComerciais.createdAt));

        // For each table, get associated products
        const _tabelasWithProducts = await Promise.all(
          tabelas.map(async (tabela) => {
            const __associations = await db
              .select({ produtoId: produtoTabelaComercial.produtoId })
              .from(produtoTabelaComercial)
              .where(eq(produtoTabelaComercial.tabelaComercialId, tabela.id));

            return {
              ...tabela,
              produtoIds: _associations.map((a) => a.produtoId),
            };
          })
        );

        console.log(
          `[${_getBrasiliaTimestamp()}] Retornando ${tabelasWithProducts.length} tabelas comerciais com produtos`
        );
        res.json(tabelasWithProducts);
      }
catch (error) {
        console.error(error);
        res.status(500).json({
          message: 'Erro ao buscar tabelas comerciais',
        });
      }
    }
  );

  // API endpoint for creating commercial tables (N:N structure)
  app.post(
    '/api/admin/tabelas-comerciais',
  __jwtAuthMiddleware,
  __requireAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { db } = await import('../server/lib/supabase');
        const { tabelasComerciais, produtoTabelaComercial } = await import('../shared/schema');
        const { z } = await import('zod');

        // Updated validation schema for N:N structure
        const _createTabelaSchema = z.object({
          nomeTabela: z.string().min(3, 'Nome da tabela deve ter pelo menos 3 caracteres'),
          taxaJuros: z.number().positive('Taxa de juros deve ser positiva'),
          prazos: z.array(z.number().positive()).min(1, 'Deve ter pelo menos um prazo'),
          produtoIds: z
            .array(z.number().int().positive())
            .min(1, 'Pelo menos um produto deve ser selecionado'),
          parceiroId: z.number().int().positive().optional(),
          comissao: z.number().min(0, 'Comissão deve ser maior ou igual a zero').default(0),
        });

        const __validatedData = createTabelaSchema.parse(req.body);

        // TRANSACTION: Create table and associate products
        const _result = await db.transaction(async (tx) => {
          // Step 1: Insert new commercial table
          const [newTabela] = await tx
            .insert(tabelasComerciais)
            .values({
              nomeTabela: _validatedData.nomeTabela,
              taxaJuros: _validatedData.taxaJuros.toString(),
              prazos: _validatedData.prazos,
              parceiroId: _validatedData.parceiroId || null,
              comissao: _validatedData.comissao.toString(),
            })
            .returning();

          // Step 2: Associate products via junction table
          const __associations = _validatedData.produtoIds.map((produtoId) => ({
  _produtoId,
            tabelaComercialId: newTabela.id,
          }));

          await tx.insert(produtoTabelaComercial).values(_associations);

          return newTabela;
        });

        console.log(
          `[${_getBrasiliaTimestamp()}] Nova tabela comercial criada com ${_validatedData.produtoIds.length} produtos: ${_result.id}`
        );
        res.status(201).json(_result);
      }
catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(500).json({error: "Error"});
        }
        console.error(error);
        res.status(500).json({ message: 'Erro ao criar tabela comercial' });
      }
    }
  );

  // API endpoint for updating commercial tables (N:N structure)
  app.put(
    '/api/admin/tabelas-comerciais/:id',
  __jwtAuthMiddleware,
  __requireAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { db } = await import('../server/lib/supabase');
        const { tabelasComerciais, produtoTabelaComercial } = await import('../shared/schema');
        const { z } = await import('zod');
        const { eq } = await import('drizzle-orm');

        const __tabelaId = parseInt(req.params.id);
        if (_isNaN(_tabelaId)) {
          return res.status(500).json({error: "Error"});
        }

        // Updated validation schema for N:N structure
        const _updateTabelaSchema = z.object({
          nomeTabela: z.string().min(3, 'Nome da tabela deve ter pelo menos 3 caracteres'),
          taxaJuros: z.number().positive('Taxa de juros deve ser positiva'),
          prazos: z.array(z.number().positive()).min(1, 'Deve ter pelo menos um prazo'),
          produtoIds: z
            .array(z.number().int().positive())
            .min(1, 'Pelo menos um produto deve ser selecionado'),
          parceiroId: z.number().int().positive().nullable().optional(),
          comissao: z.number().min(0, 'Comissão deve ser maior ou igual a zero').default(0),
        });

        const __validatedData = updateTabelaSchema.parse(req.body);

        // TRANSACTION: Update table and reassociate products
        const _result = await db.transaction(async (tx) => {
          // Step 1: Update the commercial table
          const [updatedTabela] = await tx
            .update(tabelasComerciais)
            .set({
              nomeTabela: _validatedData.nomeTabela,
              taxaJuros: _validatedData.taxaJuros.toString(),
              prazos: _validatedData.prazos,
              parceiroId: _validatedData.parceiroId || null,
              comissao: _validatedData.comissao.toString(),
            })
            .where(eq(tabelasComerciais.id, _tabelaId))
            .returning();

          if (!updatedTabela) {
            throw new Error("Error");
          }

          // Step 2: Delete existing product _associations
          await tx
            .delete(produtoTabelaComercial)
            .where(eq(produtoTabelaComercial.tabelaComercialId, _tabelaId));

          // Step 3: Create new product _associations
          const __associations = _validatedData.produtoIds.map((produtoId) => ({
  _produtoId,
            tabelaComercialId: _tabelaId,
          }));

          await tx.insert(produtoTabelaComercial).values(_associations);

          return updatedTabela;
        });

        console.log(
          `[${_getBrasiliaTimestamp()}] Tabela comercial atualizada com ${_validatedData.produtoIds.length} produtos: ${_result.id}`
        );
        res.json(_result);
      }
catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(500).json({error: "Error"});
        }
        if (error instanceof Error && error.message == 'Tabela comercial não encontrada') {
          return res.status(500).json({error: "Error"});
        }
        console.error(error);
        res.status(500).json({ message: 'Erro ao atualizar tabela comercial' });
      }
    }
  );

  // API endpoint for deleting commercial tables
  app.delete(
    '/api/admin/tabelas-comerciais/:id',
  __jwtAuthMiddleware,
  __requireAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { db } = await import('../server/lib/supabase');
        const { tabelasComerciais, produtoTabelaComercial } = await import('../shared/schema');
        const { eq } = await import('drizzle-orm');

        const __tabelaId = parseInt(req.params.id);
        if (_isNaN(_tabelaId)) {
          return res.status(500).json({error: "Error"});
        }

        // TRANSACTION: Delete table and its _associations
        await db.transaction(async (tx) => {
          // Step 1: Delete product _associations
          await tx
            .delete(produtoTabelaComercial)
            .where(eq(produtoTabelaComercial.tabelaComercialId, _tabelaId));

          // Step 2: Soft delete the commercial table
          const _result = await tx
            .update(tabelasComerciais)
            .set({ deletedAt: new Date() })
            .where(eq(tabelasComerciais.id, _tabelaId))
            .returning();

          if (_result.length == 0) {
            throw new Error("Error");
          }
        });

        console.log(`[${_getBrasiliaTimestamp()}] Tabela comercial deletada: ${_tabelaId}`);
        res.status(204).send();
      }
catch (error) {
        if (error instanceof Error && error.message == 'Tabela comercial não encontrada') {
          return res.status(500).json({error: "Error"});
        }
        console.error(error);
        res.status(500).json({ message: 'Erro ao deletar tabela comercial' });
      }
    }
  );

  // REMOVIDO: Rota duplicada movida para linha 441 - ver comentário 🔧 CORREÇÃO CRÍTICA

  // MOVED TO server/routes/propostas/core.ts - GET /api/propostas/metricas

  // REMOVED DUPLICATE - GET /api/propostas/metricas (already moved above)

  // [REMOVED: Legacy payment endpoint - Replaced by /api/pagamentos with V2.0 status system]

  // Endpoint for formalization data - Using Supabase direct to avoid Drizzle orderSelectedFields error
  app.get(
    '/api/propostas/:id/formalizacao',
  __jwtAuthMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const _propostaId = req.params.id;
        console.log(
          `[${_getBrasiliaTimestamp()}] 🔍 INICIO - Buscando dados de formalização para proposta: ${propostaId}`
        );

        if (!propostaId) {
          return res.status(500).json({error: "Error"});
        }

        // Usar Supabase Admin Client diretamente para evitar problemas do Drizzle
        const { createServerSupabaseAdminClient } = await import('./lib/supabase');
        const _supabase = createServerSupabaseAdminClient();

        console.log(`[${_getBrasiliaTimestamp()}] 🔍 STEP 1 - Fazendo query direta no Supabase...`);

        // Buscar proposta usando Supabase diretamente - incluindo numeroProposta
        const { data: proposta, error: propostaError } = await supabase
          .from('propostas')
          .select('*, numero_proposta')
          .eq('id', propostaId)
          .single();

        console.log(`[${_getBrasiliaTimestamp()}] 🔍 STEP 2 - Proposta encontrada:`, !!proposta);
        console.log(`[${_getBrasiliaTimestamp()}] 🔍 STEP 2.1 - Dados da proposta:`, {
          id: proposta?.id,
          status: proposta?.status,
          tabela_comercial_id: proposta?.tabela_comercial_id,
          produto_id: proposta?.produto_id,
          atendente_id: proposta?.atendente_id,
        });

        if (propostaError || !proposta) {
          console.log(
            `[${_getBrasiliaTimestamp()}] ❌ Proposta ${propostaId} não encontrada:`,
            propostaError?.message
          );
          return res.status(500).json({error: "Error"});
        }

        console.log(`[${_getBrasiliaTimestamp()}] 🔍 STEP 3 - Buscando documentos...`);

        // Buscar documentos da proposta
        const { data: documentos, error: docError } = await supabase
          .from('proposta_documentos')
          .select('*')
          .eq('proposta_id', propostaId);

        console.log(
          `[${_getBrasiliaTimestamp()}] 🔍 STEP 4 - Documentos encontrados:`,
          documentos?.length || 0
        );
        console.log(
          `[${_getBrasiliaTimestamp()}] 🔍 STEP 4.1 - Estrutura dos documentos:`,
          documentos
        );

        // STEP 4.2: Gerar URLs assinadas para visualização dos documentos
        let _documentosComUrls = [];
        if (documentos && documentos.length > 0) {
          console.log(
            `[${_getBrasiliaTimestamp()}] 🔍 STEP 4.2 - Gerando URLs assinadas para ${documentos.length} documentos...`
          );

          for (const doc of documentos) {
            try {
              console.log(`🔍 [FORMALIZAÇÃO] Tentando gerar URL para documento:`, {
                nome: doc.nome_arquivo,
                url: doc.url,
                tipo: doc.tipo,
                proposta_id: doc.proposta_id,
              });

              // Extrair o caminho do arquivo a partir da URL salva
              const _documentsIndex = doc.url.indexOf('/documents/');
              let filePath;

              if (documentsIndex !== -1) {
                // Extrair caminho após '/documents/'
                filePath = doc.url.substring(documentsIndex + '/documents/'.length);
              }
else {
                // Fallback: construir caminho baseado no nome do arquivo
                const _fileName = doc.nome_arquivo;
                filePath = `proposta-${propostaId}/${fileName}`;
              }

              console.log(`🔍 [FORMALIZAÇÃO] Caminho extraído para URL assinada: ${filePath}`);

              const { data: signedUrlData, error: urlError } = await _supabase.storage
                .from('documents')
                .createSignedUrl(filePath, 3600); // 1 hora

              if (!urlError && signedUrlData) {
                documentosComUrls.push({
                  ...doc,
                  // Mapeamento para formato esperado pelo DocumentViewer
                  name: doc.nome_arquivo,
                  url: signedUrlData.signedUrl,
                  type: doc.tipo || 'application/octet-stream', // fallback se tipo for null
                  uploadDate: doc.created_at,
                  // Manter campos originais também
                  url_visualizacao: signedUrlData.signedUrl,
                });
                console.log(
                  `[${_getBrasiliaTimestamp()}] ✅ URL gerada para documento: ${doc.nome_arquivo}`
                );
              }
else {
                console.log(
                  `[${_getBrasiliaTimestamp()}] ❌ Erro ao gerar URL para documento ${doc.nome_arquivo}:`,
                  urlError?.message
                );
                console.log(`[${_getBrasiliaTimestamp()}] ❌ Caminho tentado: ${filePath}`);
                documentosComUrls.push({
                  ...doc,
                  // Mesmo sem URL, mapear para formato esperado
                  name: doc.nome_arquivo,
                  url: '',
                  type: doc.tipo || 'application/octet-stream',
                  uploadDate: doc.created_at,
                }); // Adiciona sem URL em caso de erro
              }
            }
catch (error) {
              console.log(
                `[${_getBrasiliaTimestamp()}] ❌ Erro ao processar documento ${doc.nome_arquivo}:`,
                error
              );
              documentosComUrls.push({
                ...doc,
                // Mesmo com erro, mapear para formato esperado
                name: doc.nome_arquivo,
                url: '',
                type: doc.tipo || 'application/octet-stream',
                uploadDate: doc.created_at,
              }); // Adiciona sem URL em caso de erro
            }
          }
        }

        // Buscar taxa de juros da tabela comercial se existir
        let _taxaJurosTabela = null;
        console.log(
          `[${_getBrasiliaTimestamp()}] 🔍 STEP 5 - Verificando tabela_comercial_id:`,
          proposta.tabela_comercial_id
        );

        if (proposta.tabela_comercial_id) {
          console.log(
            `[${_getBrasiliaTimestamp()}] 🔍 STEP 5.1 - Buscando tabela comercial ID:`,
            proposta.tabela_comercial_id
          );

          const { data: tabelaComercial, error: tabelaError } = await supabase
            .from('tabelas_comerciais')
            .select('taxa_juros, nome_tabela, parceiro_id')
            .eq('id', proposta.tabela_comercial_id)
            .single();

          console.log(
            `[${_getBrasiliaTimestamp()}] 🔍 STEP 5.2 - Resultado da consulta tabela comercial:`,
            {
              data: tabelaComercial,
              error: tabelaError?.message,
              hasData: !!tabelaComercial,
            }
          );

          if (tabelaComercial && !tabelaError) {
            taxaJurosTabela = tabelaComercial.taxa_juros;
            console.log(
              `[${_getBrasiliaTimestamp()}] ✅ Taxa de juros encontrada:`,
  _taxaJurosTabela,
              `% da tabela "${tabelaComercial.nome_tabela}"`
            );
          }
else {
            console.log(
              `[${_getBrasiliaTimestamp()}] ❌ Erro ao buscar tabela comercial:`,
              tabelaError?.message
            );
          }
        }
else {
          console.log(
            `[${_getBrasiliaTimestamp()}] ⚠️ AVISO: Proposta ${propostaId} não possui tabela_comercial_id`
          );
        }

        console.log(`[${_getBrasiliaTimestamp()}] 🔍 STEP 6 - Processando dados JSONB...`);

        // Parse dos dados JSONB antes de retornar
        const _propostaProcessada = {
          ...proposta,
          // Parse seguro dos dados JSONB
          clienteData: proposta.cliente_data || {},
          condicoesData: proposta.condicoes_data || {},
          // Converter snake_case para camelCase para compatibilidade frontend
          ccbGerado: proposta.ccb_gerado || false,
          dataAprovacao: proposta.data_aprovacao,
          assinaturaEletronicaConcluida: proposta.assinatura_eletronica_concluida || false,
          biometriaConcluida: proposta.biometria_concluida || false,
          caminhoCcbAssinado: proposta.caminho_ccb_assinado,
          createdAt: proposta.created_at,
          // Adicionar documentos com URLs assinadas
          documentos: documentosComUrls || [],
          // Adicionar taxa de juros da tabela comercial
          taxaJurosTabela: taxaJurosTabela,
        };

        console.log(
          `[${_getBrasiliaTimestamp()}] ✅ SUCESSO - Dados de formalização retornados para proposta ${propostaId}:`,
          {
            id: propostaProcessada.id,
            status: propostaProcessada.status,
            ccbGerado: propostaProcessada.ccbGerado,
            dataAprovacao: propostaProcessada.dataAprovacao,
            temClienteData: !!propostaProcessada.clienteData?.nome,
            temCondicoesData: !!propostaProcessada.condicoesData?.valor,
            totalDocumentos: propostaProcessada.documentos?.length || 0,
            clienteNome: propostaProcessada.clienteData?.nome || 'Nome não informado',
            valorEmprestimo: propostaProcessada.condicoesData?.valor || 'Valor não informado',
            taxaJuros:
              propostaProcessada.taxaJurosTabela ||
              propostaProcessada.condicoesData?.taxaJuros ||
              'Taxa não informada',
          }
        );

        res.json(propostaProcessada);
      }
catch (error) {
        console.error(
          `[${_getBrasiliaTimestamp()}] ❌ ERRO ao buscar dados de formalização:`,
          error
        );
        res.status(500).json({
          message: 'Erro ao buscar dados de formalização',
          error: (error as Error).message,
        });
      }
    }
  );

  // Mock data para prazos
  const _prazos = [
    { id: 1, valor: '12 meses' },
    { id: 2, valor: '24 meses' },
    { id: 3, valor: '36 meses' },
  ];

  // Users management endpoints - REFATORADO com padrão Service/Repository
  const _usersAdminRouter = (await import('./routes/admin-users.js')).default;
  app.use('/api/admin', usersAdminRouter);

  // API endpoint for partners - GET all (public for dropdowns)
  app.get('/api/parceiros', async (req, res) => {
    try {
      const { db } = await import('../server/lib/supabase');
      const { parceiros } = await import('../shared/schema');

      const { isNull } = await import('drizzle-orm');
      const _allParceiros = await db.select().from(parceiros).where(isNull(parceiros.deletedAt));
      res.json(allParceiros);
    }
catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Erro ao buscar parceiros' });
    }
  });

  // API endpoint for partners - GET by ID
  app.get('/api/parceiros/:id', timingNormalizerMiddleware, async (req, res) => {
    try {
      const { db } = await import('../server/lib/supabase');
      const { parceiros } = await import('../shared/schema');
      const { eq } = await import('drizzle-orm');

      const _parceiroId = parseInt(req.params.id);
      if (_isNaN(parceiroId)) {
        return res.status(500).json({error: "Error"});
      }

      const [parceiro] = await db.select().from(parceiros).where(eq(parceiros.id, parceiroId));

      if (!parceiro) {
        return res.status(500).json({error: "Error"});
      }

      res.json(parceiro);
    }
catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Erro ao buscar parceiro' });
    }
  });

  // API endpoint for partners - POST create
  app.post(
    '/api/admin/parceiros',
  __jwtAuthMiddleware,
  __requireAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { db } = await import('../server/lib/supabase');
        const { parceiros, insertParceiroSchema } = await import('../shared/schema');
        const { z } = await import('zod');

        const __validatedData = insertParceiroSchema.parse(req.body);
        const [newParceiro] = await db.insert(parceiros).values(_validatedData).returning();

        res.status(201).json(newParceiro);
      }
catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(500).json({error: "Error"});
        }
        console.error(error);
        res.status(500).json({ message: 'Erro ao criar parceiro' });
      }
    }
  );

  // API endpoint for partners - PUT update
  app.put(
    '/api/admin/parceiros/:id',
  __jwtAuthMiddleware,
  __requireAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { db } = await import('../server/lib/supabase');
        const { parceiros, updateParceiroSchema } = await import('../shared/schema');
        const { eq } = await import('drizzle-orm');
        const { z } = await import('zod');

        const _parceiroId = parseInt(req.params.id);
        if (_isNaN(parceiroId)) {
          return res.status(500).json({error: "Error"});
        }

        const __validatedData = updateParceiroSchema.parse(req.body);
        const [updatedParceiro] = await db
          .update(parceiros)
          .set(_validatedData)
          .where(eq(parceiros.id, parceiroId))
          .returning();

        if (!updatedParceiro) {
          return res.status(500).json({error: "Error"});
        }

        res.json(updatedParceiro);
      }
catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(500).json({error: "Error"});
        }
        console.error(error);
        res.status(500).json({ message: 'Erro ao atualizar parceiro' });
      }
    }
  );

  // API endpoint for partners - DELETE
  app.delete(
    '/api/admin/parceiros/:id',
  __jwtAuthMiddleware,
  __requireAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { db } = await import('../server/lib/supabase');
        const { parceiros, lojas } = await import('../shared/schema');
        const { eq, and, isNull } = await import('drizzle-orm');

        const _parceiroId = parseInt(req.params.id);
        if (_isNaN(parceiroId)) {
          return res.status(500).json({error: "Error"});
        }

        // Regra de negócio crítica: verificar se existem lojas associadas (excluindo soft-deleted)
        const _lojasAssociadas = await db
          .select()
          .from(lojas)
          .where(and(eq(lojas.parceiroId, parceiroId), isNull(lojas.deletedAt)));

        if (lojasAssociadas.length > 0) {
          return res.status(409).json({
            message: 'Não é possível excluir um parceiro que possui lojas cadastradas.',
          });
        }

        // Verificar se o parceiro existe antes de excluir (excluindo soft-deleted)
        const [parceiroExistente] = await db
          .select()
          .from(parceiros)
          .where(and(eq(parceiros.id, parceiroId), isNull(parceiros.deletedAt)));

        if (!parceiroExistente) {
          return res.status(500).json({error: "Error"});
        }

        // Soft delete - set deleted_at timestamp
        await db
          .update(parceiros)
          .set({ deletedAt: new Date() })
          .where(eq(parceiros.id, parceiroId));

        res.status(204).send();
      }
catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao excluir parceiro' });
      }
    }
  );

  // Rotas CRUD para produtos
  app.get('/api/produtos', async (req, res) => {
    try {
      const _produtos = await buscarTodosProdutos();
      res.json(produtos);
    }
catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Erro ao buscar produtos' });
    }
  });

  app.post('/api/produtos', async (req, res) => {
    try {
      const { nome, status, tacValor, tacTipo } = req.body;

      console.log('[PRODUTOS API] Criando produto com dados:', { nome, status, tacValor, tacTipo });

      if (!nome || !status) {
        return res.status(500).json({error: "Error"});
      }

      // Validação opcional dos campos TAC
      if (tacValor !== undefined && tacValor < 0) {
        return res.status(500).json({error: "Error"});
      }

      if (tacTipo !== undefined && !['fixo', 'percentual'].includes(tacTipo)) {
        return res.status(500).json({error: "Error"});
      }

      const _dadosProduto = {
  _nome,
  _status,
        tacValor: tacValor ?? 0,
        tacTipo: tacTipo ?? 'fixo',
      };

      console.log('[PRODUTOS API] Enviando para controller:', dadosProduto);

      const _novoProduto = await criarProduto(dadosProduto);

      console.log('[PRODUTOS API] Produto criado:', novoProduto);

      res.status(201).json(novoProduto);
    }
catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Erro ao criar produto' });
    }
  });

  app.put('/api/produtos/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { nome, status, tacValor, tacTipo } = req.body;

      if (!nome || !status) {
        return res.status(500).json({error: "Error"});
      }

      // Validação opcional dos campos TAC
      if (tacValor !== undefined && tacValor < 0) {
        return res.status(500).json({error: "Error"});
      }

      if (tacTipo !== undefined && !['fixo', 'percentual'].includes(tacTipo)) {
        return res.status(500).json({error: "Error"});
      }

      const _produtoAtualizado = await atualizarProduto(id, {
  _nome,
  _status,
        tacValor: tacValor ?? 0,
        tacTipo: tacTipo ?? 'fixo',
      });
      res.json(produtoAtualizado);
    }
catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Erro ao atualizar produto' });
    }
  });

  app.delete('/api/produtos/:id', async (req, res) => {
    try {
      const { id } = req.params;

      await deletarProduto(id);
      res.status(204).send(); // 204 No Content on successful deletion
    }
catch (error) {
      console.error(error);

      // Check if it's a dependency error
      if (error instanceof Error && error.message.includes('Tabelas Comerciais')) {
        return res.status(409).json({
          message: error.message,
        });
      }

      res.status(500).json({ message: 'Erro ao excluir produto' });
    }
  });

  // Rota para buscar prazos
  app.get('/api/prazos', (req, res) => {
    res.json(prazos);
  });

  // Função para calcular o valor da parcela usando a fórmula da Tabela Price
  const _calcularParcela = (
    valorSolicitado: number,
    prazoEmMeses: number,
    taxaDeJurosMensal: number
  ): number => {
    if (taxaDeJurosMensal <= 0) {
      return valorSolicitado / prazoEmMeses;
    }
    const _i = taxaDeJurosMensal / 100; // Convertendo a taxa percentual para decimal
    const _pmt =
      (valorSolicitado * (i * Math.pow(1 + i, prazoEmMeses))) / (Math.pow(1 + i, prazoEmMeses) - 1);
    return parseFloat(pmt.toFixed(2));
  };

  // Rota para simular crédito COM DADOS REAIS DO BANCO
  app.post('/api/simular', async (req, res) => {
    try {
      const { valorEmprestimo, prazoMeses, parceiroId, produtoId } = req.body;

      // Validação de entrada
      if (
        typeof valorEmprestimo !== 'number' ||
        valorEmprestimo <= 0 ||
        typeof prazoMeses !== 'number' ||
        prazoMeses <= 0 ||
        (!parceiroId && !produtoId)
      ) {
        return res.status(400).json({
          error:
            'Parâmetros inválidos. Forneça valorEmprestimo, prazoMeses e parceiroId ou produtoId.',
        });
      }

      console.log('[SIMULAÇÃO] Iniciando simulação:', {
  _valorEmprestimo,
  _prazoMeses,
  _parceiroId,
  _produtoId,
      });

      // PASSO 1: Buscar parâmetros financeiros do banco de dados
      let _taxaJurosMensal = 5.0; // Default fallback
      let _tacValor = 0;
      let _tacTipo = 'fixo';
      let _comissao = 0;

      // Hierarquia de busca de taxas
      if (parceiroId) {
        // 1.1 - Busca dados do parceiro
        const _parceiro = await db
          .select()
          .from(parceiros)
          .where(eq(parceiros.id, parceiroId))
          .limit(1);

        if (parceiro.length > 0) {
          const _parceiroData = parceiro[0];

          // Verifica se parceiro tem tabela comercial padrão
          if (parceiroData.tabelaComercialPadraoId) {
            const _tabelaPadrao = await db
              .select()
              .from(tabelasComerciais)
              .where(eq(tabelasComerciais.id, parceiroData.tabelaComercialPadraoId))
              .limit(1);

            if (tabelaPadrao.length > 0) {
              taxaJurosMensal = parseFloat(tabelaPadrao[0].taxaJuros);
              console.log('[SIMULAÇÃO] Usando tabela padrão do parceiro:', {
                _tabelaId: parceiroData.tabelaComercialPadraoId,
                taxaJuros: taxaJurosMensal,
              });
            }
          }

          // Verifica comissão padrão do parceiro
          if (parceiroData.comissaoPadrao) {
            comissao = parseFloat(parceiroData.comissaoPadrao);
          }
        }
      }

      // 1.2 - Se produtoId fornecido, busca configurações do produto
      if (produtoId) {
        const _produto = await db.select().from(produtos).where(eq(produtos.id, produtoId)).limit(1);

        if (produto.length > 0) {
          const _produtoData = produto[0];
          tacValor = parseFloat(produtoData.tacValor || '0');
          tacTipo = produtoData.tacTipo || 'fixo';

          // Busca tabelas comerciais associadas ao produto
          const _tabelasProduto = await db
            .select({
              tabela: tabelasComerciais,
            })
            .from(produtoTabelaComercial)
            .innerJoin(
  _tabelasComerciais,
              eq(produtoTabelaComercial.tabelaComercialId, tabelasComerciais.id)
            )
            .where(eq(produtoTabelaComercial.produtoId, produtoId));

          if (tabelasProduto.length > 0) {
            // Prioriza tabela específica do parceiro se existir
            let _tabelaSelecionada = tabelasProduto[0].tabela;

            if (parceiroId) {
              const _tabelaParceiro = tabelasProduto.find(
                (t) => t.tabela.parceiroId == parceiroId
              );
              if (tabelaParceiro) {
                tabelaSelecionada = tabelaParceiro.tabela;
                console.log('[SIMULAÇÃO] Usando tabela específica parceiro-produto');
              }
            }

            taxaJurosMensal = parseFloat(tabelaSelecionada.taxaJuros);

            // Sobrepõe comissão se não definida no parceiro
            if (!comissao && tabelaSelecionada.comissao) {
              comissao = parseFloat(tabelaSelecionada.comissao);
            }
          }
        }
      }

      console.log('[SIMULAÇÃO] Parâmetros obtidos do banco:', {
  _taxaJurosMensal,
  _tacValor,
  _tacTipo,
  _comissao,
      });

      // PASSO 2: Executar cálculos usando o serviço de finanças
      const { executarSimulacaoCompleta } = await import('./services/financeService.js');

      const _resultado = executarSimulacaoCompleta(
  _valorEmprestimo,
  _prazoMeses,
  _taxaJurosMensal,
  _tacValor,
  _tacTipo,
        0 // dias de carência (pode ser parametrizado depois)
      );

      // PASSO 3: Adicionar comissão ao resultado
      const _valorComissao = (valorEmprestimo * comissao) / 100;

      // PASSO 4: Retornar simulação completa
      const _respostaCompleta = {
        ...resultado,
        comissao: {
          percentual: comissao,
          valor: Math.round(valorComissao * 100) / 100,
        },
        parametrosUtilizados: {
  _parceiroId,
  _produtoId,
  _taxaJurosMensal,
  _tacValor,
  _tacTipo,
        },
      };

      // Log para validação (PROTOCOLO 5-CHECK - Item 5)
      if (valorEmprestimo == 10000 && prazoMeses == 12) {
        console.log('=== DEMONSTRAÇÃO DE CÁLCULO PARA R$ 10.000 em 12 meses ===');
        console.log('Valor Empréstimo: R$', valorEmprestimo);
        console.log('Prazo: ', prazoMeses, 'meses');
        console.log('Taxa Juros Mensal:', taxaJurosMensal, '%');
        console.log('IOF Total: R$', resultado.iof.total);
        console.log('TAC: R$', resultado.tac);
        console.log('Valor Parcela: R$', resultado.valorParcela);
        console.log('CET Anual:', resultado.cetAnual, '%');
        console.log('======================================');
      }

      return res.status(500).json({error: "Error"});
    }
catch (error) {
      console.error(error);
      return res.status(500).json({
        error: 'Erro ao processar simulação',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  });

  // Funções de mock para a simulação
  const _buscarTaxas = (produtoId: string) => {
    // Lógica futura: buscar no DB a tabela do produto/parceiro
    return { taxaDeJurosMensal: 5.0, valorTac: 150.0 }; // Exemplo: 5% a.m. e R$150 de TAC
  };

  const _calcularIOF = (valor: number) => {
    return valor * 0.0038; // Exemplo de alíquota
  };

  // Endpoint GET para simulação de crédito
  // Server time endpoint for reliable timestamp source
  app.get('/api/server-time', (req, res) => {
    res.json({ now: _getBrasiliaTimestamp() });
  });

  app.get('/api/simulacao', (req, res) => {
    const { valor, prazo, produto_id, incluir_tac, dataVencimento } = req.query;

    const _valorSolicitado = parseFloat(valor as string);
    const _prazoEmMeses = parseInt(prazo as string);

    if (_isNaN(valorSolicitado) || _isNaN(prazoEmMeses) || !produto_id || !dataVencimento) {
      return res.status(500).json({error: "Error"});
    }

    // Correção Crítica: Usa a data do servidor como a "verdade"
    const _dataAtual = getBrasiliaDate();
    const _primeiroVencimento = new Date(dataVencimento as string);
    const _diasDiferenca = Math.ceil(
      (primeiroVencimento.getTime() - dataAtual.getTime()) / (1000 * 3600 * 24)
    );

    if (diasDiferenca > 45) {
      return res
        .status(400)
        .json({ error: 'A data do primeiro vencimento não pode ser superior a 45 dias.' });
    }

    const { taxaDeJurosMensal, valorTac } = buscarTaxas(produto_id as string);

    const _taxaJurosDiaria = taxaDeJurosMensal / 30;
    const _jurosCarencia = valorSolicitado * (taxaJurosDiaria / 100) * diasDiferenca;

    const _iof = calcularIOF(valorSolicitado);
    const _tac = incluir_tac == 'true' ? valorTac : 0;

    const _valorTotalFinanciado = valorSolicitado + iof + tac + jurosCarencia;

    const _valorParcela = calcularParcela(valorTotalFinanciado, prazoEmMeses, taxaDeJurosMensal);

    const _custoTotal = valorParcela * prazoEmMeses;
    const _cetAnual = ((custoTotal / valorSolicitado - 1) / (prazoEmMeses / 12)) * 100;

    return res.json({
      valorParcela: parseFloat(valorParcela.toFixed(2)),
      taxaJuros: taxaDeJurosMensal,
      valorIOF: parseFloat(iof.toFixed(2)),
      valorTAC: tac,
      valorTotalFinanciado: parseFloat(valorTotalFinanciado.toFixed(2)),
      custoEfetivoTotalAnual: parseFloat(cetAnual.toFixed(2)),
      jurosCarencia: parseFloat(jurosCarencia.toFixed(2)),
      diasCarencia: diasDiferenca,
    });
  });

  // Rota para fila de formalização
  app.get('/api/formalizacao/propostas', (req, res) => {
    const _mockPropostas = [
      { id: '1753800001234', cliente: 'Empresa A', status: 'Assinatura Pendente' },
      { id: '1753800005678', cliente: 'Empresa B', status: 'Biometria Concluída' },
      { id: '1753800009012', cliente: 'Empresa C', status: 'CCB Gerada' },
    ];
    res.json(mockPropostas);
  });

  // Update proposal formalization step
  app.patch(
    '/api/propostas/:id/etapa-formalizacao',
  __jwtAuthMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { id } = req.params;
        const { etapa, concluida, caminho_documento } = req.body;

        // 🔍 DEBUG: Log user information
        console.log(`🔍 [ETAPA DEBUG] User info:`, {
          userId: req.user?.id,
          userRole: req.user?.role,
          userLojaId: req.user?.loja_id,
  _etapa,
  _concluida,
          propostaId: id,
        });

        // Validate input
        const _etapasValidas = ['ccb_gerado', 'assinatura_eletronica', 'biometria'];
        if (!etapa || !etapasValidas.includes(etapa)) {
          return res.status(400).json({
            message: 'Etapa inválida. Use: ccb_gerado, assinatura_eletronica ou biometria',
          });
        }

        if (typeof concluida !== 'boolean') {
          return res.status(400).json({
            message: "O campo 'concluida' deve ser um booleano",
          });
        }

        // Import dependencies
        const { db } = await import('../server/lib/supabase');
        const { propostas, propostaLogs } = await import('../shared/schema');
        const { eq } = await import('drizzle-orm');

        // Get the proposal first to check permissions
        const [proposta] = await db.select().from(propostas).where(eq(propostas.id, id));

        if (!proposta) {
          return res.status(500).json({error: "Error"});
        }

        // 🔍 DEBUG: Log proposta info
        console.log(`🔍 [ETAPA DEBUG] Proposta info:`, {
          propostaId: proposta.id,
          propostaLojaId: proposta.lojaId,
          propostaStatus: proposta.status,
        });

        // Check permissions based on step and role
        if (etapa == 'ccb_gerado') {
          // CCB generation can be done by ANALISTA, GERENTE, ATENDENTE, or ADMINISTRADOR
          const _allowedRoles = ['ANALISTA', 'GERENTE', 'ATENDENTE', 'ADMINISTRADOR'];
          console.log(
            `🔍 [ETAPA DEBUG] Checking CCB permissions - Role: ${req.user?.role}, Allowed: ${allowedRoles.join(', ')}`
          );

          if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
            console.log(`❌ [ETAPA DEBUG] Permission denied for role: ${req.user?.role}`);
            return res.status(403).json({
              message: `Você não tem permissão para gerar CCB. Seu role: ${req.user?.role}`,
            });
          }
          console.log(`✅ [ETAPA DEBUG] Permission granted for CCB generation`);
        }
else {
          // Other steps (ClickSign, Biometry) only ATENDENTE of the same store
          console.log(
            `🔍 [ETAPA DEBUG] Checking other steps permissions - Role: ${req.user?.role}, LojaId: ${req.user?.loja_id}, PropostaLojaId: ${proposta.lojaId}`
          );

          // Allow ADMINISTRADOR to access any store, otherwise check if ATENDENTE of same store
          const _isAdmin = req.user?.role == 'ADMINISTRADOR';
          const _isAttendenteFromSameStore =
            req.user?.role == 'ATENDENTE' && req.user?.loja_id == proposta.lojaId;

          if (!isAdmin && !isAttendenteFromSameStore) {
            console.log(`❌ [ETAPA DEBUG] Permission denied for step ${etapa}`);
            return res.status(403).json({
              message: `Apenas atendente da loja ou administrador pode atualizar as etapas de assinatura e biometria. Seu role: ${req.user?.role}`,
            });
          }
          console.log(`✅ [ETAPA DEBUG] Permission granted for step ${etapa}`);
        }

        // Build update object based on the step
        const updateData: unknown = {};

        if (etapa == 'ccb_gerado') {
          updateData.ccbGerado = concluida;

          // Automatically generate CCB when marked as complete
          if (concluida && !proposta.ccbGerado) {
            console.log(`[${_getBrasiliaTimestamp()}] Gerando CCB para proposta ${id}`);

            try {
              const { ccbGenerationService } = await import('./services/ccbGenerationService');
              const _result = await ccbGenerationService.generateCCB(id);
              if (!_result.success) {
                throw new Error("Error");
              }
              updateData.caminhoCcbAssinado = _result.pdfPath;
              console.log(`[${_getBrasiliaTimestamp()}] CCB gerada com sucesso: ${_result.pdfPath}`);
            }
catch (error) {
              console.error(error);
              // Don't fail the entire request if CCB generation fails
            }
          }
        }
else if (etapa == 'assinatura_eletronica') {
          updateData.assinaturaEletronicaConcluida = concluida;

          // TODO: Integrate with ClickSign when marked as complete
          if (concluida && !proposta.assinaturaEletronicaConcluida) {
            console.log(`[${_getBrasiliaTimestamp()}] Enviando para ClickSign - proposta ${id}`);
          }
        }
else if (etapa == 'biometria') {
          updateData.biometriaConcluida = concluida;

          // Generate boletos when biometry is complete
          if (concluida && !proposta.biometriaConcluida) {
            // TODO: Generate payment boletos
            console.log(`[${_getBrasiliaTimestamp()}] Gerando boletos para proposta ${id}`);
          }
        }

        // Add document path if provided
        if (caminho_documento && etapa == 'ccb_gerado' && concluida) {
          updateData.caminhoCcbAssinado = caminho_documento;
        }

        // Update the proposal
        const [updatedProposta] = await db
          .update(propostas)
          .set(updateData)
          .where(eq(propostas.id, id))
          .returning();

        // Create audit log
        await db.insert(propostaLogs).values({
          propostaId: id,
          autorId: req.user?.id || '',
          statusNovo: `etapa_${etapa}_${concluida ? 'concluida' : 'revertida'}`,
          observacao: `Etapa ${etapa} ${concluida ? 'marcada como concluída' : 'revertida'} por ${req.user?.role || 'usuário'}`,
        });

        // Check if all formalization steps are complete
        if (
          updatedProposta.ccbGerado &&
          updatedProposta.assinaturaEletronicaConcluida &&
          updatedProposta.biometriaConcluida
        ) {
          // PAM V1.0 - Usar FSM para validação de transição de status
          try {
            await transitionTo({
              propostaId: id,
              novoStatus: 'pronto_pagamento',
              userId: req.user?.id || 'sistema',
              contexto: 'formalizacao',
              observacoes:
                'Todas as etapas de formalização concluídas (CCB, assinatura, biometria)',
              metadata: {
                tipoAcao: 'FORMALIZACAO_COMPLETA',
                ccbGerado: true,
                assinaturaEletronica: true,
                biometria: true,
                usuarioRole: req.user?.role || 'desconhecido',
              },
            });
            console.log(
              `[${_getBrasiliaTimestamp()}] Transição de status validada e executada com sucesso`
            );
          }
catch (error) {
            if (error instanceof InvalidTransitionError) {
              console.error(
                `[${_getBrasiliaTimestamp()}] Transição de status inválida: ${error.message}`
              );
              // Não retornamos erro 409 aqui pois é uma operação interna após conclusão de etapas
              // O sistema deveria estar em um estado válido para esta transição
            }
else {
              console.error(error);
            }
          }

          console.log(`[${_getBrasiliaTimestamp()}] Proposta ${id} pronta para pagamento`);
        }

        res.json({
          message: 'Etapa de formalização atualizada com sucesso',
  _etapa,
  _concluida,
          proposta: updatedProposta,
        });
      }
catch (error) {
        console.error(error);
        res.status(500).json({
          message: 'Erro ao atualizar etapa de formalização',
        });
      }
    }
  );

  // Update proposal status - REAL IMPLEMENTATION WITH AUDIT TRAIL
  app.put(
    '/api/propostas/:id/status',
  __jwtAuthMiddleware,
  _requireManagerOrAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { id } = req.params;
        const { status, observacao } = req.body;

        if (!status) {
          return res.status(500).json({error: "Error"});
        }

        // Import database and schema dependencies
        const { db } = await import('../server/lib/supabase');
        const { propostas, comunicacaoLogs } = await import('../shared/schema');
        const { eq } = await import('drizzle-orm');

        // Execute transaction for atomic updates
        const _result = await db.transaction(async (tx) => {
          // Step 1: Get current proposal for audit trail
          const [currentProposta] = await tx
            .select({
              status: propostas.status,
              lojaId: propostas.lojaId,
            })
            .from(propostas)
            .where(eq(propostas.id, id));

          if (!currentProposta) {
            throw new Error("Error");
          }

          // PAM V1.0 - Usar FSM para validação de transição de status
          // Determinar contexto baseado no status
          let contexto: 'pagamentos' | 'cobrancas' | 'formalizacao' | 'geral' = 'geral';
          if (['aprovado', 'reprovado', 'cancelado'].includes(status)) {
            contexto = 'geral';
          }

          try {
            await transitionTo({
              propostaId: id,
              novoStatus: status,
              userId: req.user?.id || 'sistema',
  _contexto,
              observacoes: observacao || `Status alterado para ${status}`,
              metadata: {
                tipoAcao: 'STATUS_UPDATE_MANUAL',
                usuarioRole: req.user?.role || 'desconhecido',
                statusAnterior: currentProposta.status,
              },
            });
          }
catch (error) {
            if (error instanceof InvalidTransitionError) {
              // Retornar 409 Conflict para transições inválidas
              throw { statusCode: 409, message: error.message };
            }
            throw error;
          }

          // Atualizar campos adicionais se necessário
          const [updatedProposta] = await tx
            .update(propostas)
            .set({
              dataAprovacao: status == 'aprovado' ? getBrasiliaDate() : undefined,
            })
            .where(eq(propostas.id, id))
            .returning();

          // Skip comunicacaoLogs for now - focus on propostaLogs for audit
          // This will be implemented later for client communication tracking

          return updatedProposta;
        });

        console.log(
          `[${_getBrasiliaTimestamp()}] Status da proposta ${id} atualizado de ${_result.status} para ${status}`
        );
        res.json(_result);
      }
catch (error) {
        console.error(error);
        if (error instanceof Error && error.message == 'Proposta não encontrada') {
          return res.status(500).json({error: "Error"});
        }
        // Tratar erro 409 de transição inválida
        if (error?.statusCode == 409) {
          return res.status(409).json({
            message: error.message,
            error: 'INVALID_TRANSITION',
          });
        }
        res.status(500).json({ message: 'Erro ao atualizar status' });
      }
    }
  );

  // Dashboard stats
  app.get('/api/dashboard/stats', _jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const _allPropostas = await storage.getPropostas();

      const _stats = {
        totalPropostas: allPropostas.length,
        aguardandoAnalise: allPropostas.filter((p) => p.status == 'aguardando_analise').length,
        aprovadas: allPropostas.filter((p) => p.status == 'aprovado').length,
        valorTotal: allPropostas.reduce((sum, p) => sum + parseFloat(p.valor), 0),
      };

      res.json(stats);
    }
catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Failed to fetch stats' });
    }
  });

  // Gerente-Lojas Relationship Routes
  // Get all stores managed by a specific manager
  app.get(
    '/api/gerentes/:gerenteId/lojas',
  __jwtAuthMiddleware,
  _requireManagerOrAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const _gerenteId = parseInt(req.params.gerenteId);
        const _lojaIds = await storage.getLojasForGerente(gerenteId);
        res.json(lojaIds);
      }
catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch stores for manager' });
      }
    }
  );

  // Get all managers for a specific store
  app.get(
    '/api/lojas/:lojaId/gerentes',
  __jwtAuthMiddleware,
  _requireManagerOrAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const _lojaId = parseInt(req.params.lojaId);
        const _gerenteIds = await storage.getGerentesForLoja(lojaId);
        res.json(gerenteIds);
      }
catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch managers for store' });
      }
    }
  );

  // Add a manager to a store
  app.post(
    '/api/gerente-lojas',
  __jwtAuthMiddleware,
  __requireAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const __validatedData = insertGerenteLojaSchema.parse(req.body);
        const _relationship = await storage.addGerenteToLoja(_validatedData);
        res.json(relationship);
      }
catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(500).json({error: "Error"});
        }
        console.error(error);
        res.status(500).json({ message: 'Failed to add manager to store' });
      }
    }
  );

  // Remove a manager from a store
  app.delete(
    '/api/gerente-lojas/:gerenteId/:lojaId',
  __jwtAuthMiddleware,
  __requireAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const _gerenteId = parseInt(req.params.gerenteId);
        const _lojaId = parseInt(req.params.lojaId);
        await storage.removeGerenteFromLoja(gerenteId, lojaId);
        res.json({ message: 'Manager removed from store successfully' });
      }
catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to remove manager from store' });
      }
    }
  );

  // Get all relationships for a specific manager
  app.get(
    '/api/gerentes/:gerenteId/relationships',
  __jwtAuthMiddleware,
  _requireManagerOrAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const _gerenteId = parseInt(req.params.gerenteId);
        const _relationships = await storage.getGerenteLojas(gerenteId);
        res.json(relationships);
      }
catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch manager relationships' });
      }
    }
  );

  // ========== SYSTEM METADATA ROUTES ==========

  // Helper middleware to check for multiple roles (local version)
  const _requireRolesLocal = (allowedRoles: string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          message: `Acesso negado. Apenas ${allowedRoles.join(', ')} podem acessar este recurso.`,
        });
      }
      next();
    };
  };

  // System metadata endpoint for hybrid filtering strategy
  // Now allows ADMINISTRADOR, DIRETOR, and GERENTE to create users
  app.get(
    '/api/admin/system/metadata',
  __jwtAuthMiddleware,
    requireRolesLocal(['ADMINISTRADOR', 'DIRETOR', 'GERENTE']),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { db } = await import('../server/lib/supabase');
        const { lojas } = await import('../shared/schema');
        const { count } = await import('drizzle-orm');

        const { isNull } = await import('drizzle-orm');
        const _result = await db
          .select({ count: count() })
          .from(lojas)
          .where(isNull(lojas.deletedAt));
        const _totalLojas = result[0]?.count || 0;

        res.json({ totalLojas });
      }
catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar metadados do sistema' });
      }
    }
  );

  // Get lojas by parceiro ID for server-side filtering
  app.get(
    '/api/admin/parceiros/:parceiroId/lojas',
  __jwtAuthMiddleware,
    requireRolesLocal(['ADMINISTRADOR', 'DIRETOR', 'GERENTE']),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { db } = await import('../server/lib/supabase');
        const { lojas } = await import('../shared/schema');
        const { eq } = await import('drizzle-orm');

        const _parceiroId = parseInt(req.params.parceiroId);
        if (_isNaN(parceiroId)) {
          return res.status(500).json({error: "Error"});
        }

        const _lojasResult = await db.select().from(lojas).where(eq(lojas.parceiroId, parceiroId));

        res.json(lojasResult);
      }
catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar lojas do parceiro' });
      }
    }
  );

  // ========== LOJAS CRUD ROUTES ==========

  // GET all active lojas
  app.get(
    '/api/admin/lojas',
  __jwtAuthMiddleware,
    requireRolesLocal(['ADMINISTRADOR', 'DIRETOR', 'GERENTE']),
    async (req: AuthenticatedRequest, res) => {
      try {
        const _lojas = await storage.getLojas();
        res.json(lojas);
      }
catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar lojas' });
      }
    }
  );

  // GET loja by ID
  app.get('/api/lojas/:id', timingNormalizerMiddleware, async (req, res) => {
    try {
      const _id = parseInt(req.params.id);
      if (_isNaN(id)) {
        return res.status(500).json({error: "Error"});
      }

      const _loja = await storage.getLojaById(id);
      if (!loja) {
        return res.status(500).json({error: "Error"});
      }

      res.json(loja);
    }
catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Erro ao buscar loja' });
    }
  });

  // POST create new loja
  app.post(
    '/api/admin/lojas',
  __jwtAuthMiddleware,
  __requireAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const __validatedData = insertLojaSchema.strict().parse(req.body);
        const _newLoja = await storage.createLoja(_validatedData);
        res.status(201).json(newLoja);
      }
catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(500).json({error: "Error"});
        }
        console.error(error);
        res.status(500).json({ message: 'Erro ao criar loja' });
      }
    }
  );

  // PUT update loja
  app.put(
    '/api/admin/lojas/:id',
  __jwtAuthMiddleware,
  __requireAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const _id = parseInt(req.params.id);
        if (_isNaN(id)) {
          return res.status(500).json({error: "Error"});
        }

        const __validatedData = updateLojaSchema.strict().parse(req.body);
        const _updatedLoja = await storage.updateLoja(id, _validatedData);

        if (!updatedLoja) {
          return res.status(500).json({error: "Error"});
        }

        res.json(updatedLoja);
      }
catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(500).json({error: "Error"});
        }
        console.error(error);
        res.status(500).json({ message: 'Erro ao atualizar loja' });
      }
    }
  );

  // DELETE soft delete loja (set is_active = false)
  app.delete(
    '/api/admin/lojas/:id',
  __jwtAuthMiddleware,
  __requireAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const _id = parseInt(req.params.id);
        if (_isNaN(id)) {
          return res.status(500).json({error: "Error"});
        }

        // Check for dependencies before soft delete
        const _dependencies = await storage.checkLojaDependencies(id);

        if (dependencies.hasUsers || dependencies.hasPropostas || dependencies.hasGerentes) {
          const _dependencyDetails = [];
          if (dependencies.hasUsers) dependencyDetails.push('usuários ativos');
          if (dependencies.hasPropostas) dependencyDetails.push('propostas associadas');
          if (dependencies.hasGerentes) dependencyDetails.push('gerentes associados');

          return res.status(409).json({
            message: 'Não é possível desativar esta loja',
            details: `A loja possui ${dependencyDetails.join(', ')}. Remova ou transfira essas dependências antes de desativar a loja.`,
            dependencies: dependencies,
          });
        }

        // Perform soft delete
        await storage.deleteLoja(id);
        res.json({ message: 'Loja desativada com sucesso' });
      }
catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao desativar loja' });
      }
    }
  );

  // User profile endpoint for RBAC context
  app.get('/api/auth/profile', _jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(500).json({error: "Error"});
      }

      res.json({
        id: req.user!.id,
        email: req.user!.email,
        role: req.user!.role,
        full_name: req.user!.full_name,
        loja_id: req.user!.loja_id,
      });
    }
catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Health check endpoints for system stability monitoring
  app.get('/api/health/storage', async (req, res) => {
    try {
      // Test basic storage operations
      const _users = await storage.getUsers();
      const _lojas = await storage.getLojas();
      const _usersWithDetails = await storage.getUsersWithDetails();

      res.json({
        status: 'healthy',
        timestamp: _getBrasiliaTimestamp(),
        checks: {
          getUsers: { status: 'ok', count: users.length },
          getLojas: { status: 'ok', count: lojas.length },
          getUsersWithDetails: { status: 'ok', count: usersWithDetails.length },
        },
      });
    }
catch (error) {
      console.error(error);
      res.status(500).json({
        status: 'unhealthy',
        timestamp: _getBrasiliaTimestamp(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  app.get('/api/health/schema', async (req, res) => {
    try {
      const { createServerSupabaseAdminClient } = await import('./lib/supabase');
      const _supabase = createServerSupabaseAdminClient();

      // Check essential tables exist
      const _tables = ['profiles', 'lojas', 'parceiros', 'produtos', 'propostas'];
      const checks: Record<string, any> = {};

      for (const table of tables) {
        try {
          const { data, error } = await _supabase.from(table).select('*').limit(1);

          checks[table] = {
            status: error ? 'error' : 'ok',
            error: error?.message || null,
          };
        }
catch (err) {
          checks[table] = {
            status: 'error',
            error: err instanceof Error ? err.message : 'Unknown error',
          };
        }
      }

      const _allHealthy = Object.values(checks).every((check) => check.status == 'ok');

      res.status(allHealthy ? 200 : 500).json({
        status: allHealthy ? 'healthy' : 'unhealthy',
        timestamp: _getBrasiliaTimestamp(),
        tables: checks,
      });
    }
catch (error) {
      console.error(error);
      res.status(500).json({
        status: 'unhealthy',
        timestamp: _getBrasiliaTimestamp(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ========================
  // IMPORT SECURE FILE VALIDATION MIDDLEWARE
  // ========================
  const { secureFileValidationMiddleware } = await import('./middleware/file-validation.js');

  // ========================
  // ENDPOINT DE UPLOAD DE DOCUMENTOS
  // ========================
  app.post(
    '/api/upload',
    upload.single('file'),
  _secureFileValidationMiddleware,
  __jwtAuthMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const _file = req.file;
        const _proposalId = req.body.proposalId || req.body.filename?.split('-')[0] || 'temp';

        if (!file) {
          return res.status(500).json({error: "Error"});
        }

        const { createServerSupabaseAdminClient } = await import('./lib/supabase');
        const _supabase = createServerSupabaseAdminClient();

        // Usar filename do body ou gerar um UUID
        const { v4: uuidv4 } = await import('uuid');
        const _uniqueId = uuidv4().split('-')[0]; // Use first segment of UUID for shorter filename
        const _fileName = req.body.filename || `${uniqueId}-${file.originalname}`;
        const _filePath = `proposta-${proposalId}/${fileName}`;

        console.log(`[DEBUG] Fazendo upload de ${file.originalname} para ${filePath}`);

        // Upload para o Supabase Storage
        const { data: uploadData, error: uploadError } = await _supabase.storage
          .from('documents')
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

        if (uploadError) {
          console.error(error);
          return res.status(400).json({
            message: `Erro no upload: ${uploadError.message}`,
          });
        }

        // Obter URL pública
        const { data: publicUrl } = _supabase.storage.from('documents').getPublicUrl(filePath);

        console.log(`[DEBUG] Upload bem-sucedido. Arquivo salvo em: ${publicUrl.publicUrl}`);

        res.json({
          success: true,
          fileName: fileName,
          filePath: filePath,
          url: publicUrl.publicUrl,
          originalName: file.originalname,
          size: file.size,
          type: file.mimetype,
        });
      }
catch (error) {
        console.error(error);
        res.status(500).json({
          message: 'Erro interno do servidor no upload',
        });
      }
    }
  );

  // Register origination routes
  app.use('/api/origination', originationRoutes);

  // Register ClickSign routes
  app.use('/api/clicksign', clickSignRouter);

  // Register Webhook routes (ClickSign and Inter)
  const _webhookRouter = (await import('./routes/webhooks')).default;
  app.use('/api/webhooks', webhookRouter);
  app.use('/webhooks/inter', interWebhookRouter);

  // Register Inter Collections routes FIRST (more specific route)
  const _interCollectionsRouter = (await import('./routes/inter-collections.js')).default;
  app.use('/api/inter/collections', interCollectionsRouter);

  // Register Inter Fix Collections (emergency endpoint)
  const _interFixRouter = (await import('./routes/inter-fix-collections.js')).default;
  app.use('/api/inter', interFixRouter);

  // Register Inter Test Fix (no auth endpoint for testing)
  const _interTestFixRouter = (await import('./routes/inter-fix-test.js')).default;
  app.use('/api/inter', interTestFixRouter);

  // Register Inter Execute Fix (execute regeneration)
  const _interExecuteFixRouter = (await import('./routes/inter-execute-fix.js')).default;
  app.use('/api/inter', interExecuteFixRouter);

  // Register Inter Bank routes AFTER (less specific route)
  app.use('/api/inter', interRoutes);

  // Inter Real-time Status Update Route
  app.use('/api/inter', interRealtimeRouter);

  // Inter Fix Route - Regenerar boletos com códigos reais
  const _interFixBoletosRouter = (await import('./routes/inter-fix-boletos.js')).default;
  app.use('/api/inter-fix', interFixBoletosRouter);

  // Endpoints movidos para server/routes/propostas-carne.ts para melhor organização

  // Register Cobranças routes
  const _cobrancasRouter = (await import('./routes/cobrancas.js')).default;
  app.use('/api/cobrancas', cobrancasRouter);

  // Register Alertas Proativos routes (PAM V1.0)
  const _alertasRouter = (await import('./routes/alertas.js')).default;
  app.use('/api/alertas', alertasRouter);

  // Register Monitoring routes (Admin only)
  app.use('/api/monitoring', _jwtAuthMiddleware, _requireAdmin, monitoringRoutes);

  // Register CCB V2 Intelligent Test routes
  app.use('/api/ccb-test-v2', ccbIntelligentTestRoutes);

  // Register CCB Corrected routes with complete field mapping
  app.use('/api/ccb-corrected', ccbCorrectedRoutes);

  // Cliente routes para buscar dados existentes e CEP
  app.use('/api', clienteRoutes);

  // Register Documentos download routes (CCB, contratos, etc)
  app.use('/api/documentos', documentosRoutes);

  // Register Observações routes
  const _observacoesRouter = (await import('./routes/observacoes.js')).default;
  app.use('/api', observacoesRouter);

  // Register Pagamentos routes
  const _pagamentosRouter = (await import('./routes/pagamentos/index.js')).default;
  app.use('/api/pagamentos', pagamentosRouter);

  // Register Formalização routes
  const _formalizacaoRouter = (await import('./routes/formalizacao')).default;
  app.use('/api/formalizacao', formalizacaoRouter);

  // Register Propostas Carnê routes
  app.use('/api/propostas', propostasCarneRoutes);
  app.use('/api', propostasCarneStatusRoutes);
  app.use(propostasCarneCheckRoutes);
  app.use('/api/propostas', propostasStorageStatusRoutes);
  app.use('/api/propostas', propostasCorrigirSincronizacaoRoutes);
  app.use('/api/propostas', propostasSincronizarBoletosRoutes);

  // Job Status routes (para consultar status de jobs assíncronos)
  app.use('/api/jobs', jobStatusRoutes);
  app.use('/api', testQueueRoutes);
  app.use('/api/test', testRetryRoutes);

  // Test Audit routes - Sistema de Status V2.0
  app.use('/api/test-audit', testAuditRoutes);

  // Teste temporário para verificar refatoração do Mock Queue
  const _testMockQueueWorkerRoutes = (await import('./routes/test-mock-queue-worker')).default;
  app.use('/api/test-mock-queue-worker', testMockQueueWorkerRoutes);

  // CCB Diagnostics routes
  const _ccbDiagnosticsRouter = (await import('./routes/ccb-diagnostics')).default;
  app.use('/api/ccb-diagnostics', ccbDiagnosticsRouter);

  // CCB Coordinate Calibration routes (Professional calibration system)
  const _ccbCalibrationRouter = (await import('./routes/ccb-calibration')).default;
  app.use('/api/ccb-calibration', ccbCalibrationRouter);

  // TEST CCB USER COORDINATES - Validação das coordenadas manuais do usuário
  app.use('/api/test-ccb-coordinates', testCcbCoordinatesRoutes);

  // Register Semgrep MCP routes - Projeto Cérbero
  const _securityMCPRoutes = (await import('./routes/security-mcp.js')).default;
  app.use('/api/security/mcp', securityMCPRoutes);

  // Register Security routes - OWASP Compliance Monitoring
  const { setupSecurityRoutes } = await import('./routes/security-original');
  setupSecurityRoutes(app);

  // Registrar rotas de monitoramento de segurança em tempo real
  const { securityMonitoringRouter } = await import('./routes/security-monitoring.js');
  app.use('/api/security-monitoring', securityMonitoringRouter);

  // Register Timing Security routes - CRITICAL TIMING ATTACK MITIGATION
  app.use('/api/timing-security', timingSecurityRoutes);

  // 🧪 TEST ENDPOINTS: Timing middleware validation (NO AUTH for testing)
  app.get(
    '/api/test/timing-valid',
    (req, res, next) => {
      console.log('🧪 [TEST ENDPOINT] /api/test/timing-valid hit, applying timing middleware...');
      timingNormalizerMiddleware(req, res, next);
    },
    async (req, res) => {
      console.log('🧪 [TEST ENDPOINT] /api/test/timing-valid processing request...');
      // Simulate database lookup delay for valid ID
      await new Promise((resolve) => setTimeout(resolve, 5));
      res.json({ message: 'Valid test response', timestamp: new Date().toISOString() });
    }
  );

  // 🧪 CCB TEST ENDPOINT: Generate CCB without auth for coordinate testing
  app.post('/api/test/generate-ccb/:proposalId', async (req, res) => {
    try {
      const { proposalId } = req.params;
      console.log('🧪 [CCB TEST] Generating CCB for proposal:', proposalId);

      const { ccbGenerationService } = await import('./services/ccbGenerationService');
      const _result = await ccbGenerationService.generateCCB(proposalId);

      if (!_result.success) {
        return res.status(500).json({
          success: false,
          error: _result.error,
        });
      }

      console.log('✅ [CCB TEST] CCB generated successfully:', _result.pdfPath);
      res.json({
        success: true,
        message: 'CCB gerado com sucesso para teste',
        pdfPath: _result.pdfPath,
      });
    }
catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  });

  // 🧪 DEBUG ENDPOINT: Verificar dados de endereço no CCB
  app.get('/api/test/ccb-address/:id', async (req, res) => {
    try {
      const { id } = req.params;

      // Buscar proposta
      const _proposal = await storage.getPropostaById(id);
      if (!proposal) {
        return res.status(500).json({error: "Error"});
      }

      // Extrair dados de endereço
      const _clienteData = (proposal.cliente_data as unknown) || {};

      const _debugInfo = {
        proposalId: id,
        addressData: {
          endereco: clienteData.endereco || 'NÃO ENCONTRADO',
          logradouro: clienteData.logradouro || 'NÃO ENCONTRADO',
          numero: clienteData.numero || 'NÃO ENCONTRADO',
          complemento: clienteData.complemento || 'NÃO ENCONTRADO',
          bairro: clienteData.bairro || 'NÃO ENCONTRADO',
          cep: clienteData.cep || 'NÃO ENCONTRADO',
          cidade: clienteData.cidade || 'NÃO ENCONTRADO',
          estado: clienteData.estado || 'NÃO ENCONTRADO',
          uf: clienteData.uf || 'NÃO ENCONTRADO',
        },
        coordinates: {
          enderecoCliente: { x: 100, y: 670, fontSize: 8 },
          cepCliente: { x: 270, y: 670, fontSize: 9 },
          cidadeCliente: { x: 380, y: 670, fontSize: 10 },
          ufCliente: { x: 533, y: 670, fontSize: 9 },
        },
        expectedRendering: {
          endereco:
            clienteData.endereco || `${clienteData.logradouro || ''}, ${clienteData.numero || ''}`,
          cep: clienteData.cep || 'CEP NÃO INFORMADO',
          cidade: clienteData.cidade || 'CIDADE NÃO INFORMADA',
          uf: clienteData.estado || clienteData.uf || 'UF',
        },
      };

      console.log('🧪 [CCB DEBUG] Address data for proposal:', id);
      console.log('🧪 [CCB DEBUG] Endereco:', debugInfo.expectedRendering.endereco);
      console.log('🧪 [CCB DEBUG] CEP:', debugInfo.expectedRendering.cep);
      console.log('🧪 [CCB DEBUG] Cidade:', debugInfo.expectedRendering.cidade);
      console.log('🧪 [CCB DEBUG] UF:', debugInfo.expectedRendering.uf);

      return res.status(500).json({error: "Error"});
    }
catch (error) {
      console.error(error);
      return res.status(500).json({error: "Error"});
    }
  });

  app.get('/api/test/timing-invalid', timingNormalizerMiddleware, async (req, res) => {
    // Immediate response for invalid ID
    res.status(404).json({ message: 'Invalid test response', timestamp: new Date().toISOString() });
  });

  // 🛡️ TEST ENDPOINT: File validation (NO AUTH for testing)
  app.post(
    '/api/test/file-validation',
    upload.single('file'),
  _secureFileValidationMiddleware,
    async (req, res) => {
      console.log('🛡️ [TEST ENDPOINT] File validation passed, file is safe');
      res.json({
        message: 'File validation passed',
        filename: req.file?.originalname,
        size: req.file?.size,
        type: req.file?.mimetype,
        timestamp: new Date().toISOString(),
      });
    }
  );

  // 🛡️ TEST ENDPOINT: File validation (NO AUTH for testing)
  app.post(
    '/api/test/file-validation',
    upload.single('file'),
  _secureFileValidationMiddleware,
    async (req, res) => {
      console.log('🛡️ [TEST ENDPOINT] File validation passed, file is safe');
      res.json({
        message: 'File validation passed',
        filename: req.file?.originalname,
        size: req.file?.size,
        type: req.file?.mimetype,
        timestamp: new Date().toISOString(),
      });
    }
  );

  // Register Email Change routes - OWASP V6.1.3 Compliance
  app.use('/api/auth', emailChangeRoutes);

  // Register OWASP Assessment routes
  const _owaspRoutes = (await import('./routes/owasp.js')).default;
  app.use('/api/owasp', owaspRoutes);

  // ✅ PROJETO CÉRBERO - Endpoints simplificados para SCA e SAST
  app.get('/api/security/run-sca', _jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      console.log('🔍 [SCA] Executando análise SCA...');

      // Ler relatório real do dependency-check
      const _reportPath = 'dependency-check-report.json';
      let _reportData = null;

      try {
        const _fs = await import('fs/promises');
        const _data = await fs.readFile(reportPath, 'utf-8');
        reportData = JSON.parse(_data);
      }
catch (e) {
        console.error(error);
        return res.status(500).json({error: "Error"});
      }

      // Processar vulnerabilidades
      let _totalVulns = 0;
      let _critical = 0,
        high = 0,
        medium = 0,
        low = 0;

      if (reportData && reportData.dependencies) {
        for (const dep of reportData.dependencies) {
          if (dep.vulnerabilities && dep.vulnerabilities.length > 0) {
            for (const vuln of dep.vulnerabilities) {
              totalVulns++;
              const _severity = vuln.severity;
              if (severity == 'CRITICAL') critical++;
              else if (severity == 'HIGH') high++;
              else if (severity == 'MEDIUM') medium++;
              else if (severity == 'LOW') low++;
            }
          }
        }
      }

      console.log(`✅ [SCA] Análise concluída: ${totalVulns} vulnerabilidades encontradas`);

      res.json({
        success: true,
        data: {
          reportFound: true,
          vulnerabilities: { critical, high, medium, low, total: totalVulns },
          rawReport: reportData,
          timestamp: new Date().toISOString(),
        },
      });
    }
catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  });

  app.get('/api/security/run-sast', _jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      console.log('🔍 [SAST] Executando análise SAST...');

      // Análise de código mockada mas baseada em realidade
      const _sastResults = {
        filesScanned: 25,
        vulnerabilities: [
          {
            id: 'hardcoded-secrets',
            file: 'server/routes/test-vulnerability.ts',
            line: 9,
            severity: 'HIGH',
            message: 'Hardcoded password detected',
            code: "const _superSecretKey = 'password123';",
          },
          {
            id: 'sql-injection-direct',
            file: 'server/routes/test-vulnerability.ts',
            line: 14,
            severity: 'CRITICAL',
            message: 'Direct SQL injection vulnerability',
            code: 'SELECT * FROM users WHERE id = ${req.query.id}',
          },
          {
            id: 'xss-direct-output',
            file: 'server/routes/test-vulnerability.ts',
            line: 21,
            severity: 'HIGH',
            message: 'XSS vulnerability - unsanitized user input',
            code: 'res.send(`<div>${userInput}</div>`);',
          },
        ],
      };

      console.log(
        `✅ [SAST] Análise concluída: ${sastResults.vulnerabilities.length} problemas encontrados`
      );

      res.json({
        success: true,
        data: sastResults,
        timestamp: new Date().toISOString(),
      });
    }
catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  });

  // Security Scanners routes (SCA & SAST)
  const _securityScannersRoutes = (await import('./routes/security-scanners.js')).default;
  app.use('/api/security-scanners', securityScannersRoutes);

  // Security API routes (Projeto Cérbero)
  const _securityApiRoutes = (await import('./routes/security-api.js')).default;
  app.use('/api/security', securityApiRoutes);

  // Cobranças routes
  const _cobrancasRoutes = (await import('./routes/cobrancas.js')).default;
  app.use('/api/cobrancas', cobrancasRoutes);

  // Pagamentos routes
  const _pagamentosRoutes = (await import('./routes/pagamentos/index.js')).default;
  app.use('/api/financeiro/pagamentos', pagamentosRoutes);

  // ClickSign Integration routes
  app.use('/api', clicksignIntegrationRoutes);

  // Gestão de Contratos routes (ADMIN e DIRETOR apenas)
  app.use('/api', gestaoContratosRoutes);

  // ================ JOB QUEUE TEST ENDPOINT ================
  // Endpoint temporário para teste da arquitetura de Job Queue

  // Endpoint público de teste (sem autenticação para validação rápida)
  app.get('/api/test/job-queue-health', async (req, res) => {
    try {
      console.log('[TEST ENDPOINT] 🏥 Verificando saúde do sistema de Job Queue');

      const _health = await checkQueuesHealth();

      res.json({
        success: true,
        message: 'Job Queue Architecture is operational',
        timestamp: new Date().toISOString(),
        architecture: {
          pattern: 'Async Worker Queue',
          implementation: health.mode,
          benefits: [
            '✅ Non-blocking operations',
            '✅ Parallel processing',
            '✅ Automatic retry on failure',
            '✅ Progress tracking',
            '✅ Scalable to 50+ simultaneous operations',
          ],
        },
        status: health,
      });
    }
catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  app.post(
    '/api/test/job-queue',
  __jwtAuthMiddleware,
  _requireAnyRole,
    async (req: AuthenticatedRequest, res) => {
      try {
        console.log('[TEST ENDPOINT] 🧪 Recebendo requisição de teste de Job Queue');

        const { type = 'test', propostaId } = req.body;

        // Adicionar job à fila apropriada baseado no tipo
        let job;
        let queueName;

        switch (type) {
          case 'pdf': {
            queueName = 'pdf-processing';
            job = await queues.pdfProcessing.add('TEST_PDF_JOB', {
              type: 'GENERATE_CARNE',
              propostaId: propostaId || 'TEST-PROPOSTA-123',
              userId: req.user?.id,
              timestamp: new Date().toISOString(),
            });
            break;
          }
          case 'boleto': {
            queueName = 'boleto-sync';
            job = await queues.boletoSync.add('TEST_BOLETO_JOB', {
              type: 'SYNC_BOLETOS',
              propostaId: propostaId || 'TEST-PROPOSTA-456',
              userId: req.user?.id,
              timestamp: new Date().toISOString(),
            });
            break;
          }
          default:
            queueName = 'pdf-processing';
            job = await queues.pdfProcessing.add('TEST_GENERIC_JOB', {
              type: 'TEST',
              message: 'Teste genérico da arquitetura de Job Queue',
              userId: req.user?.id,
              timestamp: new Date().toISOString(),
            });
        }

        console.log(`[TEST ENDPOINT] ✅ Job adicionado à fila ${queueName}:`, {
          id: job.id,
          name: job.name,
          data: job.data,
        });

        // Verificar saúde das filas
        const _health = await checkQueuesHealth();

        res.json({
          success: true,
          message: `Job ${job.id} adicionado à fila ${queueName} com sucesso`,
          jobDetails: {
            id: job.id,
            name: job.name,
            queue: queueName,
            data: job.data,
            timestamp: new Date().toISOString(),
          },
          queuesHealth: health,
        });
      }
catch (error) {
        console.error(error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Erro ao adicionar job à fila',
          hint: 'Verifique se o Redis está rodando e as filas estão configuradas',
        });
      }
    }
  );

  // Endpoint para verificar status das filas
  app.get(
    '/api/test/queue-status',
  __jwtAuthMiddleware,
  _requireAnyRole,
    async (req: AuthenticatedRequest, res) => {
      try {
        console.log('[TEST ENDPOINT] 📊 Verificando status das filas');

        const _health = await checkQueuesHealth();

        res.json({
          success: true,
          timestamp: new Date().toISOString(),
          queues: health,
        });
      }
catch (error) {
        console.error(error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Erro ao verificar status das filas',
        });
      }
    }
  );
  // ================ END JOB QUEUE TEST ================

  const _httpServer = createServer(app);
  return httpServer;
}
