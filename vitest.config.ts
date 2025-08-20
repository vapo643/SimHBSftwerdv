/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  // ====================================
  // FUNDAÇÃO DE TESTES AUTOMATIZADOS (Pilar 17)
  // ====================================
  test: {
    globals: true,
    // CORREÇÃO CRÍTICA: Node environment para testes backend/integração
    environment: "node", 
    setupFiles: ["./tests/setup.ts"],
    include: ["./tests/**/*.{test,spec}.{js,ts,tsx}"],
    // Configurações específicas para corrigir esbuild/TextEncoder
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      }
    },
    coverage: {
      provider: "v8", 
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "dist/", "tests/setup.ts", "**/*.d.ts", "**/*.config.*"],
    },
  },
});
