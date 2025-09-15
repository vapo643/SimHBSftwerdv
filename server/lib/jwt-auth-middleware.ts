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
// RATE LIMITING COMPLETAMENTE DESABILITADO POR SOLICITAÇÃO DO USUÁRIO
// Configuração dummy para manter compatibilidade
const isDevelopment = process.env.NODE_ENV === 'development';
const MAX_AUTH_ATTEMPTS = 999999999; // Efetivamente infinito 
const AUTH_WINDOW_MS = 1 * 60 * 1000; // Irrelevante, mas mantém compatibilidade
const AUTH_ATTEMPTS_TTL = 1; // Mínimo possível

// ===== 🛡️ CIRCUIT BREAKER DESABILITADO =====
// CIRCUIT BREAKER COMPLETAMENTE DESABILITADO POR SOLICITAÇÃO DO USUÁRIO
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 999999999; // Efetivamente infinito
const CIRCUIT_BREAKER_WINDOW_MS = 60 * 1000; // Mantido por compatibilidade
const CIRCUIT_BREAKER_COOLDOWN_MS = 1; // Mínimo possível
const CIRCUIT_BREAKER_TTL = 1; // Mínimo possível

// Monitor de falhas em memória para circuit breaker
const failureTracker = new Map<string, { failures: number; lastFailure: number; blockedUntil?: number }>();

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
 * 🛡️ PAM V1.0: Circuit Breaker - Verifica se IP está bloqueado por falhas excessivas
 */
function checkCircuitBreaker(clientIP: string): boolean {
  const now = Date.now();
  const entry = failureTracker.get(clientIP);
  
  if (!entry) {
    return true; // Sem histórico, permitir
  }
  
  // Limpar falhas antigas (fora da janela)
  if (now - entry.lastFailure > CIRCUIT_BREAKER_WINDOW_MS) {
    failureTracker.delete(clientIP);
    return true; // Falhas antigas, permitir
  }
  
  // Verificar se está em período de bloqueio
  if (entry.blockedUntil && now < entry.blockedUntil) {
    console.log(`[CIRCUIT BREAKER] 🚫 IP ${clientIP} bloqueado até ${new Date(entry.blockedUntil).toISOString()}`);
    return false; // Ainda bloqueado
  }
  
  // Se passou do período de bloqueio, limpar entrada
  if (entry.blockedUntil && now >= entry.blockedUntil) {
    failureTracker.delete(clientIP);
    console.log(`[CIRCUIT BREAKER] ✅ IP ${clientIP} liberado após cooldown`);
    return true;
  }
  
  return true; // Permitir por padrão
}

/**
 * 🛡️ PAM V1.0: Circuit Breaker - Registra falha de autenticação
 */
function recordAuthFailure(clientIP: string): void {
  const now = Date.now();
  const entry = failureTracker.get(clientIP) || { failures: 0, lastFailure: 0 };
  
  // Se a falha está fora da janela, resetar contador
  if (now - entry.lastFailure > CIRCUIT_BREAKER_WINDOW_MS) {
    entry.failures = 1;
  } else {
    entry.failures += 1;
  }
  
  entry.lastFailure = now;
  
  // Verificar se atingiu o threshold para ativar circuit breaker
  if (entry.failures >= CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
    entry.blockedUntil = now + CIRCUIT_BREAKER_COOLDOWN_MS;
    console.log(`[CIRCUIT BREAKER] 🚨 IP ${clientIP} BLOQUEADO por ${CIRCUIT_BREAKER_COOLDOWN_MS/1000}s após ${entry.failures} falhas`);
    
    securityLogger.logEvent({
      type: SecurityEventType.ACCESS_DENIED,
      severity: 'HIGH',
      ipAddress: clientIP,
      success: false,
      details: { 
        reason: 'Circuit breaker activated - too many auth failures',
        failures: entry.failures,
        cooldownMs: CIRCUIT_BREAKER_COOLDOWN_MS
      },
    });
  } else {
    console.log(`[CIRCUIT BREAKER] ⚠️ IP ${clientIP} falha ${entry.failures}/${CIRCUIT_BREAKER_FAILURE_THRESHOLD}`);
  }
  
  failureTracker.set(clientIP, entry);
}

/**
 * 🛡️ PAM V1.0: Circuit Breaker - Limpeza periódica de entradas antigas
 */
function cleanupCircuitBreakerEntries(): void {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [ip, entry] of failureTracker.entries()) {
    // Remover entradas antigas ou que passaram do período de bloqueio
    if (now - entry.lastFailure > CIRCUIT_BREAKER_WINDOW_MS || 
        (entry.blockedUntil && now > entry.blockedUntil + CIRCUIT_BREAKER_WINDOW_MS)) {
      failureTracker.delete(ip);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`[CIRCUIT BREAKER] 🧹 Limpeza: ${cleaned} entradas removidas`);
  }
}

// Limpeza automática a cada 5 minutos
setInterval(cleanupCircuitBreakerEntries, 5 * 60 * 1000);

/**
 * Distributed rate limiting for authentication attempts using Redis
 */
async function checkAuthRateLimit(identifier: string): Promise<boolean> {
  try {
    const redis = await getRedisClientLazy();
    
    // OPERAÇÃO FÊNIX: Graceful degradation para falha Redis
    if (!redis || redis.status !== 'ready') {
      console.error('[REDIS OFFLINE] Rate limit check skipped - graceful degradation');
      return true; // Allow authentication to continue
    }
    
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
    
    // OPERAÇÃO FÊNIX: Graceful degradation para falha Redis
    if (!redis || redis.status !== 'ready') {
      console.error('[REDIS OFFLINE] Blacklist add skipped - graceful degradation');
      return; // Skip Redis operations but don't throw error
    }
    
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
    const redis = await getRedisClientLazy();
    
    // OPERAÇÃO FÊNIX: Graceful degradation para falha Redis
    if (!redis || redis.status !== 'ready') {
      console.error('[REDIS OFFLINE] Token invalidation skipped - graceful degradation');
      return; // Skip Redis operations but don't throw error
    }
    
    // Get all tokens for user from Redis set
    const tokens = await redis.smembers(`user_tokens:${userId}`);

    if (tokens.length > 0) {
      // Add each token to blacklist
      const blacklistPromises = tokens.map((token: string) =>
        redis.setex(`blacklist:${token}`, TOKEN_BLACKLIST_TTL, '1')
      );

      // Remove the user tokens set
      await Promise.all([...blacklistPromises, redis.del(`user_tokens:${userId}`)]);

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
    const redis = await getRedisClientLazy();
    
    // OPERAÇÃO FÊNIX: Graceful degradation para falha Redis
    if (!redis || redis.status !== 'ready') {
      console.error('[REDIS OFFLINE] Token tracking skipped - graceful degradation');
      return; // Skip Redis operations but don't throw error
    }
    
    // Add token to user's Redis set with TTL matching token cache
    await redis.sadd(`user_tokens:${userId}`, token);
    await redis.expire(`user_tokens:${userId}`, CACHE_TTL_SECONDS);
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

    // 🛡️ PAM V1.0: CIRCUIT BREAKER CHECK - Primeira linha de defesa
    const clientIP = getClientIP(req);
    const circuitBreakerAllowed = checkCircuitBreaker(clientIP);
    
    if (!circuitBreakerAllowed) {
      console.log(`[CIRCUIT BREAKER] 🚫 Requisição bloqueada para IP: ${clientIP}`);
      return res.status(429).json({ 
        message: 'Muitas falhas de autenticação. Acesso temporariamente bloqueado. Tente novamente em alguns minutos.',
        code: 'CIRCUIT_BREAKER_ACTIVE'
      });
    }

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
      
      // 🛡️ PAM V1.0: Registrar falha de autenticação no circuit breaker
      recordAuthFailure(clientIP);
      
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
    // clientIP já foi declarado anteriormente na linha 329
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
      // OPERAÇÃO FÊNIX: Verificação crítica Redis antes de pipeline
      const redis = await getRedisClientLazy();
      if (!redis || redis.status !== 'ready') {
        console.error('[REDIS OFFLINE] Blacklist and cache check skipped - graceful degradation');
        // Continue with authentication flow without Redis
      } else {
        const pipeline = redis.pipeline();
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
      }
    } catch (redisError) {
      console.error('[REDIS OFFLINE] Pipeline failed - graceful degradation:', redisError);
      // OPERAÇÃO FÊNIX: Não tentar fallback individual se Redis está offline
      // Continue sem blacklist check - authentication prossegue normalmente
    }

    // Check blacklist result
    if (isBlacklisted) {
      // 🛡️ PAM V1.0: Registrar falha de autenticação no circuit breaker
      recordAuthFailure(clientIP);
      
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

    // CORREÇÃO DEFINITIVA: SEMPRE usar JWT local - Supabase desabilitado
    // Configuração explicita para evitar problemas de "Auth session missing!"
    let tokenType: 'supabase' | 'local' = 'local';
    const forceLocalJWT = true; // SEMPRE forçar JWT local
    
    console.log('[JWT DEBUG] FORCE LOCAL JWT - Supabase DISABLED for this environment');

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
    } else if (false) { // Supabase branch permanently disabled
      // BRANCH DISABLED - SEMPRE usar JWT local agora
      console.log('[JWT DEBUG] ERROR: Supabase branch should never execute!');
      error = { message: 'Internal error: Supabase validation disabled' };
      data = null;
    } else {
      // Use local JWT validation for local tokens
      try {
        console.log('[JWT DEBUG] Using local JWT validation');
        const jwt = await import('jsonwebtoken');
        const { getJwtSecret } = await import('./config');
        const JWT_SECRET = getJwtSecret();

        // 🔍 OPERAÇÃO PHOENIX - DIAGNÓSTICO CRÍTICO
        console.log(`[PHOENIX DEBUG] JWT_SECRET length: ${JWT_SECRET.length}`);
        console.log(`[PHOENIX DEBUG] Token first 50 chars: ${token.substring(0, 50)}...`);
        
        // Decodificar token SEM verificação para ver o conteúdo
        const decoded_no_verify = jwt.default.decode(token) as any;
        if (decoded_no_verify) {
          console.log('[PHOENIX DEBUG] Token claims (unverified):', {
            iss: decoded_no_verify.iss,
            aud: decoded_no_verify.aud,
            exp: decoded_no_verify.exp,
            sub: decoded_no_verify.sub,
            algorithm: decoded_no_verify.alg || 'not specified'
          });
          
          // Extrair PROJECT_ID do issuer
          if (decoded_no_verify.iss) {
            const projectMatch = decoded_no_verify.iss.match(/https:\/\/([^.]+)\.supabase\.co/);
            if (projectMatch) {
              console.log(`[PHOENIX DEBUG] 🚨 FRONTEND PROJECT ID: ${projectMatch[1]}`);
              console.log(`[PHOENIX DEBUG] 🚨 VERIFIQUE SE O SUPABASE_JWT_SECRET É DESTE PROJETO!`);
            }
          }
        }
        
        // Tentar verificação com log detalhado de erro
        try {
          const decoded = jwt.default.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as any;
          console.log('[PHOENIX DEBUG] ✅ JWT verification SUCCESS:', {
            userId: decoded.userId || decoded.sub,
            email: decoded.email,
            role: decoded.role,
          });
        } catch (verifyError: any) {
          console.log(`[PHOENIX DEBUG] ❌ JWT verification FAILED: ${verifyError.message}`);
          console.log(`[PHOENIX DEBUG] ❌ Error name: ${verifyError.name}`);
          if (verifyError.name === 'JsonWebTokenError') {
            console.log('[PHOENIX DEBUG] 🚨 SIGNATURE MISMATCH - JWT_SECRET provavelmente está errado!');
          }
          throw verifyError;
        }
        
        const decoded = jwt.default.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as any;

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
      
      // 🛡️ PAM V1.0: Registrar falha de autenticação no circuit breaker
      recordAuthFailure(clientIP);
      
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
      if (!db) {
        console.error('[JWT AUTH] Database not available - cannot fetch profile');
        return res.status(500).json({ message: 'Erro interno de banco de dados' });
      }
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
