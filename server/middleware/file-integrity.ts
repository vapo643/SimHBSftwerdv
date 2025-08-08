/**
 * File Integrity Middleware - OWASP ASVS V12.4.1
 *
 * Adds integrity metadata to file downloads and provides
 * verification endpoints for uploaded files.
 */

import { Request, Response, NextFunction } from "express";
import { generateFileHashes, storeFileIntegrity, getFileIntegrity } from "../lib/file-integrity";
import { securityLogger, SecurityEventType, getClientIP } from "../lib/security-logger";

export interface FileIntegrityRequest extends Request {
  fileIntegrity?: {
    sha256: string;
    sha512: string;
    size: number;
  };
}

/**
 * Middleware to add integrity headers to file downloads
 */
export function fileIntegrityMiddleware(
  req: FileIntegrityRequest,
  res: Response,
  next: NextFunction
) {
  // Store original send methods
  const originalSend = res.send;
  const originalJson = res.json;

  // Override send method to add integrity headers
  res.send = function (data: any) {
    if (
      Buffer.isBuffer(data) &&
      res.getHeader("Content-Type")?.toString().includes("application/pdf")
    ) {
      // Generate hashes for file content
      const integrity = generateFileHashes(data);

      // Add integrity headers
      res.setHeader("X-Content-SHA256", integrity.sha256);
      res.setHeader("X-Content-SHA512", integrity.sha512);
      res.setHeader("X-Content-Size", integrity.size.toString());

      // Add Content-Security-Policy for downloads
      res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline';");

      // Store integrity info in request for logging
      req.fileIntegrity = {
        sha256: integrity.sha256,
        sha512: integrity.sha512,
        size: integrity.size,
      };

      // Log file download with integrity info
      securityLogger.logEvent({
        type: SecurityEventType.DATA_ACCESS,
        severity: "INFO",
        userId: (req as any).user?.id,
        userEmail: (req as any).user?.email,
        ipAddress: getClientIP(req),
        userAgent: req.headers["user-agent"],
        endpoint: req.originalUrl,
        success: true,
        details: {
          action: "file_download",
          contentType: res.getHeader("Content-Type"),
          ...req.fileIntegrity,
        },
      });
    }

    return originalSend.call(this, data);
  };

  // Override json method to add integrity for JSON downloads
  res.json = function (data: any) {
    if (req.query.download === "true" || req.headers["x-download-request"] === "true") {
      const jsonString = JSON.stringify(data);
      const buffer = Buffer.from(jsonString, "utf-8");
      const integrity = generateFileHashes(buffer);

      res.setHeader("X-Content-SHA256", integrity.sha256);
      res.setHeader("X-Content-Size", integrity.size.toString());
    }

    return originalJson.call(this, data);
  };

  next();
}

/**
 * Endpoint to verify file integrity
 */
export function verifyFileIntegrityEndpoint(req: Request, res: Response) {
  try {
    const { fileId, sha256, sha512, size } = req.body;

    if (!fileId || (!sha256 && !sha512 && !size)) {
      return res.status(400).json({
        error: "fileId e pelo menos um hash (sha256, sha512) ou size são obrigatórios",
      });
    }

    // Get stored integrity info
    const storedIntegrity = getFileIntegrity(fileId);

    if (!storedIntegrity) {
      return res.status(404).json({
        error: "Informações de integridade não encontradas para este arquivo",
      });
    }

    // Verify provided hashes
    const verification = {
      valid: true,
      errors: [] as string[],
    };

    if (sha256 && sha256 !== storedIntegrity.sha256) {
      verification.valid = false;
      verification.errors.push("SHA-256 hash não corresponde");
    }

    if (sha512 && sha512 !== storedIntegrity.sha512) {
      verification.valid = false;
      verification.errors.push("SHA-512 hash não corresponde");
    }

    if (size && size !== storedIntegrity.size) {
      verification.valid = false;
      verification.errors.push(
        `Tamanho não corresponde: esperado ${storedIntegrity.size}, recebido ${size}`
      );
    }

    // Log verification attempt
    securityLogger.logEvent({
      type: verification.valid
        ? SecurityEventType.DATA_ACCESS
        : SecurityEventType.FILE_INTEGRITY_VIOLATION,
      severity: verification.valid ? "INFO" : "HIGH",
      userId: (req as any).user?.id,
      userEmail: (req as any).user?.email,
      ipAddress: getClientIP(req),
      userAgent: req.headers["user-agent"],
      endpoint: req.originalUrl,
      success: verification.valid,
      details: {
        fileId,
        verification,
      },
    });

    res.json({
      valid: verification.valid,
      errors: verification.errors,
      storedAt: storedIntegrity.generatedAt,
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Erro ao verificar integridade do arquivo",
      message: error.message,
    });
  }
}
