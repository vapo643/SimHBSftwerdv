import { Request, Response, NextFunction } from "express";
import { db } from "../lib/supabase";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

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
      return res.status(401).json({ message: "User context not found" });
    }

    // Get user's loja_id from database
    const userRecord = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        lojaId: users.lojaId,
        role: users.role,
      })
      .from(users)
      .where(eq(users.email, req.user.email))
      .limit(1);

    if (!userRecord.length) {
      return res.status(401).json({ message: "User not found in system" });
    }

    const userData = userRecord[0];

    // Set database session context for RLS
    await db.execute(
      `SET LOCAL app.current_user_loja_id = '${userData.lojaId}';`
    );

    await db.execute(
      `SET LOCAL app.current_user_email = '${req.user.email}';`
    );

    // Enhance request with complete user context
    req.user = {
      ...req.user,
      lojaId: userData.lojaId,
    };

    console.log(`Multi-tenant context set: userId=${req.user.id}, lojaId=${userData.lojaId}, email=${req.user.email}`);

    next();
  } catch (error) {
    console.error("Multi-tenant middleware error:", error);
    return res.status(500).json({ message: "Failed to establish security context" });
  }
}

/**
 * Validation function to ensure resources belong to user's loja
 */
export function validateResourceAccess(userLojaId: number, resourceLojaId: number, resourceType: string) {
  if (userLojaId !== resourceLojaId) {
    throw new Error(
      `Access denied: Cannot access ${resourceType} from loja_id ${resourceLojaId} (user belongs to loja_id ${userLojaId})`
    );
  }
}