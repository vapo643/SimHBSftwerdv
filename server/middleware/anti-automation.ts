/**
 * Anti-Automation Middleware - OWASP ASVS V11.1.4
 *
 * This middleware provides basic protection against automated attacks
 * by implementing a challenge-response mechanism for critical endpoints.
 *
 * For production use, integrate with a CAPTCHA service like:
 * - Google reCAPTCHA
 * - hCaptcha
 * - Cloudflare Turnstile
 */

import { Request, Response, NextFunction } from 'express';
import { securityLogger, SecurityEventType, getClientIP } from '../lib/security-logger';
import { createHash } from 'crypto';

// In-memory store for challenges (use Redis in production)
const challengeStore = new Map<
  string,
  {
    challenge: string;
    answer: string;
    attempts: number;
    createdAt: Date;
  }
>();

// Clean up old challenges every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of challengeStore.entries()) {
    if (now - value.createdAt.getTime() > 300000) {
      // 5 minutes
      challengeStore.delete(key);
    }
  }
}, 300000);

/**
 * Generate a simple math challenge
 */
function generateChallenge(): { challenge: string; answer: string } {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  const operations = ['+', '-'];
  const op = operations[Math.floor(Math.random() * operations.length)];

  let answer: number;
  let challenge: string;

  switch (op) {
    case '+':
      answer = a + b;
      challenge = `${a} + ${b}`;
      break;
    case '-':
      answer = Math.max(a, b) - Math.min(a, b);
      challenge = `${Math.max(a, b)} - ${Math.min(a, b)}`;
      break;
    default:
      answer = a + b;
      challenge = `${a} + ${b}`;
  }

  return { challenge, answer: answer.toString() };
}

/**
 * Get client fingerprint for challenge tracking
 */
function getClientFingerprint(req: Request): string {
  const ip = getClientIP(req);
  const userAgent = req.headers['user-agent'] || 'unknown';
  const fingerprint = `${ip}:${userAgent}`;
  return createHash('sha256').update(fingerprint).digest('hex');
}

/**
 * Middleware to check if automation protection is needed
 */
export function antiAutomationMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip for authenticated users with valid sessions
  if (req.user?.id) {
    return next();
  }

  const fingerprint = getClientFingerprint(req);
  const existingChallenge = challengeStore.get(fingerprint);

  // Check if challenge answer is provided
  const challengeAnswer = req.headers['x-challenge-answer'] || req.body?.challengeAnswer;

  if (existingChallenge && challengeAnswer) {
    // Verify answer
    if (existingChallenge.answer === challengeAnswer.toString()) {
      // Correct answer, allow request
      challengeStore.delete(fingerprint);
      return next();
    } else {
      // Wrong answer
      existingChallenge.attempts++;

      if (existingChallenge.attempts >= 3) {
        // Too many failed attempts
        challengeStore.delete(fingerprint);

        securityLogger.logEvent({
          type: SecurityEventType.SUSPICIOUS_ACTIVITY,
          severity: 'HIGH',
          ipAddress: getClientIP(req),
          userAgent: req.headers['user-agent'],
          endpoint: req.originalUrl,
          success: false,
          details: { reason: 'Failed anti-automation challenge multiple times' },
        });

        return res.status(403).json({
          error: 'Acesso negado. Muitas tentativas falhadas.',
        });
      }

      // Generate new challenge
      const { challenge, answer } = generateChallenge();
      existingChallenge.challenge = challenge;
      existingChallenge.answer = answer;

      return res.status(428).json({
        error: 'Resposta incorreta. Tente novamente.',
        challenge: challenge,
        remainingAttempts: 3 - existingChallenge.attempts,
      });
    }
  }

  // No challenge exists or no answer provided, create new challenge
  const { challenge, answer } = generateChallenge();

  challengeStore.set(fingerprint, {
    challenge,
    answer,
    attempts: 0,
    createdAt: new Date(),
  });

  return res.status(428).json({
    error: 'Verificação anti-automação necessária',
    challenge: challenge,
    message: 'Por favor, resolva este desafio matemático simples',
  });
}

/**
 * Lightweight version for less critical endpoints
 */
export function antiAutomationLight(req: Request, res: Response, next: NextFunction) {
  // Only activate after multiple rapid requests
  const fingerprint = getClientFingerprint(req);
  const requestKey = `requests:${fingerprint}`;

  // Simple request counting (use Redis in production)
  // This is a placeholder - implement proper request counting
  return next();
}
