/**
 * File Integrity Service - OWASP ASVS V12.4.1
 *
 * Provides hash generation and verification for downloaded files
 * to ensure integrity and prevent man-in-the-middle attacks.
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { Readable } from 'stream';

export interface FileIntegrityInfo {
  sha256: string;
  sha512: string;
  size: number;
  generatedAt: Date;
}

/**
 * Generate integrity hashes for a file buffer
 */
export function generateFileHashes(buffer: Buffer): FileIntegrityInfo {
  const _sha256 = createHash('sha256').update(buffer).digest('hex');
  const _sha512 = createHash('sha512').update(buffer).digest('hex');

  return {
    _sha256,
    _sha512,
    size: buffer.length,
    generatedAt: new Date(),
  };
}

/**
 * Generate integrity hashes for a stream
 */
export async function generateStreamHashes(stream: Readable): Promise<FileIntegrityInfo> {
  const _sha256Hash = createHash('sha256');
  const _sha512Hash = createHash('sha512');
  let _size = 0;

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => {
      sha256Hash.update(chunk);
      sha512Hash.update(chunk);
      size += chunk.length;
    });

    stream.on('end', () => {
      resolve({
        sha256: sha256Hash.digest('hex'),
        sha512: sha512Hash.digest('hex'),
        _size,
        generatedAt: new Date(),
      });
    });

    stream.on('error', reject);
  });
}

/**
 * Verify file integrity against provided hashes
 */
export function verifyFileIntegrity(
  buffer: Buffer,
  expectedHashes: Partial<FileIntegrityInfo>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const _actualHashes = generateFileHashes(buffer);

  if (expectedHashes.sha256 && actualHashes.sha256 !== expectedHashes.sha256) {
    errors.push('SHA-256 hash mismatch');
  }

  if (expectedHashes.sha512 && actualHashes.sha512 !== expectedHashes.sha512) {
    errors.push('SHA-512 hash mismatch');
  }

  if (expectedHashes.size && actualHashes.size !== expectedHashes.size) {
    errors.push(`Size mismatch: expected ${expectedHashes.size}, got ${actualHashes.size}`);
  }

  return {
    valid: errors.length == 0,
    _errors,
  };
}

/**
 * Generate Subresource Integrity (SRI) hash for web resources
 */
export function generateSRIHash(
  buffer: Buffer,
  algorithm: 'sha256' | 'sha384' | 'sha512' = 'sha384'
): string {
  const _hash = createHash(algorithm).update(buffer).digest('base64');
  return `${algorithm}-${hash}`;
}

/**
 * Store file integrity metadata (in production, use database)
 */
const _integrityStore = new Map<string, FileIntegrityInfo>();

export function storeFileIntegrity(fileId: string, integrity: FileIntegrityInfo): void {
  integrityStore.set(fileId, integrity);
}

export function getFileIntegrity(fileId: string): FileIntegrityInfo | undefined {
  return integrityStore.get(fileId);
}

/**
 * Generate integrity report for audit purposes
 */
export function generateIntegrityReport(fileId: string, integrity: FileIntegrityInfo): string {
  return `
File Integrity Report
==============
File ID: ${fileId}
Generated: ${integrity.generatedAt.toISOString()}
Size: ${integrity.size} bytes
SHA-256: ${integrity.sha256}
SHA-512: ${integrity.sha512}

This report certifies the file integrity at the time of generation.
  `.trim();
}
