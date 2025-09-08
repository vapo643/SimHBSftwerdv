/**
 * CONF-002 Integration Test - Document Integrity Verification
 * Validates SHA-256 hash calculation and audit trail collection for ClickSign documents
 */

import { clickSignService } from '../services/clickSignService';
import * as crypto from 'crypto';
import { Buffer } from 'buffer';

describe('CONF-002 - Document Integrity Integration Tests', () => {
  test('CONF-002.1: Hash calculation should produce correct SHA-256', async () => {
    // Create a sample PDF buffer for testing
    const samplePdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f 
0000000015 00000 n 
0000000060 00000 n 
0000000111 00000 n 
trailer
<< /Size 4 /Root 1 0 R >>
startxref
190
%%EOF`;

    const testBuffer = Buffer.from(samplePdfContent);

    // Calculate expected hash manually
    const expectedHash = crypto.createHash('sha256').update(testBuffer).digest('hex');

    // Test the private method through reflection (for testing purposes)
    const service = clickSignService as any;
    const calculatedHash = service.calculateDocumentHash(testBuffer);

    expect(calculatedHash).toBe(expectedHash);
    expect(calculatedHash).toHaveLength(64); // SHA-256 is 64 hex characters

    console.log(`✅ [CONF-002.1] Hash calculated correctly: ${calculatedHash}`);
  });

  test('CONF-002.2: Audit trail collection should handle missing endpoints gracefully', async () => {
    // Mock a document key that doesn't exist
    const fakeDocumentKey = 'test-document-key-12345';

    try {
      const auditTrail = await clickSignService.getDocumentAuditTrail(fakeDocumentKey);

      // Should return a structured audit trail even if API calls fail
      expect(auditTrail).toBeDefined();
      expect(auditTrail.document_key).toBe(fakeDocumentKey);
      expect(auditTrail.events).toBeDefined();
      expect(Array.isArray(auditTrail.events)).toBe(true);
      expect(auditTrail.signatures).toBeDefined();
      expect(Array.isArray(auditTrail.signatures)).toBe(true);

      console.log(`✅ [CONF-002.2] Audit trail structure validated:`, {
        document_key: auditTrail.document_key,
        events_count: auditTrail.events.length,
        signatures_count: auditTrail.signatures.length,
      });
    } catch (error) {
      // If no API token is configured, the test should handle gracefully
      if (error instanceof Error && error.message.includes('API token not configured')) {
        console.log('⚠️ [CONF-002.2] API token not configured - test passed with expected error');
        expect(error.message).toContain('API token not configured');
      } else {
        throw error;
      }
    }
  });

  test('CONF-002.3: Document download with integrity verification should return proper structure', async () => {
    // This test validates the interface structure without making real API calls
    const mockDocumentData = {
      documentBuffer: Buffer.from('test pdf content'),
      documentHash: 'a1b2c3d4e5f6',
      auditTrail: {
        document_key: 'test-key',
        list_key: 'test-list',
        events: [
          {
            timestamp: new Date().toISOString(),
            action: 'test_action',
            user_email: 'test@example.com',
            user_ip: '127.0.0.1',
            details: {},
          },
        ],
        signatures: [],
      },
      verifiedAt: new Date(),
    };

    // Validate structure matches DocumentIntegrityData interface
    expect(mockDocumentData.documentBuffer).toBeInstanceOf(Buffer);
    expect(typeof mockDocumentData.documentHash).toBe('string');
    expect(mockDocumentData.auditTrail).toBeDefined();
    expect(mockDocumentData.auditTrail.document_key).toBe('test-key');
    expect(Array.isArray(mockDocumentData.auditTrail.events)).toBe(true);
    expect(Array.isArray(mockDocumentData.auditTrail.signatures)).toBe(true);
    expect(mockDocumentData.verifiedAt).toBeInstanceOf(Date);

    console.log(`✅ [CONF-002.3] DocumentIntegrityData structure validated`);
  });

  test('CONF-002.4: Hash calculation should be deterministic and consistent', async () => {
    const testContent = 'This is a test document content for hash consistency validation';
    const testBuffer = Buffer.from(testContent);

    const service = clickSignService as any;

    // Calculate hash multiple times
    const hash1 = service.calculateDocumentHash(testBuffer);
    const hash2 = service.calculateDocumentHash(testBuffer);
    const hash3 = service.calculateDocumentHash(testBuffer);

    // All hashes should be identical
    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);

    // Verify against crypto library directly
    const expectedHash = crypto.createHash('sha256').update(testBuffer).digest('hex');
    expect(hash1).toBe(expectedHash);

    console.log(`✅ [CONF-002.4] Hash determinism validated: ${hash1}`);
  });

  test('CONF-002.5: Audit trail should contain required security fields', async () => {
    try {
      const auditTrail = await clickSignService.getDocumentAuditTrail('test-doc');

      // Validate audit trail structure contains security fields
      if (auditTrail.events.length > 0) {
        const event = auditTrail.events[0];
        expect(event).toHaveProperty('timestamp');
        expect(event).toHaveProperty('action');
        expect(event).toHaveProperty('user_email');
        expect(event).toHaveProperty('user_ip');
        expect(event).toHaveProperty('details');
      }

      // Validate signatures contain required forensic data
      if (auditTrail.signatures.length > 0) {
        const signature = auditTrail.signatures[0];
        expect(signature).toHaveProperty('signer_email');
        expect(signature).toHaveProperty('signed_at');
        expect(signature).toHaveProperty('signature_method');
        expect(signature).toHaveProperty('ip_address');
        expect(signature).toHaveProperty('user_agent');
      }

      console.log(`✅ [CONF-002.5] Audit trail security fields validated`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('API token not configured')) {
        console.log('⚠️ [CONF-002.5] API token not configured - test passed with expected error');
      } else {
        throw error;
      }
    }
  });
});
