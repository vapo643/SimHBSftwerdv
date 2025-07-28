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

  // Start server on configured port
  server.listen(
    {
      port: config.port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`🚀 Server running on port ${config.port}`);
      log(`🌍 Environment: ${config.nodeEnv}`);
    }
  );
})();