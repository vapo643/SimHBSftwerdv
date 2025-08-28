/**
 * Centralized Crypto Service
 * Generic encryption/decryption service following DRY principles
 * 
 * Implements AES-256-GCM encryption for sensitive data protection
 * - Secure key management through dependency injection
 * - Authenticated encryption with integrity verification
 * - Generic implementation for system-wide reuse
 */

import crypto from 'crypto';

interface CryptoConfig {
  encryptionKey: string;
}

class CryptoService {
  private config: CryptoConfig;

  constructor(config: CryptoConfig) {
    if (!config.encryptionKey) {
      throw new Error('Encryption key is required for CryptoService');
    }
    
    // Validate key length for AES-256 (32 bytes = 64 hex characters)
    if (Buffer.from(config.encryptionKey, 'hex').length !== 32) {
      throw new Error('Encryption key must be 32 bytes (64 hex characters) for AES-256');
    }
    
    this.config = config;
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   * Format: iv:authTag:encryptedData
   */
  encryptSensitiveData(data: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      Buffer.from(this.config.encryptionKey, 'hex'),
      iv
    );

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive data using AES-256-GCM
   * Expects format: iv:authTag:encryptedData
   */
  decryptSensitiveData(encryptedData: string): string {
    const parts = encryptedData.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format. Expected: iv:authTag:encryptedData');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(this.config.encryptionKey, 'hex'),
      iv
    );

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Generate a secure random encryption key for AES-256
   * Returns 64-character hex string (32 bytes)
   */
  static generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

export { CryptoService, type CryptoConfig };