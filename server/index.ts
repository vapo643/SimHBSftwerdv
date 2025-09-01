import { createApp } from './app';
import { setupVite, serveStatic, log } from './vite';
import { config, logConfigStatus, isAppOperational } from './lib/config';
import { registerRoutes } from './routes';

(async () => {
  const app = await createApp();

  // Register routes and get server instance
  const server = await registerRoutes(app);

  // Setup Security WebSocket
  const { setupSecurityWebSocket } = await import('./lib/security-websocket');
  const securityWS = setupSecurityWebSocket(server);
  log('🔐 Security WebSocket initialized');

  // Initialize refactored CCB Sync Service (now as fallback polling)
  const { ccbSyncService } = await import('./services/ccbSyncServiceRefactored');
  ccbSyncService.startAutoSync(6); // Poll every 6 hours as safety net
  log('🔄 CCB Sync Service initialized - Webhook primary, polling fallback every 6 hours');

  // Initialize Formalization Worker for async event processing
  const { FormalizationWorker } = await import('./workers/formalizationWorker');
  const formalizationWorker = new FormalizationWorker();
  await formalizationWorker.start();
  log('⚡ Formalization Worker initialized - Processing async events');

  // PERF-BOOST-003: Lazy initialization of workers to reduce startup time
  // Workers will be initialized on-demand when first job is processed
  log('🎯 Specialized queue workers configured for lazy initialization');
  log('   - Workers will start when first job is processed (on-demand)');

  // Initialize Sistema de Alertas Proativos (PAM V1.0)
  const { alertasProativosService } = await import('./services/alertasProativosService');

  // Configurar execução diária às 7h da manhã (Brasília)
  const horaExecucao = 7; // 7h da manhã
  const agora = new Date();
  const proximaExecucao = new Date();
  proximaExecucao.setHours(horaExecucao, 0, 0, 0);

  // Se já passou das 7h hoje, agendar para amanhã
  if (proximaExecucao <= agora) {
    proximaExecucao.setDate(proximaExecucao.getDate() + 1);
  }

  const tempoAteProximaExecucao = proximaExecucao.getTime() - agora.getTime();

  // Agendar primeira execução
  setTimeout(() => {
    alertasProativosService.executarVerificacaoDiaria();

    // Agendar execuções diárias subsequentes
    setInterval(
      () => {
        alertasProativosService.executarVerificacaoDiaria();
      },
      24 * 60 * 60 * 1000
    ); // 24 horas
  }, tempoAteProximaExecucao);

  log(
    `🔔 Sistema de Alertas Proativos inicializado - Próxima execução: ${proximaExecucao.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
  );

  // Initialize autonomous security scanners
  const { getSecurityScanner } = await import('./lib/autonomous-security-scanner');
  const { getVulnerabilityDetector } = await import('./lib/vulnerability-detector');
  const { getDependencyScanner } = await import('./lib/dependency-scanner');
  const { getSemgrepScanner } = await import('./lib/semgrep-scanner');

  // Start security monitoring if configured
  if (process.env.ENABLE_SECURITY_MONITORING === 'true') {
    log('🚀 Starting autonomous security monitoring...');

    const scanner = getSecurityScanner();
    if (scanner) {
      scanner.start();
    }

    const vulnDetector = getVulnerabilityDetector();
    // VulnerabilityDetector does not have start method - scanner is event-driven

    const depScanner = getDependencyScanner();
    depScanner.start();

    const semgrepScanner = getSemgrepScanner();
    semgrepScanner.start();

    log('✅ All security scanners started');
  } else {
    log('ℹ️  Security monitoring disabled. Set ENABLE_SECURITY_MONITORING=true to enable');
  }

  // Setup Vite or static serving based on environment
  if (app.get('env') === 'development') {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Log status before starting
  logConfigStatus();

  // Check if app can operate (graceful mode)
  if (!isAppOperational()) {
    log('⚠️  App starting in degraded mode: Some features may be limited');
    log('ℹ️  Configure DATABASE_URL in Secrets to enable full functionality');
  }

  // Initialize storage bucket on startup
  async function initializeStorage() {
    try {
      const { createServerSupabaseAdminClient } = await import('./lib/supabase');
      const supabase = createServerSupabaseAdminClient();

      log('📦 Checking storage buckets...');

      // Check existing buckets
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();

      if (listError) {
        log('⚠️ Could not list buckets:', listError.message);
        return;
      }

      const documentsExists = buckets.some((bucket) => bucket.name === 'documents');

      if (documentsExists) {
        // Check if it's public or private
        const documentsBucket = buckets.find((bucket) => bucket.name === 'documents');
        if (documentsBucket && documentsBucket.public === true) {
          log('⚠️ Storage bucket "documents" exists but is PUBLIC. Need to recreate as PRIVATE.');

          // Delete the public bucket
          log('🗑️ Deleting public bucket...');
          const { error: deleteError } = await supabase.storage.deleteBucket('documents');
          if (deleteError) {
            log('❌ Could not delete bucket:', deleteError.message);
            return;
          }
          log('✅ Public bucket deleted.');
        } else {
          log('✅ Storage bucket "documents" already exists as PRIVATE');
          return;
        }
      }

      // Delete existing public bucket if it exists (to recreate as private)
      if (documentsExists) {
        log('🗑️ Deleting existing public bucket to recreate as private...');
        const { error: deleteError } = await supabase.storage.deleteBucket('documents');
        if (deleteError) {
          log('⚠️ Could not delete bucket:', deleteError.message);
        }
      }

      // Create documents bucket AS PRIVATE
      log('🔨 Creating PRIVATE storage bucket "documents"...');
      const { data: bucket, error: createError } = await supabase.storage.createBucket(
        'documents',
        {
          public: false, // PRIVATE bucket for security
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
        log('❌ Failed to create bucket:', createError.message);
        return;
      }

      log('✅ Storage bucket "documents" created successfully!');
    } catch (error) {
      log(
        '⚠️ Storage initialization error:',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // =============== PERF-BOOST-003 - OPTIMIZED GRACEFUL SHUTDOWN ===============
  // Simplified graceful shutdown handler (workers are lazy-loaded)
  process.on('SIGTERM', async () => {
    console.log('[SERVER] 🛑 SIGTERM received, closing workers...');
    
    try {
      console.log('[SERVER] ℹ️  Specialized workers use lazy initialization (no cleanup needed)');
      
      // Close formalization worker if it exists
      if (formalizationWorker) {
        console.log('[SERVER] 📡 Closing formalization worker...');
        await formalizationWorker.stop();
        console.log('[SERVER] ✅ Formalization worker closed gracefully');
      }
      
    } catch (error) {
      console.error('[SERVER] ❌ Error during graceful shutdown:', error instanceof Error ? error.message : String(error));
    }
    
    console.log('[SERVER] 🏁 Graceful shutdown complete');
    process.exit(0);
  });

  // Start server on configured port
  server.listen(
    {
      port: config.port,
      host: '0.0.0.0',
      reusePort: true,
    },
    async () => {
      log(`🚀 Server running on port ${config.port}`);
      log(`🌍 Environment: ${config.nodeEnv}`);

      // Initialize storage bucket
      await initializeStorage();
    }
  );
})();
