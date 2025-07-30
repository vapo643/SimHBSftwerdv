import { Request, Response, NextFunction } from 'express';
import { createServerSupabaseClient } from '../../client/src/lib/supabase';
import { securityLogger, SecurityEventType, getClientIP } from './security-logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string | null;
    full_name?: string | null;
    loja_id?: number | null;
  };
}

/**
 * Middleware de autenticação JWT robusto com fallback de segurança
 * Implementa validação completa e bloqueia usuários órfãos
 */
export async function jwtAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Step a: Validate JWT token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      securityLogger.logEvent({
        type: SecurityEventType.TOKEN_INVALID,
        severity: "MEDIUM",
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
        endpoint: req.originalUrl,
        success: false,
        details: { reason: 'Missing or invalid authorization header' }
      });
      return res.status(401).json({ message: 'Token de acesso requerido' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate token and extract user ID
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
      securityLogger.logEvent({
        type: error?.message?.includes('expired') ? SecurityEventType.TOKEN_EXPIRED : SecurityEventType.TOKEN_INVALID,
        severity: "MEDIUM",
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
        endpoint: req.originalUrl,
        success: false,
        details: { reason: error?.message || 'Invalid token' }
      });
      return res.status(401).json({ message: 'Token inválido ou expirado' });
    }

    // Step b: Extract user ID
    const userId = data.user.id;
    const userEmail = data.user.email || '';

    // Step c: Query profiles table for complete user profile
    const { createServerSupabaseAdminClient } = await import('./supabase');
    const supabaseAdmin = createServerSupabaseAdminClient();
    
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, loja_id')
      .eq('id', userId)
      .single();

    // Step d: Security fallback - Block orphaned users (no profile)
    if (profileError || !profile) {
      console.error('Profile query failed:', profileError);
      securityLogger.logEvent({
        type: SecurityEventType.ACCESS_DENIED,
        severity: "HIGH",
        userId,
        userEmail,
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
        endpoint: req.originalUrl,
        success: false,
        details: { reason: 'Orphaned user - no profile found', error: profileError?.message }
      });
      return res.status(403).json({ 
        message: 'Acesso negado. Perfil de usuário não encontrado.',
        code: 'ORPHANED_USER'
      });
    }

    // Step e: Attach complete and valid profile to req.user
    req.user = {
      id: userId,
      email: userEmail,
      role: profile.role,
      full_name: profile.full_name || null,
      loja_id: profile.loja_id || null
    };

    next();
  } catch (error) {
    console.error('JWT Auth middleware error:', error);
    res.status(500).json({ message: 'Erro interno de autenticação' });
  }
}

/**
 * Legacy function - maintained for backward compatibility
 * @deprecated Use jwtAuthMiddleware directly
 */
export async function extractRoleFromToken(authToken: string): Promise<string | null> {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.auth.getUser(authToken);
    
    if (error || !data.user) {
      return null;
    }

    const { createServerSupabaseAdminClient } = await import('./supabase');
    const supabaseAdmin = createServerSupabaseAdminClient();
    
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    return profile?.role || null;
  } catch (error) {
    console.error('Error extracting role from token:', error);
    return null;
  }
}