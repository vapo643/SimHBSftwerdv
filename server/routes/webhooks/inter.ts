/**
 * Inter Webhook Routes - SECURITY HARDENED
 * Handles Inter bank webhook notifications with HMAC validation
 * PAM V10.0 - Remediação de Segurança Crítica
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { interWebhookService } from '../../services/InterWebhookService';
import { securityRepository } from '../../repositories/security.repository';

const router = Router();

/**
 * Middleware para validar HMAC do webhook do Inter
 */
async function validateInterWebhookHMAC(req: Request, res: Response, next: Function) {
  try {
    const signature = req.headers['x-inter-signature'] as string;
    const webhookSecret = process.env.INTER_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      await securityRepository.logSecurityEvent({
        eventType: 'WEBHOOK_CONFIG_ERROR',
        severity: 'CRITICAL',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.path,
        statusCode: 401,
        success: false,
        details: {
          description: 'Inter webhook secret not configured - critical security issue',
          service: 'inter',
          webhookEvent: 'config_missing'
        }
      });
      return res.status(401).json({ error: 'Webhook secret not configured' });
    }

    if (!signature) {
      await securityRepository.logSecurityEvent({
        eventType: 'WEBHOOK_SIGNATURE_MISSING',
        severity: 'HIGH',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.path,
        statusCode: 401,
        success: false,
        details: {
          description: 'Inter webhook signature header missing - potential security breach attempt',
          service: 'inter',
          webhookEvent: 'signature_missing'
        }
      });
      return res.status(401).json({ error: 'Missing signature' });
    }

    // Validar HMAC
    const bodyString = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(bodyString)
      .digest('hex');
    
    const providedSignature = signature.replace('sha256=', '');
    
    if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(providedSignature))) {
      await securityRepository.logSecurityEvent({
        eventType: 'WEBHOOK_SIGNATURE_INVALID',
        severity: 'CRITICAL',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.path,
        statusCode: 401,
        success: false,
        details: {
          description: 'Inter webhook invalid signature - potential attack or misconfiguration',
          service: 'inter',
          webhookEvent: 'signature_invalid',
          providedSignatureLength: providedSignature.length,
          expectedLength: expectedSignature.length
        }
      });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Log successful HMAC validation for audit trail
    await securityRepository.logSecurityEvent({
      eventType: 'WEBHOOK_SIGNATURE_VALID',
      severity: 'LOW',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      statusCode: 200,
      success: true,
      details: {
        description: 'Inter webhook HMAC validation successful',
        service: 'inter',
        webhookEvent: 'signature_valid'
      }
    });
    next();
  } catch (error: any) {
    await securityRepository.logSecurityEvent({
      eventType: 'WEBHOOK_VALIDATION_ERROR',
      severity: 'HIGH',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      statusCode: 500,
      success: false,
      details: {
        description: 'Inter webhook validation error - system failure',
        service: 'inter',
        webhookEvent: 'validation_error',
        error: error.message,
        errorStack: error.stack
      }
    });
    return res.status(500).json({ error: 'Webhook validation failed' });
  }
}

/**
 * POST /webhooks/inter
 * Handle Inter webhook notifications
 * PROTECTED: Requires HMAC validation
 */
router.post('/', validateInterWebhookHMAC, async (req, res) => {
  try {
    // Log webhook received with full audit trail
    await securityRepository.logSecurityEvent({
      eventType: 'WEBHOOK_RECEIVED',
      severity: 'LOW',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      statusCode: 200,
      success: true,
      details: {
        description: 'Inter webhook received and authenticated successfully',
        service: 'inter',
        webhookEvent: 'received',
        eventType: req.body?.event || 'unknown',
        payload: req.body // Full payload for audit trail
      }
    });

    // Process webhook asynchronously with proper banking-grade service
    await interWebhookService.processWebhook('webhook_inter', req.body, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      headers: req.headers,
      webhookEventId: `inter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });

    // Return success immediately
    res.status(200).json({ success: true });
  } catch (error: any) {
    // Log processing error with full audit trail
    await securityRepository.logSecurityEvent({
      eventType: 'WEBHOOK_PROCESSING_ERROR',
      severity: 'MEDIUM',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      statusCode: 200,
      success: false,
      details: {
        description: 'Inter webhook processing error - operation failed',
        service: 'inter',
        webhookEvent: 'processing_error',
        error: error.message,
        errorStack: error.stack,
        payload: req.body
      }
    });
    
    // Return success to prevent retries
    res.status(200).json({ success: true });
  }
});

export default router;
