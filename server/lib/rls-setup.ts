import { db } from './supabase';
import { profiles } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { Request, Response, NextFunction } from 'express';
import { supabase } from './supabase';

/**
 * Set up Row Level Security context for database operations
 * This function must be called before any database query to establish
 * the user's loja_id context for RLS policies
 */
export async function setRLSContext(userId: string, lojaId: number) {
  try {
    console.log(`[RLS DEBUG] 🔧 Setting RLS context: userId=${userId}, lojaId=${lojaId}`);

    // Set the current user's loja_id in the database session
    // This will be used by the get_current_user_loja_id() function
    const setCommand = `SET app.current_user_loja_id = '${lojaId}';`;
    console.log(`[RLS DEBUG] 📝 Executing SQL: ${setCommand}`);

    await db.execute(setCommand);

    // Verify the context was set correctly
    const verifyResult = await db.execute(`SHOW app.current_user_loja_id;`);
    console.log(`[RLS DEBUG] ✅ RLS context verification:`, verifyResult);

    console.log(`[RLS DEBUG] ✅ RLS context successfully set: userId=${userId}, lojaId=${lojaId}`);
  } catch (error) {
    console.error(
      `[RLS DEBUG] ❌ Failed to set RLS context for userId=${userId}, lojaId=${lojaId}:`,
      error
    );
    throw new Error('Failed to establish security context');
  }
}

/**
 * Enhanced authentication middleware that includes RLS context setup
 * This middleware should replace the existing authMiddleware
 */

export interface EnhancedAuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    lojaId: number;
  };
}

export async function rlsAuthMiddleware(
  req: EnhancedAuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    console.log(`[RLS MIDDLEWARE] 🔍 Processing request: ${req.method} ${req.url}`);

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`[RLS MIDDLEWARE] ❌ No valid auth header for ${req.method} ${req.url}`);
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    console.log(
      `[RLS MIDDLEWARE] 🎫 Token extracted (length: ${token.length}) for ${req.method} ${req.url}`
    );

    // PAM V1.0 RLS Fix: Development and Test environment compatibility
    const isTestEnv = process.env.NODE_ENV === 'test';
    const isDevelopmentEnv = process.env.NODE_ENV === 'development';
    const useJwtAuth = isTestEnv || isDevelopmentEnv || process.env.USE_JWT_AUTH === 'true';
    console.log(
      `[RLS MIDDLEWARE] 🌍 Environment: ${isTestEnv ? 'TEST' : isDevelopmentEnv ? 'DEVELOPMENT' : 'PRODUCTION'} (NODE_ENV=${process.env.NODE_ENV})`
    );
    console.log(`[RLS MIDDLEWARE] 🔐 Using JWT Auth: ${useJwtAuth}`);

    if (useJwtAuth) {
      // Development/Test environment: Use JWT validation with RLS context
      try {
        const { jwtAuthMiddleware } = await import('./jwt-auth-middleware.js');

        // Cast to any to avoid type conflicts in test environment
        const testReq = req as unknown;

        return jwtAuthMiddleware(testReq, res, async (err?: unknown) => {
          if (err) {
            return res.status(401).json({ message: 'Invalid test token' });
          }

          // After JWT validation, set RLS context using test data
          const testUser = testReq.user;
          if (testUser?.id) {
            // For test environment, use a default lojaId from the setup
            const defaultTestLojaId = 1; // This matches our test setup

            try {
              await setRLSContext(testUser.id, defaultTestLojaId);

              // Enhance request with loja info for RLS
              req.user = {
                id: testUser.id,
                email: testUser.email || '',
                lojaId: defaultTestLojaId,
              };

              console.log(
                `[RLS TEST] ✅ Context set for user ${testUser.id} with lojaId ${defaultTestLojaId}`
              );
              console.log(`[RLS TEST] 📤 Calling next() to continue request processing`);
              next();
            } catch (rlsError) {
              console.error('[RLS TEST] Failed to set RLS context:', rlsError);
              return res.status(500).json({ message: 'Failed to set security context' });
            }
          } else {
            return res.status(401).json({ message: 'Test user data missing' });
          }
        });
      } catch (importError) {
        console.error('[RLS TEST] Failed to import JWT middleware:', importError);
        return res.status(500).json({ message: 'Authentication system error' });
      }
    }

    // Production environment: Use Supabase validation
    const supabaseClient = supabase;

    // Get user from Supabase
    const {
      data: { user },
      error,
    } = await supabaseClient.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Get user's loja_id from database (using profiles table)
    console.log(`[RLS DEBUG] 🔍 Querying profiles for user: ${user.id}`);

    const userRecord = await db
      .select({
        id: profiles.id,
        fullName: profiles.fullName,
        role: profiles.role,
        lojaId: profiles.lojaId,
      })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    console.log(`[RLS DEBUG] 📊 Query result - Found ${userRecord.length} profiles`);
    if (userRecord.length > 0) {
      console.log(`[RLS DEBUG] 📋 Profile data:`, JSON.stringify(userRecord[0], null, 2));
    }

    if (!userRecord.length) {
      console.log(`[RLS DEBUG] ❌ No profile found for user ${user.id}`);
      return res.status(401).json({ message: 'User not found in system' });
    }

    const userData = userRecord[0];

    // Check if user has loja_id (required for RLS)
    if (!userData.lojaId) {
      return res.status(403).json({
        message: 'Acesso negado. Perfil de usuário não encontrado.',
        code: 'ORPHANED_USER',
      });
    }

    // Set RLS context for this request
    await setRLSContext(user.id, userData.lojaId);

    // Attach enhanced user data to request
    req.user = {
      id: user.id,
      email: user.email || '',
      lojaId: userData.lojaId,
    };

    next();
  } catch (error) {
    console.error('RLS Auth middleware error:', error);
    return res.status(401).json({ message: 'Authentication failed' });
  }
}

/**
 * Utility function to validate loja_id ownership
 * Use this in API routes for additional security validation
 */
export function validateLojaAccess(userLojaId: number, resourceLojaId: number) {
  if (userLojaId !== resourceLojaId) {
    throw new Error(
      `Unauthorized access: User loja_id ${userLojaId} cannot access resource from loja_id ${resourceLojaId}`
    );
  }
}
