/**
 * Vitest Test Environment Setup
 * PAM V1.0 - Isolated Test Database Configuration
 * 
 * This setup file configures the test environment to use a dedicated
 * test database, completely isolated from development and production.
 * 
 * @file tests/setup.ts
 * @created 2025-08-20
 */

import { config } from 'dotenv';
import path from 'path';

// Load test-specific environment variables from .env.test
config({ path: path.resolve(process.cwd(), '.env.test') });

// CRITICAL: Map TEST_DATABASE_URL to DATABASE_URL for compatibility
// This allows existing database connection code to work with the test database
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  console.log('[TEST SETUP] ✅ Using isolated test database from TEST_DATABASE_URL');
} else {
  console.warn('[TEST SETUP] ⚠️ TEST_DATABASE_URL not found in .env.test');
  console.warn('[TEST SETUP] ⚠️ Please configure a dedicated test database in .env.test');
}

// Ensure we're in test environment
process.env.NODE_ENV = 'test';

console.log('[TEST SETUP] 🔧 Test environment configured:');
console.log(`[TEST SETUP]   - NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`[TEST SETUP]   - Database: ${process.env.DATABASE_URL?.includes('test') ? '✅ Test DB' : '⚠️ Check configuration'}`);