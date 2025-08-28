/**
 * Inter Webhook Routes - SECURITY HARDENED
 * Handles Inter bank webhook notifications with HMAC validation
 * PAM V10.0 - Remediação de Segurança Crítica
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { interFixService } from '../../services/genericService';
import winston from 'winston';

const router = Router();

/**
 * Middleware para validar HMAC do webhook do Inter
 */
function validateInterWebhookHMAC(req: Request, res: Response, next: Function) {
  try {
    const signature = req.headers['x-inter-signature'] as string;
    const webhookSecret = process.env.INTER_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('[INTER WEBHOOK] SECURITY: Webhook secret not configured');
      return res.status(401).json({ error: 'Webhook secret not configured' });
    }

    if (!signature) {
      console.error('[INTER WEBHOOK] SECURITY: Missing signature header');
      winston.error('[INTER WEBHOOK] SECURITY: Missing signature header', {
        service: 'inter',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        severity: 'HIGH'
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
      console.error('[INTER WEBHOOK] SECURITY: Invalid signature');
      winston.error('[INTER WEBHOOK] SECURITY: Invalid signature', {
        service: 'inter',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        severity: 'CRITICAL',
        providedSignature,
        expectedLength: expectedSignature.length
      });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    console.log('[INTER WEBHOOK] SECURITY: HMAC validation successful');
    next();
  } catch (error: any) {
    console.error('[INTER WEBHOOK] SECURITY: Validation error:', error);
    winston.error('[INTER WEBHOOK] SECURITY: Validation error', {
      service: 'inter',
      ip: req.ip,
      error: error.message,
      severity: 'HIGH'
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
    console.log('[INTER WEBHOOK] Received:', req.body);
    
    // Log webhook recebido para auditoria
    winston.info('[INTER WEBHOOK] SECURITY: Webhook received', {
      service: 'inter',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      eventType: req.body?.event || 'unknown'
    });

    // Process webhook asynchronously
    await interFixService.executeOperation('webhook_inter', req.body);

    // Return success immediately
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[INTER WEBHOOK] Error:', error);
    
    // Log erro para auditoria
    winston.error('[INTER WEBHOOK] SECURITY: Processing error', {
      service: 'inter',
      ip: req.ip,
      error: error.message,
      severity: 'MEDIUM'
    });
    
    // Return success to prevent retries
    res.status(200).json({ success: true });
  }
});

export default router;
