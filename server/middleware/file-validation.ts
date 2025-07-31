/**
 * CRITICAL SECURITY FIX: Advanced File Validation with Magic Numbers
 * 
 * This middleware implements OWASP File Upload Cheat Sheet recommendations:
 * - Magic number validation (not just MIME type headers)
 * - Content verification against file extensions  
 * - Anti-malware scanning capability
 * - ASVS V12.1.1, V12.1.2, V16.1.1 compliance
 */

import { Request, Response, NextFunction } from 'express';

// Magic number signatures for allowed file types
const FILE_SIGNATURES = {
  'application/pdf': [
    [0x25, 0x50, 0x44, 0x46], // %PDF
  ],
  'image/jpeg': [
    [0xFF, 0xD8, 0xFF, 0xE0], // JFIF
    [0xFF, 0xD8, 0xFF, 0xE1], // EXIF
    [0xFF, 0xD8, 0xFF, 0xE2], // Canon
    [0xFF, 0xD8, 0xFF, 0xE3], // Samsung
    [0xFF, 0xD8, 0xFF, 0xE8], // SPIFF
  ],
  'image/png': [
    [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG signature
  ]
} as const;

// Allowed file extensions mapped to MIME types
const ALLOWED_FILE_TYPES = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg', 
  '.jpeg': 'image/jpeg',
  '.png': 'image/png'
} as const;

interface FileValidationError {
  type: 'INVALID_EXTENSION' | 'MIME_TYPE_MISMATCH' | 'MAGIC_NUMBER_MISMATCH' | 'FILE_TOO_LARGE' | 'MALICIOUS_CONTENT';
  message: string;
  details?: any;
}

export class SecureFileValidator {
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly SCAN_BUFFER_SIZE = 2048; // First 2KB for analysis

  /**
   * Validate file extension against allowed types
   */
  private static validateExtension(filename: string): string | null {
    const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (!ext || !(ext in ALLOWED_FILE_TYPES)) {
      return null;
    }
    return ALLOWED_FILE_TYPES[ext as keyof typeof ALLOWED_FILE_TYPES];
  }

  /**
   * Validate magic numbers (file signatures) 
   */
  private static validateMagicNumbers(buffer: Buffer, expectedMimeType: string): boolean {
    const signatures = FILE_SIGNATURES[expectedMimeType as keyof typeof FILE_SIGNATURES];
    if (!signatures) return false;

    return signatures.some(signature => {
      if (buffer.length < signature.length) return false;
      
      return signature.every((byte, index) => buffer[index] === byte);
    });
  }

  /**
   * Advanced content analysis for malicious patterns
   */
  private static scanForMaliciousContent(buffer: Buffer, filename: string): string[] {
    const warnings: string[] = [];
    const scanBuffer = buffer.subarray(0, this.SCAN_BUFFER_SIZE);
    const content = scanBuffer.toString('binary');

    // Check for embedded scripts or suspicious patterns
    const maliciousPatterns = [
      /javascript:/gi,
      /<script[\s\S]*?>/gi,
      /<iframe[\s\S]*?>/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
      /eval\s*\(/gi,
      /document\.write/gi,
      /\.exe\b/gi,
      /\.bat\b/gi,
      /\.scr\b/gi,
      /\.vbs\b/gi,
      /\.jar\b/gi
    ];

    maliciousPatterns.forEach((pattern, index) => {
      if (pattern.test(content)) {
        warnings.push(`Suspicious pattern ${index + 1} detected`);
      }
    });

    // Check for double extensions (e.g., file.pdf.exe)
    const extensionCount = (filename.match(/\./g) || []).length;
    if (extensionCount > 1) {
      warnings.push('Multiple file extensions detected');
    }

    // Check for suspicious filename patterns
    if (/\.(exe|bat|scr|vbs|jar|com|pif)$/i.test(filename)) {
      warnings.push('Executable file extension detected');
    }

    return warnings;
  }

  /**
   * Comprehensive file validation
   */
  public static validateFile(file: Express.Multer.File): FileValidationError | null {
    const { originalname, buffer, mimetype, size } = file;

    // 1. File size validation
    if (size > this.MAX_FILE_SIZE) {
      return {
        type: 'FILE_TOO_LARGE',
        message: `File size ${size} bytes exceeds maximum allowed ${this.MAX_FILE_SIZE} bytes`,
        details: { size, maxSize: this.MAX_FILE_SIZE }
      };
    }

    // 2. Extension validation
    const expectedMimeType = this.validateExtension(originalname);
    if (!expectedMimeType) {
      return {
        type: 'INVALID_EXTENSION',
        message: `File extension not allowed. Allowed types: ${Object.keys(ALLOWED_FILE_TYPES).join(', ')}`,
        details: { filename: originalname, allowedTypes: Object.keys(ALLOWED_FILE_TYPES) }
      };
    }

    // 3. MIME type header validation  
    if (mimetype !== expectedMimeType) {
      return {
        type: 'MIME_TYPE_MISMATCH',
        message: `MIME type mismatch. Expected: ${expectedMimeType}, Received: ${mimetype}`,
        details: { expected: expectedMimeType, received: mimetype }
      };
    }

    // 4. Magic number validation (CRITICAL SECURITY CHECK)
    if (!this.validateMagicNumbers(buffer, expectedMimeType)) {
      return {
        type: 'MAGIC_NUMBER_MISMATCH', 
        message: `File content does not match expected file type ${expectedMimeType}`,
        details: { 
          expectedType: expectedMimeType, 
          actualSignature: Array.from(buffer.subarray(0, 8)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ')
        }
      };
    }

    // 5. Malicious content scanning
    const maliciousWarnings = this.scanForMaliciousContent(buffer, originalname);
    if (maliciousWarnings.length > 0) {
      return {
        type: 'MALICIOUS_CONTENT',
        message: `Potentially malicious content detected: ${maliciousWarnings.join(', ')}`,
        details: { warnings: maliciousWarnings }
      };
    }

    return null; // File is valid
  }
}

/**
 * Express middleware for secure file validation
 */
export const secureFileValidationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'No file uploaded',
      code: 'NO_FILE'
    });
  }

  const validationError = SecureFileValidator.validateFile(req.file);
  
  if (validationError) {
    console.error(`🚨 [SECURITY] File validation failed:`, {
      filename: req.file.originalname,
      error: validationError.type,
      message: validationError.message,
      details: validationError.details,
      clientIP: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    return res.status(400).json({
      error: validationError.message,
      code: validationError.type,
      details: validationError.details
    });
  }

  console.log(`✅ [SECURITY] File validation passed:`, {
    filename: req.file.originalname,
    size: req.file.size,
    type: req.file.mimetype,
    timestamp: new Date().toISOString()
  });

  next();
};

export default secureFileValidationMiddleware;