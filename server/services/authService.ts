/**
 * Auth Service
 * Business logic for authentication operations
 * PAM V1.0 - Service layer implementation
 */

import { authRepository } from '../repositories/auth.repository.js';
import { createServerSupabaseClient, createServerSupabaseAdminClient } from '../lib/supabase.js';
import { validatePassword } from '../lib/password-validator.js';
import { securityLogger, SecurityEventType, getClientIP } from '../lib/security-logger.js';
import { invalidateAllUserTokens, trackUserToken } from '../lib/jwt-auth-middleware.js';
import type { Request } from 'express';
import type { User, Session } from '@shared/schema';

export class AuthService {
  /**
   * Parse user agent for better display
   */
  private parseUserAgent(userAgent: string): string {
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

  /**
   * Handle user login
   */
  async login(
    email: string,
    password: string,
    req: Request
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const supabase = createServerSupabaseClient();

      // Check if user already has active sessions
      const {
        data: { user: existingUser },
      } = await supabase.auth.getUser();

      // Attempt login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        await securityLogger.logEvent({
          type: SecurityEventType.LOGIN_FAILURE,
          severity: 'MEDIUM',
          userEmail: email,
          ipAddress: getClientIP(req),
          userAgent: req.headers['user-agent'],
          endpoint: req.originalUrl,
          success: false,
          details: { reason: error.message },
        });
        return { success: false, error: error.message };
      }

      // Handle successful login
      if (data.user && data.session) {
        // Invalidate all previous tokens for this user
        invalidateAllUserTokens(data.user.id);

        // Track the new token
        trackUserToken(data.user.id, data.session.access_token);

        // Create session record
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);

        await authRepository.createSession({
          id: data.session.access_token,
          userId: data.user.id,
          token: data.session.access_token,
          ipAddress: getClientIP(req),
          userAgent: req.headers['user-agent'] || 'Unknown',
          expiresAt,
        });

        await securityLogger.logEvent({
          type: SecurityEventType.LOGIN_SUCCESS,
          severity: 'LOW',
          userId: data.user.id,
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

        return {
          success: true,
          data: {
            user: data.user,
            session: data.session,
          },
        };
      }

      return { success: false, error: 'Login failed' };
    } catch (error) {
      console.error('[AUTH_SERVICE] Login error:', error);
      return { success: false, error: 'Login failed' };
    }
  }

  /**
   * Handle user registration
   */
  async register(
    email: string,
    password: string,
    name?: string
  ): Promise<{ success: boolean; data?: any; error?: string; suggestions?: string[] }> {
    try {
      // Validate password
      const passwordValidation = validatePassword(password, [email, name || '']);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          error: passwordValidation.message,
          suggestions: passwordValidation.suggestions,
        };
      }

      const supabase = createServerSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: {
          user: data.user,
          session: data.session,
        },
      };
    } catch (error) {
      console.error('[AUTH_SERVICE] Register error:', error);
      return { success: false, error: 'Registration failed' };
    }
  }

  /**
   * Handle user logout
   */
  async logout(): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = createServerSupabaseClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('[AUTH_SERVICE] Logout error:', error);
      return { success: false, error: 'Logout failed' };
    }
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    userEmail: string,
    currentPassword: string,
    newPassword: string,
    req: Request
  ): Promise<{
    success: boolean;
    error?: string;
    suggestions?: string[];
    requiresRelogin?: boolean;
  }> {
    try {
      // Validate new password
      const passwordValidation = validatePassword(newPassword, [userEmail]);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          error: passwordValidation.message,
          suggestions: passwordValidation.suggestions,
        };
      }

      // Verify current password
      const supabase = createServerSupabaseClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (signInError) {
        await securityLogger.logEvent({
          type: SecurityEventType.PASSWORD_CHANGE_FAILED,
          severity: 'HIGH',
          userId: userId,
          userEmail: userEmail,
          ipAddress: getClientIP(req),
          userAgent: req.headers['user-agent'],
          endpoint: req.originalUrl,
          success: false,
          details: { reason: 'Invalid current password' },
        });
        return { success: false, error: 'Senha atual incorreta' };
      }

      // Update password
      const supabaseAdmin = createServerSupabaseAdminClient();
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (updateError) {
        console.error('[AUTH_SERVICE] Password update error:', updateError);
        return { success: false, error: 'Erro ao atualizar senha. Tente novamente.' };
      }

      // Invalidate all existing tokens
      invalidateAllUserTokens(userId);

      await securityLogger.logEvent({
        type: SecurityEventType.PASSWORD_CHANGED,
        severity: 'HIGH',
        userId: userId,
        userEmail: userEmail,
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
        endpoint: req.originalUrl,
        success: true,
        details: {
          message: 'Password changed successfully, all sessions invalidated',
        },
      });

      return {
        success: true,
        requiresRelogin: true,
      };
    } catch (error) {
      console.error('[AUTH_SERVICE] Change password error:', error);
      return { success: false, error: 'Erro ao alterar senha' };
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(
    email: string,
    req: Request
  ): Promise<{ success: boolean; message: string }> {
    try {
      const supabase = createServerSupabaseClient();

      // Always return the same message to prevent user enumeration
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.VITE_APP_URL || 'http://localhost:5000'}/reset-password`,
      });

      // Log the attempt
      await securityLogger.logEvent({
        type: SecurityEventType.PASSWORD_RESET_REQUEST,
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

      // Always return the same message (ASVS 6.3.1)
      return {
        success: true,
        message:
          'Se o email existe em nosso sistema, você receberá instruções para redefinir sua senha.',
      };
    } catch (error) {
      console.error('[AUTH_SERVICE] Password reset error:', error);
      return {
        success: false,
        message: 'Erro ao processar solicitação',
      };
    }
  }

  /**
   * Get user sessions
   */
  async getUserSessions(userId: string, currentToken?: string): Promise<{ sessions: any[] }> {
    try {
      const sessions = await authRepository.getUserSessions(userId);

      // Format sessions for frontend display
      const formattedSessions = sessions.map((session) => ({
        id: session.id,
        ipAddress: session.ipAddress || 'Desconhecido',
        userAgent: session.userAgent || 'Desconhecido',
        createdAt: session.createdAt,
        lastActivityAt: session.lastActivityAt,
        expiresAt: session.expiresAt,
        isActive: session.isActive,
        device: this.parseUserAgent(session.userAgent || ''),
        isCurrent: session.id === currentToken,
      }));

      return { sessions: formattedSessions };
    } catch (error) {
      console.error('[AUTH_SERVICE] Error fetching sessions:', error);
      throw new Error('Erro ao buscar sessões');
    }
  }

  /**
   * Delete a specific session
   */
  async deleteSession(
    userId: string,
    sessionId: string,
    req: Request
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Verify the session belongs to the user
      const sessions = await authRepository.getUserSessions(userId);
      const sessionToDelete = sessions.find((s) => s.id === sessionId);

      if (!sessionToDelete) {
        return { success: false, error: 'Sessão não encontrada' };
      }

      // Delete the session
      const deleted = await authRepository.deleteSession(sessionId);

      if (deleted) {
        await securityLogger.logEvent({
          type: SecurityEventType.SESSION_TERMINATED,
          severity: 'MEDIUM',
          userId: userId,
          userEmail: (req as any).user?.email || '',
          ipAddress: getClientIP(req),
          userAgent: req.headers['user-agent'],
          endpoint: req.originalUrl,
          success: true,
          details: {
            sessionId,
            terminatedByUser: true,
          },
        });
      }

      return { success: deleted };
    } catch (error) {
      console.error('[AUTH_SERVICE] Error deleting session:', error);
      return { success: false, error: 'Erro ao encerrar sessão' };
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<any> {
    try {
      return await authRepository.getUserProfile(userId);
    } catch (error) {
      console.error('[AUTH_SERVICE] Error getting user profile:', error);
      throw new Error('Erro ao buscar perfil do usuário');
    }
  }

  /**
   * Clean up expired sessions (scheduled task)
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      return await authRepository.cleanupExpiredSessions();
    } catch (error) {
      console.error('[AUTH_SERVICE] Error cleaning up sessions:', error);
      return 0;
    }
  }
}

export const authService = new AuthService();
