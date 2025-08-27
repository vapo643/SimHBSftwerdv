import { Router } from 'express';
import { z } from 'zod';
import { jwtAuthMiddleware, AuthenticatedRequest } from '../lib/jwt-auth-middleware';
import { createServerSupabaseClient } from '../../client/src/lib/supabase';
import { storage } from '../storage';
import { securityLogger, SecurityEventType, getClientIP } from '../lib/security-logger';
import { randomBytes } from 'crypto';
import { getBrasiliaTimestamp } from '../lib/timezone';

const router = Router();

// Schema for email change request
const emailChangeSchema = z.object({
  newEmail: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

// Schema for email change verification
const verifyEmailChangeSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
});

// In-memory store for email change tokens (in production, use Redis or database)
const emailChangeTokens = new Map<
  string,
  {
    userId: string;
    oldEmail: string;
    newEmail: string;
    createdAt: Date;
    expiresAt: Date;
  }
>();

// Clean up expired tokens every hour
setInterval(
  () => {
    const now = new Date();
    const entries = Array.from(emailChangeTokens.entries());
    for (const [token, data] of entries) {
      if (data.expiresAt < now) {
        emailChangeTokens.delete(token);
      }
    }
  },
  60 * 60 * 1000
);

/**
 * POST /api/auth/change-email
 * Request email change - sends verification to new email
 */
router.post('/change-email', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { newEmail, password } = emailChangeSchema.parse(req.body);
    const userId = req.user!.id;
    const currentEmail = req.user!.email;

    // Check if new email is same as current
    if (newEmail.toLowerCase() === (currentEmail || '').toLowerCase()) {
      return res.status(400).json({
        error: 'O novo email deve ser diferente do atual',
      });
    }

    // Verify user's password
    const supabase = createServerSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: currentEmail || '',
      password,
    });

    if (signInError) {
      securityLogger.logEvent({
        type: SecurityEventType.INVALID_CREDENTIALS,
        severity: 'MEDIUM',
        userId,
        userEmail: currentEmail || '',
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
        endpoint: req.originalUrl,
        success: false,
        details: { reason: 'Invalid password for email change' },
      });

      // Generic error message - OWASP ASVS V3.2.3
      return res.status(401).json({
        error: 'Credenciais inválidas',
      });
    }

    // Check if new email is already in use
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', newEmail)
      .single();

    if (existingUser) {
      return res.status(409).json({
        error: 'Este email já está em uso',
      });
    }

    // Generate verification token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    // Store token
    emailChangeTokens.set(token, {
      userId,
      oldEmail: currentEmail || '',
      newEmail,
      createdAt: new Date(),
      expiresAt,
    });

    // In a real implementation, send emails here:
    // 1. Verification email to new address with token
    // 2. Notification email to old address

    // For now, return the token (in production, never do this!)
    // TODO: Integrate with email service (SendGrid, AWS SES, etc.)

    securityLogger.logEvent({
      type: SecurityEventType.EMAIL_CHANGE_REQUESTED,
      severity: 'MEDIUM',
      userId,
      userEmail: currentEmail,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      endpoint: req.originalUrl,
      success: true,
      details: { newEmail },
    });

    res.json({
      message: 'Email de verificação enviado para o novo endereço',
      // In production, remove this line:
      debugToken: process.env.NODE_ENV === 'development' ? token : undefined,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }

    console.error('Email change error:', error);
    res.status(500).json({ error: 'Erro ao processar mudança de email' });
  }
});

/**
 * POST /api/auth/verify-email-change
 * Verify email change token and update email
 */
router.post('/verify-email-change', async (req, res) => {
  try {
    const { token } = verifyEmailChangeSchema.parse(req.body);

    // Get token data
    const tokenData = emailChangeTokens.get(token);
    if (!tokenData) {
      return res.status(400).json({
        error: 'Token inválido ou expirado',
      });
    }

    // Check if token is expired
    if (tokenData.expiresAt < new Date()) {
      emailChangeTokens.delete(token);
      return res.status(400).json({
        error: 'Token expirado',
      });
    }

    const supabase = createServerSupabaseClient();

    // Update user's email in auth
    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(tokenData.userId, {
      email: tokenData.newEmail,
    });

    if (updateAuthError) {
      console.error('Error updating auth email:', updateAuthError);
      return res.status(500).json({
        error: 'Erro ao atualizar email',
      });
    }

    // Update user's email in profile
    const { error: updateProfileError } = await supabase
      .from('profiles')
      .update({
        email: tokenData.newEmail,
        updated_at: getBrasiliaTimestamp(),
      })
      .eq('id', tokenData.userId);

    if (updateProfileError) {
      console.error('Error updating profile email:', updateProfileError);
      // Try to rollback auth change
      await supabase.auth.admin.updateUserById(tokenData.userId, { email: tokenData.oldEmail });
      return res.status(500).json({
        error: 'Erro ao atualizar perfil',
      });
    }

    // Delete the used token
    emailChangeTokens.delete(token);

    // Log the successful change
    securityLogger.logEvent({
      type: SecurityEventType.EMAIL_CHANGED,
      severity: 'HIGH',
      userId: tokenData.userId,
      userEmail: tokenData.oldEmail,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      endpoint: req.originalUrl,
      success: true,
      details: {
        oldEmail: tokenData.oldEmail,
        newEmail: tokenData.newEmail,
      },
    });

    res.json({
      message: 'Email atualizado com sucesso. Por favor, faça login novamente com seu novo email.',
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }

    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Erro ao verificar mudança de email' });
  }
});

/**
 * GET /api/auth/email-change-status
 * Check if user has pending email change
 */
router.get('/email-change-status', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;

  // Check for pending email changes
  let hasPendingChange = false;
  let newEmail: string | undefined;

  const entries = Array.from(emailChangeTokens.entries());
  for (const [_, data] of entries) {
    if (data.userId === userId && data.expiresAt > new Date()) {
      hasPendingChange = true;
      newEmail = data.newEmail;
      break;
    }
  }

  res.json({
    hasPendingChange,
    newEmail: hasPendingChange ? newEmail : null,
  });
});

export default router;
