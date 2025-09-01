import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  plugins: [],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // ADICIONADO: Configuração específica para Redis Manager em testes
    env: {
      NODE_ENV: 'test',
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
    },
    // ADICIONADO: Timeout aumentado para permitir Redis Manager mock setup
    testTimeout: 10000,
    // ADICIONADO: Configuração para cleanup adequado do Redis Manager
    teardownTimeout: 5000,
  },
});
