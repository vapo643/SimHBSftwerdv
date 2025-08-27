/**
 * Auth Routes - REFACTORED
 * Controller layer using service pattern
 * PAM V1.0 - Clean architecture implementation
 */

import { Router, Request, Response } from 'express';
import { authService } from '../../services/authService.js';
import { jwtAuthMiddleware } from '../../lib/jwt-auth-middleware.js';
import { getClientIP } from '../../lib/security-logger.js';
import { AuthenticatedRequest } from '../../../shared/types/express';

const router = Router();

/**
 * POST /api/auth/login
 * User authentication endpoint
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email e senha são obrigatórios',
      });
    }

    const result = await authService.login(email, password, req);

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(401).json({ message: result.error });
    }
  } catch (error: any) {
    console.error('[AUTH_CONTROLLER] Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

/**
 * POST /api/auth/register
 * User registration endpoint
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email e senha são obrigatórios',
      });
    }

    const result = await authService.register(email, password, name);

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(400).json({
        message: result.error,
        suggestions: result.suggestions,
      });
    }
  } catch (error: any) {
    console.error('[AUTH_CONTROLLER] Register error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
});

/**
 * POST /api/auth/logout
 * User logout endpoint
 */
router.post('/logout', jwtAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await authService.logout();

    if (result.success) {
      res.json({ message: 'Logged out successfully' });
    } else {
      res.status(400).json({ message: result.error });
    }
  } catch (error: any) {
    console.error('[AUTH_CONTROLLER] Logout error:', error);
    res.status(500).json({ message: 'Logout failed' });
  }
});

/**
 * POST /api/auth/change-password
 * Change user password with current password verification
 */
router.post('/change-password', jwtAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { currentPassword, newPassword, confirmPassword } = authReq.body;

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

    if (!authReq.user?.id || !authReq.user?.email) {
      return res.status(401).json({
        message: 'Usuário não autenticado corretamente',
      });
    }

    const result = await authService.changePassword(
      authReq.user.id,
      authReq.user.email,
      currentPassword,
      newPassword,
      req
    );

    if (result.success) {
      res.json({
        message: 'Senha alterada com sucesso. Por favor, faça login novamente.',
        requiresRelogin: result.requiresRelogin,
      });
    } else {
      res.status(401).json({
        message: result.error,
        suggestions: result.suggestions,
      });
    }
  } catch (error: any) {
    console.error('[AUTH_CONTROLLER] Change password error:', error);
    res.status(500).json({ message: 'Erro ao alterar senha' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: 'Email é obrigatório',
      });
    }

    const result = await authService.requestPasswordReset(email, req);
    res.json({ message: result.message });
  } catch (error: any) {
    console.error('[AUTH_CONTROLLER] Password reset error:', error);
    res.status(500).json({ message: 'Erro ao processar solicitação' });
  }
});

/**
 * GET /api/auth/sessions
 * List all user sessions
 */
router.get('/sessions', jwtAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user?.id) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const currentToken = authReq.headers.authorization?.replace('Bearer ', '');
    const result = await authService.getUserSessions(authReq.user.id, currentToken);

    res.json(result);
  } catch (error: any) {
    console.error('[AUTH_CONTROLLER] Error fetching sessions:', error);
    res.status(500).json({ message: 'Erro ao buscar sessões' });
  }
});

/**
 * DELETE /api/auth/sessions/:sessionId
 * Terminate a specific session
 */
router.delete('/sessions/:sessionId', jwtAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { sessionId } = authReq.params;

    if (!authReq.user?.id) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const result = await authService.deleteSession(authReq.user.id, sessionId, authReq);

    if (result.success) {
      res.json({ message: 'Sessão encerrada com sucesso' });
    } else {
      res.status(404).json({ message: result.error || 'Sessão não encontrada' });
    }
  } catch (error: any) {
    console.error('[AUTH_CONTROLLER] Error deleting session:', error);
    res.status(500).json({ message: 'Erro ao encerrar sessão' });
  }
});

/**
 * GET /api/auth/profile
 * Get current user profile
 */
router.get('/profile', jwtAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    res.json({
      id: authReq.user.id,
      email: authReq.user.email,
      role: authReq.user.role,
      full_name: authReq.user.full_name,
      loja_id: authReq.user.loja_id,
    });
  } catch (error: any) {
    console.error('[AUTH_CONTROLLER] Error fetching profile:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/auth/validate
 * Validate current session
 */
router.get('/validate', jwtAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      return res.status(401).json({
        valid: false,
        message: 'Token inválido ou expirado',
      });
    }

    res.json({
      valid: true,
      user: {
        id: authReq.user.id,
        email: authReq.user.email,
        role: authReq.user.role,
      },
    });
  } catch (error: any) {
    console.error('[AUTH_CONTROLLER] Error validating session:', error);
    res.status(500).json({
      valid: false,
      message: 'Erro ao validar sessão',
    });
  }
});

export default router;
