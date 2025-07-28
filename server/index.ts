import { createApp } from "./app";
import { setupVite, serveStatic, log } from "./vite";
import { config, logConfigStatus, isAppOperational } from "./lib/config";
import { registerRoutes } from "./routes";

(async () => {
  const app = await createApp();
  
  // Register routes and get server instance
  const server = await registerRoutes(app);

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
      
      const documentsExists = buckets.some(bucket => bucket.name === 'documents');
      
      if (documentsExists) {
        log('✅ Storage bucket "documents" already exists');
        return;
      }
      
      // Create documents bucket
      log('🔨 Creating storage bucket "documents"...');
      const { data: bucket, error: createError } = await supabase.storage.createBucket('documents', {
        public: true,
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
      
    } catch (error) {
      log('⚠️ Storage initialization error:', error instanceof Error ? error.message : 'Unknown error');
    }
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
      
      // Initialize storage bucket
      await initializeStorage();
    }
  );
})();