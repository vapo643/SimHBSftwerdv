/**
 * Documents Routes Integration Test
 * PAM V4.0 - Regression prevention for getPropostaDocuments undefined
 * Created: 2025-08-26
 * Purpose: Ensure documents routes are permanently stable
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { type Server } from 'http';
import { registerRoutes } from '../routes';

describe('Documents Routes Integration Test - PAM V4.0', () => {
  let app: express.Application;
  let server: Server;

  beforeAll(async () => {
    // Create test app instance
    app = express();
    server = await registerRoutes(app as unknown); // Type assertion for test compatibility
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('🔍 Regression Prevention Tests', () => {
    it('should confirm getPropostaDocuments function exists and is not undefined', async () => {
      // Import the function directly to verify it's not undefined
      const { getPropostaDocuments } = await import('../routes/documents');

      expect(getPropostaDocuments).toBeDefined();
      expect(typeof getPropostaDocuments).toBe('function');
      expect(getPropostaDocuments.name).toBe('getPropostaDocuments');
    });

    it('should confirm uploadPropostaDocument function exists and is not undefined', async () => {
      const { uploadPropostaDocument } = await import('../routes/documents');

      expect(uploadPropostaDocument).toBeDefined();
      expect(typeof uploadPropostaDocument).toBe('function');
      expect(uploadPropostaDocument.name).toBe('uploadPropostaDocument');
    });

    it('should have clean, readable code structure (not minified)', async () => {
      // Read the documents.ts file and verify it's not corrupted/minified
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile('server/routes/documents.ts', 'utf-8');

      // Verify file has multiple lines (not minified)
      const lines = fileContent.split('\n');
      expect(lines.length).toBeGreaterThan(10);

      // Verify it contains proper documentation
      expect(fileContent).toContain('PAM V4.0 - Fixed corruption from mass refactoring');
      expect(fileContent).toContain('export const getPropostaDocuments');
      expect(fileContent).toContain('export const uploadPropostaDocument');
    });
  });

  describe('🌐 API Endpoint Tests', () => {
    it('should respond to GET /api/propostas/:id/documents with authentication error (not undefined error)', async () => {
      const response = await request(app)
        .get('/api/propostas/123/documents')
        .expect((res) => {
          // Should get authentication error, NOT undefined function error
          expect(res.status).not.toBe(500);
          expect(res.body).not.toContain('undefined');
          expect(res.body).not.toContain('Route.get() requires a callback function');
        });

      // Should get 401 or similar, not 500 crash
      expect([401, 403]).toContain(response.status);
    });

    it('should not crash server when accessing documents endpoint', async () => {
      // This test ensures the server doesn't crash like before
      const healthBefore = await request(app).get('/api/health').expect(200);

      // Try to access documents endpoint
      await request(app).get('/api/propostas/999/documents');

      // Server should still be healthy after
      const healthAfter = await request(app).get('/api/health').expect(200);

      expect(healthBefore.body.status).toBe('ok');
      expect(healthAfter.body.status).toBe('ok');
    });
  });

  describe('📝 Documentation Tests', () => {
    it('should have proper JSDoc comments for all functions', async () => {
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile('server/routes/documents.ts', 'utf-8');

      expect(fileContent).toContain('* GET /api/propostas/:id/documents');
      expect(fileContent).toContain('* POST /api/propostas/:id/documents');
      expect(fileContent).toContain('* Get all documents for a proposal');
      expect(fileContent).toContain('* Upload a document for a proposal');
    });
  });
});
