/**
 * CONFIGURAÇÃO DE TESTES (Pilar 17)
 * 
 * Setup global para todos os testes do projeto
 */

import { beforeAll, afterEach, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Configurar environment variables para testes
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
  process.env.SUPABASE_URL = 'https://test-project.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsImlhdCI6MTYwMzI2ODgwMCwiZXhwIjoxOTE4ODQ0ODAwfQ.test-key-for-testing-purposes-only-very-long-key-string';
});

// Limpar após cada teste
afterEach(() => {
  cleanup();
});

// Global teardown
afterAll(() => {
  // Cleanup global mocks or resources if needed
});

// Mock do localStorage para testes
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  },
  writable: true,
});

// Mock do matchMedia para testes
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock do ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock do IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  root = null;
  rootMargin = '0px';
  thresholds = [0];
  
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
};