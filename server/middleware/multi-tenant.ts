import { Request, Response, NextFunction } from 'express';
import { db } from '../lib/supabase';
import { users, gerenteLojas } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Multi-tenant security middleware
 * Sets the database session context for Row Level Security
 */
export interface MultiTenantRequest extends Request {
  user?: {
    id: string;
    email: string;
    lojaId: number;
    parceiroId?: number;
  };
}

export async function multiTenantMiddleware(
  req: MultiTenantRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user?.email) {
      return res.status(401).json({ message: 'User context not found' });
    }

    // Get user's loja_id from database via gerente_lojas junction table
    const userRecord = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        lojaId: gerenteLojas.lojaId,
      })
      .from(users)
      .leftJoin(gerenteLojas, eq(users.id, gerenteLojas.gerenteId))
      .where(eq(users.email, req.user.email))
      .limit(1);

    if (!userRecord.length) {
      return res.status(401).json({ message: 'User not found in system' });
    }

    const userData = userRecord[0];

    // Handle case where user might not have a loja assigned
    const lojaId = userData.lojaId || 1; // Default to loja 1 if no assignment

    // Set database session context for RLS
    await db.execute(`SET LOCAL app.current_user_loja_id = '${lojaId}';`);
    await db.execute(`SET LOCAL app.current_user_email = '${req.user!.email}';`);
    await db.execute(`SET LOCAL app.current_user_id = '${userData.id}';`);
    await db.execute(`SET LOCAL app.current_user_role = '${userData.role}';`);

    // Enhance request with complete user context
    req.user = {
      ...req.user!,
      lojaId: lojaId,
    };

    console.log(
      `Multi-tenant context set: userId=${req.user!.id}, lojaId=${lojaId}, email=${req.user!.email}`
    );

    next();
  } catch (error) {
    console.error('Multi-tenant middleware error:', error);
    return res.status(500).json({ message: 'Failed to establish security context' });
  }
}

/**
 * Validation function to ensure resources belong to user's loja
 */
export function validateResourceAccess(
  userLojaId: number,
  resourceLojaId: number,
  resourceType: string
) {
  if (userLojaId !== resourceLojaId) {
    throw new Error(
      `Access denied: Cannot access ${resourceType} from loja_id ${resourceLojaId} (user belongs to loja_id ${userLojaId})`
    );
  }
}
