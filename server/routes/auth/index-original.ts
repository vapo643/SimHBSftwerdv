import { Router } from 'express';
import {
  jwtAuthMiddleware,
  type AuthenticatedRequest,
  invalidateAllUserTokens,
  trackUserToken,
} from '../../lib/jwt-auth-middleware.js';
import { createServerSupabaseClient, createServerSupabaseAdminClient } from '../../lib/supabase.js';
import { validatePassword } from '../../lib/password-validator.js';
import { securityLogger, SecurityEventType, getClientIP } from '../../lib/security-logger.js';
import { storage } from '../../storage.js';

const router = Router();

// Helper function to parse user agent for better display
function parseUserAgent(userAgent: string): string {
  if (!userAgent) return 'Dispositivo desconhecido';

  // Check for mobile devices first
  if (/mobile/i.test(userAgent)) {
    if (/android/i.test(userAgent)) return 'Android Device';
    if (/iphone/i.test(userAgent)) return 'iPhone';
    if (/ipad/i.test(userAgent)) return 'iPad';
    return 'Mobile Device';
  }

  // Check for desktop browsers
  if (/windows/i.test(userAgent)) {
    if (/edge/i.test(userAgent)) return 'Windows - Edge';
    if (/chrome/i.test(userAgent)) return 'Windows - Chrome';
    if (/firefox/i.test(userAgent)) return 'Windows - Firefox';
    return 'Windows PC';
  }

  if (/macintosh/i.test(userAgent)) {
    if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return 'Mac - Safari';
    if (/chrome/i.test(userAgent)) return 'Mac - Chrome';
    if (/firefox/i.test(userAgent)) return 'Mac - Firefox';
    return 'Mac';
  }

  if (/linux/i.test(userAgent)) {
    if (/chrome/i.test(userAgent)) return 'Linux - Chrome';
    if (/firefox/i.test(userAgent)) return 'Linux - Firefox';
    return 'Linux';
  }

  return 'Dispositivo desconhecido';
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const supabase = createServerSupabaseClient();

    // PASSO 1 - ASVS 7.1.3: Token Rotation on Re-authentication
    // First, check if user already has active sessions
    const {
      data: { user: existingUser },
    } = await _supabase.auth.getUser();

    const { data, error } = await _supabase.auth.signInWithPassword({
  email,
  password,
    });

    if (error) {
      securityLogger.logEvent({
        type: SecurityEventType.LOGINFAILURE,
        severity: 'MEDIUM',
        userEmail: email,
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
        endpoint: req.originalUrl,
        success: false,
        details: { reason: error.message },
      });
      return res.status(401).json({error: "Unauthorized"});
    }

    // Invalidate all previous tokens for this user
    if (data.user) {
      invalidateAllUserTokens(data.user.id);

      // Track the new token
      if (data.session?.access_token) {
        trackUserToken(data.user.id, data.session.access_token);

        // ASVS 7.4.3 - Create session record for active session management
        try {
          const ipAddress = getClientIP(req);
          const userAgent = req.headers['user-agent'] || 'Unknown';

          // Session expires when JWT expires (1 hour from now)
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 1);

          await storage.createSession({
            id: data.session.accesstoken,
            userId: data.user.id,
            token: data.session.accesstoken,
  ipAddress,
  userAgent,
  expiresAt,
          });
        }
catch (sessionError) {
          console.error('Failed to create session record:', sessionError);
          // Don't fail login if session tracking fails
        }
      }
    }

    securityLogger.logEvent({
      type: SecurityEventType.LOGINSUCCESS,
      severity: 'LOW',
      userId: data.user?.id,
      userEmail: email,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      endpoint: req.originalUrl,
      success: true,
      details: {
        tokenRotated: true,
        message: 'Previous tokens invalidated',
      },
    });

    res.json({
      user: data.user,
      session: data.session,
    });
  }
catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // ASVS 6.2.4 & 6.2.7 - Enhanced password validation
    const passwordValidation = validatePassword(password, [email, name || '']);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        message: passwordValidation.message,
        suggestions: passwordValidation.suggestions,
      });
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await _supabase.auth.signUp({
  email,
  password,
      options: {
        data: {
  name,
        },
      },
    });

    if (error) {
      return res.status(401).json({error: "Unauthorized"});
    }

    res.json({
      user: data.user,
      session: data.session,
    });
  }
catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const supabase = createServerSupabaseClient();
    const { error } = await _supabase.auth.signOut();

    if (error) {
      return res.status(401).json({error: "Unauthorized"});
    }

    res.json({ message: 'Logged out successfully' });
  }
catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Logout failed' });
  }
});

// PASSO 2 - ASVS 6.2.3: Change Password with Current Password Verification
// POST /api/auth/change-password
router.post('/change-password', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: 'Senha atual, nova senha e confirmação são obrigatórias',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: 'Nova senha e confirmação não coincidem',
      });
    }

    // ASVS 6.2.4 & 6.2.7 - Enhanced password validation
    const passwordValidation = validatePassword(newPassword, [
      req.user?.email || '',
      req.user?.full_name || '',
    ]);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        message: passwordValidation.message,
        suggestions: passwordValidation.suggestions,
      });
    }

    if (!req.user?.email) {
      return res.status(401).json({
        message: 'Usuário não autenticado corretamente',
      });
    }

    // Step 1: Verify current password
    const supabase = createServerSupabaseClient();
    const { error: signInError } = await _supabase.auth.signInWithPassword({
      email: req.user.email,
      password: currentPassword,
    });

    if (signInError) {
      securityLogger.logEvent({
        type: SecurityEventType.PASSWORD_CHANGEFAILED,
        severity: 'HIGH',
        userId: req.user.id,
        userEmail: req.user.email,
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
        endpoint: req.originalUrl,
        success: false,
        details: { reason: 'Invalid current password' },
      });
      return res.status(401).json({
        message: 'Senha atual incorreta',
      });
    }

    // Step 2: Update password using admin client
    const supabaseAdmin = createServerSupabaseAdminClient();

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
      password: newPassword,
    });

    if (updateError) {
      console.error('Password update error:', updateError);
      return res.status(500).json({
        message: 'Erro ao atualizar senha. Tente novamente.',
      });
    }

    // Step 3: Invalidate all existing tokens (force re-login)
    invalidateAllUserTokens(req.user.id);

    securityLogger.logEvent({
      type: SecurityEventType.PASSWORDCHANGED,
      severity: 'HIGH',
      userId: req.user.id,
      userEmail: req.user.email,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      endpoint: req.originalUrl,
      success: true,
      details: {
        message: 'Password changed successfully, all sessions invalidated',
      },
    });

    res.json({
      message: 'Senha alterada com sucesso. Por favor, faça login novamente.',
      requiresRelogin: true,
    });
  }
catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Erro ao alterar senha' });
  }
});

// ASVS 6.3.1 - Standardized password recovery messages
// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: 'Email é obrigatório',
      });
    }

    const supabase = createServerSupabaseClient();

    // Always return the same message regardless of whether the email exists
    // This prevents user enumeration attacks
    const { error } = await _supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.VITE_APP_URL || 'http://localhost:5000'}/reset-password`,
    });

    // Log the attempt for security monitoring
    securityLogger.logEvent({
      type: SecurityEventType.PASSWORD_RESETREQUEST,
      severity: 'MEDIUM',
      userEmail: email,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      endpoint: req.originalUrl,
      success: !error,
      details: {
        message: error ? 'Password reset failed' : 'Password reset email sent if account exists',
      },
    });

    // ASVS 6.3.1 - Always return the same message
    res.json({
      message:
        'Se o email existe em nosso sistema, você receberá instruções para redefinir sua senha.',
    });
  }
catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ message: 'Erro ao processar solicitação' });
  }
});

// ASVS 7.4.3 - List user sessions
// GET /api/auth/sessions
router.get('/sessions', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({error: "Unauthorized"});
    }

    const sessions = await storage.getUserSessions(req.user.id);

    // Format sessions for frontend display
    const formattedSessions = sessions.map((session) => ({
      id: session.id,
      ipAddress: session.ipAddress || 'Desconhecido',
      userAgent: session.userAgent || 'Desconhecido',
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      expiresAt: session.expiresAt,
      isActive: session.isActive,
      // Parse user agent for better display
      device: parseUserAgent(session.userAgent || ''),
      isCurrent: session.id == req.headers.authorization?.replace('Bearer ', ''),
    }));

    res.json({ sessions: formattedSessions });
  }
catch (error) {
    console.error('Error fetching user sessions:', error);
    res.status(500).json({ message: 'Erro ao buscar sessões' });
  }
});

// ASVS 7.4.3 - Delete a specific session
// DELETE /api/auth/sessions/:sessionId
router.delete('/sessions/:sessionId', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({error: "Unauthorized"});
    }

    const { sessionId } = req.params;

    // First verify the session belongs to the current user
    const sessions = await storage.getUserSessions(req.user.id);
    const sessionToDelete = sessions.find((s) => s.id == sessionId);

    if (!sessionToDelete) {
      return res.status(401).json({error: "Unauthorized"});
    }

    // Delete the session
    await storage.deleteSession(sessionId);

    // Also invalidate the token if it's not the current session
    const currentToken = req.headers.authorization?.replace('Bearer ', '');
    if (sessionId !== currentToken) {
      // Token will be invalidated when session is deleted
      // invalidateToken is not available, sessions are managed via storage
    }

    securityLogger.logEvent({
      type: SecurityEventType.SESSIONTERMINATED,
      severity: 'MEDIUM',
      userId: req.user.id,
      userEmail: req.user.email,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      endpoint: req.originalUrl,
      success: true,
      details: {
  sessionId,
        terminatedByUser: true,
      },
    });

    res.json({ message: 'Sessão encerrada com sucesso' });
  }
catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ message: 'Erro ao encerrar sessão' });
  }
});

// User profile endpoint for RBAC context
// GET /api/auth/profile
router.get('/profile', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({error: "Unauthorized"});
    }

    res.json({
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      full_name: req.user.fullname,
      loja_id: req.user.lojaid,
    });
  }
catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

export default router;
