import { Request, Response, NextFunction } from 'express';
// Import dinâmico para usar função correta com Service Role Key
import { securityLogger, SecurityEventType, getClientIP } from './security-logger';
// REFATORADO: Redis client via Redis Manager centralizado
import { getRedisClient } from './redis-manager';
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

// Constants for Redis-based security features
const TOKEN_BLACKLIST_TTL = 60 * 60; // 1 hour in seconds
// Configuração dinâmica por ambiente
const isDevelopment = process.env.NODE_ENV === 'development';
const MAX_AUTH_ATTEMPTS = isDevelopment ? 10000 : 50; // 10k dev, 50 prod
const AUTH_WINDOW_MS = isDevelopment ? 1 * 60 * 1000 : 15 * 60 * 1000; // 1min dev, 15min prod
const AUTH_ATTEMPTS_TTL = Math.ceil(AUTH_WINDOW_MS / 1000); // Convert to seconds

// REFATORADO: Redis client via Redis Manager centralizado (lazy loading)
let redisClient: any = null;

async function getRedisClientLazy() {
  if (!redisClient) {
    redisClient = await getRedisClient();
  }
  return redisClient;
}
const CACHE_TTL_SECONDS = 600; // 10 minutes in seconds for Redis TTL (P0.1 optimization)
const VALIDATION_TIMEOUT_MS = 15000; // 15 second timeout for token validation
const validationSemaphore = new Map<string, Promise<any>>(); // Prevent concurrent validation of same token

// Enhanced token cache entry interface with profile data (P0.1 optimization)
interface TokenCacheEntry {
  userId: string;
  userEmail: string;
  profile?: {
    role?: string | null;
    fullName?: string | null;
    lojaId?: number | null;
  };
  timestamp: number;
}

// Redis TTL handles automatic cleanup - no manual intervals needed

/**
 * Distributed rate limiting for authentication attempts using Redis
 */
async function checkAuthRateLimit(identifier: string): Promise<boolean> {
  try {
    const redis = await getRedisClientLazy();
    const key = `auth_attempts:${identifier}`;
    const attempts = await redis.get(key);

    if (isDevelopment) {
      console.log(
        `[JWT DEBUG] Rate limit check for ${identifier}: attempts=${attempts}, max=${MAX_AUTH_ATTEMPTS}, window=${AUTH_WINDOW_MS}ms`
      );
    }

    if (!attempts) {
      // First attempt - set counter with TTL
      await redis.setex(key, AUTH_ATTEMPTS_TTL, '1');
      if (isDevelopment) console.log(`[JWT DEBUG] First attempt for ${identifier}, allowing`);
      return true; // Allow
    }

    const attemptCount = parseInt(attempts, 10);
    if (attemptCount >= MAX_AUTH_ATTEMPTS) {
      if (isDevelopment)
        console.log(
          `[JWT DEBUG] Rate limit exceeded for ${identifier}: ${attemptCount}/${MAX_AUTH_ATTEMPTS}`
        );
      return false; // Rate limited
    }

    // Increment counter and refresh TTL
    await redis.incr(key);
    await redis.expire(key, AUTH_ATTEMPTS_TTL);
    if (isDevelopment)
      console.log(
        `[JWT DEBUG] Incremented attempts for ${identifier}: ${attemptCount + 1}/${MAX_AUTH_ATTEMPTS}`
      );
    return true; // Allow
  } catch (error) {
    console.error('[JWT AUTH] Rate limit check failed:', error);
    return true; // Allow on Redis error - don't block auth flow
  }
}

/**
 * Adiciona um token ao blacklist distribuído via Redis (ASVS 7.1.3 - Token Rotation)
 */
export async function addToBlacklist(token: string): Promise<void> {
  try {
    const redis = await getRedisClientLazy();
    await redis.setex(`blacklist:${token}`, TOKEN_BLACKLIST_TTL, '1');
    securityLogger.logEvent({
      type: SecurityEventType.TOKEN_BLACKLISTED,
      severity: 'LOW',
      success: true,
      details: { reason: 'Token added to distributed blacklist' },
    });
  } catch (error) {
    console.error('[JWT AUTH] Failed to add token to blacklist:', error);
    // Log error but don't throw to prevent blocking auth flow
  }
}

/**
 * Invalida todos os tokens de um usuário via Redis distribuído (ASVS 7.2.4 - Token Rotation on Login)
 * Também usado para ASVS 8.3.7 - Account Deactivation
 */
export async function invalidateAllUserTokens(userId: string): Promise<void> {
  try {
    // Get all tokens for user from Redis set
    const tokens = await redisClient.smembers(`user_tokens:${userId}`);

    if (tokens.length > 0) {
      // Add each token to blacklist
      const blacklistPromises = tokens.map((token: string) =>
        redisClient.setex(`blacklist:${token}`, TOKEN_BLACKLIST_TTL, '1')
      );

      // Remove the user tokens set
      await Promise.all([...blacklistPromises, redisClient.del(`user_tokens:${userId}`)]);

      securityLogger.logEvent({
        type: SecurityEventType.TOKEN_BLACKLISTED,
        severity: 'HIGH',
        userId,
        success: true,
        details: {
          reason: 'All user tokens invalidated via distributed cache',
          tokenCount: tokens.length,
        },
      });
    }
  } catch (error) {
    console.error('[JWT AUTH] Failed to invalidate user tokens:', error);
    // Log error but don't throw to prevent blocking auth flow
  }
}

/**
 * Rastreia um token para um usuário via Redis distribuído
 */
export async function trackUserToken(userId: string, token: string): Promise<void> {
  try {
    // Add token to user's Redis set with TTL matching token cache
    await redisClient.sadd(`user_tokens:${userId}`, token);
    await redisClient.expire(`user_tokens:${userId}`, CACHE_TTL_SECONDS);
  } catch (error) {
    console.error('[JWT AUTH] Failed to track user token:', error);
    // Log error but don't throw to prevent blocking auth flow
  }
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

    // Distributed rate limiting check (SAMM Optimization)
    const clientIP = getClientIP(req);
    if (isDevelopment) {
      console.log(
        `[JWT DEBUG] Checking auth rate limit for IP: ${clientIP}, environment: ${process.env.NODE_ENV}`
      );
    }
    const isAllowed = await checkAuthRateLimit(clientIP);
    if (!isAllowed) {
      securityLogger.logEvent({
        type: SecurityEventType.TOKEN_INVALID,
        severity: 'HIGH',
        ipAddress: clientIP,
        userAgent: req.headers['user-agent'],
        endpoint: req.originalUrl,
        success: false,
        details: { reason: 'Too many authentication attempts - rate limited' },
      });
      return res
        .status(429)
        .json({ message: 'Muitas tentativas de autenticação. Tente novamente mais tarde.' });
    }

    // P0.3 OPTIMIZATION: Redis Pipeline for batch operations
    let isBlacklisted = false;
    let cachedEntry: TokenCacheEntry | null = null;

    try {
      const pipeline = redisClient.pipeline();
      pipeline.get(`blacklist:${token}`);
      pipeline.get(`token:${token}`);
      const results = await pipeline.exec();

      // Process results from pipeline
      if (results) {
        const [blacklistResult, cacheResult] = results;
        isBlacklisted = !!blacklistResult[1]; // blacklistResult[0] is error, [1] is value

        if (cacheResult[1]) {
          cachedEntry = JSON.parse(cacheResult[1] as string);
          console.log('[JWT DEBUG] Using Redis cached token validation (pipelined)');
        }
      }
    } catch (redisError) {
      console.warn('[JWT AUTH] Redis pipeline failed, proceeding with fallback:', redisError);
      // Fallback to individual operations if pipeline fails
      try {
        isBlacklisted = !!(await redisClient.get(`blacklist:${token}`));
      } catch (e) {
        console.warn('[JWT AUTH] Blacklist check failed:', e);
      }
    }

    // Check blacklist result
    if (isBlacklisted) {
      securityLogger.logEvent({
        type: SecurityEventType.TOKEN_INVALID,
        severity: 'HIGH',
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
        endpoint: req.originalUrl,
        success: false,
        details: { reason: 'Token is blacklisted via distributed cache' },
      });
      return res.status(401).json({ message: 'Token inválido' });
    }

    let userId: string | undefined;
    let userEmail: string | undefined;
    let data: any = null;
    let error: any = null;
    let profileFromCache: any = null;

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

    // P0.1 OPTIMIZATION: Use cached entry with profile data
    if (cachedEntry) {
      userId = cachedEntry.userId;
      userEmail = cachedEntry.userEmail;
      profileFromCache = cachedEntry.profile;
      data = { user: { id: userId, email: userEmail } };
      error = null;
    }

    if (userId && userEmail) {
      // Token found in cache, skip validation
    } else if (validationSemaphore.has(token)) {
      // Wait for ongoing validation of the same token
      console.log('[JWT DEBUG] Token validation in progress - waiting...');
      try {
        const result = await validationSemaphore.get(token)!;
        userId = result.userId;
        userEmail = result.userEmail;
        data = result.data;
        error = result.error;
      } catch (semaphoreError: any) {
        console.error('[JWT DEBUG] Semaphore wait failed:', semaphoreError.message);
        error = { message: semaphoreError.message };
        data = null;
      }
    } else if (tokenType === 'supabase') {
      // Create semaphore entry for this token validation with timeout
      const validationPromise = (async () => {
        try {
          console.log('[JWT DEBUG] Using Supabase token validation with timeout');
          const { createServerSupabaseAdminClient } = await import('./supabase');
          const supabase = createServerSupabaseAdminClient();

          // Add timeout to prevent hanging validation
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Token validation timeout')), VALIDATION_TIMEOUT_MS)
          );

          const supabaseResult = (await Promise.race([
            supabase.auth.getUser(token),
            timeoutPromise,
          ])) as any;

          const result = {
            userId: supabaseResult.data?.user?.id,
            userEmail: supabaseResult.data?.user?.email || '',
            data: supabaseResult.data,
            error: supabaseResult.error,
          };

          // P0.1 OPTIMIZATION: Cache with profile data to eliminate DB query
          if (!supabaseResult.error && supabaseResult.data?.user) {
            try {
              // Fetch profile data once for cache
              const { db } = await import('./supabase');
              const { profiles } = await import('@shared/schema');
              const { eq } = await import('drizzle-orm');

              const profileResult = await db
                .select({
                  role: profiles.role,
                  fullName: profiles.fullName,
                  lojaId: profiles.lojaId,
                })
                .from(profiles)
                .where(eq(profiles.id, result.userId!))
                .limit(1);

              const profileData = profileResult.length ? profileResult[0] : null;

              const cacheEntry: TokenCacheEntry = {
                userId: result.userId!,
                userEmail: result.userEmail,
                profile: profileData || undefined,
                timestamp: Date.now(),
              };
              await redisClient.setex(
                `token:${token}`,
                CACHE_TTL_SECONDS,
                JSON.stringify(cacheEntry)
              );
              console.log('[JWT DEBUG] Token cached in Redis with profile data');
            } catch (redisError) {
              console.warn('[JWT DEBUG] Failed to cache token in Redis:', redisError);
              // Continue without cache - not critical
            }
          }

          return result;
        } catch (supabaseError: any) {
          console.error('[JWT DEBUG] Supabase validation failed:', supabaseError.message);
          return {
            userId: undefined,
            userEmail: '',
            data: null,
            error: { message: supabaseError.message },
          };
        } finally {
          validationSemaphore.delete(token);
        }
      })();

      validationSemaphore.set(token, validationPromise);
      const result = await validationPromise;

      userId = result.userId;
      userEmail = result.userEmail;
      data = result.data;
      error = result.error;
    } else {
      // Use local JWT validation for local tokens
      try {
        console.log('[JWT DEBUG] Using local JWT validation');
        const jwt = await import('jsonwebtoken');
        
        // Tentar diferentes naming conventions para credenciais
        const JWT_SECRET = process.env.NODE_ENV === 'production' 
          ? (process.env.PROD_SUPABASE_JWT_SECRET || process.env.PROD_JWT_SECRET || process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET)
          : (process.env.DEV_SUPABASE_JWT_SECRET || process.env.DEV_JWT_SECRET || process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET);
        
        console.log(`[JWT DEBUG] SECRET encontrado: ${!!JWT_SECRET} (ambiente: ${process.env.NODE_ENV})`);
        
        // Verificação de segurança: não permitir chaves nulas ou indefinidas
        if (!JWT_SECRET) {
          const requiredVar = process.env.NODE_ENV === 'production' ? 'PROD_SUPABASE_JWT_SECRET' : 'DEV_SUPABASE_JWT_SECRET';
          console.error(`[JWT ERROR] Nenhuma JWT_SECRET encontrada. Variáveis tentadas:`, {
            primary: requiredVar,
            fallback1: 'SUPABASE_JWT_SECRET',
            fallback2: 'JWT_SECRET',
            environment: process.env.NODE_ENV
          });
          throw new Error(`JWT_SECRET não configurado para ambiente ${process.env.NODE_ENV}. Configure ${requiredVar} ou SUPABASE_JWT_SECRET`);
        }

        const decoded = jwt.default.verify(token, JWT_SECRET) as any;
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
      } catch (jwtError: any) {
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

    // P0.1 OPTIMIZATION: Use cached profile data or query as fallback
    let profile: any;

    if (profileFromCache) {
      console.log('[JWT DEBUG] Using cached profile data - no DB query needed');
      profile = profileFromCache;
    } else {
      console.log('[JWT DEBUG] Profile not in cache, querying database');
      const { db } = await import('./supabase');
      const { profiles } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');

      const profileResult = await db
        .select({
          role: profiles.role,
          fullName: profiles.fullName,
          lojaId: profiles.lojaId,
        })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);

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

      profile = profileResult[0];
    }

    // Security fallback - Block users without profile
    if (!profile) {
      console.error('Profile validation failed: No profile data for user', userId);
      securityLogger.logEvent({
        type: SecurityEventType.ACCESS_DENIED,
        severity: 'HIGH',
        userId,
        userEmail,
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
        endpoint: req.originalUrl,
        success: false,
        details: { reason: 'No profile data available' },
      });
      return res.status(403).json({
        message: 'Acesso negado. Perfil de usuário não encontrado.',
        code: 'NO_PROFILE_DATA',
      });
    }

    // Track the current token for this user via distributed cache (for token rotation)
    await trackUserToken(userId, token);

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
export async function extractRoleFromToken(token: string): Promise<string | null> {
  try {
    const { createServerSupabaseAdminClient } = await import('./supabase');
    const supabase = createServerSupabaseAdminClient();
    const { data, error } = await supabase.auth.getUser(token);

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
