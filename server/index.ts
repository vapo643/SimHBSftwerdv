import { createApp } from "./app";
import { setupVite, serveStatic, log } from "./vite";
import { config, logConfigStatus, isAppOperational } from "./lib/config";
import { registerRoutes } from "./routes";

// Global error handlers to prevent server crashes
process.on('uncaughtException', (error) => {
  console.log('⚠️ [GLOBAL] Uncaught Exception (non-fatal):', error.message);
  console.log('ℹ️ [GLOBAL] Server continues running...');
});

process.on('unhandledRejection', (reason, promise) => {
  console.log('⚠️ [GLOBAL] Unhandled Rejection (non-fatal):', reason);
  console.log('ℹ️ [GLOBAL] Server continues running...');
});

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

  // Initialize autonomous security scanners
  const { getSecurityScanner } = await import('./lib/autonomous-security-scanner');
  const { getVulnerabilityDetector } = await import('./lib/vulnerability-detector');
  const { getDependencyScanner } = await import('./lib/dependency-scanner');
  const { getSemgrepScanner } = await import('./lib/semgrep-scanner');
  
  // Start security monitoring if configured
  if (process.env.ENABLE_SECURITY_MONITORING === 'true') {
    log('🚀 Starting autonomous security monitoring...');
    
    const scanner = getSecurityScanner();
    scanner.start();
    
    const vulnDetector = getVulnerabilityDetector();
    vulnDetector.start();
    
    const depScanner = getDependencyScanner();
    depScanner.start();
    
    const semgrepScanner = getSemgrepScanner();
    semgrepScanner.start();
    
    log('✅ All security scanners started');
  } else {
    log('ℹ️  Security monitoring disabled. Set ENABLE_SECURITY_MONITORING=true to enable');
  }

  // Setup Vite or static serving based on environment
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Log status before starting
  logConfigStatus();

  // Check if app can operate (graceful mode)
  if (!isAppOperational()) {
    log("⚠️  App starting in degraded mode: Some features may be limited");
    log("ℹ️  Configure DATABASE_URL in Secrets to enable full functionality");
  }

  // Initialize storage bucket on startup (completely non-blocking)
  async function initializeStorage() {
    // Run in background - don't block server startup
    setTimeout(async () => {
      try {
        log('📦 Checking storage buckets (background task)...');
        const { createServerSupabaseAdminClient } = await import('./lib/supabase');
        const supabase = createServerSupabaseAdminClient();
        
        // Use timeout to prevent hanging
        const storagePromise = supabase.storage.listBuckets();
        const timeoutPromise = new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error('Storage timeout')), 3000)
        );
        
        const result = await Promise.race([storagePromise, timeoutPromise]);
        const { data: buckets, error: listError } = result;
    
        if (listError) {
          log('⚠️ Could not list buckets (background):', listError.message);
          return;
        }
    
        const documentsExists = buckets?.some((bucket: any) => bucket.name === 'documents');
        
        if (documentsExists) {
          // Check if it's public or private
          const documentsBucket = buckets?.find((bucket: any) => bucket.name === 'documents');
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
        
        if (!documentsExists) {
          // Create documents bucket AS PRIVATE
          log('🔨 Creating PRIVATE storage bucket "documents"...');
          const { data: bucket, error: createError } = await supabase.storage.createBucket('documents', {
            public: false, // PRIVATE bucket for security
            fileSizeLimit: 52428800, // 50MB
            allowedMimeTypes: [
              'application/pdf',
              'image/jpeg', 
              'image/jpg',
              'image/png',
              'image/gif'
            ]
          });
          
          if (createError) {
            log('❌ Failed to create bucket:', createError.message);
            return;
          }
          
          log('✅ Storage bucket "documents" created successfully!');
        }
        
      } catch (error) {
        log('⚠️ Storage initialization error (background):', error instanceof Error ? error.message : 'Unknown error');
      }
    }, 500); // Start after 500ms
  }

  // Start server on configured port
  server.listen(
    {
      port: config.port,
      host: "0.0.0.0",
      reusePort: true,
    },
    async () => {
      log(`🚀 Server running on port ${config.port}`);
      log(`🌍 Environment: ${config.nodeEnv}`);
      
      // Initialize storage bucket (completely non-blocking)
      initializeStorage().catch((error) => {
        log('⚠️ Storage initialization failed (non-critical):', error instanceof Error ? error.message : 'Unknown error');
      });
    }
  );
})();