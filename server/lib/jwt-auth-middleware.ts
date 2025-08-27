import { Request, Response, NextFunction } from 'express';
// Import dinâmico para usar função correta com Service Role Key
import { securityLogger, SecurityEventType, getClientIP } from './security-logger';
// Importação direta da interface personalizada
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username?: string;
    email?: string;
    role?: string | null;
    full_name?: string | null;
    loja_id?: number | null;
  };
  sessionID?: string;
  file?: Express.Multer.File;
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
}

// Interface já definida acima

// Token blacklist para segurança aprimorada (SAMM Optimization)
const tokenBlacklist = new Set<string>();
const TOKEN_BLACKLIST_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hora

// Rate limiting por usuário (SAMM Optimization)
const userAuthAttempts = new Map<string, { count: number; resetTime: number }>();
const MAX_AUTH_ATTEMPTS = 10;
const AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

// User token tracking for invalidation on account deactivation
const userTokens = new Map<string, Set<string>>(); // userId -> Set of tokens

// Limpar blacklist periodicamente
setInterval(() => {
  tokenBlacklist.clear();
  userTokens.clear();
}, TOKEN_BLACKLIST_CLEANUP_INTERVAL);

/**
 * Adiciona um token ao blacklist (ASVS 7.1.3 - Token Rotation)
 */
export function addToBlacklist(token: string): void {
  tokenBlacklist.add(token);
  securityLogger.logEvent({
    type: SecurityEventType.TOKEN_BLACKLISTED,
    severity: 'LOW',
    success: true,
    details: { reason: 'Token added to blacklist' },
  });
}

/**
 * Invalida todos os tokens de um usuário (ASVS 7.2.4 - Token Rotation on Login)
 * Também usado para ASVS 8.3.7 - Account Deactivation
 */
export function invalidateAllUserTokens(userId: string): void {
  const tokens = userTokens.get(userId);
  if (tokens && tokens.size > 0) {
    tokens.forEach((token) => tokenBlacklist.add(token));
    userTokens.delete(userId);
    securityLogger.logEvent({
      type: SecurityEventType.TOKEN_BLACKLISTED,
      severity: 'HIGH',
      userId,
      success: true,
      details: {
        reason: 'All user tokens invalidated - token rotation',
        tokenCount: tokens.size,
      },
    });
  }
}

/**
 * Rastreia um token para um usuário
 */
export function trackUserToken(userId: string, token: string): void {
  if (!userTokens.has(userId)) {
    userTokens.set(userId, new Set());
  }
  userTokens.get(userId)!.add(token);
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
    // Log detalhado para TODAS as rotas (diagnóstico completo)
    console.log('[JWT DEBUG] ==== INÍCIO DA VALIDAÇÃO JWT ====');
    console.log('[JWT DEBUG] Rota acessada:', req.path);
    console.log('[JWT DEBUG] Método:', req.method);
    console.log('[JWT DEBUG] User-Agent:', req.headers['user-agent']);
    console.log('[JWT DEBUG] Origin:', req.headers.origin);
    console.log('[JWT DEBUG] Referer:', req.headers.referer);

    // Step a: Validate JWT token
    const authHeader = req.headers.authorization;
    console.log('[JWT DEBUG] Header Auth presente:', !!authHeader);
    console.log('[JWT DEBUG] Header começa com Bearer:', authHeader?.startsWith('Bearer '));

    // Debug adicional para PDF downloads
    if (req.path.includes('/pdf')) {
      console.log('[JWT DEBUG - PDF ESPECÍFICO] Request path:', req.path);
      console.log('[JWT DEBUG - PDF ESPECÍFICO] Auth header completo length:', authHeader?.length);
      console.log(
        '[JWT DEBUG - PDF ESPECÍFICO] Token preview:',
        authHeader?.substring(0, 50) + '...'
      );
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (req.path.includes('/pdf')) {
        console.error('[JWT AUTH - PDF DOWNLOAD] Missing or invalid auth header');
      }
      securityLogger.logEvent({
        type: SecurityEventType.TOKEN_INVALID,
        severity: 'MEDIUM',
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
        endpoint: req.originalUrl,
        success: false,
        details: { reason: 'Missing or invalid authorization header' },
      });
      return res.status(401).json({ message: 'Token de acesso requerido' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Debug logging para PDF downloads - token info
    if (req.path.includes('/pdf')) {
      console.log('[JWT AUTH - PDF DOWNLOAD] Token length:', token.length);
      console.log(
        '[JWT AUTH - PDF DOWNLOAD] Token first 20 chars:',
        token.substring(0, 20) + '...'
      );
    }

    // SAMM Optimization: Check token blacklist
    if (tokenBlacklist.has(token)) {
      securityLogger.logEvent({
        type: SecurityEventType.TOKEN_INVALID,
        severity: 'HIGH',
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
        endpoint: req.originalUrl,
        success: false,
        details: { reason: 'Token is blacklisted' },
      });
      return res.status(401).json({ message: 'Token inválido' });
    }

    let userId: string | undefined;
    let userEmail: string | undefined;
    let data: unknown = null;
    let error: unknown = null;

    // Auto-detect token type by checking JWT header
    let tokenType: 'supabase' | 'local' = 'local';
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        const header = JSON.parse(Buffer.from(tokenParts[0], 'base64').toString());
        // Supabase tokens have 'kid' (Key ID) in header
        if (header.kid) {
          tokenType = 'supabase';
        }
      }
    } catch (e) {
      // If header parsing fails, default to local
      tokenType = 'local';
    }

    console.log('[JWT DEBUG] Auto-detected token type:', tokenType);

    if (tokenType === 'supabase') {
      // Use Supabase validation for Supabase tokens
      try {
        console.log('[JWT DEBUG] Using Supabase token validation');
        const { createServerSupabaseAdminClient } = await import('./supabase');
        const supabase = createServerSupabaseAdminClient();
        const supabaseResult = await supabase.auth.getUser(token);

        data = supabaseResult.data;
        error = supabaseResult.error;

        if (data?.user) {
          userId = data.user.id;
          userEmail = data.user.email || '';
        }
      } catch (supabaseError: unknown) {
        console.error('[JWT DEBUG] Supabase validation failed:', supabaseError.message);
        error = { message: supabaseError.message };
        data = null;
      }
    } else {
      // Use local JWT validation for local tokens
      try {
        console.log('[JWT DEBUG] Using local JWT validation');
        const jwt = await import('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-key';

        const decoded = jwt.default.verify(token, JWT_SECRET) as unknown;
        console.log('[JWT DEBUG] JWT decoded successfully:', {
          userId: decoded.userId,
          email: decoded.email,
          role: decoded.role,
        });

        userId = decoded.userId;
        userEmail = decoded.email || '';

        // Create mock data object for consistency
        data = { user: { id: userId, email: userEmail } };
        error = null;
      } catch (jwtError: unknown) {
        console.error('[JWT DEBUG] Local JWT verification failed:', jwtError.message);
        error = { message: jwtError.message };
        data = null;
      }
    }

    // Log completo do erro (CRUCIAL para diagnóstico)
    if (error) {
      console.error('[JWT DEBUG] Falha na validação. Erro completo:', {
        message: error.message,
        mode: tokenType.toUpperCase(),
        fullError: JSON.stringify(error, null, 2),
      });
    }

    // Security-aware logging - OWASP ASVS V7.1.1
    if (process.env.NODE_ENV === 'development') {
      console.log('🔐 JWT VALIDATION:', {
        hasError: !!error,
        errorType: error?.message || null,
        hasUser: !!data?.user,
        userId: data?.user?.id,
        timestamp: new Date().toISOString(),
        mode: tokenType.toUpperCase(),
      });
    }

    if (error || !data?.user || !userId || !userEmail) {
      console.error('[JWT DEBUG] ==== FIM DA VALIDAÇÃO JWT (FALHA) ====');
      securityLogger.logEvent({
        type: error?.message?.includes('expired')
          ? SecurityEventType.TOKEN_EXPIRED
          : SecurityEventType.TOKEN_INVALID,
        severity: 'MEDIUM',
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
        endpoint: req.originalUrl,
        success: false,
        details: { reason: error?.message || 'Invalid token' },
      });
      return res.status(401).json({ message: 'Token inválido ou expirado' });
    }

    // Step c: Query profiles table using direct DB connection (bypasses RLS)
    const { db } = await import('./supabase');
    const { profiles } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');

    const profileResult = await db
      .select({
        id: profiles.id,
        fullName: profiles.fullName,
        role: profiles.role,
        lojaId: profiles.lojaId,
      })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    // Step d: Security fallback - Block orphaned users (no profile)
    if (!profileResult.length) {
      console.error('Profile query failed: No profile found for user', userId);
      securityLogger.logEvent({
        type: SecurityEventType.ACCESS_DENIED,
        severity: 'HIGH',
        userId,
        userEmail,
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
        endpoint: req.originalUrl,
        success: false,
        details: { reason: 'Orphaned user - no profile found' },
      });
      return res.status(403).json({
        message: 'Acesso negado. Perfil de usuário não encontrado.',
        code: 'ORPHANED_USER',
      });
    }

    const profile = profileResult[0];

    // Track the current token for this user (for token rotation)
    trackUserToken(userId, token);

    // Step e: Attach complete and valid profile to req.user
    req.user = {
      id: userId,
      email: userEmail,
      role: profile.role,
      full_name: profile.fullName || null,
      loja_id: profile.lojaId || null,
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
    const { createServerSupabaseAdminClient } = await import('./supabase');
    const supabase = createServerSupabaseAdminClient();
    const { data, error } = await supabase.auth.getUser(authToken);

    if (error || !data.user) {
      return null;
    }

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
